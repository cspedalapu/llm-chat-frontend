"""Behavioral coverage for the personal workspace and provider integration boundary."""

import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from backend.app import providers, store
from backend.app.context import assemble
from backend.app.generation import run_generation
from backend.app.main import app
from backend.app.providers import ProviderError, build_request, normalize_chunk
from backend.app.secrets import decrypt

HEADERS = {"X-Workspace-Client": "local-chat"}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("CHAT_DATA_DIR", str(tmp_path))
    with TestClient(app, headers=HEADERS) as client:
        yield client


def model(client, **overrides):
    body = {
        "label": "Test model",
        "kind": "openai",
        "base_url": "https://example.com/v1",
        "model": "test-model",
        "api_key": "secret-test-key",
        "context_tokens": 16000,
        "max_output_tokens": 2048,
    }
    body.update(overrides)
    response = client.post("/models", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def conversation(client, **overrides):
    response = client.post("/conversations", json=overrides)
    assert response.status_code == 200, response.text
    return response.json()


def generate(client, chat, provider, **overrides):
    body = {
        "query": "Hello",
        "model": provider["id"],
        "request_id": store.uid(),
        "expected_message_count": len(chat["messages"]),
    }
    body.update(overrides)
    return client.post(f"/conversations/{chat['id']}/generate", json=body)


@pytest.fixture
def fake(monkeypatch):
    calls = []

    async def stream(provider, messages):
        calls.append((provider, messages))
        yield {"text": "Hello **world** [1]."}
        yield {"usage": {"input": 10, "output": 5}, "model": "actual-model", "finish": "stop"}

    monkeypatch.setattr(providers, "stream", stream)
    return calls


def test_health_and_empty_workspace(client):
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/workspace").json()["conversations"] == []
    assert client.get("/models").json() == []


def test_local_browser_boundary(client):
    assert (
        client.post(
            "/projects", json={"title": "bad"}, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert client.get("/workspace", headers={"Host": "evil.example"}).status_code == 400
    with TestClient(app) as other:
        assert other.post("/projects", json={"title": "no header"}).status_code == 403


def test_encrypted_provider_secret_never_returned(client):
    provider = model(client)
    assert provider["has_key"]
    assert "secret-test-key" not in json.dumps(client.get("/workspace").json())
    assert "secret" not in provider
    with store.db() as con:
        stored = store.get(con, "provider", provider["id"])
        assert stored["secret"] != "secret-test-key"
        assert decrypt(stored["secret"]) == "secret-test-key"


def test_endpoint_change_requires_key_reentry(client):
    provider = model(client)
    response = client.patch(
        "/models/" + provider["id"],
        json={**provider, "base_url": "https://another.example/v1", "api_key": ""},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com",
        "http://remote.example",
        "https://u:p@example.com",
        "https://example.com?key=abc",
    ],
)
def test_provider_url_validation(client, url):
    assert (
        client.post("/models", json={"label": "x", "model": "x", "base_url": url}).status_code
        == 422
    )


def test_model_selection_and_usage_are_real(client, fake):
    provider = model(client, input_price=1, output_price=2)
    chat = conversation(client)
    response = generate(client, chat, provider)
    assert response.status_code == 200
    assert "event: delta" in response.text and "event: done" in response.text
    assert fake[0][0]["id"] == provider["id"]
    stored = client.get("/conversations/" + chat["id"]).json()
    assert len(stored["messages"]) == 2
    result = stored["messages"][-1]["result"]
    assert result["generationModel"] == "actual-model"
    assert result["usage"] == {"input": 10, "output": 5}
    assert result["estimated_cost"] == pytest.approx(0.00002)
    assert client.get("/usage").json()["requests"] == 1


def test_idempotency_and_conflicting_tabs(client, fake):
    provider = model(client)
    chat = conversation(client)
    request_id = store.uid()
    assert generate(client, chat, provider, request_id=request_id).status_code == 200
    assert generate(client, chat, provider, request_id=request_id).status_code == 200
    assert len(fake) == 1
    assert (
        generate(client, chat, provider, request_id=request_id, query="different").status_code
        == 409
    )
    assert generate(client, chat, provider).status_code == 409
    assert len(client.get("/conversations/" + chat["id"]).json()["messages"]) == 2


def test_long_conversation_and_context_budget(client, fake):
    provider = model(client, context_tokens=4096, max_output_tokens=512)
    chat = conversation(client, summary="User-maintained important decision.")
    with store.db() as con:
        chat["messages"] = [
            {
                "id": store.uid(),
                "role": role,
                "text": "history " * 50,
                "timestamp": store.now(),
                "state": "ready",
            }
            for _ in range(35)
            for role in ("user", "assistant")
        ]
        store.put(con, "conversation", chat)
    response = generate(client, chat, provider)
    assert response.status_code == 200
    assert len(fake[0][1]) < 70
    assert "important decision" in fake[0][1][0]["content"]
    stored = client.get("/conversations/" + chat["id"]).json()
    assert len(stored["messages"]) == 72
    assert stored["messages"][-1]["result"]["context_trimmed"]


def test_project_instructions_memory_preset_and_citations(client, fake):
    provider = model(client)
    project = client.post(
        "/projects",
        json={
            "title": "Research",
            "instructions": "Be concise",
            "memory": "Our release is called cobalt",
        },
    ).json()
    preset = client.post(
        "/presets",
        json={"title": "Reviewer", "instructions": "Use evidence", "output_format": "Bullets"},
    ).json()
    uploaded = client.post(
        "/documents",
        data={"project_id": project["id"]},
        files={"file": ("notes.txt", b"Cobalt launch date is Friday.", "text/plain")},
    ).json()
    chat = conversation(client, projectId=project["id"])
    assert (
        generate(
            client, chat, provider, query="Cobalt launch date?", preset_id=preset["id"]
        ).status_code
        == 200
    )
    messages = fake[0][1]
    assert "Be concise" in messages[0]["content"]
    assert "called cobalt" in messages[0]["content"]
    assert "Use evidence" in messages[0]["content"]
    assert "Friday" in messages[-1]["content"]
    result = client.get("/conversations/" + chat["id"]).json()["messages"][-1]["result"]
    assert result["sources"][0]["documentId"] == uploaded["id"]
    assert result["sources"][0]["page"] == 1


def test_documents_cannot_cross_projects(client, fake):
    provider = model(client)
    project = client.post("/projects", json={"title": "Other"}).json()
    document = client.post(
        "/documents",
        data={"project_id": project["id"]},
        files={"file": ("private.txt", b"private context", "text/plain")},
    ).json()
    response = generate(client, conversation(client), provider, document_ids=[document["id"]])
    assert response.status_code == 403
    assert not fake


def test_attachment_context_survives_followup(client, fake):
    provider = model(client)
    document = client.post(
        "/documents", files={"file": ("note.txt", b"Cobalt means blue", "text/plain")}
    ).json()
    chat = conversation(client)
    generate(client, chat, provider, query="Cobalt?", document_ids=[document["id"]])
    chat = client.get("/conversations/" + chat["id"]).json()
    generate(client, chat, provider, query="Explain cobalt again")
    assert "Cobalt means blue" in fake[-1][1][-1]["content"]


def test_provider_failure_saved_and_excluded_from_context(client, monkeypatch):
    provider = model(client)
    chat = conversation(client)

    async def broken(provider, messages):
        yield {"text": "Partial"}
        raise ProviderError("Temporary failure")

    monkeypatch.setattr(providers, "stream", broken)
    assert generate(client, chat, provider).status_code == 200
    chat = client.get("/conversations/" + chat["id"]).json()
    assert chat["messages"][-1]["state"] == "error"
    assert chat["messages"][-1]["text"] == "Partial"
    packed, _, _ = assemble(provider, chat, None, None, "Next", [])
    assert all(
        "Partial" not in m["content"] and "Temporary failure" not in m["content"] for m in packed
    )


def test_branch_preserves_original_and_bookmarks(client, fake):
    provider = model(client)
    chat = conversation(client)
    generate(client, chat, provider)
    chat = client.get("/conversations/" + chat["id"]).json()
    answer = chat["messages"][-1]
    bookmarked = client.patch(
        f"/conversations/{chat['id']}/messages/{answer['id']}", json={"saved": True}
    ).json()
    assert bookmarked["messages"][-1]["saved"]
    branch = client.post(
        f"/conversations/{chat['id']}/branch",
        json={"message_id": chat["messages"][0]["id"], "include_message": False},
    ).json()
    assert branch["messages"] == []
    assert branch["parentId"] == chat["id"]
    assert len(client.get("/conversations/" + chat["id"]).json()["messages"]) == 2


def test_search_archive_and_project_delete(client, fake):
    project = client.post("/projects", json={"title": "P"}).json()
    chat = conversation(client, projectId=project["id"])
    generate(client, chat, model(client), query="Find the cobalt milestone")
    assert client.get("/search?q=cobalt").json()[0]["id"] == chat["id"]
    client.patch("/conversations/" + chat["id"], json={"archived": True})
    assert client.get("/search?q=cobalt").json() == []
    assert client.get("/search?q=cobalt&archived=true").json()
    client.delete("/projects/" + project["id"])
    assert client.get("/conversations/" + chat["id"]).json()["projectId"] is None


def test_quota_and_invalid_upload(client, fake):
    client.patch("/settings", json={"daily_request_limit": 1})
    provider = model(client)
    generate(client, conversation(client), provider)
    assert generate(client, conversation(client), provider).status_code == 429
    assert client.post("/documents", files={"file": ("image.png", b"not text")}).status_code == 415
    assert client.post("/documents", files={"file": ("empty.txt", b"")}).status_code == 422


def test_store_restart_marks_interrupted(client):
    chat = conversation(client)
    with store.db() as con:
        chat["messages"] = [
            {
                "id": "partial",
                "role": "assistant",
                "text": "saved text",
                "state": "streaming",
                "timestamp": store.now(),
            }
        ]
        store.put(con, "conversation", chat)
    store.init_store()
    restored = client.get("/conversations/" + chat["id"]).json()
    assert restored["messages"][0]["state"] == "interrupted"
    assert restored["messages"][0]["text"] == "saved text"


@pytest.mark.asyncio
async def test_cancellation_persists_partial_output(client, monkeypatch):
    provider = model(client)
    chat = conversation(client)
    rid = store.uid()
    with store.db() as con:
        chat["messages"] = [{"id": "answer", "role": "assistant", "text": "", "state": "streaming"}]
        store.put(con, "conversation", chat)
        con.execute(
            "INSERT INTO generations VALUES(?,?,?,?,?,?)",
            (rid, chat["id"], "hash", "streaming", "{}", store.now()),
        )

    async def slow(provider, messages):
        yield {"text": "Partial output"}
        await asyncio.sleep(20)

    monkeypatch.setattr(providers, "stream", slow)
    queue = asyncio.Queue()
    task = asyncio.create_task(run_generation(provider, [], chat["id"], "answer", rid, {}, queue))
    await queue.get()
    task.cancel()
    await task
    restored = client.get("/conversations/" + chat["id"]).json()
    assert restored["messages"][0]["state"] == "cancelled"
    assert restored["messages"][0]["text"] == "Partial output"


@pytest.mark.parametrize(
    "kind,ending",
    [
        ("openai", "/chat/completions"),
        ("anthropic", "/messages"),
        ("gemini", ":streamGenerateContent?alt=sse"),
        ("ollama", "/api/chat"),
    ],
)
def test_provider_request_protocols(client, kind, ending):
    public = model(client, kind=kind)
    with store.db() as con:
        provider = store.get(con, "provider", public["id"])
    url, headers, body = build_request(
        provider, [{"role": "system", "content": "Rules"}, {"role": "user", "content": "Hi"}]
    )
    assert url.endswith(ending)
    assert "secret-test-key" not in url and "secret-test-key" not in json.dumps(body)
    assert (
        headers.get("Authorization") == "Bearer secret-test-key"
        or headers.get("x-api-key") == "secret-test-key"
        or headers.get("x-goog-api-key") == "secret-test-key"
    )


def test_per_request_reasoning_overrides_the_connection_default(client):
    """The composer sends a thinking effort per message; it must beat the stored one."""
    public = model(client, kind="openai")
    with store.db() as con:
        provider = store.get(con, "provider", public["id"])

    assert not provider.get("reasoning")
    _, _, body = build_request(provider, [{"role": "user", "content": "Hi"}])
    assert "reasoning_effort" not in body

    overridden = {**provider, "reasoning": "high"}
    _, _, body = build_request(overridden, [{"role": "user", "content": "Hi"}])
    assert body["reasoning_effort"] == "high"


def test_generate_rejects_an_unknown_reasoning_level(client):
    conversation_id = conversation(client)
    response = client.post(
        f"/conversations/{conversation_id}/generate",
        json={
            "request_id": "r1", "query": "Hi", "model": model(client)["id"],
            "expected_message_count": 0, "reasoning": "extreme",
        },
        headers=HEADERS,
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "kind,payload",
    [
        ("openai", {"choices": [{"delta": {"content": "ok"}}]}),
        (
            "anthropic",
            {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "ok"}},
        ),
        ("gemini", {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}),
        ("ollama", {"message": {"content": "ok"}}),
    ],
)
def test_provider_stream_normalization(kind, payload):
    assert {"text": "ok"} in list(normalize_chunk(kind, payload))
