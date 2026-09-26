import { useMemo } from "react";
import { Approval, research, RunEvent } from "@/lib/research";

interface ToolRow { kind: "tool"; call_id: string; tool: string; summary: string; status: string; detail?: string; latency_ms?: number; sources?: { n: number; title: string; url: string }[] }
type Row =
  | ToolRow
  | { kind: "part"; index: number; question: string; done?: string; failed?: string }
  | { kind: "note"; text: string; tone?: "info" | "warn" | "error" }
  | { kind: "approval"; request: Approval };

/** Folds the event log into readable rows: parts, tool calls (start + finish merged), notes. */
function rows(events: RunEvent[]): Row[] {
  const out: Row[] = [];
  const tools = new Map<string, ToolRow>();
  const parts = new Map<number, Extract<Row, { kind: "part" }>>();
  for (const { type, data } of events) {
    if (type === "sub_started") {
      const part = { kind: "part" as const, index: data.index, question: data.question };
      parts.set(data.index, part); out.push(part);
    } else if (type === "sub_done") {
      const part = parts.get(data.index); if (part) part.done = data.preview;
    } else if (type === "sub_failed") {
      const part = parts.get(data.index); if (part) part.failed = data.error;
    } else if (type === "tool_started" || type === "tool_finished") {
      let row = tools.get(data.call_id);
      if (!row) { row = { kind: "tool", call_id: data.call_id, tool: data.tool, summary: data.summary, status: "running" }; tools.set(data.call_id, row); out.push(row); }
      if (type === "tool_finished") Object.assign(row, { status: data.status, detail: data.detail, latency_ms: data.latency_ms, sources: data.sources });
    } else if (type === "approval_needed") {
      out.push({ kind: "approval", request: data as Approval });
    } else if (type === "approval_resolved") {
      out.push({ kind: "note", text: data.decision === "deny" ? "You declined a tool call." : "You allowed a tool call." });
    } else if (type === "plan") {
      out.push({ kind: "note", text: `Plan ready: ${data.sub_questions?.length || 0} part(s).` });
    } else if (type === "tools") {
      out.push({ kind: "note", text: "Using " + (data.tools || []).map((t: { label: string }) => t.label).join(", ") + "." });
    } else if (type === "steer_received") {
      out.push({ kind: "note", text: `Your instruction: “${data.text}”` });
    } else if (type === "steer_applied") {
      out.push({ kind: "note", text: "Instruction applied." });
    } else if (type === "budget") {
      out.push({ kind: "note", tone: "warn", text: `Stopped searching: ${data.reason} reached. Writing up what was found.` });
    } else if (type === "citations") {
      out.push({ kind: "note", text: `Citations checked: ${data.supported || 0} supported, ${data.weak || 0} weak, ${data.snippet_only || 0} snippet only, ${data.missing || 0} missing.` });
    } else if (type === "status" && ["failed", "cancelled"].includes(data.status)) {
      out.push({ kind: "note", tone: "error", text: data.status === "failed" ? `Failed: ${data.error || "unknown error"}` : "Stopped." });
    } else if (type === "status" && data.status === "writing") {
      out.push({ kind: "note", text: "Writing the report…" });
    }
  }
  return out;
}

const STATUS_LABEL: Record<string, string> = { running: "Running", ok: "Done", error: "Failed", blocked: "Blocked", denied: "Declined" };

export function Timeline({ runId, events, pending, onDecided }: {
  runId: string; events: RunEvent[]; pending: Approval[]; onDecided: () => void;
}) {
  const list = useMemo(() => rows(events), [events]);
  const open = new Set(pending.map(p => p.call_id));
  async function decide(callId: string, decision: "allow" | "deny" | "always") {
    try { await research.decide(runId, callId, decision); } finally { onDecided(); }
  }
  if (!list.length) return <p className="muted timeline-empty">Waiting for the first step…</p>;
  return <ol className="timeline" aria-label="Research activity">
    {list.map((row, i) => {
      if (row.kind === "part") return <li key={i} className="tl-part">
        <span className="tl-part-index">Part {row.index}</span><span className="tl-part-q">{row.question}</span>
        {row.failed && <span className="tl-error">{row.failed}</span>}
      </li>;
      if (row.kind === "tool") return <li key={i} className={"tl-tool " + row.status}>
        <span className="tl-dot" aria-hidden="true" />
        <div className="tl-body">
          <div className="tl-line"><strong>{row.tool}</strong><span className="tl-summary">{row.summary}</span>
            <span className="tl-status">{STATUS_LABEL[row.status] || row.status}{row.latency_ms ? ` · ${(row.latency_ms / 1000).toFixed(1)}s` : ""}</span></div>
          {row.status === "error" && row.detail && <p className="tl-error">{row.detail}</p>}
          {row.sources && row.sources.length > 0 && <ul className="tl-sources">{row.sources.map(s =>
            <li key={s.n}><span className="cite-num">{s.n}</span>{s.url.startsWith("http") ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : s.title}</li>)}</ul>}
        </div>
      </li>;
      if (row.kind === "approval") return <li key={i} className="tl-approval">
        <div className="tl-body">
          <p><strong>{row.request.tool}</strong> wants to run: <code>{row.request.summary}</code></p>
          {open.has(row.request.call_id)
            ? <div className="tl-approval-actions">
              <button type="button" className="primary-pill small" onClick={() => void decide(row.request.call_id, "allow")}>Allow once</button>
              <button type="button" className="ghost-pill small" onClick={() => void decide(row.request.call_id, "always")}>Always allow</button>
              <button type="button" className="ghost-pill small danger" onClick={() => void decide(row.request.call_id, "deny")}>Deny</button>
            </div>
            : <p className="muted">Answered.</p>}
        </div>
      </li>;
      return <li key={i} className={"tl-note " + (row.tone || "info")}>{row.text}</li>;
    })}
  </ol>;
}
