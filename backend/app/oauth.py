"""OAuth 2.1 authorization-code flow with PKCE, for connectors.

Used by Google Drive, Microsoft 365 and remote MCP servers that require sign-in.

- Google / Microsoft: endpoints and scopes are fixed; the operator supplies the client
  id and secret through environment variables.
- MCP: endpoints are discovered per the MCP authorization spec (Protected Resource
  Metadata, RFC 9728, then Authorization Server Metadata, RFC 8414 / OIDC). The client
  is the one the user entered, or registered dynamically (RFC 7591) when the server
  offers it. The `resource` parameter (RFC 8707) binds tokens to that server.

Flow: `start()` stores a single-use state (10 min) and returns the authorize URL; the
browser comes back to `/connectors/oauth/callback`, where `finish()` exchanges the code
and stores the tokens encrypted on the connector. `access_token()` refreshes as needed.
"""

from __future__ import annotations

import base64
import hashlib
import os
import secrets
import time
from urllib.parse import urlencode, urlsplit

import httpx
from fastapi import HTTPException

from . import connectors, store
from .secrets import decrypt, encrypt

STATE_TTL_SECONDS = 600
TIMEOUT = httpx.Timeout(20.0, connect=10.0)

FIXED = {
    "google_drive": {
        "authorize": "https://accounts.google.com/o/oauth2/v2/auth",
        "token": "https://oauth2.googleapis.com/token",
        "scope": "https://www.googleapis.com/auth/drive.readonly",
        "client_env": ("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"),
        "extra": {"access_type": "offline", "prompt": "consent", "include_granted_scopes": "true"},
    },
    "microsoft": {
        "authorize": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
        "token": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        "scope": "offline_access User.Read Files.Read.All Sites.Read.All",
        "client_env": ("MICROSOFT_OAUTH_CLIENT_ID", "MICROSOFT_OAUTH_CLIENT_SECRET"),
        "extra": {},
    },
}


def public_url() -> str:
    """Where the browser reaches the app; the redirect URI is built from it."""
    return os.environ.get("CHAT_PUBLIC_URL", "http://localhost:5173").rstrip("/")


def redirect_uri() -> str:
    return public_url() + "/api/connectors/oauth/callback"


def _pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)[:96]
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    )
    return verifier, challenge


def _tenant(url: str) -> str:
    return url.replace("{tenant}", os.environ.get("MICROSOFT_OAUTH_TENANT", "common"))


async def _json(client: httpx.AsyncClient, url: str) -> dict | None:
    try:
        response = await client.get(url, headers={"Accept": "application/json"})
    except httpx.HTTPError:
        return None
    if response.status_code != 200:
        return None
    try:
        return response.json()
    except ValueError:
        return None


async def discover_mcp(server_url: str) -> dict:
    """Find the authorization server for an MCP endpoint. Returns endpoints and the resource."""
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        metadata_url = None
        try:
            probe = await client.post(
                server_url,
                json={"jsonrpc": "2.0", "id": 1, "method": "ping"},
                headers={"Accept": "application/json, text/event-stream"},
            )
            header = probe.headers.get("www-authenticate", "")
            for part in header.replace(",", " ").split():
                if part.startswith("resource_metadata="):
                    metadata_url = part.split("=", 1)[1].strip('"')
        except httpx.HTTPError as exc:
            raise HTTPException(502, "Could not reach the MCP server.") from exc
        parts = urlsplit(server_url)
        origin = f"{parts.scheme}://{parts.netloc}"
        candidates = [metadata_url] if metadata_url else []
        candidates += [
            origin + "/.well-known/oauth-protected-resource" + parts.path.rstrip("/"),
            origin + "/.well-known/oauth-protected-resource",
        ]
        resource_meta = None
        for url in candidates:
            resource_meta = await _json(client, url)
            if resource_meta:
                break
        issuers = (resource_meta or {}).get("authorization_servers") or [origin]
        issuer = issuers[0].rstrip("/")
        issuer_parts = urlsplit(issuer)
        issuer_origin = f"{issuer_parts.scheme}://{issuer_parts.netloc}"
        suffix = issuer_parts.path.rstrip("/")
        server_meta = None
        for url in (
            issuer_origin + "/.well-known/oauth-authorization-server" + suffix,
            issuer_origin + "/.well-known/openid-configuration" + suffix,
            issuer + "/.well-known/openid-configuration",
        ):
            server_meta = await _json(client, url)
            if (
                server_meta
                and server_meta.get("authorization_endpoint")
                and server_meta.get("token_endpoint")
            ):
                break
        if not server_meta or not server_meta.get("authorization_endpoint"):
            raise HTTPException(
                502, "The MCP server does not publish OAuth metadata. Use a token instead."
            )
        return {
            "authorize": server_meta["authorization_endpoint"],
            "token": server_meta["token_endpoint"],
            "registration": server_meta.get("registration_endpoint"),
            "scope": " ".join((resource_meta or {}).get("scopes_supported") or []),
            "resource": (resource_meta or {}).get("resource") or server_url,
        }


async def _register_client(registration_endpoint: str, name: str) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(
            registration_endpoint,
            json={
                "client_name": name,
                "redirect_uris": [redirect_uri()],
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "token_endpoint_auth_method": "none",
            },
        )
    if response.status_code >= 300:
        raise HTTPException(
            502, "The MCP server refused client registration. Enter a client ID instead."
        )
    return response.json()


async def start(con, owner: str, item: dict) -> str:
    """Create the single-use state and return the URL the browser should open."""
    if item["type"] == "oauth":
        spec = FIXED[item["key"]]
        client_id = os.environ.get(spec["client_env"][0], "")
        if not client_id:
            raise HTTPException(
                409, f"Sign-in is not configured on the server ({spec['client_env'][0]})."
            )
        endpoints = {
            "authorize": _tenant(spec["authorize"]),
            "token": _tenant(spec["token"]),
            "scope": spec["scope"],
            "resource": None,
        }
        client = {
            "client_id": client_id,
            "client_secret": os.environ.get(spec["client_env"][1], ""),
        }
        extra = spec["extra"]
    elif item["type"] == "mcp":
        endpoints = await discover_mcp(item["config"]["url"])
        stored = connectors.secrets_of(item)
        client = {
            "client_id": item["config"].get("client_id") or stored.get("client_id", ""),
            "client_secret": stored.get("client_secret", ""),
        }
        if not client["client_id"]:
            if not endpoints.get("registration"):
                raise HTTPException(
                    409, "This MCP server needs a client ID. Add one in the connection settings."
                )
            registered = await _register_client(endpoints["registration"], "LLM Workspace Research")
            client = {
                "client_id": registered["client_id"],
                "client_secret": registered.get("client_secret", ""),
            }
            connectors.set_secrets(item, {**stored, **client})
            store.put(con, "connector", item)
        extra = {}
    else:
        raise HTTPException(400, "This tool does not use sign-in.")
    verifier, challenge = _pkce()
    state = secrets.token_urlsafe(32)
    store.put(
        con,
        "oauth_state",
        {
            "id": state,
            "owner": owner,
            "connector_id": item["id"],
            "verifier": verifier,
            "token": endpoints["token"],
            "resource": endpoints.get("resource"),
            "expires": time.time() + STATE_TTL_SECONDS,
            "client_id": client["client_id"],
            "client_secret": encrypt(client.get("client_secret") or ""),
        },
    )
    params = {
        "response_type": "code",
        "client_id": client["client_id"],
        "redirect_uri": redirect_uri(),
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        **extra,
    }
    if endpoints.get("scope"):
        params["scope"] = endpoints["scope"]
    if endpoints.get("resource"):
        params["resource"] = endpoints["resource"]
    return (
        endpoints["authorize"] + ("&" if "?" in endpoints["authorize"] else "?") + urlencode(params)
    )


async def _token_request(url: str, data: dict) -> dict:
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(url, data=data, headers={"Accept": "application/json"})
    if response.status_code >= 300:
        raise HTTPException(502, "Sign-in could not be completed: the token request was rejected.")
    return response.json()


def _save_tokens(item: dict, tokens: dict, flow: dict) -> None:
    stored = connectors.secrets_of(item)
    stored.update(
        {
            "access_token": tokens["access_token"],
            "refresh_token": tokens.get("refresh_token") or stored.get("refresh_token", ""),
            "expires_at": time.time() + int(tokens.get("expires_in") or 3600),
            "token_endpoint": flow["token"],
            "resource": flow.get("resource"),
            "client_id": flow["client_id"],
        }
    )
    connectors.set_secrets(item, stored)


async def finish(con, state: str, code: str) -> dict:
    flow = store.get(con, "oauth_state", state)
    store.delete(con, "oauth_state", state)  # single use, whatever happens next
    if flow is None or flow["expires"] < time.time():
        raise HTTPException(400, "This sign-in link expired. Start again from the tools directory.")
    item = connectors.get(con, flow["owner"], flow["connector_id"])
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri(),
        "client_id": flow["client_id"],
        "code_verifier": flow["verifier"],
    }
    secret = decrypt(flow.get("client_secret", ""))
    if secret:
        data["client_secret"] = secret
    if flow.get("resource"):
        data["resource"] = flow["resource"]
    tokens = await _token_request(flow["token"], data)
    if not tokens.get("access_token"):
        raise HTTPException(502, "Sign-in could not be completed: no access token was returned.")
    stored_secret = connectors.secrets_of(item).get("client_secret") or secret
    _save_tokens(item, tokens, flow)
    if stored_secret:
        connectors.set_secrets(
            item, {**connectors.secrets_of(item), "client_secret": stored_secret}
        )
    connectors.refresh_status(item)
    connectors.mark(con, item, "ready", "")
    return item


async def access_token(con, item: dict) -> str:
    """A valid access token for the connector, refreshing it when it is about to expire."""
    stored = connectors.secrets_of(item)
    if item["type"] == "mcp" and item["config"].get("auth") == "bearer":
        return stored.get("token", "")
    token = stored.get("access_token", "")
    if not token:
        raise HTTPException(409, f"Sign in to {item['name']} first.")
    if stored.get("expires_at", 0) > time.time() + 60 or not stored.get("refresh_token"):
        return token
    data = {
        "grant_type": "refresh_token",
        "refresh_token": stored["refresh_token"],
        "client_id": stored["client_id"],
    }
    secret = stored.get("client_secret")
    if not secret and item["type"] == "oauth":
        secret = os.environ.get(FIXED[item["key"]]["client_env"][1], "")
    if secret:
        data["client_secret"] = secret
    if stored.get("resource"):
        data["resource"] = stored["resource"]
    try:
        tokens = await _token_request(stored["token_endpoint"], data)
    except HTTPException:
        connectors.mark(con, item, "needs_auth", "Sign-in expired. Connect again.")
        raise
    _save_tokens(
        item,
        tokens,
        {
            "token": stored["token_endpoint"],
            "resource": stored.get("resource"),
            "client_id": stored["client_id"],
        },
    )
    store.put(con, "connector", item)
    return tokens["access_token"]
