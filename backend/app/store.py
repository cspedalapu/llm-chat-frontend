"""Small, transactional local store. All paths are controlled by the application."""
from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4


def now() -> str:
    return datetime.now(UTC).isoformat()


def uid() -> str:
    return str(uuid4())


def data_dir() -> Path:
    path = Path(os.environ.get("CHAT_DATA_DIR", "data")).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def db():
    connection = sqlite3.connect(data_dir() / "workspace.sqlite3", timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def init_store():
    with db() as con:
        con.execute("PRAGMA journal_mode=WAL")
        con.executescript("""
            CREATE TABLE IF NOT EXISTS records (
                kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL,
                PRIMARY KEY(kind, id)
            );
            CREATE TABLE IF NOT EXISTS generations (
                id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL,
                request_hash TEXT NOT NULL, status TEXT NOT NULL,
                body TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS generation_conversation
                ON generations(conversation_id, status);
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY, document_id TEXT NOT NULL,
                page INTEGER NOT NULL, text TEXT NOT NULL
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS chunk_search USING fts5(
                id UNINDEXED, document_id UNINDEXED, text
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS chat_search USING fts5(
                id UNINDEXED, title, text
            );
        """)
        # A local server restart cannot resume an upstream stream.
        con.execute("UPDATE generations SET status='interrupted' WHERE status='streaming'")
        for item in all_records(con, "conversation"):
            changed = False
            for message in item["messages"]:
                if message.get("state") == "streaming":
                    message["state"] = "interrupted"
                    changed = True
            if changed:
                put(con, "conversation", item)


def get(con, kind, record_id):
    row = con.execute("SELECT body FROM records WHERE kind=? AND id=?", (kind, record_id)).fetchone()
    return json.loads(row["body"]) if row else None


def all_records(con, kind):
    return [json.loads(row["body"]) for row in con.execute(
        "SELECT body FROM records WHERE kind=? ORDER BY rowid DESC", (kind,)
    )]


def put(con, kind, item):
    con.execute("INSERT INTO records(kind,id,body) VALUES(?,?,?) "
                "ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body",
                (kind, item["id"], json.dumps(item)))
    if kind == "conversation":
        con.execute("DELETE FROM chat_search WHERE id=?", (item["id"],))
        con.execute("INSERT INTO chat_search(id,title,text) VALUES(?,?,?)", (
            item["id"], item["title"], "\n".join(m["text"] for m in item["messages"])
        ))
    return item


def delete(con, kind, record_id):
    con.execute("DELETE FROM records WHERE kind=? AND id=?", (kind, record_id))
    if kind == "conversation":
        con.execute("DELETE FROM chat_search WHERE id=?", (record_id,))
