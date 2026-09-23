from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    ModelDescriptor,
    ResolutionSections,
)

MODEL_LABELS = {
    "llama3.1:8b": "Local Llama 3.1 8B",
    "gpt-4o-mini": "OpenAI GPT-4o mini",
}


app = FastAPI(
    title="LLM Chat Starter Backend",
    version="0.1.0",
    description="A minimal FastAPI backend that serves the frontend starter contract.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


RATE_LIMIT_REQUESTS = 30
RATE_LIMIT_WINDOW_SECONDS = 60.0
RATE_LIMITED_PATHS = ("/chat",)

_hits: dict[str, deque[float]] = defaultdict(deque)
_hits_lock = Lock()


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    """Cap per-client calls on the expensive endpoints.

    The stub backend is cheap, but /chat is the path that will forward to a paid
    LLM provider, so the ceiling belongs here before that wiring lands.
    """
    if not request.url.path.startswith(RATE_LIMITED_PATHS):
        return await call_next(request)

    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS

    with _hits_lock:
        seen = _hits[client]
        while seen and seen[0] < cutoff:
            seen.popleft()
        if len(seen) >= RATE_LIMIT_REQUESTS:
            retry_after = max(1, int(seen[0] - cutoff) + 1)
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={"Retry-After": str(retry_after)},
            )
        seen.append(now)

    return await call_next(request)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="llm-chat-starter-backend")


@app.get("/models", response_model=list[ModelDescriptor])
def list_models() -> list[ModelDescriptor]:
    return [ModelDescriptor(id=model_id, label=label) for model_id, label in MODEL_LABELS.items()]


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    answer = (
        "Backend is connected, but no real LLM provider is configured yet. "
        "Connect OpenAI, Anthropic, Gemini, DeepSeek, Kimi, or a local model to get real answers."
    )

    return ChatResponse(
        answer=answer,
        diagnostic_label="",
        sections=ResolutionSections(
            businessContext="",
            rootCause="",
            steps=[],
            prevention=[],
        ),
        sources=[],
        latency_ms=0,
        model=request.model,
        requested_model=request.model,
        generation_model=request.model,
        generation_label=MODEL_LABELS.get(request.model, request.model),
        generation_note="",
    )
