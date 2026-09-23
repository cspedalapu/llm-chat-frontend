"""Contract tests for the stub backend.

These lock the request/response shape the frontend depends on, plus the input
limits and rate ceiling that guard the endpoint once a real provider is wired.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app import main
from backend.app.main import app
from backend.app.schemas import MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS


@pytest.fixture
def client() -> TestClient:
    main._hits.clear()
    return TestClient(app)


def _payload(**overrides) -> dict:
    body = {"query": "why is my deploy failing", "model": "gpt-4o-mini"}
    body.update(overrides)
    return body


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "llm-chat-starter-backend"}


def test_models_lists_both_ids(client: TestClient) -> None:
    response = client.get("/models")
    assert response.status_code == 200
    assert {item["id"] for item in response.json()} == {"llama3.1:8b", "gpt-4o-mini"}


def test_chat_returns_full_contract(client: TestClient) -> None:
    response = client.post("/chat", json=_payload())
    assert response.status_code == 200

    body = response.json()
    expected_keys = {
        "answer", "diagnostic_label", "sections", "sources", "latency_ms",
        "model", "requested_model", "generation_model", "generation_label",
        "generation_note",
    }
    assert expected_keys <= body.keys()
    assert body["model"] == "gpt-4o-mini"
    assert body["generation_label"] == "OpenAI GPT-4o mini"
    assert set(body["sections"]) == {"businessContext", "rootCause", "steps", "prevention"}


def test_chat_rejects_unknown_model(client: TestClient) -> None:
    assert client.post("/chat", json=_payload(model="gpt-5-ultra")).status_code == 422


def test_chat_rejects_empty_query(client: TestClient) -> None:
    assert client.post("/chat", json=_payload(query="")).status_code == 422


def test_chat_rejects_oversized_query(client: TestClient) -> None:
    oversized = "x" * (MAX_MESSAGE_CHARS + 1)
    assert client.post("/chat", json=_payload(query=oversized)).status_code == 422


def test_chat_rejects_oversized_history(client: TestClient) -> None:
    history = [{"role": "user", "text": "hi"}] * (MAX_HISTORY_MESSAGES + 1)
    assert client.post("/chat", json=_payload(history=history)).status_code == 422


@pytest.mark.parametrize("top_k", [0, 21])
def test_chat_rejects_out_of_range_top_k(client: TestClient, top_k: int) -> None:
    assert client.post("/chat", json=_payload(top_k=top_k)).status_code == 422


def test_chat_accepts_history_at_the_limit(client: TestClient) -> None:
    history = [{"role": "user", "text": "hi"}] * MAX_HISTORY_MESSAGES
    assert client.post("/chat", json=_payload(history=history)).status_code == 200


def test_rate_limit_trips_then_reports_retry_after(client: TestClient) -> None:
    for _ in range(main.RATE_LIMIT_REQUESTS):
        assert client.post("/chat", json=_payload()).status_code == 200

    blocked = client.post("/chat", json=_payload())
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 1


def test_rate_limit_does_not_apply_to_reads(client: TestClient) -> None:
    for _ in range(main.RATE_LIMIT_REQUESTS + 5):
        assert client.get("/models").status_code == 200
