from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import ChatRequest, ChatResponse, HealthResponse, ModelDescriptor, ResolutionSections, ResolutionSource


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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="llm-chat-starter-backend")


@app.get("/models", response_model=list[ModelDescriptor])
def list_models() -> list[ModelDescriptor]:
    return [ModelDescriptor(id=model_id, label=label) for model_id, label in MODEL_LABELS.items()]


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    history_hint = (
        f"The current conversation already includes {len(request.history)} earlier message(s). "
        if request.history
        else "This is the first message in the current conversation. "
    )
    model_tail = (
        "The next step is to connect this starter API to a hosted provider adapter."
        if request.model == "gpt-4o-mini"
        else "The next step is to connect this starter API to a local or self-hosted model adapter."
    )

    return ChatResponse(
        answer=(
            f"I received your request: '{request.query}'. {history_hint}"
            "This backend is intentionally generic so it can serve as a reusable base for later projects. "
            f"{model_tail}"
        ),
        diagnostic_label="Starter backend response",
        sections=ResolutionSections(
            businessContext=(
                "The request reached the API contract correctly and the frontend-backend integration is working."
            ),
            rootCause=(
                "No provider-specific reasoning is happening yet. The backend is returning a seeded starter response."
            ),
            steps=[
                "Confirm the frontend can post messages and render the API response.",
                "Replace this seeded handler with a real provider adapter when ready.",
                "Add persistence, streaming, and project-scoped context as the next platform steps.",
            ],
            prevention=[
                "Keep provider-specific logic behind a normalized adapter layer.",
                "Avoid tying the UI directly to one vendor's request and response shape.",
            ],
        ),
        sources=[
            ResolutionSource(
                title="Generic starter backend",
                system="FastAPI foundation",
                origin="Seeded API response",
                summary="This response proves the contract is live and ready for a real model integration.",
                confidence="Starter",
            )
        ],
        latency_ms=240,
        model=request.model,
        requested_model=request.model,
        generation_model=request.model,
        generation_label=MODEL_LABELS.get(request.model, request.model),
        generation_note="Seeded FastAPI starter backend response.",
    )
