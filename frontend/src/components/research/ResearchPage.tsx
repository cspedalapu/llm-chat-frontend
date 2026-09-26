import { useCallback, useEffect, useState } from "react";
import { useResearchRuns } from "@/hooks/useResearch";
import { ACTIVE, ConnectorDirectory, research, ResearchOptions, Run, tools } from "@/lib/research";
import { PlusIcon } from "../icons";
import { NewResearch } from "./NewResearch";
import { RunView } from "./RunView";
import { ToolsDirectory } from "./ToolsDirectory";
import { ToolsPanel } from "./ToolsPanel";

const STATUS_DOT: Record<string, string> = {
  planning: "live", researching: "live", writing: "live", awaiting_approval: "wait",
  completed: "done", failed: "bad", cancelled: "off", interrupted: "bad",
};

/**
 * The Research tab: history on the left, the current run (or a new one) in the middle,
 * connected tools on the right. Everything here needs the `research` capability.
 */
export function ResearchPage({ initialQuestion, onQuestionUsed, onOpenChat, onManageModels, canManageTools }: {
  initialQuestion: string; onQuestionUsed: () => void; onOpenChat: (id: string) => void;
  onManageModels: () => void; canManageTools: boolean;
}) {
  const { runs, error, refresh } = useResearchRuns();
  const [selected, setSelected] = useState<string | null>(null);
  const [options, setOptions] = useState<ResearchOptions | null>(null);
  const [directory, setDirectory] = useState<ConnectorDirectory | null>(null);
  const [managing, setManaging] = useState(false);
  const [question, setQuestion] = useState(initialQuestion);

  const loadSetup = useCallback(async () => {
    const [nextOptions, nextDirectory] = await Promise.all([
      research.options(), canManageTools ? tools.directory() : Promise.resolve(null),
    ]);
    setOptions(nextOptions); setDirectory(nextDirectory);
  }, [canManageTools]);
  useEffect(() => { void loadSetup().catch(() => undefined); }, [loadSetup]);
  // A question handed over from the chat composer ("Research this") opens a new run form.
  useEffect(() => { if (initialQuestion) { setQuestion(initialQuestion); setSelected(null); onQuestionUsed(); } }, [initialQuestion, onQuestionUsed]);

  function started(run: Run) { setSelected(run.id); setQuestion(""); void refresh(); }

  return <section className="research" aria-label="Research">
    <nav className="research-history" aria-label="Research history">
      <button type="button" className={"history-new" + (selected === null ? " on" : "")} onClick={() => setSelected(null)}>
        <PlusIcon aria-hidden="true" />New research</button>
      <label className="visually-hidden" htmlFor="history-select">Open a research run</label>
      <select id="history-select" className="history-select" value={selected || ""} onChange={e => setSelected(e.target.value || null)}>
        <option value="">New research</option>
        {runs.map(r => <option key={r.id} value={r.id}>{r.title || r.question}</option>)}
      </select>
      {error && <p role="alert" className="error-notice">{error}</p>}
      <ul className="history-list">
        {runs.map(r => <li key={r.id}>
          <button type="button" className={"history-item" + (selected === r.id ? " on" : "")} onClick={() => setSelected(r.id)}
            aria-current={selected === r.id ? "true" : undefined}>
            <span className={"history-dot " + (STATUS_DOT[r.status] || "off")} aria-hidden="true" />
            <span className="history-title">{r.title || r.question}</span>
            <span className="visually-hidden">{ACTIVE.includes(r.status) ? " (running)" : ` (${r.status})`}</span>
          </button>
        </li>)}
        {!runs.length && <li className="muted history-empty">Your research runs will appear here.</li>}
      </ul>
    </nav>

    <div className="research-main">
      {selected
        ? <RunView key={selected} runId={selected} onChanged={() => void refresh()} onRerun={started}
          onDeleted={() => { setSelected(null); void refresh(); }} onOpenChat={onOpenChat} />
        : <NewResearch options={options} initialQuestion={question} onStarted={started}
          onOpenTools={() => setManaging(true)} onManageModels={onManageModels} />}
    </div>

    {canManageTools && <ToolsPanel directory={directory} onManage={() => setManaging(true)} />}
    {managing && <ToolsDirectory onClose={() => { setManaging(false); void loadSetup(); }} onChanged={() => void loadSetup()} />}
  </section>;
}
