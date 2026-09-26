"""Shared types for research tools.

A tool is something the model may call during a research run: search the web, read
a page, search papers, read a Drive file, call an MCP server. Every tool is described
the same way so the engine can offer it to any model, enforce permissions, and log
each call without knowing what the tool does.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Literal

Access = Literal["read", "write"]


@dataclass
class Source:
    """Something a report can cite. `content` is the text we actually hold for it."""

    title: str
    url: str
    snippet: str = ""
    content: str = ""
    kind: str = "web"  # web | paper | library | table | drive | onedrive | mcp


@dataclass
class ToolResult:
    sources: list[Source] = field(default_factory=list)
    # Extra text for the model beyond the source list (e.g. a table summary).
    text: str = ""
    error: str = ""


@dataclass
class ToolContext:
    run_id: str
    owner: str
    # URLs the model may open with fetch tools: search results, the question, the plan.
    allowed_urls: set[str] = field(default_factory=set)
    allowed_domains: list[str] = field(default_factory=list)
    blocked_domains: list[str] = field(default_factory=list)


Runner = Callable[[dict, ToolContext], Awaitable[ToolResult]]


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    connector: str  # connector key, used for permissions, status and tracking
    run: Runner
    access: Access = "read"
    label: str = ""  # human name shown in the timeline ("Web search", "arXiv")
    # Name the connector's permissions are keyed by (MCP tools are exposed prefixed).
    permission_key: str = ""

    @property
    def key(self) -> str:
        return self.permission_key or self.name

    def spec(self) -> dict:
        return {"name": self.name, "description": self.description, "parameters": self.parameters}


class ToolError(Exception):
    """A tool failed in a way the model and the user may see (message must be safe)."""


def object_schema(properties: dict, required: list[str]) -> dict:
    return {"type": "object", "properties": properties, "required": required}
