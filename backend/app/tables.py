"""Spreadsheet and Word reading shared by uploads, research tools and cloud connectors.

Everything here is bounded: row, column and character caps keep a hostile or huge
file from exhausting memory or flooding a model's context.
"""

from __future__ import annotations

import csv
import io
import re
import statistics
import zipfile
from xml.etree import ElementTree

MAX_ROWS = 5000
MAX_COLS = 60
CELL_CHARS = 200


def _cell(value) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return text[:CELL_CHARS]


def read_xlsx(content: bytes) -> list[tuple[str, list[list[str]]]]:
    """Return [(sheet name, rows)] for an .xlsx file. Values only, formulas evaluated by Excel."""
    from openpyxl import load_workbook  # imported lazily: only uploads and table tools need it

    try:
        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:  # openpyxl raises many types for corrupt files
        raise ValueError("Cannot read this Excel file. Save it as .xlsx and try again.") from exc
    sheets = []
    try:
        for sheet in workbook.worksheets[:20]:
            rows = []
            for row in sheet.iter_rows(values_only=True, max_col=MAX_COLS):
                cells = [_cell(v) for v in row]
                while cells and not cells[-1]:
                    cells.pop()  # read-only mode pads rows out to max_col
                if any(cells):
                    rows.append(cells)
                if len(rows) >= MAX_ROWS:
                    break
            sheets.append((sheet.title, rows))
    finally:
        workbook.close()
    return sheets


def read_csv(text: str) -> list[list[str]]:
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    rows = []
    for row in csv.reader(io.StringIO(text), dialect):
        cells = [_cell(v) for v in row[:MAX_COLS]]
        if any(cells):
            rows.append(cells)
        if len(rows) >= MAX_ROWS:
            break
    return rows


def rows_to_text(rows: list[list[str]]) -> str:
    return "\n".join("\t".join(row) for row in rows)


def read_docx(content: bytes) -> str:
    """Plain text of a .docx body: paragraphs in order, table cells tab-separated."""
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            info = archive.getinfo("word/document.xml")
            if info.file_size > 30 * 1024 * 1024:
                raise ValueError("Word document is too large.")
            xml = archive.read(info)
    except (KeyError, zipfile.BadZipFile) as exc:
        raise ValueError("Cannot read this Word file. Save it as .docx and try again.") from exc
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    root = ElementTree.fromstring(xml)
    lines = []
    for paragraph in root.iter(ns + "p"):
        text = "".join(node.text or "" for node in paragraph.iter(ns + "t"))
        if text.strip():
            lines.append(text)
    return "\n".join(lines)


_NUMBER = re.compile(r"^-?[\d,]*\.?\d+(?:[eE][-+]?\d+)?%?$")


def _number(value: str) -> float | None:
    cleaned = (
        value.replace(" ", "").replace("$", "").replace("€", "").replace("£", "").replace("₹", "")
    )
    if not cleaned or not _NUMBER.match(cleaned):
        return None
    try:
        return float(cleaned.rstrip("%").replace(",", ""))
    except ValueError:
        return None


def summarize(rows: list[list[str]], *, preview_rows: int = 8) -> str:
    """A compact, model-readable description of a table: shape, columns, stats, preview."""
    if not rows:
        return "The table is empty."
    header, body = rows[0], rows[1:]
    lines = [f"{len(body)} data rows × {len(header)} columns."]
    for index, name in enumerate(header):
        values = [row[index] for row in body if index < len(row) and row[index] != ""]
        numbers = [n for n in (_number(v) for v in values) if n is not None]
        label = name or f"column {index + 1}"
        if values and len(numbers) >= max(3, len(values) * 0.8):
            lines.append(
                f"- {label}: numeric, {len(numbers)} values, min {min(numbers):g}, "
                f"max {max(numbers):g}, mean {statistics.fmean(numbers):.4g}, "
                f"sum {sum(numbers):.6g}"
            )
        else:
            distinct = list(dict.fromkeys(values))
            examples = ", ".join(distinct[:5])
            lines.append(
                f"- {label}: text, {len(values)} values, {len(distinct)} distinct (e.g. {examples})"
            )
    lines.append("Preview:")
    lines.extend("\t".join(row) for row in rows[: preview_rows + 1])
    return "\n".join(lines)
