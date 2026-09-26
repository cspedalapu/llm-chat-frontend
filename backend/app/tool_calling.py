"""Non-streaming, tool-using model calls, normalized across provider wire formats.

Chat streaming lives in providers.py. Agent loops (research) need something else:
one request, a complete answer, and any tool calls the model wants to make. This
module converts one neutral message format to each provider's format and back.

Neutral messages:
    {"role": "system" | "user", "content": str}
    {"role": "assistant", "content": str, "tool_calls": [ToolCall, ...]}   # tool_calls optional
    {"role": "tool", "tool_call_id": str, "name": str, "content": str}

ToolCall: {"id": str, "name": str, "arguments": dict}
Tool spec: {"name": str, "description": str, "parameters": <JSON Schema object>}

Provider-specific data a provider requires back on the next turn (DeepSeek's
``reasoning_content``, Gemini's thought signatures) rides along on the assistant
message under ``_provider`` and is only ever sent back to the same kind.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote
from uuid import uuid4

import httpx

from .providers import ProviderError, http_error
from .secrets import decrypt


@dataclass
class Completion:
    text: str = ""
    tool_calls: list[dict] = field(default_factory=list)
    usage: dict = field(default_factory=dict)
    model: str = ""
    finish: str = ""
    # Opaque data to echo back on the assistant message (see module docstring).
    provider_data: dict = field(default_factory=dict)

    def as_message(self) -> dict:
        message: dict[str, Any] = {"role": "assistant", "content": self.text}
        if self.tool_calls:
            message["tool_calls"] = self.tool_calls
        if self.provider_data:
            message["_provider"] = self.provider_data
        return message


def _arguments(raw: Any) -> dict:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            value = json.loads(raw)
        except ValueError:
            return {"_unparsed": raw}
        return value if isinstance(value, dict) else {"value": value}
    return {}


def _merge_user(turns: list[dict], blocks: list) -> None:
    """Append user content blocks, merging with a preceding user turn (Anthropic/Gemini)."""
    if turns and turns[-1]["role"] == "user" and isinstance(turns[-1]["content"], list):
        turns[-1]["content"].extend(blocks)
    else:
        turns.append({"role": "user", "content": blocks})


# ---------------------------------------------------------------- request builders


def _openai(provider, messages, tools, limit):
    converted = []
    for m in messages:
        if m["role"] == "system":
            converted.append(
                {"role": provider.get("system_role", "system"), "content": m["content"]}
            )
        elif m["role"] == "assistant":
            item: dict[str, Any] = {"role": "assistant", "content": m.get("content") or None}
            if m.get("tool_calls"):
                item["tool_calls"] = [
                    {
                        "id": c["id"],
                        "type": "function",
                        "function": {"name": c["name"], "arguments": json.dumps(c["arguments"])},
                    }
                    for c in m["tool_calls"]
                ]
            extra = m.get("_provider", {})
            if extra.get("kind") == "openai" and extra.get("reasoning_content"):
                # DeepSeek thinking mode requires its reasoning back on tool-call turns.
                item["reasoning_content"] = extra["reasoning_content"]
            converted.append(item)
        elif m["role"] == "tool":
            converted.append(
                {"role": "tool", "tool_call_id": m["tool_call_id"], "content": m["content"]}
            )
        else:
            converted.append({"role": "user", "content": m["content"]})
    body: dict[str, Any] = {
        "model": provider["model"],
        "messages": converted,
        "stream": False,
        provider.get("token_parameter", "max_tokens"): limit,
    }
    if tools:
        body["tools"] = [
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["parameters"],
                },
            }
            for t in tools
        ]
    if provider.get("reasoning"):
        body["reasoning_effort"] = provider["reasoning"]
    return provider["base_url"] + "/chat/completions", body


def _anthropic(provider, messages, tools, limit):
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    turns: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            continue
        if m["role"] == "assistant":
            blocks: list[dict] = []
            if m.get("content"):
                blocks.append({"type": "text", "text": m["content"]})
            for c in m.get("tool_calls", []):
                blocks.append(
                    {"type": "tool_use", "id": c["id"], "name": c["name"], "input": c["arguments"]}
                )
            turns.append({"role": "assistant", "content": blocks or [{"type": "text", "text": ""}]})
        elif m["role"] == "tool":
            _merge_user(
                turns,
                [
                    {
                        "type": "tool_result",
                        "tool_use_id": m["tool_call_id"],
                        "content": m["content"],
                    }
                ],
            )
        else:
            _merge_user(turns, [{"type": "text", "text": m["content"]}])
    body: dict[str, Any] = {
        "model": provider["model"],
        "system": system,
        "messages": turns,
        "max_tokens": limit,
    }
    if tools:
        body["tools"] = [
            {"name": t["name"], "description": t["description"], "input_schema": t["parameters"]}
            for t in tools
        ]
    return provider["base_url"] + "/messages", body


def _gemini(provider, messages, tools, limit):
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    contents: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            continue
        if m["role"] == "assistant":
            extra = m.get("_provider", {})
            if extra.get("kind") == "gemini" and extra.get("parts"):
                # Echo the model's own parts: they carry thought signatures Gemini requires.
                parts = extra["parts"]
            else:
                parts = ([{"text": m["content"]}] if m.get("content") else []) + [
                    {"functionCall": {"name": c["name"], "args": c["arguments"]}}
                    for c in m.get("tool_calls", [])
                ]
            contents.append({"role": "model", "parts": parts or [{"text": ""}]})
        elif m["role"] == "tool":
            block = {"functionResponse": {"name": m["name"], "response": {"result": m["content"]}}}
            if contents and contents[-1]["role"] == "user":
                contents[-1]["parts"].append(block)
            else:
                contents.append({"role": "user", "parts": [block]})
        elif contents and contents[-1]["role"] == "user":
            contents[-1]["parts"].append({"text": m["content"]})
        else:
            contents.append({"role": "user", "parts": [{"text": m["content"]}]})
    body: dict[str, Any] = {"contents": contents, "generationConfig": {"maxOutputTokens": limit}}
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    if tools:
        body["tools"] = [
            {
                "functionDeclarations": [
                    {
                        "name": t["name"],
                        "description": t["description"],
                        "parametersJsonSchema": t["parameters"],
                    }
                    for t in tools
                ]
            }
        ]
    model = quote(provider["model"].removeprefix("models/"), safe="")
    return provider["base_url"] + "/models/" + model + ":generateContent", body


def _ollama(provider, messages, tools, limit):
    converted = []
    for m in messages:
        if m["role"] == "assistant":
            item: dict[str, Any] = {"role": "assistant", "content": m.get("content", "")}
            if m.get("tool_calls"):
                item["tool_calls"] = [
                    {"function": {"name": c["name"], "arguments": c["arguments"]}}
                    for c in m["tool_calls"]
                ]
            converted.append(item)
        elif m["role"] == "tool":
            converted.append({"role": "tool", "content": m["content"], "tool_name": m["name"]})
        else:
            converted.append({"role": m["role"], "content": m["content"]})
    body: dict[str, Any] = {
        "model": provider["model"],
        "messages": converted,
        "stream": False,
        "options": {"num_predict": limit, "num_ctx": provider["context_tokens"]},
    }
    if tools:
        body["tools"] = [
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["parameters"],
                },
            }
            for t in tools
        ]
    return provider["base_url"] + "/api/chat", body


BUILDERS = {"openai": _openai, "anthropic": _anthropic, "gemini": _gemini, "ollama": _ollama}


def build_tool_request(provider, messages, tools=None, max_tokens=None):
    kind = provider["kind"]
    key = decrypt(provider.get("secret", ""))
    headers = {"Content-Type": "application/json"}
    if kind == "anthropic":
        headers.update({"x-api-key": key, "anthropic-version": "2023-06-01"})
    elif kind == "gemini":
        headers["x-goog-api-key"] = key
    elif key:
        headers["Authorization"] = "Bearer " + key
    limit = max_tokens or provider["max_output_tokens"]
    url, body = BUILDERS[kind](provider, messages, tools or [], limit)
    return url, headers, body


# ---------------------------------------------------------------- response parsing


def parse_tool_response(kind: str, data: dict) -> Completion:
    if data.get("error"):
        raise ProviderError("Provider reported an error. Check its service status.")
    out = Completion(model=data.get("model", ""))
    if kind == "openai":
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        out.text = message.get("content") or ""
        out.finish = choice.get("finish_reason") or ""
        out.tool_calls = [
            {
                "id": c.get("id") or "call_" + uuid4().hex[:12],
                "name": c["function"]["name"],
                "arguments": _arguments(c["function"].get("arguments")),
            }
            for c in message.get("tool_calls") or []
        ]
        if message.get("reasoning_content"):
            out.provider_data = {
                "kind": "openai",
                "reasoning_content": message["reasoning_content"],
            }
        usage = data.get("usage") or {}
        out.usage = {
            "input": usage.get("prompt_tokens", 0),
            "output": usage.get("completion_tokens", 0),
        }
    elif kind == "anthropic":
        for block in data.get("content", []):
            if block.get("type") == "text":
                out.text += block.get("text", "")
            elif block.get("type") == "tool_use":
                out.tool_calls.append(
                    {
                        "id": block["id"],
                        "name": block["name"],
                        "arguments": _arguments(block.get("input")),
                    }
                )
        out.finish = data.get("stop_reason") or ""
        usage = data.get("usage") or {}
        out.usage = {"input": usage.get("input_tokens", 0), "output": usage.get("output_tokens", 0)}
    elif kind == "gemini":
        if data.get("promptFeedback", {}).get("blockReason"):
            raise ProviderError("The provider declined this prompt.")
        candidate = (data.get("candidates") or [{}])[0]
        parts = candidate.get("content", {}).get("parts", [])
        for part in parts:
            if part.get("text") and not part.get("thought"):
                out.text += part["text"]
            if part.get("functionCall"):
                call = part["functionCall"]
                out.tool_calls.append(
                    {
                        "id": call.get("id") or "call_" + uuid4().hex[:12],
                        "name": call["name"],
                        "arguments": _arguments(call.get("args")),
                    }
                )
        if out.tool_calls:
            out.provider_data = {"kind": "gemini", "parts": parts}
        out.finish = candidate.get("finishReason") or ""
        out.model = data.get("modelVersion", "")
        usage = data.get("usageMetadata") or {}
        out.usage = {
            "input": usage.get("promptTokenCount", 0),
            "output": usage.get("candidatesTokenCount", 0) + usage.get("thoughtsTokenCount", 0),
        }
    else:
        message = data.get("message") or {}
        out.text = message.get("content") or ""
        out.tool_calls = [
            {
                "id": "call_" + uuid4().hex[:12],
                "name": c["function"]["name"],
                "arguments": _arguments(c["function"].get("arguments")),
            }
            for c in message.get("tool_calls") or []
        ]
        out.finish = data.get("done_reason") or ""
        out.usage = {"input": data.get("prompt_eval_count", 0), "output": data.get("eval_count", 0)}
    return out


async def complete(provider, messages, tools=None, *, max_tokens=None, timeout=120.0) -> Completion:
    """One model turn. Raises ProviderError with a user-safe message on any failure."""
    url, headers, body = build_tool_request(provider, messages, tools, max_tokens)
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout, connect=15), follow_redirects=False
        ) as client:
            response = await client.post(url, headers=headers, json=body)
        if response.status_code >= 300:
            raise http_error(response.status_code)
        return parse_tool_response(provider["kind"], response.json())
    except httpx.TimeoutException as exc:
        raise ProviderError("Provider timed out. Check the connection and retry.") from exc
    except httpx.HTTPError as exc:
        raise ProviderError(
            "Could not connect to the provider. Check its base URL and service."
        ) from exc
    except (ValueError, KeyError, TypeError, IndexError) as exc:
        raise ProviderError("Unexpected provider response. Check the selected API type.") from exc


PROBE_TOOL = {
    "name": "report_status",
    "description": "Report that the connection works.",
    "parameters": {
        "type": "object",
        "properties": {"status": {"type": "string"}},
        "required": ["status"],
    },
}


async def supports_tools(provider) -> bool:
    """True when the model answers a trivial prompt with a tool call."""
    try:
        result = await complete(
            provider,
            [
                {
                    "role": "user",
                    "content": "Call the report_status tool with status 'ok'. "
                    "Do not reply with text.",
                }
            ],
            [PROBE_TOOL],
            max_tokens=256,
            timeout=45,
        )
    except ProviderError:
        return False
    return any(c["name"] == PROBE_TOOL["name"] for c in result.tool_calls)
