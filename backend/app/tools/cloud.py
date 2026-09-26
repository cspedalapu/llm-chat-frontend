"""Google Drive and Microsoft OneDrive / SharePoint as read-only research tools.

Both follow the same pattern: a search tool returns files (title, link, modified
date) and remembers their ids; a read tool downloads one of those files and turns it
into text (Google formats are exported; Office, PDF and text files are extracted).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from pathlib import PurePath

from .. import tables
from . import net
from .base import Source, Tool, ToolContext, ToolError, ToolResult, object_schema
from .web import pdf_to_text

TokenGetter = Callable[[], Awaitable[str]]
TEXT_CHARS = 60_000
MAX_DOWNLOAD = 15 * 1024 * 1024


def _extract(name: str, mime: str, content: bytes) -> str:
    suffix = PurePath(name).suffix.lower()
    if suffix == ".pdf" or mime == "application/pdf":
        return pdf_to_text(content)
    if suffix == ".docx":
        return tables.read_docx(content)
    if suffix == ".xlsx":
        return "\n\n".join(
            f"Sheet: {sheet}\n" + tables.rows_to_text(rows)
            for sheet, rows in tables.read_xlsx(content)
        )
    if suffix in (".txt", ".md", ".csv", ".json", ".html", ".htm") or mime.startswith("text/"):
        return content.decode("utf-8", errors="replace")
    raise ToolError(
        "This file type can't be read yet. "
        "Supported: Google Docs/Sheets/Slides, Word, Excel, PDF, text."
    )


async def _authorized(token: TokenGetter) -> dict:
    return {"Authorization": "Bearer " + await token()}


def _quote_drive(text: str) -> str:
    return text.replace("\\", "\\\\").replace("'", "\\'")


# ------------------------------------------------------------------ Google Drive

GOOGLE_EXPORTS = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
}
DRIVE = "https://www.googleapis.com/drive/v3/files"


def google_drive_tools(token: TokenGetter) -> list[Tool]:
    seen: dict[str, dict] = {}

    async def search(args: dict, ctx: ToolContext) -> ToolResult:
        query = str(args.get("query", "")).strip()[:200]
        if not query:
            raise ToolError("Drive search needs a query.")
        response = await net.api_request(
            "GET",
            DRIVE,
            headers=await _authorized(token),
            params={
                "q": f"fullText contains '{_quote_drive(query)}' and trashed = false",
                "fields": "files(id,name,mimeType,webViewLink,modifiedTime)",
                "pageSize": 8,
                "supportsAllDrives": "true",
                "includeItemsFromAllDrives": "true",
            },
        )
        net.raise_for_status(response, "Google Drive")
        files = response.json().get("files", [])
        seen.update({f["id"]: f for f in files})
        return ToolResult(
            sources=[
                Source(
                    title=f["name"],
                    url=f.get("webViewLink") or f"https://drive.google.com/file/d/{f['id']}",
                    snippet=f"Drive file · id {f['id']} · "
                    f"modified {f.get('modifiedTime', '')[:10]}",
                    kind="drive",
                )
                for f in files
            ],
            text="Use drive_read with a file id to read one."
            if files
            else "No Drive files matched.",
        )

    async def read(args: dict, ctx: ToolContext) -> ToolResult:
        file_id = str(args.get("file_id", "")).strip()
        meta = seen.get(file_id)
        if meta is None:
            raise ToolError("Only files returned by drive_search can be read.")
        headers = await _authorized(token)
        export = GOOGLE_EXPORTS.get(meta["mimeType"])
        if export:
            response = await net.api_request(
                "GET", f"{DRIVE}/{file_id}/export", headers=headers, params={"mimeType": export}
            )
            net.raise_for_status(response, "Google Drive")
            text = response.text
        else:
            response = await net.api_request(
                "GET",
                f"{DRIVE}/{file_id}",
                headers=headers,
                params={"alt": "media", "supportsAllDrives": "true"},
            )
            net.raise_for_status(response, "Google Drive")
            if len(response.content) > MAX_DOWNLOAD:
                raise ToolError("That file is too large to read.")
            text = _extract(meta["name"], meta["mimeType"], response.content)
        url = meta.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}"
        return ToolResult(
            sources=[Source(title=meta["name"], url=url, content=text[:TEXT_CHARS], kind="drive")]
        )

    return [
        Tool(
            name="drive_search",
            description="Search the user's Google Drive by content and name. Returns file ids.",
            parameters=object_schema(
                {"query": {"type": "string", "description": "Words to search for."}}, ["query"]
            ),
            connector="google_drive",
            run=search,
            label="Google Drive",
        ),
        Tool(
            name="drive_read",
            description="Read a Google Drive file found with drive_search (Docs, Sheets, "
            "Slides, Word, Excel, PDF, text).",
            parameters=object_schema(
                {"file_id": {"type": "string", "description": "The file id from drive_search."}},
                ["file_id"],
            ),
            connector="google_drive",
            run=read,
            label="Read Drive file",
        ),
    ]


# ------------------------------------------------------------------ Microsoft Graph

GRAPH = "https://graph.microsoft.com/v1.0"


def microsoft_tools(token: TokenGetter) -> list[Tool]:
    seen: dict[str, dict] = {}

    async def search(args: dict, ctx: ToolContext) -> ToolResult:
        query = str(args.get("query", "")).strip()[:200].replace("'", "''")
        if not query:
            raise ToolError("OneDrive search needs a query.")
        response = await net.api_request(
            "GET",
            f"{GRAPH}/me/drive/root/search(q='{query}')",
            headers=await _authorized(token),
            params={
                "$top": 8,
                "$select": "id,name,webUrl,file,size,lastModifiedDateTime,parentReference",
            },
        )
        net.raise_for_status(response, "Microsoft 365")
        items = [i for i in response.json().get("value", []) if i.get("file")]
        seen.update({i["id"]: i for i in items})
        return ToolResult(
            sources=[
                Source(
                    title=i["name"],
                    url=i.get("webUrl", ""),
                    snippet=f"OneDrive file · id {i['id']} · "
                    f"modified {i.get('lastModifiedDateTime', '')[:10]}",
                    kind="onedrive",
                )
                for i in items
            ],
            text="Use onedrive_read with a file id to read one."
            if items
            else "No OneDrive files matched.",
        )

    async def read(args: dict, ctx: ToolContext) -> ToolResult:
        item_id = str(args.get("file_id", "")).strip()
        meta = seen.get(item_id)
        if meta is None:
            raise ToolError("Only files returned by onedrive_search can be read.")
        if (meta.get("size") or 0) > MAX_DOWNLOAD:
            raise ToolError("That file is too large to read.")
        drive = (meta.get("parentReference") or {}).get("driveId")
        path = (
            f"{GRAPH}/drives/{drive}/items/{item_id}/content"
            if drive
            else f"{GRAPH}/me/drive/items/{item_id}/content"
        )
        response = await net.api_request("GET", path, headers=await _authorized(token))
        net.raise_for_status(response, "Microsoft 365")
        text = _extract(meta["name"], meta.get("file", {}).get("mimeType", ""), response.content)
        return ToolResult(
            sources=[
                Source(
                    title=meta["name"],
                    url=meta.get("webUrl", ""),
                    content=text[:TEXT_CHARS],
                    kind="onedrive",
                )
            ]
        )

    return [
        Tool(
            name="onedrive_search",
            description="Search the user's OneDrive and SharePoint files. Returns file ids.",
            parameters=object_schema(
                {"query": {"type": "string", "description": "Words to search for."}}, ["query"]
            ),
            connector="microsoft",
            run=search,
            label="OneDrive",
        ),
        Tool(
            name="onedrive_read",
            description="Read a OneDrive/SharePoint file found with onedrive_search "
            "(Word, Excel, PDF, text).",
            parameters=object_schema(
                {"file_id": {"type": "string", "description": "The file id from onedrive_search."}},
                ["file_id"],
            ),
            connector="microsoft",
            run=read,
            label="Read OneDrive file",
        ),
    ]
