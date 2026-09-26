"""Research runs: plan -> (approve) -> research in parallel with tools -> write -> check citations.

A run executes as a background asyncio task and records everything as it goes: status,
plan, events (for the live timeline), numbered sources, tool calls, usage and the
report. The HTTP layer (routes.py) only starts, steers and reads runs.

Budgets bound every run: tool calls, wall-clock time and (optionally) cost. When a
budget runs out the researchers stop calling tools and write up what they have, so a
run always ends with a report unless the model itself fails.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import re
import time
from dataclasses import dataclass, field

from .. import connectors, providers, store
from ..providers import ProviderError
from ..tool_calling import complete
from ..tools import mcp as mcp_tools
from ..tools import registry
from ..tools.base import Tool, ToolContext, ToolError
from . import citations, prompts
from . import store as rstore

log = logging.getLogger("research")


@dataclass(frozen=True)
class Depth:
    label: str
    sub_questions: int
    max_calls: int
    minutes: int
    turns: int  # model turns per researcher before it must write up


DEPTHS = {
    "quick": Depth("Quick", sub_questions=1, max_calls=10, minutes=4, turns=6),
    "standard": Depth("Standard", sub_questions=3, max_calls=40, minutes=12, turns=10),
    "deep": Depth("Deep", sub_questions=5, max_calls=120, minutes=30, turns=16),
}
PARALLEL_RESEARCHERS = 3
TOOL_TIMEOUT_SECONDS = 45
APPROVAL_TIMEOUT_SECONDS = 600
TOOL_OUTPUT_CHARS = 3500
CATALOG_LIMIT = 80

tasks: dict[str, asyncio.Task] = {}
approvals: dict[tuple[str, str], asyncio.Future] = {}


# ------------------------------------------------------------------ run record helpers


def _load(run_id: str) -> dict:
    with store.db() as con:
        run = rstore.load(con, run_id)
    if run is None:
        raise LookupError(run_id)
    return run


def _mutate(run_id: str, fn) -> dict:
    """Load-modify-save without awaiting in between, so concurrent researchers don't clash."""
    with store.db() as con:
        run = rstore.load(con, run_id)
        if run is None:
            raise LookupError(run_id)
        fn(run)
        return rstore.save(con, run)


def _update(run_id: str, **fields) -> dict:
    return _mutate(run_id, lambda run: run.update(fields))


def emit(run_id: str, kind: str, data: dict | None = None) -> None:
    with store.db() as con:
        rstore.add_event(con, run_id, kind, data or {})


def _set_status(run_id: str, status: str, **extra) -> None:
    _update(run_id, status=status, **extra)
    emit(
        run_id,
        "status",
        {"status": status, **({"error": extra["error"]} if extra.get("error") else {})},
    )


def _provider(model_id: str) -> dict:
    with store.db() as con:
        item = store.get(con, "provider", model_id)
    if item is None:
        raise ProviderError(
            "The model connection for this run was removed. Choose another model and re-run."
        )
    return item


def _add_usage(run_id: str, provider: dict, usage: dict) -> None:
    input_tokens, output_tokens = usage.get("input", 0) or 0, usage.get("output", 0) or 0
    cost = None
    if provider.get("input_price") is not None and provider.get("output_price") is not None:
        cost = (
            input_tokens * provider["input_price"] + output_tokens * provider["output_price"]
        ) / 1_000_000

    def apply(run):
        u = run.setdefault("usage", {"input": 0, "output": 0, "cost": 0.0, "unpriced": False})
        u["input"] += input_tokens
        u["output"] += output_tokens
        if cost is None:
            u["unpriced"] = True
        else:
            u["cost"] = round(u["cost"] + cost, 6)

    _mutate(run_id, apply)


# ------------------------------------------------------------------ budget


@dataclass
class Budget:
    calls_left: int
    deadline: float
    max_cost: float | None
    run_id: str
    exhausted_reason: str = ""

    def spent(self) -> float:
        return _load(self.run_id).get("usage", {}).get("cost", 0.0)

    def exhausted(self) -> bool:
        if self.exhausted_reason:
            return True
        if self.calls_left <= 0:
            self.exhausted_reason = "tool call budget"
        elif time.monotonic() > self.deadline:
            self.exhausted_reason = "time budget"
        elif self.max_cost is not None and self.spent() >= self.max_cost:
            self.exhausted_reason = "cost budget"
        return bool(self.exhausted_reason)


@dataclass
class Session:
    run_id: str
    owner: str
    provider: dict
    tools: dict[str, Tool]
    owners: dict[str, dict]
    ctx: ToolContext
    budget: Budget
    steer_seen: set[str] = field(default_factory=set)


# ------------------------------------------------------------------ public API


def start(run_id: str) -> None:
    task = asyncio.create_task(_execute(run_id))
    tasks[run_id] = task
    task.add_done_callback(lambda _: tasks.pop(run_id, None))


def running(run_id: str) -> bool:
    task = tasks.get(run_id)
    return bool(task and not task.done())


async def cancel(run_id: str) -> None:
    for key, future in list(approvals.items()):
        if key[0] == run_id and not future.done():
            future.set_result("deny")
    task = tasks.get(run_id)
    if task and not task.done():
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


def decide(run_id: str, call_id: str, decision: str) -> bool:
    future = approvals.get((run_id, call_id))
    if future is None or future.done():
        return False
    future.set_result(decision)
    return True


async def shutdown() -> None:
    running_tasks = list(tasks.values())
    for task in running_tasks:
        task.cancel()
    await asyncio.gather(*running_tasks, return_exceptions=True)


# ------------------------------------------------------------------ execution


async def _execute(run_id: str) -> None:
    try:
        run = _load(run_id)
        researcher = _provider(run["model_id"])
        if not run.get("plan"):
            _set_status(run_id, "planning")
            plan = await _plan(run, researcher)
            run = _update(run_id, plan=plan, title=plan["title"])
            emit(run_id, "plan", plan)
            if run.get("plan_first"):
                _set_status(run_id, "awaiting_approval")
                return
        _set_status(run_id, "researching", startedAt=store.now())
        depth = DEPTHS[run["depth"]]
        budget = Budget(
            calls_left=run["budget"]["max_calls"],
            run_id=run_id,
            deadline=time.monotonic() + run["budget"]["minutes"] * 60,
            max_cost=run["budget"].get("max_cost"),
        )
        async with mcp_tools.McpSessions() as sessions:
            with store.db() as con:
                tools, owners = await registry.build(con, run["owner"], run["sources"], sessions)
            if not tools:
                raise ProviderError(
                    "None of the chosen sources is ready. Set up a tool in the Tools panel."
                )
            web = owners.get(connectors.record_id(run["owner"], "web_search"), {}).get("config", {})
            ctx = ToolContext(
                run_id=run_id,
                owner=run["owner"],
                allowed_urls=set(_urls_in(run["question"])),
                allowed_domains=web.get("allowed_domains") or [],
                blocked_domains=web.get("blocked_domains") or [],
            )
            session = Session(
                run_id, run["owner"], researcher, {t.name: t for t in tools}, owners, ctx, budget
            )
            emit(run_id, "tools", {"tools": [{"name": t.name, "label": t.label} for t in tools]})
            # Hard stop a little after the soft deadline, in case a provider hangs.
            async with asyncio.timeout(run["budget"]["minutes"] * 60 + 240):
                findings = await _research(session, run, depth)
        if budget.exhausted_reason:
            emit(run_id, "budget", {"reason": budget.exhausted_reason})
        _set_status(run_id, "writing")
        writer = _provider(run.get("writer_model_id") or run["model_id"])
        report, warning = await _write(run_id, writer, findings)
        with store.db() as con:
            held = {s["n"]: s for s in rstore.sources(con, run_id, with_content=True)}
        check = citations.check(report, held)
        _update(
            run_id,
            report=report,
            findings=findings,
            citation_check=check,
            warning=warning,
            finishedAt=store.now(),
        )
        emit(run_id, "citations", check["totals"])
        _set_status(run_id, "completed")
    except asyncio.CancelledError:
        _set_status(run_id, "cancelled", finishedAt=store.now())
    except TimeoutError:
        _set_status(
            run_id, "failed", error="The run exceeded its time limit.", finishedAt=store.now()
        )
    except ProviderError as exc:
        _set_status(run_id, "failed", error=str(exc), finishedAt=store.now())
    except LookupError:
        pass  # run deleted while starting
    except Exception:
        log.exception("Research run %s failed", run_id)
        _set_status(
            run_id,
            "failed",
            error="Unexpected failure. Check the backend log.",
            finishedAt=store.now(),
        )


def _urls_in(text: str) -> list[str]:
    return re.findall(r"https?://[^\s\"'<>)\]]+", text)


def _parse_json(text: str) -> dict | None:
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        value = json.loads(text[start : end + 1])
    except ValueError:
        return None
    return value if isinstance(value, dict) else None


async def _plan(run: dict, provider: dict) -> dict:
    count = DEPTHS[run["depth"]].sub_questions
    labels = [s.split(":", 1)[0] for s in run["sources"]]
    user = run["question"] + (f"\n\nClarifications: {run['answers']}" if run.get("answers") else "")
    result = await complete(
        provider,
        [
            {"role": "system", "content": prompts.planner(count, labels)},
            {"role": "user", "content": user},
        ],
        None,
        max_tokens=1500,
    )
    _add_usage(run["id"], provider, result.usage)
    data = _parse_json(result.text) or {}
    subs = []
    for item in data.get("sub_questions") or []:
        question = item.get("question") if isinstance(item, dict) else item
        if isinstance(question, str) and question.strip():
            approach = item.get("approach", "") if isinstance(item, dict) else ""
            subs.append(
                {
                    "id": store.uid(),
                    "question": question.strip()[:400],
                    "approach": str(approach)[:400],
                }
            )
    if not subs:
        subs = [{"id": store.uid(), "question": run["question"][:400], "approach": ""}]
    clarify = [
        q.strip()[:300]
        for q in data.get("clarifying_questions") or []
        if isinstance(q, str) and q.strip()
    ]
    raw_title = data.get("title")
    title = raw_title.strip() if isinstance(raw_title, str) and raw_title.strip() else ""
    return {
        "title": (title or run["question"])[:120],
        "clarifying_questions": clarify[:3],
        "sub_questions": subs[:count],
    }


async def _research(session: Session, run: dict, depth: Depth) -> list[dict]:
    subs = run["plan"]["sub_questions"]
    gate = asyncio.Semaphore(PARALLEL_RESEARCHERS)

    async def one(index: int, sub: dict) -> dict:
        async with gate:
            try:
                text = await _investigate(session, run, sub, index, len(subs), depth.turns)
            except ProviderError as exc:
                text = f"Research for this part failed: {exc}"
                emit(session.run_id, "sub_failed", {"index": index, "error": str(exc)})
            return {"id": sub["id"], "question": sub["question"], "text": text}

    return list(await asyncio.gather(*(one(i + 1, s) for i, s in enumerate(subs))))


def _new_steer(session: Session) -> list[str]:
    run = _load(session.run_id)
    fresh = [s for s in run.get("steer", []) if s["id"] not in session.steer_seen]
    for s in fresh:
        session.steer_seen.add(s["id"])
    if fresh:

        def mark(r):
            for s in r.get("steer", []):
                if s["id"] in session.steer_seen:
                    s["applied"] = True

        _mutate(session.run_id, mark)
        emit(session.run_id, "steer_applied", {"ids": [s["id"] for s in fresh]})
    return [s["text"] for s in fresh]


def _compact(messages: list[dict], limit_chars: int) -> None:
    """Keep the conversation under the model's context by trimming the oldest tool outputs."""
    total = sum(len(m.get("content") or "") for m in messages)
    for m in messages:
        if total <= limit_chars:
            return
        if m["role"] == "tool" and len(m["content"]) > 300:
            total -= len(m["content"]) - 120
            m["content"] = (
                m["content"][:120]
                + "\n[Older tool output trimmed; its source numbers remain valid.]"
            )


async def _investigate(
    session: Session, run: dict, sub: dict, index: int, total: int, turns: int
) -> str:
    emit(session.run_id, "sub_started", {"index": index, "question": sub["question"]})
    specs = [t.spec() for t in session.tools.values()]
    earlier = [s["text"] for s in run.get("steer", [])]
    session.steer_seen.update(s["id"] for s in run.get("steer", []))
    user = prompts.sub_question_prompt(run["question"], sub, run.get("answers", ""), index, total)
    if earlier:
        user += "\nInstructions from the user: " + " ".join(earlier)
    messages = [
        {"role": "system", "content": prompts.RESEARCHER},
        {"role": "user", "content": user},
    ]
    limit_chars = max(8000, int(session.provider.get("context_tokens", 16000) * 2.5))
    text = ""
    for _ in range(turns):
        for instruction in _new_steer(session):
            messages.append(
                {
                    "role": "user",
                    "content": "New instruction from the user, apply it from now on: "
                    + instruction,
                }
            )
        finishing = session.budget.exhausted()
        if finishing:
            messages.append({"role": "user", "content": prompts.FINISH_NOW})
        _compact(messages, limit_chars)
        result = await complete(session.provider, messages, specs)
        _add_usage(session.run_id, session.provider, result.usage)
        messages.append(result.as_message())
        if not result.tool_calls or finishing:
            text = result.text
            break
        for call in result.tool_calls:
            output = await _call_tool(session, call)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call["id"],
                    "name": call["name"],
                    "content": output,
                }
            )
    else:
        messages.append({"role": "user", "content": prompts.FINISH_NOW})
        _compact(messages, limit_chars)
        result = await complete(session.provider, messages, specs)
        _add_usage(session.run_id, session.provider, result.usage)
        text = result.text
    text = text.strip() or "No findings for this part."
    emit(session.run_id, "sub_done", {"index": index, "preview": text[:280]})
    return text


def _summary(tool: Tool, args: dict) -> str:
    for key in ("query", "url", "file_id", "document"):
        if args.get(key):
            return str(args[key])[:200]
    return json.dumps(args)[:200]


async def _ask(session: Session, call: dict, tool: Tool, args: dict) -> str:
    future = asyncio.get_running_loop().create_future()
    approvals[(session.run_id, call["id"])] = future
    request = {
        "call_id": call["id"],
        "tool": tool.label or tool.name,
        "summary": _summary(tool, args),
    }
    _mutate(session.run_id, lambda r: r.setdefault("pending_approvals", []).append(request))
    emit(session.run_id, "approval_needed", request)
    try:
        decision = await asyncio.wait_for(future, APPROVAL_TIMEOUT_SECONDS)
    except TimeoutError:
        decision = "deny"
    finally:
        approvals.pop((session.run_id, call["id"]), None)
        _mutate(
            session.run_id,
            lambda r: r.update(
                pending_approvals=[
                    p for p in r.get("pending_approvals", []) if p["call_id"] != call["id"]
                ]
            ),
        )
    emit(session.run_id, "approval_resolved", {"call_id": call["id"], "decision": decision})
    if decision == "always":
        with store.db() as con:
            item = store.get(con, "connector", tool.connector)
            if item:
                item.setdefault("permissions", {})[tool.key] = "allow"
                store.put(con, "connector", item)
        session.owners[tool.connector].setdefault("permissions", {})[tool.key] = "allow"
    return decision


def _log(
    session: Session,
    call: dict,
    tool: Tool | None,
    args: dict,
    status: str,
    detail: str,
    latency_ms: int = 0,
    cost: float | None = None,
) -> None:
    with store.db() as con:
        rstore.log_tool_call(
            con,
            id=store.uid(),
            run_id=session.run_id,
            owner=session.owner,
            connector=tool.connector if tool else "unknown",
            tool=tool.name if tool else call["name"],
            arguments=json.dumps(args)[:2000],
            status=status,
            detail=detail[:500],
            latency_ms=latency_ms,
            cost=cost,
            created_at=store.now(),
        )


async def _call_tool(session: Session, call: dict) -> str:
    tool = session.tools.get(call["name"])
    args = call.get("arguments") or {}
    if tool is None:
        return f"Error: there is no tool named {call['name']}."
    if session.budget.exhausted():
        return "Error: the research budget is used up. Do not call more tools; write your findings."
    connector = session.owners[tool.connector]
    rule = connectors.permission(connector, {"name": tool.key, "access": tool.access})
    base = {"call_id": call["id"], "tool": tool.label or tool.name, "summary": _summary(tool, args)}
    if rule == "block":
        _log(session, call, tool, args, "blocked", "Blocked by tool permissions")
        emit(session.run_id, "tool_finished", {**base, "status": "blocked"})
        return "Error: this tool is blocked by the user's settings. Use another tool."
    if rule == "ask" and await _ask(session, call, tool, args) == "deny":
        _log(session, call, tool, args, "denied", "Declined by the user")
        emit(session.run_id, "tool_finished", {**base, "status": "denied"})
        return "Error: the user declined this tool call. Use another approach."
    session.budget.calls_left -= 1
    _mutate(
        session.run_id,
        lambda r: r.setdefault("counts", {}).__setitem__(
            "tool_calls", r["counts"].get("tool_calls", 0) + 1
        ),
    )
    emit(session.run_id, "tool_started", base)
    started = time.monotonic()
    try:
        result = await asyncio.wait_for(tool.run(args, session.ctx), TOOL_TIMEOUT_SECONDS)
    except ToolError as exc:
        return _failed(session, call, tool, args, base, str(exc), started)
    except TimeoutError:
        return _failed(
            session, call, tool, args, base, "The tool took too long to answer.", started
        )
    except Exception:
        log.exception("Tool %s failed in run %s", tool.name, session.run_id)
        return _failed(session, call, tool, args, base, "The tool failed unexpectedly.", started)
    latency = int((time.monotonic() - started) * 1000)
    numbered, lines = [], []
    with store.db() as con:
        before = con.execute(
            "SELECT COUNT(*) FROM research_sources WHERE run_id=?", (session.run_id,)
        ).fetchone()[0]
        for source in result.sources:
            n = rstore.upsert_source(
                con,
                session.run_id,
                url=source.url,
                title=source.title,
                snippet=source.snippet,
                content=source.content,
                kind=source.kind,
                tool=tool.name,
            )
            numbered.append({"n": n, "title": source.title, "url": source.url})
            body = source.content[:TOOL_OUTPUT_CHARS] if source.content else source.snippet
            lines.append(f"[{n}] {source.title}\nURL: {source.url}\n{body}".strip())
        after = con.execute(
            "SELECT COUNT(*) FROM research_sources WHERE run_id=?", (session.run_id,)
        ).fetchone()[0]
        read = con.execute(
            "SELECT COUNT(*) FROM research_sources WHERE run_id=? AND content<>''",
            (session.run_id,),
        ).fetchone()[0]
    _mutate(
        session.run_id,
        lambda r: r.setdefault("counts", {}).update(sources_found=after, sources_read=read),
    )
    cost = None
    if tool.name == "web_search":
        price = connector.get("config", {}).get("price_per_1k")
        cost = price / 1000 if isinstance(price, (int, float)) else None
    detail = f"{len(result.sources)} result(s), {after - before} new"
    _log(session, call, tool, args, "ok", detail, latency, cost)
    emit(
        session.run_id,
        "tool_finished",
        {**base, "status": "ok", "detail": detail, "latency_ms": latency, "sources": numbered[:10]},
    )
    body = "\n\n".join(lines) or "No results."
    if result.text:
        body = result.text + "\n\n" + body
    return prompts.tool_output(body)


def _failed(session, call, tool, args, base, message, started) -> str:
    latency = int((time.monotonic() - started) * 1000)
    _log(session, call, tool, args, "error", message, latency)
    emit(
        session.run_id,
        "tool_finished",
        {**base, "status": "error", "detail": message, "latency_ms": latency},
    )
    if "credentials" in message or "Sign in" in message:
        with store.db() as con:
            item = store.get(con, "connector", tool.connector)
            if item:
                connectors.mark(con, item, "error", message)
    return f"Error from {tool.label or tool.name}: {message}"


def _catalog(run_id: str) -> str:
    with store.db() as con:
        held = rstore.sources(con, run_id, with_content=True)
    held.sort(key=lambda s: (not s["content"], s["n"]))
    lines = []
    for s in held[:CATALOG_LIMIT]:
        excerpt = (s["content"] or s["snippet"])[:600].replace("\n", " ")
        lines.append(f"[{s['n']}] {s['title']} — {s['url']}\n{excerpt}")
    return "\n\n".join(lines) or "No sources were found."


async def _write(run_id: str, writer: dict, findings: list[dict]) -> tuple[str, str]:
    run = _load(run_id)
    messages = [
        {"role": "system", "content": prompts.WRITER},
        {
            "role": "user",
            "content": prompts.writer_input(
                run["question"], run.get("answers", ""), run["plan"], findings, _catalog(run_id)
            ),
        },
    ]
    text, pending, last_flush = "", "", time.monotonic()
    try:
        async for event in providers.stream(writer, messages):
            if event.get("text"):
                text += event["text"]
                pending += event["text"]
                if time.monotonic() - last_flush > 0.4:
                    emit(run_id, "report_delta", {"text": pending})
                    _update(run_id, report=text)
                    pending, last_flush = "", time.monotonic()
            if event.get("usage"):
                _add_usage(run_id, writer, event["usage"])
        if pending:
            emit(run_id, "report_delta", {"text": pending})
    except ProviderError as exc:
        # Keep the research: fall back to the raw findings rather than losing the run.
        fallback = (
            f"# {run['plan']['title']}\n\n"
            f"> The report could not be written ({exc}). Findings follow.\n\n"
        )
        fallback += "\n\n".join(f"## {f['question']}\n\n{f['text']}" for f in findings)
        emit(run_id, "report_delta", {"text": fallback, "replace": True})
        return fallback, f"The writing model failed: {exc}"
    if not text.strip():
        raise ProviderError("The writing model returned no text.")
    return text, ""
