"""Executable version of docs/API-CONTRACT.md.

By default this runs against this repo's backend, in-process, with a fake model.
A fork that replaces the backend points it at the running server instead:

    CONTRACT_BASE_URL=http://127.0.0.1:8000 python -m pytest backend/tests/test_contract.py

Core-tier checks always run. Optional checks run only for the capabilities the
backend advertises in GET /workspace, so a partial backend passes cleanly.
Generation checks use the first model in /workspace (or CONTRACT_MODEL_ID); against
a real backend they send a short prompt, which may cost a provider call.
"""

from __future__ import annotations

import json
import os
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

HEADERS = {"X-Workspace-Client": "local-chat"}
BASE_URL = os.environ.get("CONTRACT_BASE_URL", "").rstrip("/")
MESSAGE_STATES = {"ready", "error", "streaming", "cancelled", "interrupted"}


@pytest.fixture
def api(request, monkeypatch):
    if BASE_URL:
        with httpx.Client(base_url=BASE_URL, headers=HEADERS, timeout=120) as client:
            yield client
        return

    from backend.app import main, providers
    from backend.app.main import app

    async def stream(provider, messages):
        yield {"text": "Contract "}
        yield {"text": "reply."}
        yield {"usage": {"input": 3, "output": 2}, "finish": "stop"}

    # Requested lazily: remote runs need no temp dir (and avoid Windows temp-dir issues).
    monkeypatch.setenv("CHAT_DATA_DIR", str(request.getfixturevalue("tmp_path")))
    monkeypatch.setattr(providers, "stream", stream)
    main._burst.clear()
    with TestClient(app, headers=HEADERS) as client:
        created = client.post("/models", json={
            "label": "Contract model", "kind": "openai", "base_url": "https://example.com/v1",
            "model": "contract", "api_key": "k",
        })
        assert created.status_code == 200, created.text
        yield client


@pytest.fixture
def capabilities(api):
    return set(api.get("/workspace").json().get("capabilities", []))


@pytest.fixture
def model_id(api):
    wanted = os.environ.get("CONTRACT_MODEL_ID")
    if wanted:
        return wanted
    models = api.get("/workspace").json()["models"]
    if not models:
        pytest.skip("Backend lists no models; set CONTRACT_MODEL_ID to test generation.")
    return models[0]["id"]


def requires(capabilities, name):
    if name not in capabilities:
        pytest.skip(f"Backend does not advertise '{name}'.")


def parse_sse(body: str) -> list[tuple[str, dict]]:
    events = []
    for frame in body.replace("\r\n", "\n").split("\n\n"):
        lines = frame.split("\n")
        event = next((line[6:].strip() for line in lines if line.startswith("event:")), None)
        data = "\n".join(line[5:].strip() for line in lines if line.startswith("data:"))
        if event and data:
            events.append((event, json.loads(data)))
    return events


def new_conversation(api, **body):
    response = api.post("/conversations", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def generate(api, conversation, model_id, query="Say hello.", **extra):
    body = {
        "request_id": str(uuid4()),
        "query": query,
        "model": model_id,
        "expected_message_count": len(conversation["messages"]),
        **extra,
    }
    return api.post(f"/conversations/{conversation['id']}/generate", json=body)


# --- Core tier -------------------------------------------------------------------


def test_health(api):
    response = api.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["api_version"] == "1"


def test_workspace_shape(api):
    body = api.get("/workspace").json()
    assert isinstance(body["capabilities"], list)
    assert all(isinstance(c, str) for c in body["capabilities"])
    assert isinstance(body["conversations"], list)
    assert isinstance(body["models"], list)
    for model in body["models"]:
        assert isinstance(model["id"], str) and isinstance(model["label"], str)


def test_conversation_lifecycle(api):
    item = new_conversation(api, title="Contract check")
    for key in ("id", "title", "messages", "updatedAt"):
        assert key in item
    assert item["messages"] == []
    assert api.get("/conversations/" + item["id"]).json()["id"] == item["id"]

    renamed = api.patch("/conversations/" + item["id"], json={"title": "Renamed"})
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Renamed"
    listed = [c["id"] for c in api.get("/workspace").json()["conversations"]]
    assert item["id"] in listed

    assert api.delete("/conversations/" + item["id"]).status_code == 200
    assert api.get("/conversations/" + item["id"]).status_code == 404


def test_unknown_conversation_is_404(api):
    assert api.get("/conversations/does-not-exist").status_code == 404


def test_generate_stream_protocol(api, model_id):
    conversation = new_conversation(api)
    response = generate(api, conversation, model_id)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(response.text)
    names = [name for name, _ in events]

    assert names[0] == "start"
    assert names[-1] == "done"
    assert set(names[1:-1]) <= {"delta"}
    start, done = events[0][1], events[-1][1]
    assert start["conversation"]["id"] == conversation["id"]
    assert start["message_id"] == done["message_id"]
    assert done["state"] in MESSAGE_STATES
    if done["state"] == "ready":
        assert done["text"] == "".join(data["text"] for name, data in events if name == "delta")
        assert done["text"]

    stored = api.get("/conversations/" + conversation["id"]).json()
    assert len(stored["messages"]) == 2
    user, answer = stored["messages"]
    assert user["role"] == "user" and answer["role"] == "assistant"
    assert answer["id"] == done["message_id"]
    assert answer["text"] == done["text"]
    api.delete("/conversations/" + conversation["id"])


def test_generate_rejects_stale_message_count(api, model_id):
    conversation = new_conversation(api)
    response = generate(api, conversation, model_id, expected_message_count=5)
    assert response.status_code == 409
    assert isinstance(response.json()["detail"], str)
    api.delete("/conversations/" + conversation["id"])


# --- Optional capabilities --------------------------------------------------------


def test_models_manage(api, capabilities):
    requires(capabilities, "models.manage")
    models = api.get("/models").json()
    assert isinstance(models, list)
    assert all("secret" not in m and "api_key" not in m for m in models)


def test_projects(api, capabilities):
    requires(capabilities, "projects")
    project = api.post("/projects", json={"title": "Contract project"}).json()
    assert project["id"]
    assert project["id"] in [p["id"] for p in api.get("/workspace").json()["projects"]]
    updated = api.patch("/projects/" + project["id"], json={"title": "Renamed project"})
    assert updated.json()["title"] == "Renamed project"
    assert api.delete("/projects/" + project["id"]).status_code == 200


def test_documents(api, capabilities):
    requires(capabilities, "documents")
    files = {"file": ("contract.txt", b"Contract document text.", "text/plain")}
    document = api.post("/documents", files=files).json()
    for key in ("id", "name", "pages"):
        assert key in document
    detail = api.get("/documents/" + document["id"]).json()
    assert detail["chunks"] and "text" in detail["chunks"][0]
    assert api.delete("/documents/" + document["id"]).status_code == 200


def test_presets(api, capabilities):
    requires(capabilities, "presets")
    preset = api.post("/presets", json={"title": "Contract", "instructions": "Be brief."}).json()
    assert preset["id"]
    assert api.delete("/presets/" + preset["id"]).status_code == 200


def test_search(api, capabilities):
    requires(capabilities, "search")
    response = api.get("/search", params={"q": "contract", "archived": "false"})
    assert response.status_code == 200
    for item in response.json():
        assert {"id", "title", "preview"} <= set(item)


def test_usage(api, capabilities):
    requires(capabilities, "usage")
    body = api.get("/usage").json()
    for key in ("requests", "today", "input_tokens", "output_tokens", "estimated_cost", "recent"):
        assert key in body


def test_settings(api, capabilities):
    requires(capabilities, "settings")
    current = api.get("/workspace").json()["settings"]["daily_request_limit"]
    response = api.patch("/settings", json={"daily_request_limit": current})
    assert response.status_code == 200


def test_cancel_unknown_request_is_harmless(api, capabilities):
    requires(capabilities, "cancel")
    assert api.post(f"/generations/{uuid4()}/cancel").status_code == 200


def test_reasoning_is_accepted(api, capabilities, model_id):
    requires(capabilities, "reasoning")
    conversation = new_conversation(api)
    assert generate(api, conversation, model_id, reasoning="low").status_code == 200
    api.delete("/conversations/" + conversation["id"])


def test_branching_and_bookmarks(api, capabilities, model_id):
    if not {"branching", "bookmarks"} & capabilities:
        pytest.skip("Backend advertises neither 'branching' nor 'bookmarks'.")
    conversation = new_conversation(api)
    generate(api, conversation, model_id)
    stored = api.get("/conversations/" + conversation["id"]).json()
    user, answer = stored["messages"]
    created = []
    if "bookmarks" in capabilities:
        path = f"/conversations/{conversation['id']}/messages/{answer['id']}"
        saved = api.patch(path, json={"saved": True}).json()
        assert saved["messages"][-1]["saved"] is True
    if "branching" in capabilities:
        branch = api.post(f"/conversations/{conversation['id']}/branch",
                          json={"message_id": answer["id"], "include_message": True}).json()
        created.append(branch["id"])
        assert branch["id"] != conversation["id"]
        assert len(branch["messages"]) == 2
        assert branch["parentId"] == conversation["id"]
    for conversation_id in [conversation["id"], *created]:
        api.delete("/conversations/" + conversation_id)


def test_research(api, capabilities):
    requires(capabilities, "research")
    options = api.get("/research/options").json()
    assert {"quick", "standard", "deep"} <= set(options["depths"])
    for source in options["sources"]:
        assert {"id", "name", "ready"} <= set(source)
    assert isinstance(api.get("/research/runs").json(), list)
    assert api.get("/research/runs/does-not-exist").status_code == 404


def test_research_connectors(api, capabilities):
    requires(capabilities, "research.connectors")
    body = api.get("/connectors").json()
    assert isinstance(body["connectors"], list) and isinstance(body["usage"], list)
    for item in body["connectors"]:
        assert {"id", "type", "name", "status", "tools"} <= set(item)
        assert "secret" not in item
    assert isinstance(api.get("/tool-calls").json(), list)
