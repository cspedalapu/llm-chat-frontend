"""Provider wire protocols normalized to text, usage, model and finish events."""

from __future__ import annotations

import json
from urllib.parse import quote

import httpx

from .secrets import decrypt


class ProviderError(Exception):
    pass


HTTP_HINTS = {
    401: "Check the API key.",
    403: "Check model access and permissions.",
    404: "Check the base URL and model ID.",
    429: "Provider quota or rate limit reached. Retry later.",
    400: "Check the model settings and supported request options.",
}


def http_error(status: int) -> ProviderError:
    # Never reflect raw provider bodies: they may contain keys or prompt content.
    return ProviderError(
        f"Provider returned HTTP {status}. " + HTTP_HINTS.get(status, "Try again later.")
    )


def build_request(provider, messages):
    kind = provider["kind"]
    base = provider["base_url"]
    model = provider["model"]
    key = decrypt(provider.get("secret", ""))
    headers = {"Content-Type": "application/json"}
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    turns = [m for m in messages if m["role"] != "system"]
    limit = provider["max_output_tokens"]
    if kind == "anthropic":
        headers.update({"x-api-key": key, "anthropic-version": "2023-06-01"})
        return (
            base + "/messages",
            headers,
            {
                "model": model,
                "messages": turns,
                "system": system,
                "max_tokens": limit,
                "stream": True,
            },
        )
    if kind == "gemini":
        headers["x-goog-api-key"] = key
        return (
            base
            + "/models/"
            + quote(model.removeprefix("models/"), safe="")
            + ":streamGenerateContent?alt=sse",
            headers,
            {
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [
                    {
                        "role": "model" if m["role"] == "assistant" else "user",
                        "parts": [{"text": m["content"]}],
                    }
                    for m in turns
                ],
                "generationConfig": {"maxOutputTokens": limit},
            },
        )
    if kind == "ollama":
        if key:
            headers["Authorization"] = "Bearer " + key
        return (
            base + "/api/chat",
            headers,
            {
                "model": model,
                "messages": messages,
                "stream": True,
                "options": {"num_predict": limit, "num_ctx": provider["context_tokens"]},
            },
        )
    if key:
        headers["Authorization"] = "Bearer " + key
    body = {
        "model": model,
        "messages": [
            {**m, "role": provider.get("system_role", "system")} if m["role"] == "system" else m
            for m in messages
        ],
        "stream": True,
        provider.get("token_parameter", "max_tokens"): limit,
    }
    if provider.get("include_usage", True):
        body["stream_options"] = {"include_usage": True}
    if provider.get("reasoning"):
        body["reasoning_effort"] = provider["reasoning"]
    return base + "/chat/completions", headers, body


def normalize_chunk(kind, data):
    if data.get("error") or data.get("type") == "error":
        raise ProviderError(
            "Provider reported an error during generation. Check its service status."
        )
    if kind == "openai":
        if data.get("model"):
            yield {"model": data["model"]}
        for choice in data.get("choices", []):
            text = choice.get("delta", {}).get("content")
            if isinstance(text, str) and text:
                yield {"text": text}
            if choice.get("finish_reason"):
                yield {"finish": choice["finish_reason"]}
        if data.get("usage"):
            yield {
                "usage": {
                    "input": data["usage"].get("prompt_tokens", 0),
                    "output": data["usage"].get("completion_tokens", 0),
                }
            }
    elif kind == "anthropic":
        message = data.get("message", {})
        if message.get("model"):
            yield {"model": message["model"]}
        text = data.get("delta", {}).get("text")
        if text:
            yield {"text": text}
        usage = message.get("usage") or data.get("usage")
        if usage:
            yield {
                "usage": {
                    k: usage[v]
                    for k, v in (("input", "input_tokens"), ("output", "output_tokens"))
                    if v in usage
                }
            }
        if data.get("delta", {}).get("stop_reason"):
            yield {"finish": data["delta"]["stop_reason"]}
        if data.get("type") == "message_stop":
            yield {"done": True}
    elif kind == "gemini":
        if data.get("modelVersion"):
            yield {"model": data["modelVersion"]}
        for candidate in data.get("candidates", [])[:1]:
            for part in candidate.get("content", {}).get("parts", []):
                if part.get("text") and not part.get("thought"):
                    yield {"text": part["text"]}
            if candidate.get("finishReason"):
                yield {"finish": candidate["finishReason"], "done": True}
        if data.get("promptFeedback", {}).get("blockReason"):
            raise ProviderError("The provider declined this prompt.")
        if data.get("usageMetadata"):
            usage = data["usageMetadata"]
            yield {
                "usage": {
                    "input": usage.get("promptTokenCount", 0),
                    "output": usage.get("candidatesTokenCount", 0)
                    + usage.get("thoughtsTokenCount", 0),
                }
            }
    else:
        if data.get("model"):
            yield {"model": data["model"]}
        if data.get("message", {}).get("content"):
            yield {"text": data["message"]["content"]}
        if data.get("done"):
            yield {
                "done": True,
                "finish": data.get("done_reason", "stop"),
                "usage": {
                    "input": data.get("prompt_eval_count", 0),
                    "output": data.get("eval_count", 0),
                },
            }


async def stream(provider, messages):
    url, headers, body = build_request(provider, messages)
    finished = False
    timeout = httpx.Timeout(connect=15, read=120, write=30, pool=15)
    try:
        async with (
            httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client,
            client.stream("POST", url, headers=headers, json=body) as response,
        ):
            if response.status_code >= 300:
                raise http_error(response.status_code)
            async for line in response.aiter_lines():
                if provider["kind"] == "ollama":
                    payload = line.strip()
                elif line.startswith("data:"):
                    payload = line[5:].strip()
                else:
                    continue
                if not payload:
                    continue
                if payload == "[DONE]":
                    finished = True
                    break
                for event in normalize_chunk(provider["kind"], json.loads(payload)):
                    finished = finished or bool(event.get("done") or event.get("finish"))
                    yield event
            if not finished:
                raise ProviderError(
                    "Provider stream ended unexpectedly. Partial output was saved."
                )
    except httpx.TimeoutException as exc:
        raise ProviderError("Provider timed out. Check the connection and retry.") from exc
    except httpx.HTTPError as exc:
        raise ProviderError(
            "Could not connect to the provider. Check its base URL and service."
        ) from exc
    except (ValueError, KeyError, TypeError) as exc:
        raise ProviderError("Unexpected provider response. Check the selected API type.") from exc
