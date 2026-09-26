"""The user's own documents as research tools: passage search and table reading."""

from __future__ import annotations

from pathlib import PurePath

from .. import documents, store, tables
from .base import Source, Tool, ToolContext, ToolError, ToolResult, object_schema

TABLE_SUFFIXES = (".xlsx", ".csv")


def _pages(con, document_id: str) -> list[tuple[int, str]]:
    rows = con.execute(
        "SELECT page, text FROM document_pages WHERE document_id=? ORDER BY page", (document_id,)
    ).fetchall()
    if rows:
        return [(r["page"], r["text"]) for r in rows]
    # Documents uploaded before full pages were stored: stitch overlapping chunks back together.
    stitched: dict[int, str] = {}
    for r in con.execute(
        "SELECT page, text FROM chunks WHERE document_id=? ORDER BY rowid", (document_id,)
    ):
        stitched[r["page"]] = stitched.get(r["page"], "") + (
            r["text"][300:] if r["page"] in stitched else r["text"]
        )
    return sorted(stitched.items())


def search_library_tool(document_ids: list[str] | None = None) -> Tool:
    """`document_ids` limits the search; None means every document in the library."""

    async def run(args: dict, ctx: ToolContext) -> ToolResult:
        query = str(args.get("query", "")).strip()
        if not query:
            raise ToolError("Library search needs a query.")
        with store.db() as con:
            ids = (
                document_ids
                if document_ids is not None
                else [d["id"] for d in store.all_records(con, "document")]
            )
            passages = documents.retrieve(con, query, ids, limit=6)
        return ToolResult(
            sources=[
                Source(
                    title=f"{p['title']} (page {p['page']})",
                    url=f"library://{p['documentId']}#page={p['page']}",
                    snippet=p["excerpt"][:300],
                    content=p["excerpt"],
                    kind="library",
                )
                for p in passages
            ]
        )

    return Tool(
        name="search_library",
        description="Search the user's uploaded documents (PDF, Word, Excel, text). "
        "Returns matching passages.",
        parameters=object_schema(
            {"query": {"type": "string", "description": "Words to look for."}}, ["query"]
        ),
        connector="library",
        run=run,
        label="Your library",
    )


def list_tables(con) -> list[dict]:
    return [
        d
        for d in store.all_records(con, "document")
        if PurePath(d["name"]).suffix.lower() in TABLE_SUFFIXES
    ]


def read_table_tool() -> Tool:
    async def run(args: dict, ctx: ToolContext) -> ToolResult:
        wanted = str(args.get("document", "")).strip().lower()
        with store.db() as con:
            candidates = list_tables(con)
            doc = next(
                (d for d in candidates if d["id"] == wanted or d["name"].lower() == wanted), None
            ) or next((d for d in candidates if wanted and wanted in d["name"].lower()), None)
            if doc is None:
                names = ", ".join(d["name"] for d in candidates[:20]) or "none uploaded"
                raise ToolError(f"No spreadsheet matches. Available: {names}.")
            pages = _pages(con, doc["id"])
        sheet = str(args.get("sheet", "")).strip().lower()
        parts, sources = [], []
        for page, text in pages:
            if doc["name"].lower().endswith(".csv"):
                name, rows = "CSV", tables.read_csv(text)
            else:
                first, _, body = text.partition("\n")
                name = first.removeprefix("Sheet: ")
                rows = [line.split("\t") for line in body.splitlines() if line.strip()]
            if sheet and sheet != name.lower():
                continue
            summary = tables.summarize(rows)
            parts.append(f"Sheet '{name}':\n{summary}")
            sources.append(
                Source(
                    title=f"{doc['name']} — {name}",
                    url=f"library://{doc['id']}#page={page}",
                    snippet=summary[:300],
                    content=tables.rows_to_text(rows)[:60_000],
                    kind="table",
                )
            )
        if not parts:
            raise ToolError("That sheet was not found in the spreadsheet.")
        return ToolResult(sources=sources, text="\n\n".join(parts))

    return Tool(
        name="read_table",
        description="Read an uploaded Excel (.xlsx) or CSV file: columns, row count, "
        "numeric statistics "
        "(min, max, mean, sum) and a preview of the first rows.",
        parameters=object_schema(
            {
                "document": {
                    "type": "string",
                    "description": "File name (or part of it) or document id.",
                },
                "sheet": {
                    "type": "string",
                    "description": "Optional sheet name; all sheets when omitted.",
                },
            },
            ["document"],
        ),
        connector="library",
        run=run,
        label="Read table",
    )
