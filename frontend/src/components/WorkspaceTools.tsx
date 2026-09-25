import { useEffect, useState } from "react";
import { api, download } from "@/lib/chatClient";
import { Preset, Provider, Usage, WorkspaceData } from "@/types";
import { Modal } from "./Modal";

function PresetEditor({ preset, models, onSave, onClose }: { preset?: Preset; models: Provider[]; onSave: (body: Omit<Preset, "id">) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ title: preset?.title || "", instructions: preset?.instructions || "", model: preset?.model || "", output_format: preset?.output_format || "" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return <Modal title={preset ? "Edit assistant" : "Create assistant"} onClose={onClose}><form className="workspace-modal-form" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await onSave(form); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
    <label className="workspace-modal-field"><span>Name</span><input required maxLength={150} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
    <label className="workspace-modal-field"><span>Instructions</span><textarea aria-label="Instructions" required rows={6} maxLength={12000} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} /></label>
    <label className="workspace-modal-field"><span>Preferred model</span><select value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}><option value="">Keep selected model</option>{models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
    <label className="workspace-modal-field"><span>Output format</span><textarea aria-label="Output format" rows={3} maxLength={1000} value={form.output_format} onChange={e => setForm({ ...form, output_format: e.target.value })} placeholder="For example: findings, evidence, and next actions" /></label>
    {error && <p role="alert">{error}</p>}<button className="workspace-modal-primary" disabled={busy}>Save assistant</button>
  </form></Modal>;
}

export function WorkspaceTools({ data, onRefresh, onUse }: { data: WorkspaceData; onRefresh: () => Promise<void>; onUse: (p: Preset) => void }) {
  const [usage, setUsage] = useState<Usage | null>(null); const [editor, setEditor] = useState<Preset | "new" | null>(null);
  const [limit, setLimit] = useState(data.settings.daily_request_limit); const [status, setStatus] = useState("");
  useEffect(() => { api<Usage>("/usage").then(setUsage).catch(e => setStatus(e.message)); }, []);
  return <section className="feature-page"><div className="page-heading"><div><p className="eyebrow">Personal workspace</p><h1>Assistants & usage</h1></div><button className="workspace-modal-primary" onClick={() => setEditor("new")}>Create assistant</button></div>
    <p className="muted">Save repeatable instructions and output formats for writing, studying, coding, or research. An assistant follows you into any chat. Use a <strong>project</strong> instead when the work has its own documents and memory to keep together.</p>
    <div className="feature-grid">{data.presets.map(p => <article key={p.id} className="feature-card"><h2>{p.title}</h2><p>{p.instructions.slice(0, 180)}</p><div className="action-row"><button onClick={() => onUse(p)}>Use assistant</button><button onClick={() => setEditor(p)}>Edit</button><button onClick={async () => { try { await api(`/presets/${p.id}`, "DELETE"); await onRefresh(); } catch (e) { setStatus((e as Error).message); } }}>Delete</button></div></article>)}</div>
    {!data.presets.length && <div className="empty-card">No saved assistants yet. Create one for a task you repeat.</div>}
    <h2>Usage</h2>{usage && <><div className="stats-grid"><div><strong>{usage.today}</strong><span>requests today (UTC)</span></div><div><strong>{usage.input_tokens.toLocaleString()}</strong><span>reported input tokens</span></div><div><strong>{usage.output_tokens.toLocaleString()}</strong><span>reported output tokens</span></div><div><strong>${usage.estimated_cost.toFixed(4)}</strong><span>estimated total cost</span></div></div>
      <p className="muted">{usage.unpriced_requests} request(s) lack complete pricing or usage. Cancelled calls may still be billed by your provider. Connection tests are not included.</p>
      <details><summary>Recent generations</summary><div className="table-scroll"><table><thead><tr><th>Model</th><th>Status</th><th>Duration</th><th>Time</th></tr></thead><tbody>{usage.recent.map((item, i) => <tr key={item.id || i}><td>{item.generationModel}</td><td>{item.status}</td><td>{((item.latencyMs || 0) / 1000).toFixed(1)}s</td><td>{new Date(item.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div></details></>}
    <form className="settings-row" onSubmit={async e => { e.preventDefault(); try { await api("/settings", "PATCH", { daily_request_limit: limit }); await onRefresh(); setStatus("Daily request limit saved."); } catch (e) { setStatus((e as Error).message); } }}><label>Daily generation limit <input aria-label="Daily generation limit" type="number" min={1} max={100000} value={limit} onChange={e => setLimit(Number(e.target.value))} /></label><button>Save limit</button></form>
    <h2>Your data</h2><p className="muted">Chats and extracted documents stay in this local workspace. Prompts, instructions, and matching excerpts are sent to the model provider you choose.</p>
    <button onClick={() => download("workspace-export.json", JSON.stringify({ conversations: data.conversations, projects: data.projects, presets: data.presets }, null, 2), "application/json")}>Export chats, projects & assistants</button>
    <p className="muted">For a complete backup including document text and encrypted connections, stop the backend and copy its data directory together with secret.key.</p>
    {status && <p role="status">{status}</p>}
    {editor && <PresetEditor preset={editor === "new" ? undefined : editor} models={data.models} onClose={() => setEditor(null)} onSave={async body => { await api(editor === "new" ? "/presets" : `/presets/${editor.id}`, editor === "new" ? "POST" : "PATCH", body); await onRefresh(); }} />}
  </section>;
}
