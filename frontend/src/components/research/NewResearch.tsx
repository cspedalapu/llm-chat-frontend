import { useEffect, useMemo, useState } from "react";
import { Depth, research, ResearchOptions, Run } from "@/lib/research";

const DEPTH_ORDER: Depth[] = ["quick", "standard", "deep"];

export function NewResearch({ options, initialQuestion, onStarted, onOpenTools, onManageModels }: {
  options: ResearchOptions | null; initialQuestion: string; onStarted: (run: Run) => void;
  onOpenTools: () => void; onManageModels: () => void;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [depth, setDepth] = useState<Depth>("standard");
  const [modelId, setModelId] = useState("");
  const [writerId, setWriterId] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  // Until the user picks sources themselves, follow "everything that's ready" (so a tool
  // set up a moment ago is included).
  const [picked, setPicked] = useState(false);
  const [planFirst, setPlanFirst] = useState(true);
  const [maxCost, setMaxCost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const models = useMemo(() => (options?.models || []).filter(m => m.supports_tools !== false), [options]);
  const ready = useMemo(() => (options?.sources || []).filter(s => s.ready), [options]);
  useEffect(() => { if (initialQuestion) setQuestion(initialQuestion); }, [initialQuestion]);
  useEffect(() => { if (!modelId && models.length) setModelId(models[0].id); }, [models, modelId]);
  useEffect(() => { if (!picked) setSources(ready.map(s => s.id)); }, [ready, picked]);

  if (!options) return <div className="research-empty"><p className="muted">Loading research options…</p></div>;
  const chosenModel = models.find(m => m.id === modelId);
  const preset = options.depths[depth];

  async function start() {
    setBusy(true); setError("");
    try {
      const run = await research.start({
        question: question.trim(), depth, model_id: modelId, writer_model_id: writerId || null,
        sources, plan_first: planFirst, max_cost: maxCost ? Number(maxCost) : null,
      });
      onStarted(run);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <form className="research-new" onSubmit={e => { e.preventDefault(); void start(); }}>
    <h1>What should we research?</h1>
    <label className="visually-hidden" htmlFor="research-question">Research question</label>
    <textarea id="research-question" className="research-question" rows={3} maxLength={4000} value={question} autoFocus
      placeholder="e.g. How big is the EV charging market in India, and who are the main players?"
      onChange={e => setQuestion(e.target.value)} />

    <fieldset className="research-field">
      <legend>Depth</legend>
      <div className="segmented" role="radiogroup" aria-label="Depth">
        {DEPTH_ORDER.map(key => {
          const d = options.depths[key];
          return <button type="button" role="radio" aria-checked={depth === key} key={key}
            className={depth === key ? "on" : ""} onClick={() => setDepth(key)}>
            <strong>{d.label}</strong><span>~{d.minutes} min · ≤{d.max_calls} tool calls</span>
          </button>;
        })}
      </div>
    </fieldset>

    <div className="research-grid">
      <label className="research-field" htmlFor="research-model"><span>Research model</span>
        {models.length ? <select id="research-model" value={modelId} onChange={e => setModelId(e.target.value)}>
          {models.map(m => <option key={m.id} value={m.id}>{m.label}{m.supports_tools === true ? "" : " (tool use not tested)"}</option>)}
        </select> : <button type="button" className="link-button" onClick={onManageModels}>Add a model that supports tool use</button>}
      </label>
      <label className="research-field" htmlFor="research-writer"><span>Report writer</span>
        <select id="research-writer" value={writerId} onChange={e => setWriterId(e.target.value)} disabled={!models.length}>
          <option value="">Same as research model</option>
          {(options.models || []).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
    </div>
    {chosenModel && chosenModel.supports_tools !== true && <p className="research-hint">
      This model's tool use hasn't been checked. Run <em>Test connection</em> under LLMs to confirm it can research.</p>}

    <fieldset className="research-field">
      <legend>Sources</legend>
      <div className="source-chips">
        {options.sources.map(s => {
          const on = sources.includes(s.id);
          return s.ready
            ? <button type="button" key={s.id} aria-pressed={on} className={"source-chip" + (on ? " on" : "")}
              onClick={() => { setPicked(true); setSources(on ? sources.filter(x => x !== s.id) : [...sources, s.id]); }}>{s.name}</button>
            : s.status === "unavailable"
              ? <span key={s.id} className="source-chip off" title="Not configured on this server">{s.name} · not available</span>
              : <button type="button" key={s.id} className="source-chip off" onClick={onOpenTools}
                title="Set this tool up in Manage tools">{s.name} · {s.status === "needs_auth" ? "connect" : "set up"}</button>;
        })}
      </div>
    </fieldset>

    <details className="research-advanced">
      <summary>Options</summary>
      <label className="research-check"><input type="checkbox" checked={planFirst} onChange={e => setPlanFirst(e.target.checked)} />
        Show me the plan before researching</label>
      <label className="research-field narrow" htmlFor="research-cost"><span>Stop when the model cost reaches (USD, optional)</span>
        <input id="research-cost" type="number" min={0.01} step={0.01} value={maxCost} onChange={e => setMaxCost(e.target.value)} placeholder="No limit" />
      </label>
    </details>

    {error && <p role="alert" className="error-notice">{error}</p>}
    <div className="research-actions">
      <span className="muted">Up to {preset.sub_questions} part{preset.sub_questions > 1 ? "s" : ""}, {preset.max_calls} tool calls, ~{preset.minutes} minutes.</span>
      <button className="primary-pill" disabled={busy || question.trim().length < 3 || !modelId || !sources.length}>
        {busy ? "Starting…" : planFirst ? "Plan research" : "Start research"}
      </button>
    </div>
  </form>;
}
