"""The smallest backend the UI accepts: the core tier of docs/API-CONTRACT.md.

In-memory, no model provider: the "Echo" model streams your message back word by
word. Start here when a fork replaces the backend, then swap `reply()` for your
real pipeline and add optional capabilities one at a time.

    uvicorn app:app --app-dir examples/minimal_backend --port 8000
    CONTRACT_BASE_URL=http://127.0.0.1:8000 python -m pytest backend/tests/test_contract.py
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="Minimal workspace backend")

MODELS = [{"id": "echo", "label": "Echo"}]
conversations: dict[str, dict] = {}


def now() -> str:
    return datetime.now(UTC).isoformat()


def found(conversation_id: str) -> dict:
    if conversation_id not in conversations:
        raise HTTPException(404, "Conversation not found")
    return conversations[conversation_id]


class ConversationInput(BaseModel):
    title: str | None = None
    model: str | None = None
    projectId: str | None = None
    archived: bool | None = None
    pinned: bool | None = None
    summary: str | None = None


class GenerateInput(BaseModel):
    request_id: str
    query: str
    model: str
    expected_message_count: int


@app.get("/health")
def health():
    return {"status": "ok", "service": "minimal-backend", "api_version": "1"}


@app.get("/workspace")
def workspace():
    items = sorted(conversations.values(), key=lambda c: c["updatedAt"], reverse=True)
    # No optional capabilities: the UI hides projects, documents, search, etc.
    return {"capabilities": [], "models": MODELS, "conversations": items}


@app.post("/conversations")
def create_conversation(body: ConversationInput):
    item = {
        "id": str(uuid4()),
        "title": body.title or "New chat",
        "model": body.model or "",
        "projectId": None,
        "messages": [],
        "preview": "",
        "updatedAt": now(),
    }
    conversations[item["id"]] = item
    return item


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    return found(conversation_id)


@app.patch("/conversations/{conversation_id}")
def update_conversation(conversation_id: str, body: ConversationInput):
    item = found(conversation_id)
    item.update(body.model_dump(exclude_unset=True))
    return item


@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    found(conversation_id)
    del conversations[conversation_id]
    return {"ok": True}


async def reply(query: str) -> AsyncIterator[str]:
    """Replace with your model / agent / retrieval pipeline."""
    for word in ("You said: " + query).split(" "):
        await asyncio.sleep(0.02)
        yield word + " "


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/conversations/{conversation_id}/generate")
async def generate(conversation_id: str, body: GenerateInput):
    item = found(conversation_id)
    if len(item["messages"]) != body.expected_message_count:
        raise HTTPException(409, "Conversation changed in another tab. Reload before sending.")
    model = next((m for m in MODELS if m["id"] == body.model), None)
    if model is None:
        raise HTTPException(404, "Model not found")
    answer = {
        "id": str(uuid4()),
        "role": "assistant",
        "text": "",
        "timestamp": now(),
        "state": "streaming",
        "result": {
            "generationLabel": model["label"],
            "generationModel": model["id"],
            "request_id": body.request_id,
        },
    }
    item["messages"] += [
        {"id": str(uuid4()), "role": "user", "text": body.query, "timestamp": now()},
        answer,
    ]
    if item["title"] == "New chat":
        item["title"] = body.query[:65]

    async def events():
        yield sse("start", {"conversation": item, "message_id": answer["id"]})
        try:
            async for chunk in reply(body.query):
                answer["text"] += chunk
                yield sse("delta", {"text": chunk})
            answer["state"] = "ready"
        finally:
            if answer["state"] == "streaming":  # client disconnected = stop
                answer["state"] = "cancelled"
            item["preview"] = answer["text"][:120]
            item["updatedAt"] = now()
        yield sse("done", {"state": answer["state"], "text": answer["text"],
                           "result": answer["result"], "message_id": answer["id"]})

    return StreamingResponse(events(), media_type="text/event-stream")
