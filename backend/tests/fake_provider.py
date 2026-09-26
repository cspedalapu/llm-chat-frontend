"""Local protocol fixture for browser tests. Never used by the application itself."""

import asyncio
import json

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse

app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True}


PAGE_URL = "http://127.0.0.1:8012/pages/cobalt"


@app.get("/search")
def search(q: str = ""):
    """SearXNG-compatible JSON search, for the research browser test."""
    return {
        "results": [
            {
                "title": "Cobalt launch report",
                "url": PAGE_URL,
                "content": "Cobalt launches on Friday, the report says.",
            }
        ]
    }


@app.get("/pages/cobalt")
def page():
    html = (
        "<html><head><title>Cobalt launch report</title></head><body>"
        "<p>Cobalt launches Friday. The launch team is blue.</p></body></html>"
    )
    return HTMLResponse(html)


def _message(content="", tool_calls=None):
    message = {"role": "assistant", "content": content}
    if tool_calls:
        message["tool_calls"] = [
            {
                "id": f"call_{i}",
                "type": "function",
                "function": {"name": name, "arguments": json.dumps(args)},
            }
            for i, (name, args) in enumerate(tool_calls)
        ]
    return JSONResponse(
        {
            "model": "fixture",
            "choices": [{"message": message, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 40, "completion_tokens": 12},
        }
    )


def _complete(body):
    """Non-streaming turns used by research: plan, tool calls, findings."""
    messages = body["messages"]
    tools = {t["function"]["name"] for t in body.get("tools", [])}
    if "report_status" in tools:
        return _message(tool_calls=[("report_status", {"status": "ok"})])
    if messages[0]["content"].startswith("You plan research"):
        return _message(
            json.dumps(
                {
                    "title": "Cobalt launch timing",
                    "clarifying_questions": [],
                    "sub_questions": [{"question": "When does cobalt launch?"}],
                }
            )
        )
    done = [m for m in messages if m["role"] == "tool"]
    if "web_search" in tools and not done:
        return _message(tool_calls=[("web_search", {"query": "cobalt launch"})])
    if "read_page" in tools and len(done) == 1:
        return _message(tool_calls=[("read_page", {"url": PAGE_URL})])
    return _message("- Cobalt launches Friday [1].\nGaps: none.")


@app.post("/v1/chat/completions")
async def chat(request: Request):
    body = await request.json()
    if body.get("stream") is False:
        return _complete(body)
    prompt = body["messages"][-1]["content"]
    if "fail-provider" in prompt:
        return JSONResponse({"error": "fixture failure"}, status_code=401)
    text = "## Local test answer\n\nModel: " + body["model"] + ". Cobalt launches Friday [1].\n\n"
    text += "```python\nprint('hello')\n```\n\n| Item | Value |\n| --- | --- |\n| Test | Passed |"

    async def events():
        for index in range(0, len(text), 12):
            yield (
                "data: "
                + json.dumps(
                    {
                        "model": body["model"],
                        "choices": [{"delta": {"content": text[index : index + 12]}}],
                    }
                )
                + "\n\n"
            )
            await asyncio.sleep(0.3 if "slow-response" in prompt else 0.02)
        yield 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
        yield 'data: {"choices":[],"usage":{"prompt_tokens":24,"completion_tokens":32}}\n\n'
        yield "data: [DONE]\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")
