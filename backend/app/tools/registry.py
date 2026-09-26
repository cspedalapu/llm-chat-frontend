"""Turns the sources a user picked for a run into the concrete tools the model may call."""

from __future__ import annotations

from .. import connectors, oauth, store
from . import academic, cloud, library, mcp, web
from .base import Tool

# Source chips shown in the Research form -> connector keys.
SOURCE_CONNECTORS = {
    "web": "web_search",
    "academic": "academic",
    "library": "library",
    "google_drive": "google_drive",
    "microsoft": "microsoft",
}


def connector_for_source(con, owner: str, source: str) -> dict | None:
    if source.startswith("mcp:"):
        item = store.get(con, "connector", source[4:])
        return item if item and item.get("owner") == owner and item["type"] == "mcp" else None
    key = SOURCE_CONNECTORS.get(source)
    if key is None:
        return None
    connectors.ensure_defaults(con, owner)
    return store.get(con, "connector", connectors.record_id(owner, key))


def available_sources(con, owner: str) -> list[dict]:
    """What the Research form can offer, with readiness, in display order."""
    out = []
    for item in connectors.all_for(con, owner):
        view = connectors.public(item)
        source = (
            next((s for s, k in SOURCE_CONNECTORS.items() if k == item["key"]), None)
            or f"mcp:{item['id']}"
        )
        out.append(
            {
                "id": source,
                "connector_id": item["id"],
                "name": item["name"],
                "type": item["type"],
                "status": view["status"],
                "enabled": item.get("enabled", True),
                "ready": view["status"] == "ready" and item.get("enabled", True),
            }
        )
    return out


def _token_getter(connector_id: str):
    async def get() -> str:
        with store.db() as con:
            item = store.get(con, "connector", connector_id)
            return await oauth.access_token(con, item)

    return get


async def build(
    con, owner: str, sources: list[str], sessions: mcp.McpSessions
) -> tuple[list[Tool], dict[str, dict]]:
    """Tools for the chosen sources, plus the connector records they belong to (by id)."""
    tools: list[Tool] = []
    owners: dict[str, dict] = {}
    for source in dict.fromkeys(sources):
        item = connector_for_source(con, owner, source)
        if item is None or not connectors.usable(item):
            continue
        owners[item["id"]] = item
        key = item["key"]
        if key == "web_search":
            config = {**item["config"], "api_key": connectors.secrets_of(item).get("api_key", "")}
            made = [web.search_tool(config), web.read_page_tool()]
        elif key == "academic":
            made = [academic.papers_tool(item["config"].get("databases"))]
        elif key == "library":
            made = [library.search_library_tool(), library.read_table_tool()]
        elif key == "google_drive":
            made = cloud.google_drive_tools(_token_getter(item["id"]))
        elif key == "microsoft":
            made = cloud.microsoft_tools(_token_getter(item["id"]))
        elif item["type"] == "mcp":
            headers = {}
            if item["config"].get("auth") in ("bearer", "oauth"):
                token = await oauth.access_token(con, item)
                headers["Authorization"] = "Bearer " + token
            made = mcp.connector_tools(item, headers, sessions)
        else:
            made = []
        for tool in made:
            tool.connector = item["id"]
        tools.extend(made)
    return tools, owners
