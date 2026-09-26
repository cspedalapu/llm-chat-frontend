from __future__ import annotations

import io
import re
from pathlib import Path

from fastapi import HTTPException
from pypdf import PdfReader

from . import store, tables

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_TEXT_CHARS = 500000


def extract(name: str, content: bytes):
    suffix = Path(name).suffix.lower()
    if suffix == ".pdf":
        try:
            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted or len(reader.pages) > 300:
                raise ValueError("PDF is encrypted or exceeds 300 pages")
            pages = []
            total = 0
            for i, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                total += len(text)
                if total > MAX_TEXT_CHARS:
                    raise ValueError("Document exceeds extracted text limit")
                pages.append((i + 1, text))
        except Exception as exc:
            raise HTTPException(
                422, "Cannot read PDF. Use a text PDF under 300 pages / 500k characters."
            ) from exc
    elif suffix in (".xlsx", ".docx"):
        try:
            if suffix == ".xlsx":
                # One "page" per sheet, so citations can name the sheet by number.
                pages = [
                    (i + 1, f"Sheet: {name}\n" + tables.rows_to_text(rows))
                    for i, (name, rows) in enumerate(tables.read_xlsx(content))
                ]
            else:
                pages = [(1, tables.read_docx(content))]
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
    elif suffix in (".txt", ".md", ".csv", ".json", ".py", ".js", ".ts", ".log"):
        try:
            pages = [(1, content.decode("utf-8-sig"))]
        except UnicodeDecodeError as exc:
            raise HTTPException(422, "Save text files as UTF-8 before uploading.") from exc
    else:
        raise HTTPException(
            415,
            "Supported: text PDF, Word (.docx), Excel (.xlsx), TXT, Markdown, CSV, JSON "
            "and text code files.",
        )
    if sum(len(text) for _, text in pages) > MAX_TEXT_CHARS:
        raise HTTPException(413, "Document exceeds 500,000 extracted characters.")
    if not any(text.strip() for _, text in pages):
        raise HTTPException(422, "No text found. Scanned PDFs need OCR before upload.")
    return pages


def save_document(con, name, pages, project_id):
    document = {
        "id": store.uid(),
        "name": name[:200],
        "projectId": project_id,
        "pages": len(pages),
        "createdAt": store.now(),
    }
    for page, text in pages:
        con.execute(
            "INSERT OR REPLACE INTO document_pages VALUES(?,?,?)", (document["id"], page, text)
        )
        for start in range(0, len(text), 1400):
            passage = text[start : start + 1700].strip()
            if not passage:
                continue
            chunk_id = store.uid()
            con.execute(
                "INSERT INTO chunks VALUES(?,?,?,?)", (chunk_id, document["id"], page, passage)
            )
            con.execute(
                "INSERT INTO chunk_search VALUES(?,?,?)", (chunk_id, document["id"], passage)
            )
    return store.put(con, "document", document)


def search_expression(query):
    words = list(dict.fromkeys(re.findall(r"\w{2,}", query, re.UNICODE)))[:30]
    return " OR ".join('"' + word + '"' for word in words)


def retrieve(con, query, document_ids, limit=5):
    if not document_ids:
        return []
    expression = search_expression(query)
    if not expression:
        return []
    placeholders = ",".join("?" for _ in document_ids)
    rows = con.execute(
        "SELECT c.id,c.document_id,c.page,c.text FROM chunk_search "
        "JOIN chunks c ON c.id=chunk_search.id WHERE chunk_search MATCH ? "
        f"AND c.document_id IN ({placeholders}) ORDER BY rank LIMIT ?",
        (expression, *document_ids, limit),
    ).fetchall()
    return [
        {
            "id": row["id"],
            "documentId": row["document_id"],
            "title": store.get(con, "document", row["document_id"])["name"],
            "page": row["page"],
            "excerpt": row["text"],
            "number": i + 1,
        }
        for i, row in enumerate(rows)
    ]
