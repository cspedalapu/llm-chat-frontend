"""Authentication hook point.

The base ships as a single-user local workspace, so every request that passes the
local-origin checks in main.py is treated as the one local user. A fork that is
deployed for real users replaces the body of ``authenticate`` (session cookie,
bearer token, reverse-proxy header, ...) and nothing else in the middleware changes.
"""

from __future__ import annotations

from fastapi import Request

# Sent by the frontend on every request. Browsers cannot attach a custom header to
# a cross-site form post, so requiring it on writes blocks CSRF from other pages.
CLIENT_HEADER = "X-Workspace-Client"
CLIENT_VALUE = "local-chat"

# Routes that must answer without an identity (load balancers, uptime checks).
PUBLIC_PATHS = frozenset({"/health"})

LOCAL_USER = {"id": "local", "name": "Local user"}


def authenticate(request: Request) -> dict | None:
    """Return the caller's identity, or None to reject the request with 401.

    The returned dict is stored on ``request.state.user`` for route handlers.
    """
    return LOCAL_USER
