"""Persistence for research runs: the run, its event log, its sources and tool calls.

Everything a run produces is written as it happens, so a reload or a dropped event
stream loses nothing, and a server restart leaves the run marked `interrupted`.
"""

from __future__ import annotations

import json

from .. import store

ACTIVE = ("planning", "researching", "writing")
TERMINAL = ("completed", "failed", "cancelled", "interrupted")


def init() -> None:
    with store.db() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS research_runs (
                id TEXT PRIMARY KEY, owner TEXT NOT NULL, status TEXT NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL, body TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS research_runs_owner ON research_runs(owner, created_at);
            CREATE TABLE IF NOT EXISTS research_events (
                run_id TEXT NOT NULL, seq INTEGER NOT NULL, type TEXT NOT NULL,
                data TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(run_id, seq)
            );
            CREATE TABLE IF NOT EXISTS research_sources (
                run_id TEXT NOT NULL, n INTEGER NOT NULL, url TEXT NOT NULL, title TEXT NOT NULL,
                snippet TEXT NOT NULL, content TEXT NOT NULL, kind TEXT NOT NULL,
                tool TEXT NOT NULL,
                PRIMARY KEY(run_id, n)
            );
            CREATE INDEX IF NOT EXISTS research_sources_url ON research_sources(run_id, url);
            CREATE TABLE IF NOT EXISTS tool_calls (
                id TEXT PRIMARY KEY, run_id TEXT NOT NULL, owner TEXT NOT NULL,
                connector TEXT NOT NULL, tool TEXT NOT NULL, arguments TEXT NOT NULL,
                status TEXT NOT NULL, detail TEXT NOT NULL, latency_ms INTEGER NOT NULL,
                cost REAL, created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS tool_calls_owner ON tool_calls(owner, created_at);
            CREATE INDEX IF NOT EXISTS tool_calls_run ON tool_calls(run_id);
        """)
        placeholders = ",".join("?" for _ in ACTIVE)
        for row in con.execute(
            f"SELECT id, body FROM research_runs WHERE status IN ({placeholders})", ACTIVE
        ):
            body = json.loads(row["body"])
            body["status"] = "interrupted"
            body["error"] = "The server restarted during this run. Re-run it to continue."
            con.execute(
                "UPDATE research_runs SET status='interrupted', body=? WHERE id=?",
                (json.dumps(body), row["id"]),
            )


def save(con, run: dict) -> dict:
    run["updatedAt"] = store.now()
    con.execute(
        "INSERT INTO research_runs(id,owner,status,created_at,updated_at,body) VALUES(?,?,?,?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET status=excluded.status, "
        "updated_at=excluded.updated_at, body=excluded.body",
        (
            run["id"],
            run["owner"],
            run["status"],
            run["createdAt"],
            run["updatedAt"],
            json.dumps(run),
        ),
    )
    return run


def load(con, run_id: str) -> dict | None:
    row = con.execute("SELECT body FROM research_runs WHERE id=?", (run_id,)).fetchone()
    return json.loads(row["body"]) if row else None


def list_for(con, owner: str, limit: int = 100) -> list[dict]:
    rows = con.execute(
        "SELECT body FROM research_runs WHERE owner=? ORDER BY created_at DESC LIMIT ?",
        (owner, limit),
    ).fetchall()
    return [json.loads(r["body"]) for r in rows]


def delete(con, run_id: str) -> None:
    for table in ("research_runs", "research_events", "research_sources"):
        column = "id" if table == "research_runs" else "run_id"
        con.execute(f"DELETE FROM {table} WHERE {column}=?", (run_id,))


def add_event(con, run_id: str, kind: str, data: dict) -> int:
    seq = con.execute(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM research_events WHERE run_id=?", (run_id,)
    ).fetchone()[0]
    con.execute(
        "INSERT INTO research_events VALUES(?,?,?,?,?)",
        (run_id, seq, kind, json.dumps(data), store.now()),
    )
    return seq


def events_after(con, run_id: str, after: int, limit: int = 500) -> list[dict]:
    rows = con.execute(
        "SELECT seq, type, data, created_at FROM research_events WHERE run_id=? AND seq>? "
        "ORDER BY seq LIMIT ?",
        (run_id, after, limit),
    ).fetchall()
    return [
        {"seq": r["seq"], "type": r["type"], "data": json.loads(r["data"]), "at": r["created_at"]}
        for r in rows
    ]


def sources(con, run_id: str, *, with_content: bool = False) -> list[dict]:
    rows = con.execute(
        "SELECT * FROM research_sources WHERE run_id=? ORDER BY n", (run_id,)
    ).fetchall()
    out = []
    for r in rows:
        item = {
            "n": r["n"],
            "url": r["url"],
            "title": r["title"],
            "snippet": r["snippet"],
            "kind": r["kind"],
            "tool": r["tool"],
            "read": bool(r["content"]),
        }
        if with_content:
            item["content"] = r["content"]
        out.append(item)
    return out


def upsert_source(
    con, run_id: str, *, url: str, title: str, snippet: str, content: str, kind: str, tool: str
) -> int:
    """Number a source once per run (by URL); keep the richest text we have for it."""
    row = con.execute(
        "SELECT n, snippet, content FROM research_sources WHERE run_id=? AND url=?", (run_id, url)
    ).fetchone()
    if row:
        if len(content) > len(row["content"]) or (snippet and not row["snippet"]):
            con.execute(
                "UPDATE research_sources SET content=?, snippet=?, title=? WHERE run_id=? AND n=?",
                (
                    max(content, row["content"], key=len),
                    snippet or row["snippet"],
                    title,
                    run_id,
                    row["n"],
                ),
            )
        return row["n"]
    n = con.execute(
        "SELECT COALESCE(MAX(n), 0) + 1 FROM research_sources WHERE run_id=?", (run_id,)
    ).fetchone()[0]
    con.execute(
        "INSERT INTO research_sources VALUES(?,?,?,?,?,?,?,?)",
        (run_id, n, url, title[:300], snippet[:1000], content, kind, tool),
    )
    return n


def log_tool_call(con, **row) -> None:
    con.execute(
        "INSERT INTO tool_calls VALUES(:id,:run_id,:owner,:connector,:tool,:arguments,"
        ":status,:detail,"
        ":latency_ms,:cost,:created_at)",
        row,
    )


def tool_calls(con, owner: str, run_id: str | None = None, limit: int = 200) -> list[dict]:
    if run_id:
        rows = con.execute(
            "SELECT * FROM tool_calls WHERE owner=? AND run_id=? ORDER BY created_at DESC LIMIT ?",
            (owner, run_id, limit),
        )
    else:
        rows = con.execute(
            "SELECT * FROM tool_calls WHERE owner=? ORDER BY created_at DESC LIMIT ?",
            (owner, limit),
        )
    return [{**dict(r), "arguments": json.loads(r["arguments"])} for r in rows]


def tool_summary(con, owner: str) -> list[dict]:
    today = store.now()[:10]
    rows = con.execute(
        "SELECT connector, COUNT(*) AS calls, SUM(status='error') AS errors, "
        "SUM(created_at >= ?) AS today, COALESCE(SUM(cost), 0) AS cost, "
        "MAX(created_at) AS last_used, CAST(AVG(latency_ms) AS INTEGER) AS avg_latency_ms "
        "FROM tool_calls WHERE owner=? GROUP BY connector",
        (today, owner),
    ).fetchall()
    return [dict(r) for r in rows]
