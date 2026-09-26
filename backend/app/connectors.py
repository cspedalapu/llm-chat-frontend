"""Connectors: the research tools a user has set up, their secrets, status and permissions.

Three types:
- builtin: web search, academic databases, the user's library. Always present.
- oauth:   Google Drive and Microsoft 365, signed in per user (see oauth.py).
- mcp:     any remote MCP server the user adds by URL.

Records are scoped by `owner` (the id from auth.authenticate) so the same code serves
one local user today and many tenants later. Secrets are Fernet-encrypted with the
workspace key and never leave the backend (`public()` strips them).
"""

from __future__ import annotations

import json
import os
import re

from fastapi import HTTPException

from . import store
from .secrets import decrypt, encrypt

PERMISSIONS = ("allow", "ask", "block")

BUILTIN = {
    "web_search": {
        "name": "Web search",
        "description": "Search the web and read pages. Choose a search provider to enable it.",
        "config": {
            "provider": "",
            "base_url": "",
            "price_per_1k": None,
            "allowed_domains": [],
            "blocked_domains": [],
        },
        "tools": [
            ("web_search", "read", "Search the web"),
            ("read_page", "read", "Read a web page or PDF"),
        ],
    },
    "academic": {
        "name": "Academic papers",
        "description": "OpenAlex, arXiv, Semantic Scholar and PubMed. Free public APIs.",
        "config": {"databases": ["openalex", "arxiv", "semantic_scholar", "pubmed"]},
        "tools": [("search_papers", "read", "Search scholarly papers")],
    },
    "library": {
        "name": "Your library",
        "description": "Documents you uploaded: PDF, Word, Excel, CSV and text.",
        "config": {},
        "tools": [
            ("search_library", "read", "Search your documents"),
            ("read_table", "read", "Read an Excel or CSV table"),
        ],
    },
}

OAUTH = {
    "google_drive": {
        "name": "Google Drive",
        "description": "Search and read Docs, Sheets, Slides and files in your Drive (read-only).",
        "env": "GOOGLE_OAUTH_CLIENT_ID",
        "tools": [
            ("drive_search", "read", "Search Google Drive"),
            ("drive_read", "read", "Read a Drive file"),
        ],
    },
    "microsoft": {
        "name": "Microsoft OneDrive & SharePoint",
        "description": "Search and read Word, Excel, PDF and text files in OneDrive and "
        "SharePoint (read-only).",
        "env": "MICROSOFT_OAUTH_CLIENT_ID",
        "tools": [
            ("onedrive_search", "read", "Search OneDrive"),
            ("onedrive_read", "read", "Read a OneDrive file"),
        ],
    },
}


def _tool_list(entries) -> list[dict]:
    return [{"name": n, "access": a, "description": d} for n, a, d in entries]


def _base(owner: str, key: str, kind: str, spec: dict) -> dict:
    return {
        "id": key if kind != "mcp" else store.uid(),
        "key": key,
        "type": kind,
        "owner": owner,
        "name": spec["name"],
        "description": spec["description"],
        # The user's on/off switch. Whether it can actually run is `status`.
        "enabled": True,
        "config": dict(spec.get("config", {})),
        "tools": _tool_list(spec.get("tools", [])),
        "permissions": {},
        "secret": "",
        "status": "needs_setup",
        "status_detail": "",
        "updatedAt": store.now(),
    }


def record_id(owner: str, key: str) -> str:
    # Stable per-owner ids for built-in and OAuth connectors.
    return key if owner == "local" else f"{owner}:{key}"


def ensure_defaults(con, owner: str) -> None:
    for key, spec in BUILTIN.items():
        if store.get(con, "connector", record_id(owner, key)) is None:
            item = _base(owner, key, "builtin", spec)
            item["id"] = record_id(owner, key)
            item["status"] = "needs_setup" if key == "web_search" else "ready"
            store.put(con, "connector", item)
    for key, spec in OAUTH.items():
        if store.get(con, "connector", record_id(owner, key)) is None:
            item = _base(owner, key, "oauth", spec)
            item["id"] = record_id(owner, key)
            item["status"] = "needs_auth"
            store.put(con, "connector", item)


def all_for(con, owner: str) -> list[dict]:
    ensure_defaults(con, owner)
    order = {"builtin": 0, "oauth": 1, "mcp": 2}
    builtin_order = list(BUILTIN)  # web search first: the most common source
    items = [c for c in store.all_records(con, "connector") if c.get("owner") == owner]
    return sorted(
        items,
        key=lambda c: (
            order.get(c["type"], 9),
            builtin_order.index(c["key"]) if c["key"] in builtin_order else 0,
            c["name"].lower(),
        ),
    )


def get(con, owner: str, connector_id: str) -> dict:
    ensure_defaults(con, owner)
    item = store.get(con, "connector", connector_id)
    if item is None or item.get("owner") != owner:
        raise HTTPException(404, "Tool connection not found")
    return item


def secrets_of(item: dict) -> dict:
    raw = decrypt(item.get("secret", ""))
    try:
        return json.loads(raw) if raw else {}
    except ValueError:
        return {}


def set_secrets(item: dict, values: dict) -> None:
    item["secret"] = encrypt(json.dumps(values)) if values else ""


def oauth_configured(key: str) -> bool:
    return bool(os.environ.get(OAUTH[key]["env"]))


def usable(item: dict) -> bool:
    return bool(item.get("enabled")) and item.get("status") == "ready"


def permission(item: dict, tool: dict) -> str:
    """Effective permission. Write tools are always blocked in research (read-only)."""
    if tool.get("access") == "write":
        return "block"
    chosen = item.get("permissions", {}).get(tool["name"])
    return chosen if chosen in PERMISSIONS else "allow"


def public(item: dict) -> dict:
    secrets = secrets_of(item)
    view = {k: v for k, v in item.items() if k not in ("secret", "owner")}
    view["has_secret"] = bool(
        secrets.get("api_key") or secrets.get("access_token") or secrets.get("token")
    )
    view["tools"] = [{**t, "permission": permission(item, t)} for t in item.get("tools", [])]
    if item["type"] == "oauth":
        view["configured"] = oauth_configured(item["key"])
        if not view["configured"]:
            view["status"] = "unavailable"
            view["status_detail"] = (
                f"Set {OAUTH[item['key']]['env']} (and its secret) on the server to enable sign-in."
            )
    return view


def refresh_status(item: dict) -> None:
    """Derive status from configuration (not from the last error, which `mark` records)."""
    if item["type"] == "builtin" and item["key"] == "web_search":
        provider = item["config"].get("provider")
        if provider == "searxng":
            ok = bool(item["config"].get("base_url"))
        else:
            ok = provider in ("tavily", "brave") and bool(secrets_of(item).get("api_key"))
        item["status"] = "ready" if ok else "needs_setup"
    elif item["type"] == "oauth":
        item["status"] = "ready" if secrets_of(item).get("access_token") else "needs_auth"
    elif item["type"] == "mcp" and item["status"] not in ("error",):
        needs = item["config"].get("auth") == "oauth" and not secrets_of(item).get("access_token")
        item["status"] = (
            "needs_auth" if needs else ("ready" if item.get("tools") else "needs_setup")
        )


def mark(con, item: dict, status: str, detail: str = "") -> None:
    item["status"], item["status_detail"], item["updatedAt"] = status, detail[:300], store.now()
    store.put(con, "connector", item)


def slug(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return (value or "tool")[:24]
