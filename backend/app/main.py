from __future__ import annotations

import asyncio
import os
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import auth, documents, providers, store
from .contracts import (
    BranchInput,
    ConversationInput,
    MessageUpdate,
    PresetInput,
    ProjectInput,
    ProviderInput,
    SettingsInput,
)
from .generation import ensure_idle, required, router, tasks
from .secrets import encrypt, public_provider

ORIGINS = [
    f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (5173, 8080, 4173)
]
ORIGINS += [value for value in os.environ.get("CHAT_ALLOWED_ORIGINS", "").split(",") if value]
HOSTS = ["localhost", "127.0.0.1", "[::1]", "testserver"]
HOSTS += [value for value in os.environ.get("CHAT_ALLOWED_HOSTS", "").split(",") if value]

# Bumped only for breaking changes to docs/API-CONTRACT.md.
API_VERSION = "1"
# Optional contract features this backend implements. The frontend hides the UI for
# anything missing, so a replacement backend can start with the core tier only.
CAPABILITIES = [
    "models.manage",
    "projects",
    "documents",
    "presets",
    "search",
    "usage",
    "settings",
    "branching",
    "bookmarks",
    "cancel",
    "reasoning",
]


@asynccontextmanager
async def lifespan(app):
    store.init_store()
    yield
    running = list(tasks.values())
    for task in running:
        task.cancel()
    await asyncio.gather(*running, return_exceptions=True)


app = FastAPI(title="Local LLM Workspace", version="0.2.0", lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=HOSTS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", auth.CLIENT_HEADER],
)
app.include_router(router)


BURST_REQUESTS = 30
BURST_WINDOW_SECONDS = 60.0
BURST_PATH_SUFFIX = "/generate"
BURST_PATH_PREFIX = "/documents"

_burst: dict[str, deque[float]] = defaultdict(deque)
_burst_lock = Lock()


def over_burst_limit(client: str) -> int:
    """Short-window ceiling on the expensive paths.

    The daily cap in generation.py bounds spend; this bounds a runaway client or
    a retry loop hammering generate/upload in a few seconds.
    """
    now = time.monotonic()
    cutoff = now - BURST_WINDOW_SECONDS
    with _burst_lock:
        seen = _burst[client]
        while seen and seen[0] < cutoff:
            seen.popleft()
        if len(seen) >= BURST_REQUESTS:
            return max(1, int(seen[0] - cutoff) + 1)
        seen.append(now)
    return 0


@app.middleware("http")
async def local_boundary(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and origin not in ORIGINS and origin != str(request.base_url).rstrip("/"):
        return JSONResponse({"detail": "This personal workspace only accepts local origins."}, 403)
    if (
        request.method not in ("GET", "HEAD", "OPTIONS")
        and request.headers.get(auth.CLIENT_HEADER) != auth.CLIENT_VALUE
    ):
        return JSONResponse({"detail": "Missing workspace request header."}, 403)
    if request.method != "OPTIONS" and request.url.path not in auth.PUBLIC_PATHS:
        user = auth.authenticate(request)
        if user is None:
            return JSONResponse({"detail": "Sign in to continue."}, 401)
        request.state.user = user
    path = request.url.path
    expensive = path.endswith(BURST_PATH_SUFFIX) or path.startswith(BURST_PATH_PREFIX)
    if request.method == "POST" and expensive:
        retry_after = over_burst_limit(request.client.host if request.client else "unknown")
        if retry_after:
            return JSONResponse(
                {"detail": "Too many requests in a short window. Please slow down."},
                429,
                headers={"Retry-After": str(retry_after)},
            )
    size = request.headers.get("content-length", "0")
    if not size.isdigit() or int(size) > documents.MAX_FILE_BYTES + 65536:
        return JSONResponse({"detail": "Request exceeds 10 MB."}, 413)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/health")
def health():
    return {"status": "ok", "service": "local-llm-workspace", "api_version": API_VERSION}


@app.get("/workspace")
def workspace():
    with store.db() as con:
        conversations = store.all_records(con, "conversation")
        return {
            "capabilities": CAPABILITIES,
            "projects": store.all_records(con, "project"),
            "conversations": sorted(conversations, key=lambda c: c["updatedAt"], reverse=True),
            "models": [public_provider(p) for p in store.all_records(con, "provider")],
            "documents": store.all_records(con, "document"),
            "presets": store.all_records(con, "preset"),
            "settings": store.get(con, "settings", "local") or {"daily_request_limit": 200},
        }


@app.get("/models")
def models():
    with store.db() as con:
        return [public_provider(p) for p in store.all_records(con, "provider")]


@app.post("/models")
def create_provider(body: ProviderInput):
    item = {
        **body.model_dump(exclude={"api_key"}),
        "id": store.uid(),
        "secret": encrypt(body.api_key),
    }
    with store.db() as con:
        store.put(con, "provider", item)
    return public_provider(item)


@app.patch("/models/{model_id}")
def update_provider(model_id: str, body: ProviderInput):
    with store.db() as con:
        existing = required(con, "provider", model_id)
        if (
            existing.get("secret")
            and not body.api_key
            and (existing["base_url"] != body.base_url or existing["kind"] != body.kind)
        ):
            raise HTTPException(422, "Re-enter the API key when changing the endpoint or API type.")
        item = {
            **body.model_dump(exclude={"api_key"}),
            "id": model_id,
            "secret": encrypt(body.api_key) if body.api_key else existing.get("secret", ""),
        }
        store.put(con, "provider", item)
    return public_provider(item)


@app.delete("/models/{model_id}")
def delete_provider(model_id: str):
    with store.db() as con:
        required(con, "provider", model_id)
        store.delete(con, "provider", model_id)
    return {"ok": True}


@app.post("/models/{model_id}/test")
async def test_provider(model_id: str):
    with store.db() as con:
        provider = required(con, "provider", model_id)
    provider["max_output_tokens"] = 64
    try:
        async with asyncio.timeout(30):
            async for event in providers.stream(
                provider, [{"role": "user", "content": "Reply OK."}]
            ):
                if event.get("text"):
                    return {"ok": True, "detail": "Provider returned text successfully."}
        raise providers.ProviderError("Provider returned no text.")
    except (providers.ProviderError, TimeoutError) as exc:
        raise HTTPException(502, str(exc) or "Connection test timed out.") from exc


@app.post("/projects")
def create_project(body: ProjectInput):
    with store.db() as con:
        return store.put(con, "project", {**body.model_dump(), "id": store.uid(), "kind": "folder"})


@app.patch("/projects/{project_id}")
def update_project(project_id: str, body: ProjectInput):
    with store.db() as con:
        existing = required(con, "project", project_id)
        return store.put(con, "project", {**existing, **body.model_dump()})


@app.delete("/projects/{project_id}")
def delete_project(project_id: str):
    with store.db() as con:
        required(con, "project", project_id)
        for item in store.all_records(con, "conversation"):
            if item.get("projectId") == project_id:
                ensure_idle(con, item["id"])
                item["projectId"] = None
                store.put(con, "conversation", item)
        for item in store.all_records(con, "document"):
            if item.get("projectId") == project_id:
                item["projectId"] = None
                store.put(con, "document", item)
        store.delete(con, "project", project_id)
    return {"ok": True}


@app.post("/conversations")
def create_conversation(body: ConversationInput):
    with store.db() as con:
        if body.projectId:
            required(con, "project", body.projectId)
        return store.put(
            con,
            "conversation",
            {
                **body.model_dump(),
                "id": store.uid(),
                "messages": [],
                "preview": "",
                "updatedAt": store.now(),
            },
        )


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    with store.db() as con:
        return required(con, "conversation", conversation_id)


@app.patch("/conversations/{conversation_id}")
def update_conversation(conversation_id: str, body: ConversationInput):
    with store.db() as con:
        item = required(con, "conversation", conversation_id)
        ensure_idle(con, conversation_id)
        if body.projectId:
            required(con, "project", body.projectId)
        return store.put(con, "conversation", {**item, **body.model_dump(exclude_unset=True)})


@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    with store.db() as con:
        required(con, "conversation", conversation_id)
        ensure_idle(con, conversation_id)
        store.delete(con, "conversation", conversation_id)
    return {"ok": True}


@app.post("/conversations/{conversation_id}/branch")
def branch(conversation_id: str, body: BranchInput):
    with store.db() as con:
        item = required(con, "conversation", conversation_id)
        ensure_idle(con, conversation_id)
        index = next((i for i, m in enumerate(item["messages"]) if m["id"] == body.message_id), -1)
        if index < 0:
            raise HTTPException(404, "Message not found")
        messages = item["messages"][: index + int(body.include_message)]
        for message in messages:
            message["id"] = store.uid()
            message["saved"] = False
        return store.put(
            con,
            "conversation",
            {
                **item,
                "id": store.uid(),
                "title": item["title"][:130] + " (branch)",
                "messages": messages,
                "parentId": conversation_id,
                "archived": False,
                "updatedAt": store.now(),
                "preview": messages[-1]["text"][:120] if messages else "",
            },
        )


@app.patch("/conversations/{conversation_id}/messages/{message_id}")
def bookmark(conversation_id: str, message_id: str, body: MessageUpdate):
    with store.db() as con:
        item = required(con, "conversation", conversation_id)
        message = next((m for m in item["messages"] if m["id"] == message_id), None)
        if message is None:
            raise HTTPException(404, "Message not found")
        message["saved"] = body.saved
        return store.put(con, "conversation", item)


@app.get("/search")
def search(q: str = "", archived: bool = False):
    with store.db() as con:
        expression = documents.search_expression(q)
        if expression:
            ids = [
                row["id"]
                for row in con.execute(
                    "SELECT id FROM chat_search WHERE chat_search MATCH ? ORDER BY rank LIMIT 100",
                    (expression,),
                )
            ]
            items = [store.get(con, "conversation", record_id) for record_id in ids]
        else:
            items = store.all_records(con, "conversation")
        return [
            {
                "id": c["id"],
                "title": c["title"],
                "preview": c["preview"],
                "archived": c.get("archived", False),
                "projectId": c.get("projectId"),
            }
            for c in items
            if c and (archived or not c.get("archived"))
        ]


@app.post("/presets")
def create_preset(body: PresetInput):
    with store.db() as con:
        return store.put(con, "preset", {**body.model_dump(), "id": store.uid()})


@app.patch("/presets/{preset_id}")
def update_preset(preset_id: str, body: PresetInput):
    with store.db() as con:
        required(con, "preset", preset_id)
        return store.put(con, "preset", {**body.model_dump(), "id": preset_id})


@app.delete("/presets/{preset_id}")
def delete_preset(preset_id: str):
    with store.db() as con:
        store.delete(con, "preset", preset_id)
    return {"ok": True}


@app.post("/documents")
async def upload_document(file: Annotated[UploadFile, File()], project_id: str = Form("")):
    content = await file.read(documents.MAX_FILE_BYTES + 1)
    await file.close()
    if len(content) > documents.MAX_FILE_BYTES:
        raise HTTPException(413, "File exceeds 10 MB.")
    name = Path(file.filename or "document.txt").name
    pages = await asyncio.to_thread(documents.extract, name, content)
    with store.db() as con:
        if project_id:
            required(con, "project", project_id)
        return documents.save_document(con, name, pages, project_id or None)


@app.get("/documents/{document_id}")
def get_document(document_id: str):
    with store.db() as con:
        item = required(con, "document", document_id)
        chunks = [
            dict(row)
            for row in con.execute(
                "SELECT id,page,text FROM chunks WHERE document_id=? ORDER BY rowid", (document_id,)
            )
        ]
        return {**item, "chunks": chunks}


@app.delete("/documents/{document_id}")
def delete_document(document_id: str):
    with store.db() as con:
        required(con, "document", document_id)
        store.delete(con, "document", document_id)
        con.execute("DELETE FROM chunks WHERE document_id=?", (document_id,))
        con.execute("DELETE FROM chunk_search WHERE document_id=?", (document_id,))
    return {"ok": True}


@app.patch("/settings")
def update_settings(body: SettingsInput):
    with store.db() as con:
        return store.put(con, "settings", {**body.model_dump(), "id": "local"})
