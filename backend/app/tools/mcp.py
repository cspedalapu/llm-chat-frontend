"""Remote MCP servers as research tools (Model Context Protocol, Streamable HTTP).

A connector stores the server URL and how to authenticate (none, a bearer token, or
OAuth). During a research run one session per server is opened and kept for the run.
Tool names are prefixed with the connector's slug so two servers can't collide, and a
tool counts as read-only only when the server marks it `readOnlyHint`.
"""

from __future__ import annotations

import json
import re
from contextlib import AsyncExitStack
from typing import Any

from mcp import Client
from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client

from .base import Source, Tool, ToolContext, ToolError, ToolResult

# Tests register in-process servers here: {url: MCPServer}. Never set in production.
TEST_SERVERS: dict[str, Any] = {}
RESULT_CHARS = 20_000


def _client(url: str, headers: dict[str, str]) -> Client:
    if url in TEST_SERVERS:
        return Client(TEST_SERVERS[url])
    return Client(
        streamable_http_client(url, http_client=create_mcp_http_client(headers=headers)),
        read_timeout_seconds=60,
    )


def tool_name(prefix: str, name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", f"{prefix}__{name}")[:64]


def describe(tool) -> dict:
    annotations = getattr(tool, "annotations", None)
    read_only = bool(annotations and getattr(annotations, "read_only_hint", False))
    return {
        "name": tool.name,
        "description": (tool.description or tool.title or tool.name)[:1000],
        "access": "read" if read_only else "write",
        "input_schema": tool.input_schema or {"type": "object", "properties": {}},
    }


async def list_tools(url: str, headers: dict[str, str]) -> list[dict]:
    """Connect once and return the server's tools (used by 'Test connection')."""
    try:
        async with _client(url, headers) as client:
            result = await client.list_tools()
    except Exception as exc:  # the SDK raises transport, protocol and HTTP errors
        raise ToolError(_friendly(exc)) from exc
    return [describe(t) for t in result.tools]


def _friendly(exc: Exception) -> str:
    text = str(exc)
    if "401" in text or "Unauthorized" in text:
        return "The MCP server rejected the credentials. Sign in again or update the token."
    if "404" in text:
        return "No MCP server at that URL. Check the address (it usually ends in /mcp)."
    return (
        "Could not talk to the MCP server. Check the URL and that it is reachable from the backend."
    )


def _content_text(result) -> str:
    parts = []
    for block in result.content or []:
        if getattr(block, "type", "") == "text":
            parts.append(block.text)
        elif getattr(block, "type", "") == "resource" and getattr(block.resource, "text", None):
            parts.append(block.resource.text)
    if not parts and getattr(result, "structured_content", None):
        parts.append(json.dumps(result.structured_content)[:RESULT_CHARS])
    return "\n".join(parts)[:RESULT_CHARS]


class McpSessions:
    """Opens each server once per run and closes them all when the run ends."""

    def __init__(self):
        self._stack = AsyncExitStack()
        self._clients: dict[str, Client] = {}

    async def __aenter__(self):
        await self._stack.__aenter__()
        return self

    async def __aexit__(self, *exc):
        return await self._stack.__aexit__(*exc)

    async def client(self, url: str, headers: dict[str, str]) -> Client:
        if url not in self._clients:
            try:
                self._clients[url] = await self._stack.enter_async_context(_client(url, headers))
            except Exception as exc:
                raise ToolError(_friendly(exc)) from exc
        return self._clients[url]


def connector_tools(connector: dict, headers: dict[str, str], sessions: McpSessions) -> list[Tool]:
    url = connector["config"]["url"]
    prefix = connector["config"].get("slug") or "mcp"
    tools = []
    for spec in connector.get("tools", []):

        async def run(args: dict, ctx: ToolContext, _name=spec["name"]) -> ToolResult:
            client = await sessions.client(url, headers)
            try:
                result = await client.call_tool(_name, args)
            except ToolError:
                raise
            except Exception as exc:
                raise ToolError(_friendly(exc)) from exc
            text = _content_text(result)
            if getattr(result, "is_error", False):
                raise ToolError((text or "The tool reported an error.")[:500])
            found = re.findall(r"https?://[^\s\"'<>)\]]+", text)
            ctx.allowed_urls.update(found[:50])  # URLs a tool returns may be opened with read_page
            return ToolResult(
                sources=[
                    Source(
                        title=f"{connector['name']}: {_name}",
                        url=f"mcp://{connector['id']}/{_name}",
                        snippet=text[:300],
                        content=text,
                        kind="mcp",
                    )
                ]
            )

        tools.append(
            Tool(
                name=tool_name(prefix, spec["name"]),
                description=spec["description"],
                parameters=spec.get("input_schema") or {"type": "object", "properties": {}},
                connector=connector["id"],
                run=run,
                access=spec["access"],
                label=f"{connector['name']}: {spec['name']}",
                permission_key=spec["name"],
            )
        )
    return tools
