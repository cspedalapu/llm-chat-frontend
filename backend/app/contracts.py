from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, model_validator


class ProviderInput(BaseModel):
    label: str = Field(min_length=1, max_length=100)
    kind: Literal["openai", "anthropic", "gemini", "ollama"] = "openai"
    base_url: str = Field(max_length=500)
    model: str = Field(min_length=1, max_length=150, pattern=r"^[a-zA-Z0-9_.:/-]+$")
    api_key: str = Field(default="", max_length=4096)
    context_tokens: int = Field(default=16000, ge=2048, le=2000000)
    max_output_tokens: int = Field(default=2048, ge=64, le=64000)
    input_price: float | None = Field(default=None, ge=0, le=10000)
    output_price: float | None = Field(default=None, ge=0, le=10000)
    system_role: Literal["system", "developer"] = "system"
    token_parameter: Literal["max_tokens", "max_completion_tokens"] = "max_tokens"
    include_usage: bool = True
    reasoning: Literal["", "low", "medium", "high"] = ""

    @model_validator(mode="after")
    def validate_config(self):
        parsed = urlsplit(self.base_url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise ValueError("Enter a complete HTTP(S) API base URL")
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("Keep credentials and query parameters out of the base URL")
        if parsed.scheme == "http" and parsed.hostname not in (
            "localhost",
            "127.0.0.1",
            "::1",
            "host.docker.internal",
        ):
            raise ValueError(
                "Remote providers require HTTPS; HTTP is allowed only for local models"
            )
        if self.max_output_tokens + 1024 >= self.context_tokens:
            raise ValueError("Context limit must leave at least 1024 tokens for input")
        self.base_url = self.base_url.rstrip("/")
        return self


class ProjectInput(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    instructions: str = Field(default="", max_length=12000)
    memory: str = Field(default="", max_length=12000)
    template: str | None = None


class ConversationInput(BaseModel):
    title: str = Field(default="New chat", min_length=1, max_length=150)
    model: str = Field(default="", max_length=150)
    projectId: str | None = None
    archived: bool = False
    pinned: bool = False
    summary: str = Field(default="", max_length=12000)


class PresetInput(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    instructions: str = Field(min_length=1, max_length=12000)
    model: str = ""
    output_format: str = Field(default="", max_length=1000)


class GenerateInput(BaseModel):
    request_id: str = Field(min_length=1, max_length=100)
    query: str = Field(min_length=1, max_length=32000)
    model: str
    preset_id: str | None = None
    document_ids: list[str] = Field(default_factory=list, max_length=20)
    expected_message_count: int = Field(ge=0)


class BranchInput(BaseModel):
    message_id: str
    include_message: bool = False


class MessageUpdate(BaseModel):
    saved: bool


class SettingsInput(BaseModel):
    daily_request_limit: int = Field(default=200, ge=1, le=100000)
