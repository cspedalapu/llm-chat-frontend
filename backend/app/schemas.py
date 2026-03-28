from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ModelId = Literal["llama3.1:8b", "gpt-4o-mini"]
MessageRole = Literal["assistant", "user"]


class ChatHistoryMessage(BaseModel):
    role: MessageRole
    text: str = Field(min_length=1)


class ChatRequest(BaseModel):
    query: str = Field(min_length=1)
    model: ModelId
    top_k: int = Field(default=3, ge=1, le=20)
    history: list[ChatHistoryMessage] = Field(default_factory=list)


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

