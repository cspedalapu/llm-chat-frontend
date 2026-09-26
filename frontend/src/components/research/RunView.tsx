import { useEffect, useState } from "react";
import { useRun } from "@/hooks/useResearch";
import { ACTIVE, downloadExport, research, Run, RunStatus } from "@/lib/research";
import { DotsIcon, DownloadIcon, RefreshIcon, StopIcon, TrashIcon } from "../icons";
import { Menu, MenuDivider, MenuItem } from "../Menu";
import { PlanReview } from "./PlanReview";
import { ReportView } from "./ReportView";
import { Timeline } from "./Timeline";

const STATUS: Record<RunStatus, string> = {
  planning: "Planning", awaiting_approval: "Waiting for you", researching: "Researching", writing: "Writing report",
  completed: "Completed", failed: "Failed", cancelled: "Stopped", interrupted: "Interrupted",
};

function elapsed(run: Run, now: number) {
  const start = Date.parse(run.startedAt || run.createdAt);
  const end = run.finishedAt ? Date.parse(run.finishedAt) : now;
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function RunView({ runId, onChanged, onRerun, onDeleted, onOpenChat }: {
  runId: string; onChanged: () => void; onRerun: (run: Run) => void; onDeleted: () => void; onOpenChat: (id: string) => void;
}) {
  const { run, events, error, setError, refresh, resume } = useRun(runId);
  const [tab, setTab] = useState<"report" | "activity">("activity");
  const [steer, setSteer] = useState("");
  const [now, setNow] = useState(Date.now());
  const active = run ? ACTIVE.includes(run.status) : false;

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  // Show the report as soon as there is one.
  useEffect(() => { if (run?.status === "completed" || (run?.status === "writing" && run.report)) setTab("report"); }, [run?.status, run?.report]);
  // Tell the run list when the status changes (not on every refetch).
  useEffect(() => { if (run) onChanged(); }, [run?.status]);

  if (!run) return <div className="research-empty">{error ? <p role="alert" className="error-notice">{error}</p> : <p className="muted">Loading…</p>}</div>;

  const act = (fn: () => Promise<unknown>) => fn().then(() => { void refresh(); onChanged(); }).catch(e => setError((e as Error).message));
  const name = (run.title || "research").replace(/[^\w -]/g, "").slice(0, 70) || "research";
  const failed = run.status === "failed" || run.status === "interrupted";

  return <section className="run-view" aria-labelledby="run-title">
    <header className="run-head">
      <div className="run-head-main">
        <span className={"run-status " + run.status}>{STATUS[run.status]}</span>
        <h1 id="run-title">{run.title || run.question}</h1>
        <p className="muted run-question">{run.question}</p>
        <dl className="run-stats">
          <div><dt>Time</dt><dd>{elapsed(run, now)}</dd></div>
          <div><dt>Sources</dt><dd>{run.counts.sources_read} read / {run.counts.sources_found} found</dd></div>
          <div><dt>Tool calls</dt><dd>{run.counts.tool_calls} / {run.budget.max_calls}</dd></div>
          <div><dt>Model cost</dt><dd>{run.usage.unpriced ? "not priced" : `$${run.usage.cost.toFixed(4)}`}</dd></div>
        </dl>
      </div>
      <div className="run-actions">
        {(active || run.status === "awaiting_approval") && <button type="button" className="ghost-pill" onClick={() => act(() => research.cancel(run.id))}><StopIcon />Stop</button>}
        {run.report && <Menu label="Export" align="end" triggerClassName="ghost-pill" trigger={<><DownloadIcon />Export</>}>{close => <>
          <MenuItem onSelect={() => { close(); act(() => downloadExport(run.id, "md", name)); }}>Markdown (.md)</MenuItem>
          <MenuItem onSelect={() => { close(); act(() => downloadExport(run.id, "docx", name)); }}>Word (.docx)</MenuItem>
          <MenuItem onSelect={() => { close(); setTab("report"); setTimeout(() => window.print(), 50); }}>PDF (print)</MenuItem>
        </>}</Menu>}
        <Menu label="Run options" align="end" triggerClassName="header-icon" trigger={<DotsIcon />}>{close => <>
          {run.report && <MenuItem onSelect={() => { close(); act(async () => onOpenChat((await research.toChat(run.id)).id)); }}>Continue in chat</MenuItem>}
          {!active && <MenuItem icon={RefreshIcon} onSelect={() => { close(); act(async () => onRerun(await research.rerun(run.id))); }}>Re-run</MenuItem>}
          <MenuDivider />
          <MenuItem icon={TrashIcon} danger onSelect={() => { close(); act(async () => { await research.remove(run.id); onDeleted(); }); }}>Delete</MenuItem>
        </>}</Menu>
      </div>
    </header>

    {error && <p role="alert" className="error-notice">{error}</p>}
    {failed && run.error && <p role="alert" className="research-hint error">{run.error}</p>}
    {run.status === "planning" && !run.plan && <p className="muted run-wait">Writing a research plan…</p>}
    {run.status === "awaiting_approval" && run.plan && <PlanReview run={run} onChanged={() => { void refresh(); resume(); onChanged(); }} />}

    {run.status !== "awaiting_approval" && run.plan && <>
      <div className="run-tabs" role="tablist" aria-label="Run views">
        <button type="button" role="tab" aria-selected={tab === "report"} className={tab === "report" ? "on" : ""} onClick={() => setTab("report")} disabled={!run.report}>Report</button>
        <button type="button" role="tab" aria-selected={tab === "activity"} className={tab === "activity" ? "on" : ""} onClick={() => setTab("activity")}>Activity</button>
      </div>
      {tab === "report" && run.report ? <ReportView run={run} />
        : <Timeline runId={run.id} events={events} pending={run.pending_approvals || []} onDecided={() => void refresh()} />}
    </>}

    {active && <form className="run-steer" onSubmit={e => { e.preventDefault(); const text = steer.trim(); if (text.length < 2) return; act(() => research.steer(run.id, text)); setSteer(""); }}>
      <label className="visually-hidden" htmlFor="run-steer">Add an instruction</label>
      <input id="run-steer" value={steer} maxLength={1000} onChange={e => setSteer(e.target.value)} placeholder="Add an instruction, e.g. “focus on 2024 data”" />
      <button className="primary-pill small" disabled={steer.trim().length < 2}>Send</button>
    </form>}
  </section>;
}
