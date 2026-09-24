from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from contextlib import suppress

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from . import documents, providers, store
from .context import assemble
from .contracts import GenerateInput

router = APIRouter()
tasks: dict[str, asyncio.Task] = {}
log = logging.getLogger("chat")


def required(con, kind, record_id):
    item = store.get(con, kind, record_id)
    if item is None:
        raise HTTPException(404, f"{kind.capitalize()} not found")
    return item


def ensure_idle(con, conversation_id):
    if con.execute("SELECT 1 FROM generations WHERE conversation_id=? AND status='streaming'",
                   (conversation_id,)).fetchone():
        raise HTTPException(409, "Stop this conversation's response before changing it.")


@router.get("/usage")
def usage():
    with store.db() as con:
        rows = con.execute("SELECT body,status,created_at FROM generations ORDER BY created_at DESC").fetchall()
    items = [{**json.loads(r["body"]), "status": r["status"], "createdAt": r["created_at"]} for r in rows]
    return {"requests": len(items), "today": sum(i["createdAt"][:10] == store.now()[:10] for i in items),
            "input_tokens": sum(i.get("usage", {}).get("input", 0) for i in items),
            "output_tokens": sum(i.get("usage", {}).get("output", 0) for i in items),
            "estimated_cost": sum(i.get("estimated_cost") or 0 for i in items),
            "unpriced_requests": sum(i.get("estimated_cost") is None for i in items),
            "recent": items[:50]}


def sse(event, data):
    return "event: " + event + "\ndata: " + json.dumps(data) + "\n\n"


def save_generation(conversation_id, message_id, request_id, text, state, metadata):
    with store.db() as con:
        item = required(con, "conversation", conversation_id)
        for message in item["messages"]:
            if message["id"] == message_id:
                message.update(text=text, state=state, result=metadata)
        item["preview"] = text[:120] or state.capitalize()
        item["updatedAt"] = store.now()
        store.put(con, "conversation", item)
        con.execute("UPDATE generations SET status=?,body=? WHERE id=?", (
            state, json.dumps({**metadata, "conversation_id": conversation_id,
                              "message_id": message_id, "id": request_id}), request_id
        ))


async def run_generation(provider, messages, conversation_id, message_id, request_id, metadata, queue):
    text = ""
    state = "ready"
    started = time.monotonic()
    last_save = started
    try:
        async with asyncio.timeout(300):
            async for event in providers.stream(provider, messages):
                if event.get("text"):
                    text += event["text"]
                    if len(text) > 500000:
                        raise providers.ProviderError("Response exceeded the local output size limit.")
                    if "first_token_ms" not in metadata:
                        metadata["first_token_ms"] = int((time.monotonic() - started) * 1000)
                    await queue.put(("delta", {"text": event["text"]}))
                if event.get("usage"):
                    metadata.setdefault("usage", {}).update(event["usage"])
                if event.get("model"):
                    metadata["generationModel"] = event["model"]
                if event.get("finish"):
                    metadata["finish_reason"] = event["finish"]
                if time.monotonic() - last_save > 1:
                    save_generation(conversation_id, message_id, request_id, text, "streaming", metadata)
                    last_save = time.monotonic()
        if not text:
            raise providers.ProviderError("Provider returned no answer text.")
    except asyncio.CancelledError:
        state = "cancelled"
    except (providers.ProviderError, TimeoutError) as exc:
        state = "error"
        metadata["error"] = str(exc) or "Generation exceeded the five-minute limit."
    except Exception:
        state = "error"
        metadata["error"] = "Unexpected generation failure. Check the backend log."
        log.exception("Generation %s failed", request_id)
    finally:
        metadata["latencyMs"] = int((time.monotonic() - started) * 1000)
        usage = metadata.get("usage", {})
        if (provider.get("input_price") is not None and provider.get("output_price") is not None
                and "input" in usage and "output" in usage):
            metadata["estimated_cost"] = (usage["input"] * provider["input_price"]
                                          + usage["output"] * provider["output_price"]) / 1000000
        save_generation(conversation_id, message_id, request_id, text, state, metadata)
        log.info("generation=%s status=%s latency_ms=%s", request_id, state, metadata["latencyMs"])
        await queue.put(("done", {"state": state, "text": text, "result": metadata,
                                  "message_id": message_id}))
        tasks.pop(request_id, None)


@router.post("/conversations/{conversation_id}/generate")
async def generate(conversation_id: str, body: GenerateInput):
    if not body.query.strip():
        raise HTTPException(422, "Enter a message.")
    digest = hashlib.sha256((conversation_id + body.model_dump_json()).encode()).hexdigest()
    with store.db() as con:
        con.execute("BEGIN IMMEDIATE")
        item = required(con, "conversation", conversation_id)
        old = con.execute("SELECT * FROM generations WHERE id=?", (body.request_id,)).fetchone()
        if old:
            if old["request_hash"] != digest:
                raise HTTPException(409, "Request ID already used for different content.")
            if old["status"] == "streaming":
                raise HTTPException(409, "This request is already running. Refresh the conversation.")
            previous = json.loads(old["body"])
            message = next(m for m in item["messages"] if m["id"] == previous["message_id"])
            return StreamingResponse(iter([sse("done", {
                "state": message["state"], "text": message["text"], "result": message.get("result"),
                "message_id": message["id"], "replayed": True,
            })]), media_type="text/event-stream")
        ensure_idle(con, conversation_id)
        if len(item["messages"]) != body.expected_message_count:
            raise HTTPException(409, "Conversation changed in another tab. Reload before sending.")
        settings = store.get(con, "settings", "local") or {"daily_request_limit": 200}
        count = con.execute("SELECT count(*) FROM generations WHERE created_at>=?",
                            (store.now()[:10],)).fetchone()[0]
        if count >= settings["daily_request_limit"]:
            raise HTTPException(429, "Daily request limit reached. Adjust it in Workspace settings.")
        provider = required(con, "provider", body.model)
        project = required(con, "project", item["projectId"]) if item.get("projectId") else None
        preset = required(con, "preset", body.preset_id) if body.preset_id else None
        allowed = []
        for document_id in body.document_ids:
            doc = required(con, "document", document_id)
            if doc.get("projectId") not in (None, item.get("projectId")):
                raise HTTPException(403, "Document belongs to another project.")
            allowed.append(document_id)
        if project:
            allowed += [d["id"] for d in store.all_records(con, "document")
                        if d.get("projectId") == project["id"]]
        sources = documents.retrieve(con, body.query, list(set(allowed)))
        messages, sources, trimmed = assemble(provider, item, project, preset, body.query, sources)
        message_id = store.uid()
        metadata = {"model": body.model, "generationModel": provider["model"],
                    "generationLabel": provider["label"], "sources": sources,
                    "context_trimmed": trimmed, "usage": {}, "request_id": body.request_id,
                    "context_note": "Older turns omitted; saved history is unchanged." if trimmed else "",
                    "source_note": "No matching document passages found." if allowed and not sources else ""}
        item["messages"].extend([
            {"id": store.uid(), "role": "user", "text": body.query, "timestamp": store.now(),
             "documentIds": body.document_ids, "presetId": body.preset_id},
            {"id": message_id, "role": "assistant", "text": "", "timestamp": store.now(),
             "state": "streaming", "result": metadata},
        ])
        item["model"] = body.model
        if item["title"] == "New chat":
            item["title"] = body.query[:65]
        item["updatedAt"] = store.now()
        store.put(con, "conversation", item)
        con.execute("INSERT INTO generations VALUES(?,?,?,?,?,?)", (
            body.request_id, conversation_id, digest, "streaming", json.dumps(metadata), store.now()
        ))
    queue = asyncio.Queue()
    task = asyncio.create_task(run_generation(
        provider, messages, conversation_id, message_id, body.request_id, metadata, queue
    ))
    tasks[body.request_id] = task

    async def events():
        try:
            yield sse("start", {"conversation": item, "message_id": message_id})
            while True:
                try:
                    event, payload = await asyncio.wait_for(queue.get(), timeout=10)
                except TimeoutError:
                    yield ": heartbeat\n\n"
                    continue
                yield sse(event, payload)
                if event == "done":
                    break
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(events(), media_type="text/event-stream", headers={
        "X-Accel-Buffering": "no", "Cache-Control": "no-cache"
    })


@router.post("/generations/{request_id}/cancel")
async def cancel(request_id: str):
    task = tasks.get(request_id)
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
    return {"ok": True}
