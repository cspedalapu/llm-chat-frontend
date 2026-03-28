from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import ChatRequest, ChatResponse, HealthResponse, ModelDescriptor, ResolutionSections


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
