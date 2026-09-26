"""HTTP API for research runs and tool connections (capabilities `research`, `research.connectors`).

Every route resolves the caller from `request.state.user` (see auth.py) and only ever
touches records that caller owns. See docs/API-CONTRACT.md for shapes.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from html import escape
from typing import Annotated, Literal
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from pydantic import BaseModel, Field, field_validator

from .. import connectors, oauth, store
from ..secrets import public_provider
from ..tools import academic, registry, web
from ..tools import mcp as mcp_tools
from ..tools.base import ToolContext, ToolError
from . import engine, export
from . import store as rstore

router = APIRouter()
MAX_ACTIVE_RUNS = 3
DOMAIN = re.compile(r"^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$")


def owner_of(request: Request) -> str:
    user = getattr(request.state, "user", None) or {}
    return str(user.get("id") or "local")


def _run(con, owner: str, run_id: str) -> dict:
    run = rstore.load(con, run_id)
    if run is None or run["owner"] != owner:
        raise HTTPException(404, "Research run not found")
    return run


def _http_url(value: str, *, label: str) -> str:
    parts = urlsplit(value.strip())
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ValueError(f"Enter a complete http(s) {label} URL")
    if parts.username or parts.password:
        raise ValueError("Keep credentials out of the URL")
    local = parts.hostname in ("localhost", "127.0.0.1", "::1", "host.docker.internal")
    if (
        parts.scheme == "http"
        and not local
        and os.environ.get("RESEARCH_ALLOW_PRIVATE_NETWORK") != "1"
    ):
        raise ValueError(f"Use HTTPS for a remote {label}")
    return value.strip().rstrip("/")


# ------------------------------------------------------------------ inputs


class RunInput(BaseModel):
    question: str = Field(min_length=3, max_length=4000)
    depth: Literal["quick", "standard", "deep"] = "standard"
    model_id: str = Field(min_length=1, max_length=100)
    writer_model_id: str | None = Field(default=None, max_length=100)
    sources: list[str] = Field(min_length=1, max_length=20)
    plan_first: bool = True
    max_cost: float | None = Field(default=None, gt=0, le=1000)


class SubQuestion(BaseModel):
    question: str = Field(min_length=3, max_length=400)
    approach: str = Field(default="", max_length=400)


class PlanInput(BaseModel):
    action: Literal["approve", "replan"]
    sub_questions: list[SubQuestion] | None = Field(default=None, max_length=8)
    answers: str = Field(default="", max_length=4000)


class SteerInput(BaseModel):
    text: str = Field(min_length=2, max_length=1000)


class ApprovalInput(BaseModel):
    decision: Literal["allow", "deny", "always"]


class ConnectorUpdate(BaseModel):
    enabled: bool | None = None
    name: str | None = Field(default=None, min_length=1, max_length=80)
    provider: Literal["", "searxng", "tavily", "brave"] | None = None
    base_url: str | None = Field(default=None, max_length=500)
    api_key: str | None = Field(default=None, max_length=4096)
    price_per_1k: float | None = Field(default=None, ge=0, le=1000)
    allowed_domains: list[str] | None = Field(default=None, max_length=100)
    blocked_domains: list[str] | None = Field(default=None, max_length=200)
    databases: list[Literal["openalex", "arxiv", "semantic_scholar", "pubmed"]] | None = None
    token: str | None = Field(default=None, max_length=8192)
    client_id: str | None = Field(default=None, max_length=300)
    client_secret: str | None = Field(default=None, max_length=1000)
    permissions: dict[str, Literal["allow", "ask", "block"]] | None = None

    @field_validator("allowed_domains", "blocked_domains")
    @classmethod
    def domains(cls, values):
        if values is None:
            return values
        cleaned = [v.strip().lower().removeprefix("www.") for v in values if v.strip()]
        bad = [v for v in cleaned if not DOMAIN.match(v)]
        if bad:
            raise ValueError(f"Not a domain: {', '.join(bad[:3])}")
        return list(dict.fromkeys(cleaned))


class McpInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    url: str = Field(min_length=8, max_length=500)
    auth: Literal["none", "bearer", "oauth"] = "none"
    token: str = Field(default="", max_length=8192)
    client_id: str = Field(default="", max_length=300)
    client_secret: str = Field(default="", max_length=1000)

    @field_validator("url")
    @classmethod
    def url_ok(cls, value):
        return _http_url(value, label="MCP server")


# ------------------------------------------------------------------ runs


def _summary(run: dict) -> dict:
    keys = (
        "id",
        "title",
        "question",
        "status",
        "depth",
        "createdAt",
        "updatedAt",
        "counts",
        "error",
    )
    return {k: run.get(k) for k in keys}


def _models(con) -> list[dict]:
    return [
        {"id": p["id"], "label": p["label"], "supports_tools": p.get("supports_tools")}
        for p in (public_provider(x) for x in store.all_records(con, "provider"))
    ]


@router.get("/research/options")
def options(request: Request):
    owner = owner_of(request)
    with store.db() as con:
        return {
            "depths": {k: {**vars(v)} for k, v in engine.DEPTHS.items()},
            "sources": registry.available_sources(con, owner),
            "models": _models(con),
        }


@router.get("/research/runs")
def list_runs(request: Request):
    with store.db() as con:
        return [_summary(r) for r in rstore.list_for(con, owner_of(request))]


def _check_model(con, model_id: str) -> None:
    provider = store.get(con, "provider", model_id)
    if provider is None:
        raise HTTPException(404, "Model connection not found")
    if provider.get("supports_tools") is False:
        raise HTTPException(
            422,
            f"{provider['label']} did not pass the tool-use test. Pick another model or "
            "re-run Test connection under LLMs.",
        )


@router.post("/research/runs")
async def create_run(body: RunInput, request: Request):
    owner = owner_of(request)
    with store.db() as con:
        _check_model(con, body.model_id)
        if body.writer_model_id:
            _check_model(con, body.writer_model_id)
        valid = {s["id"] for s in registry.available_sources(con, owner)}
        unknown = [s for s in body.sources if s not in valid]
        if unknown:
            raise HTTPException(422, "Unknown source: " + ", ".join(unknown))
        ready = [s["id"] for s in registry.available_sources(con, owner) if s["ready"]]
        if not set(body.sources) & set(ready):
            raise HTTPException(422, "None of the chosen sources is ready. Set one up under Tools.")
        active = [r for r in rstore.list_for(con, owner) if r["status"] in rstore.ACTIVE]
        if len(active) >= MAX_ACTIVE_RUNS:
            raise HTTPException(429, "Three research runs are already running. Wait or stop one.")
        settings = store.get(con, "settings", "local") or {"daily_request_limit": 200}
        today = store.now()[:10]
        used = (
            con.execute(
                "SELECT count(*) FROM generations WHERE created_at>=?", (today,)
            ).fetchone()[0]
            + con.execute(
                "SELECT count(*) FROM research_runs WHERE owner=? AND created_at>=?", (owner, today)
            ).fetchone()[0]
        )
        if used >= settings["daily_request_limit"]:
            raise HTTPException(
                429, "Daily request limit reached. Adjust it in Workspace settings."
            )
        depth = engine.DEPTHS[body.depth]
        run = {
            "id": store.uid(),
            "owner": owner,
            "title": body.question[:80],
            "question": body.question.strip(),
            "depth": body.depth,
            "model_id": body.model_id,
            "writer_model_id": body.writer_model_id,
            "sources": [s for s in body.sources if s in ready],
            "plan_first": body.plan_first,
            "answers": "",
            "plan": None,
            "status": "planning",
            "createdAt": store.now(),
            "budget": {
                "max_calls": depth.max_calls,
                "minutes": depth.minutes,
                "max_cost": body.max_cost,
            },
            "usage": {"input": 0, "output": 0, "cost": 0.0, "unpriced": False},
            "counts": {"tool_calls": 0, "sources_found": 0, "sources_read": 0},
            "steer": [],
            "pending_approvals": [],
            "report": "",
            "citation_check": None,
            "warning": "",
            "error": "",
        }
        rstore.save(con, run)
    engine.start(run["id"])
    return run


@router.get("/research/runs/{run_id}")
def get_run(run_id: str, request: Request):
    with store.db() as con:
        run = _run(con, owner_of(request), run_id)
        return {
            **run,
            "sources_list": rstore.sources(con, run_id),
            "last_seq": con.execute(
                "SELECT COALESCE(MAX(seq),0) FROM research_events WHERE run_id=?", (run_id,)
            ).fetchone()[0],
        }


@router.delete("/research/runs/{run_id}")
async def delete_run(run_id: str, request: Request):
    with store.db() as con:
        _run(con, owner_of(request), run_id)
    await engine.cancel(run_id)
    with store.db() as con:
        rstore.delete(con, run_id)
    return {"ok": True}


@router.post("/research/runs/{run_id}/plan")
async def plan(run_id: str, body: PlanInput, request: Request):
    with store.db() as con:
        run = _run(con, owner_of(request), run_id)
        if run["status"] != "awaiting_approval":
            raise HTTPException(409, "This run is not waiting for plan approval.")
        run["answers"] = body.answers.strip()
        if body.action == "replan":
            run["plan"] = None
        elif body.sub_questions is not None:
            if not body.sub_questions:
                raise HTTPException(422, "Keep at least one sub-question.")
            run["plan"]["sub_questions"] = [
                {"id": store.uid(), "question": s.question.strip(), "approach": s.approach.strip()}
                for s in body.sub_questions
            ]
        run["status"] = "planning" if body.action == "replan" else "researching"
        rstore.save(con, run)
        rstore.add_event(
            con, run_id, "plan_" + ("replanned" if body.action == "replan" else "approved"), {}
        )
    engine.start(run_id)
    return run


@router.post("/research/runs/{run_id}/steer")
def steer(run_id: str, body: SteerInput, request: Request):
    with store.db() as con:
        run = _run(con, owner_of(request), run_id)
        if run["status"] not in ("planning", "researching", "awaiting_approval"):
            raise HTTPException(409, "Instructions can only be added while the run is researching.")
        item = {"id": store.uid(), "text": body.text.strip(), "at": store.now(), "applied": False}
        run.setdefault("steer", []).append(item)
        rstore.save(con, run)
        rstore.add_event(con, run_id, "steer_received", item)
    return item


@router.post("/research/runs/{run_id}/cancel")
async def cancel(run_id: str, request: Request):
    with store.db() as con:
        run = _run(con, owner_of(request), run_id)
    if engine.running(run_id):
        await engine.cancel(run_id)
    elif run["status"] not in rstore.TERMINAL:
        with store.db() as con:
            run["status"] = "cancelled"
            rstore.save(con, run)
            rstore.add_event(con, run_id, "status", {"status": "cancelled"})
    return {"ok": True}


@router.post("/research/runs/{run_id}/approvals/{call_id}")
def approve(run_id: str, call_id: str, body: ApprovalInput, request: Request):
    with store.db() as con:
        _run(con, owner_of(request), run_id)
    if not engine.decide(run_id, call_id, body.decision):
        raise HTTPException(409, "That request is no longer waiting for a decision.")
    return {"ok": True}


@router.post("/research/runs/{run_id}/rerun")
async def rerun(run_id: str, request: Request):
    with store.db() as con:
        old = _run(con, owner_of(request), run_id)
    body = RunInput(
        question=old["question"],
        depth=old["depth"],
        model_id=old["model_id"],
        writer_model_id=old.get("writer_model_id"),
        sources=old["sources"],
        plan_first=old.get("plan_first", True),
        max_cost=old["budget"].get("max_cost"),
    )
    return await create_run(body, request)


def _sse(kind: str, data: dict) -> str:
    return f"event: {kind}\ndata: {json.dumps(data)}\n\n"


@router.get("/research/runs/{run_id}/events")
async def events(run_id: str, request: Request, after: Annotated[int, Query(ge=0)] = 0):
    """Server-sent events from `after` onwards. Ends when the run stops or awaits approval."""
    with store.db() as con:
        _run(con, owner_of(request), run_id)

    async def stream():
        last, idle = after, 0
        while not await request.is_disconnected():
            with store.db() as con:
                rows = rstore.events_after(con, run_id, last)
                run = rstore.load(con, run_id)
            for row in rows:
                last = row["seq"]
                yield _sse(row["type"], {"seq": row["seq"], "at": row["at"], "data": row["data"]})
            if run is None:
                break
            waiting = run["status"] == "awaiting_approval" and not engine.running(run_id)
            if not rows and (run["status"] in rstore.TERMINAL or waiting):
                yield _sse("end", {"seq": last, "status": run["status"]})
                break
            idle = 0 if rows else idle + 1
            if idle and idle % 25 == 0:
                yield ": heartbeat\n\n"
            await asyncio.sleep(0.4)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )


@router.get("/research/runs/{run_id}/export")
def export_run(run_id: str, request: Request, format: Literal["md", "docx"] = "md"):
    with store.db() as con:
        run = _run(con, owner_of(request), run_id)
        sources = rstore.sources(con, run_id)
    if not run.get("report"):
        raise HTTPException(409, "This run has no report yet.")
    name = re.sub(r"[^\w -]", "", run.get("title") or "research").strip()[:70] or "research"
    if format == "docx":
        return Response(
            export.docx(run, sources),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{name}.docx"'},
        )
    return Response(
        export.markdown(run, sources),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}.md"'},
    )


@router.post("/research/runs/{run_id}/chat")
def continue_in_chat(run_id: str, request: Request):
    """Open a normal chat that already contains the question and the report."""
    with store.db() as con:
        run = _run(con, owner_of(request), run_id)
        if not run.get("report"):
            raise HTTPException(409, "This run has no report yet.")
        report = export.markdown(run, rstore.sources(con, run_id))
        return store.put(
            con,
            "conversation",
            {
                "id": store.uid(),
                "title": (run.get("title") or run["question"])[:150],
                "model": run["model_id"],
                "projectId": None,
                "archived": False,
                "pinned": False,
                "summary": f"Continues research run {run_id}. The report is the first answer.",
                "messages": [
                    {
                        "id": store.uid(),
                        "role": "user",
                        "text": run["question"],
                        "timestamp": store.now(),
                    },
                    {
                        "id": store.uid(),
                        "role": "assistant",
                        "text": report,
                        "timestamp": store.now(),
                        "state": "ready",
                        "result": {"generationLabel": "Research report", "sources": []},
                    },
                ],
                "preview": report[:120],
                "updatedAt": store.now(),
            },
        )


# ------------------------------------------------------------------ connectors


@router.get("/connectors")
def list_connectors(request: Request):
    owner = owner_of(request)
    with store.db() as con:
        return {
            "connectors": [connectors.public(c) for c in connectors.all_for(con, owner)],
            "usage": rstore.tool_summary(con, owner),
            "search_providers": web.SEARCH_PROVIDERS,
            "academic_databases": academic.DATABASES,
            "redirect_uri": oauth.redirect_uri(),
        }


def _apply(item: dict, body: ConnectorUpdate) -> None:
    if body.enabled is not None:
        item["enabled"] = body.enabled
    if body.name is not None and item["type"] == "mcp":
        item["name"] = body.name.strip()
    secrets = connectors.secrets_of(item)
    if item["key"] == "web_search":
        config = item["config"]
        if body.provider is not None:
            config["provider"] = body.provider
        if body.base_url is not None:
            config["base_url"] = _http_url(body.base_url, label="SearXNG") if body.base_url else ""
        if body.price_per_1k is not None or "price_per_1k" in body.model_fields_set:
            config["price_per_1k"] = body.price_per_1k
        if body.allowed_domains is not None:
            config["allowed_domains"] = body.allowed_domains
        if body.blocked_domains is not None:
            config["blocked_domains"] = body.blocked_domains
        if body.api_key is not None:
            secrets["api_key"] = body.api_key.strip()
    if item["key"] == "academic" and body.databases is not None:
        if not body.databases:
            raise HTTPException(422, "Keep at least one paper database.")
        item["config"]["databases"] = list(dict.fromkeys(body.databases))
    if item["type"] == "mcp":
        if body.token is not None:
            secrets["token"] = body.token.strip()
        if body.client_id is not None:
            item["config"]["client_id"] = body.client_id.strip()
        if body.client_secret is not None:
            secrets["client_secret"] = body.client_secret.strip()
    if body.permissions is not None:
        names = {t["name"] for t in item.get("tools", [])}
        unknown = [n for n in body.permissions if n not in names]
        if unknown:
            raise HTTPException(422, "Unknown tool: " + ", ".join(unknown))
        item.setdefault("permissions", {}).update(body.permissions)
    connectors.set_secrets(item, secrets)


@router.patch("/connectors/{connector_id}")
def update_connector(connector_id: str, body: ConnectorUpdate, request: Request):
    with store.db() as con:
        item = connectors.get(con, owner_of(request), connector_id)
        try:
            _apply(item, body)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        connectors.refresh_status(item)
        item["updatedAt"] = store.now()
        store.put(con, "connector", item)
        return connectors.public(item)


def _unique_slug(con, owner: str, name: str) -> str:
    taken = {c["config"].get("slug") for c in connectors.all_for(con, owner) if c["type"] == "mcp"}
    base = connectors.slug(name)
    slug, n = base, 2
    while slug in taken:
        slug, n = f"{base}_{n}", n + 1
    return slug


def _headers(item: dict) -> dict:
    secrets = connectors.secrets_of(item)
    token = (
        secrets.get("token")
        if item["config"].get("auth") == "bearer"
        else secrets.get("access_token")
    )
    return {"Authorization": "Bearer " + token} if token else {}


async def _discover_tools(con, item: dict) -> None:
    try:
        headers = _headers(item)
        if item["config"].get("auth") == "oauth" and headers:
            headers = {"Authorization": "Bearer " + await oauth.access_token(con, item)}
        item["tools"] = await mcp_tools.list_tools(item["config"]["url"], headers)
        item["status"], item["status_detail"] = (
            ("ready" if item["tools"] else "error"),
            ("" if item["tools"] else "The server lists no tools."),
        )
    except ToolError as exc:
        item["status"], item["status_detail"] = "error", str(exc)
    item["updatedAt"] = store.now()
    store.put(con, "connector", item)


@router.post("/connectors")
async def add_mcp(body: McpInput, request: Request):
    owner = owner_of(request)
    with store.db() as con:
        item = {
            "id": store.uid(),
            "key": "mcp",
            "type": "mcp",
            "owner": owner,
            "name": body.name.strip(),
            "description": "Custom MCP server",
            "enabled": True,
            "config": {
                "url": body.url,
                "auth": body.auth,
                "client_id": body.client_id.strip(),
                "slug": _unique_slug(con, owner, body.name),
            },
            "tools": [],
            "permissions": {},
            "secret": "",
            "status": "needs_auth" if body.auth == "oauth" else "needs_setup",
            "status_detail": "",
            "updatedAt": store.now(),
        }
        secrets = {}
        if body.token:
            secrets["token"] = body.token.strip()
        if body.client_secret:
            secrets["client_secret"] = body.client_secret.strip()
        connectors.set_secrets(item, secrets)
        store.put(con, "connector", item)
        if body.auth != "oauth":
            await _discover_tools(con, item)
        return connectors.public(item)


@router.delete("/connectors/{connector_id}")
def remove_connector(connector_id: str, request: Request):
    with store.db() as con:
        item = connectors.get(con, owner_of(request), connector_id)
        if item["type"] == "builtin":
            raise HTTPException(400, "Built-in tools can be turned off but not removed.")
        if item["type"] == "mcp":
            store.delete(con, "connector", connector_id)
            return {"ok": True}
        connectors.set_secrets(item, {})
        connectors.refresh_status(item)
        store.put(con, "connector", item)
        return connectors.public(item)


@router.post("/connectors/{connector_id}/test")
async def test_connector(connector_id: str, request: Request):
    owner = owner_of(request)
    with store.db() as con:
        item = connectors.get(con, owner, connector_id)
        connectors.refresh_status(item)
        try:
            if item["type"] == "mcp":
                await _discover_tools(con, item)
                if item["status"] != "ready":
                    raise ToolError(item["status_detail"] or "The server could not be reached.")
                detail = f"Connected. {len(item['tools'])} tool(s) available."
            else:
                source = next(
                    s["id"]
                    for s in registry.available_sources(con, owner)
                    if s["connector_id"] == item["id"]
                )
                async with mcp_tools.McpSessions() as sessions:
                    tools, _ = await registry.build(con, owner, [source], sessions)
                if not tools:
                    raise ToolError("Finish setting this tool up first.")
                probe = tools[0]
                result = await probe.run({"query": "renewable energy"}, ToolContext("test", owner))
                detail = f"Working: {len(result.sources)} result(s) for a test query."
            connectors.mark(con, item, "ready", "")
            return {"ok": True, "detail": detail, "connector": connectors.public(item)}
        except (ToolError, HTTPException) as exc:
            message = exc.detail if isinstance(exc, HTTPException) else str(exc)
            connectors.mark(con, item, "error", message)
            return {"ok": False, "detail": message, "connector": connectors.public(item)}


@router.post("/connectors/{connector_id}/auth/start")
async def auth_start(connector_id: str, request: Request):
    owner = owner_of(request)
    with store.db() as con:
        item = connectors.get(con, owner, connector_id)
        return {"url": await oauth.start(con, owner, item)}


_DONE_PAGE = (
    '<!doctype html><meta charset="utf-8"><title>{title}</title>'
    '<body style="font:15px system-ui;background:#212121;color:#ececec;display:grid;'
    'place-items:center;height:100vh;margin:0">'
    '<div style="text-align:center;max-width:28rem;padding:1rem">'
    '<h1 style="font-size:1.3rem">{title}</h1><p>{message}</p>'
    '<p><a style="color:#91c1ff" href="{home}">Back to the app</a></p></div>'
    "<script>try{{window.opener&&window.opener.postMessage("
    '{{type:"connector-auth",ok:{ok}}},"{origin}");setTimeout(()=>window.close(),900)}}'
    "catch(e){{}}</script></body>"
)


def _page(title: str, message: str, ok: bool) -> HTMLResponse:
    home = oauth.public_url()
    return HTMLResponse(
        _DONE_PAGE.format(
            title=escape(title),
            message=escape(message),
            home=escape(home),
            ok="true" if ok else "false",
            origin=escape(home),
        ),
        status_code=200 if ok else 400,
    )


@router.get("/connectors/oauth/callback")
async def auth_callback(state: str = "", code: str = "", error: str = ""):
    if error or not state or not code:
        return _page("Sign-in cancelled", "No changes were made. You can close this window.", False)
    with store.db() as con:
        try:
            item = await oauth.finish(con, state, code)
        except HTTPException as exc:
            return _page("Sign-in failed", str(exc.detail), False)
        if item["type"] == "mcp":
            await _discover_tools(con, item)
    return _page("Connected", f"{item['name']} is connected. You can close this window.", True)


@router.get("/tool-calls")
def list_tool_calls(
    request: Request, run_id: str | None = None, limit: Annotated[int, Query(ge=1, le=500)] = 100
):
    with store.db() as con:
        return rstore.tool_calls(con, owner_of(request), run_id, limit)
