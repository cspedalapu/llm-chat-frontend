"""Outbound HTTP for tools, with the checks that keep research from being turned
against the server itself or the user's network.

- Only http(s). Hosts resolving to private, loopback, link-local or reserved
  addresses are refused (SSRF), unless RESEARCH_ALLOW_PRIVATE_NETWORK=1 (tests and
  self-hosted SearXNG on a LAN).
- Redirects are followed manually so every hop is re-checked.
- Bodies are read with a hard size cap.
"""

from __future__ import annotations

import asyncio
import ipaddress
import os
import socket
from urllib.parse import urljoin, urlsplit

import httpx

from .base import ToolError

USER_AGENT = "LLMWorkspaceResearch/1.0 (+https://github.com/cspedalapu/llm-chat-frontend)"
MAX_BODY_BYTES = 8 * 1024 * 1024
TIMEOUT = httpx.Timeout(20.0, connect=10.0)


def private_network_allowed() -> bool:
    return os.environ.get("RESEARCH_ALLOW_PRIVATE_NETWORK") == "1"


def domain_of(url: str) -> str:
    return (urlsplit(url).hostname or "").lower().removeprefix("www.")


def matches(domain: str, patterns: list[str]) -> bool:
    return any(
        domain == p or domain.endswith("." + p)
        for p in (p.lower().removeprefix("www.") for p in patterns)
    )


def domain_permitted(url: str, allowed: list[str], blocked: list[str]) -> bool:
    domain = domain_of(url)
    if blocked and matches(domain, blocked):
        return False
    return not allowed or matches(domain, allowed)


async def _check_host(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise ToolError("Only http and https addresses can be opened.")
    if parts.username or parts.password:
        raise ToolError("Addresses with embedded credentials are not allowed.")
    if private_network_allowed():
        return
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(
            parts.hostname, parts.port or 443, type=socket.SOCK_STREAM
        )
    except socket.gaierror as exc:
        raise ToolError("That address could not be found.") from exc
    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if not address.is_global:
            raise ToolError("Addresses on private or local networks cannot be opened.")


async def get(
    url: str,
    *,
    headers: dict | None = None,
    params: dict | None = None,
    max_bytes: int = MAX_BODY_BYTES,
) -> httpx.Response:
    """GET with SSRF checks on every redirect hop and a body size cap."""
    merged = {"User-Agent": USER_AGENT, **(headers or {})}
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False) as client:
        for _ in range(6):
            await _check_host(url)
            async with client.stream("GET", url, headers=merged, params=params) as response:
                if response.is_redirect and response.headers.get("location"):
                    url = urljoin(str(response.url), response.headers["location"])
                    params = None
                    continue
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > max_bytes:
                        raise ToolError("The response is too large to read.")
                return httpx.Response(
                    response.status_code,
                    headers=response.headers,
                    content=bytes(body),
                    request=response.request,
                )
    raise ToolError("Too many redirects.")


async def api_request(method: str, url: str, **kwargs) -> httpx.Response:
    """Calls to fixed, well-known API hosts (search and academic providers).

    These hosts are chosen by the operator, not the model, so no SSRF check; still
    time-limited, and network failures become ToolError with a safe message.
    """
    headers = {"User-Agent": USER_AGENT, **kwargs.pop("headers", {})}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            return await client.request(method, url, headers=headers, **kwargs)
    except httpx.TimeoutException as exc:
        raise ToolError("The service took too long to answer.") from exc
    except httpx.HTTPError as exc:
        raise ToolError("Could not reach the service.") from exc


def raise_for_status(response: httpx.Response, service: str) -> None:
    if response.status_code in (401, 403):
        raise ToolError(f"{service} rejected the credentials. Check the key or sign in again.")
    if response.status_code == 429:
        raise ToolError(f"{service} rate limit reached. Try again later.")
    if response.status_code >= 400:
        raise ToolError(f"{service} returned HTTP {response.status_code}.")
