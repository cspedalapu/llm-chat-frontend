from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ModelId = Literal["llama3.1:8b", "gpt-4o-mini"]
MessageRole = Literal["assistant", "user"]


MAX_MESSAGE_CHARS = 8_000
MAX_HISTORY_MESSAGES = 50


class ChatHistoryMessage(BaseModel):
    role: MessageRole
    text: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)


class ChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    model: ModelId
    top_k: int = Field(default=3, ge=1, le=20)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=MAX_HISTORY_MESSAGES)


class ResolutionSource(BaseModel):
    title: str
    system: str
    origin: str
    summary: str
    confidence: str


class ResolutionSections(BaseModel):
    businessContext: str
    rootCause: str
    steps: list[str]
    prevention: list[str]


class ChatResponse(BaseModel):
    answer: str
    diagnostic_label: str
    sections: ResolutionSections
    sources: list[ResolutionSource]
    latency_ms: int
    model: ModelId
    requested_model: str
    generation_model: str
    generation_label: str
    generation_note: str = ""


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str


class ModelDescriptor(BaseModel):
    id: ModelId
    label: str
