"""Local protocol fixture for browser tests. Never used by the application itself."""

import asyncio
import json

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI()


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/v1/chat/completions")
async def chat(request: Request):
    body = await request.json()
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
