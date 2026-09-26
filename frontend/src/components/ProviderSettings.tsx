import { FormEvent, useState } from "react";
import { Provider } from "@/types";
import { api } from "@/lib/chatClient";
import { Modal } from "./Modal";

const defaults: Record<Provider["kind"], string> = {
  openai: "https://api.openai.com/v1", anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta", ollama: "http://localhost:11434",
};
const initial = { label: "", kind: "openai" as Provider["kind"], base_url: defaults.openai, model: "", api_key: "",
  context_tokens: 16000, max_output_tokens: 2048, input_price: null as number | null, output_price: null as number | null,
  system_role: "system", token_parameter: "max_tokens", include_usage: true, reasoning: "" };

export function ProviderEditor({ provider, onClose, onSaved }: { provider?: Provider; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ ...initial, ...provider, api_key: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await api(provider ? `/models/${provider.id}` : "/models", provider ? "PATCH" : "POST", form); await onSaved(); onClose(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Modal title={provider ? "Edit model connection" : "Add your model"} onClose={onClose}>
    <form onSubmit={save} className="workspace-modal-form">
      <label className="workspace-modal-field"><span>Connection name</span><input required maxLength={100} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="My writing model" /></label>
      <label className="workspace-modal-field"><span>API type</span><select value={form.kind} onChange={e => { const kind = e.target.value as Provider["kind"]; setForm({ ...form, kind, base_url: defaults[kind], api_key: "", reasoning: "" }); }}>
        <option value="openai">OpenAI-compatible (OpenAI, DeepSeek, OpenRouter, custom…)</option><option value="anthropic">Anthropic Messages</option><option value="gemini">Google Gemini</option><option value="ollama">Ollama</option>
      </select></label>
      <label className="workspace-modal-field"><span>API base URL</span><input type="url" required value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} /></label>
      <p className="muted">Enter the base URL, without the chat endpoint. Use HTTPS for remote services. In Docker, use host.docker.internal for a model running on your computer.</p>
      <label className="workspace-modal-field"><span>Model ID</span><input required value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="Exact ID from your provider" /></label>
      <label className="workspace-modal-field"><span>API key {provider?.has_key ? "(saved; leave blank to keep)" : "(optional for local models)"}</span><input type="password" autoComplete="new-password" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} /></label>
      <p className="muted">Keys are encrypted in your local backend and never returned to the browser.</p>
      <div className="field-grid"><label className="workspace-modal-field"><span>Context limit (tokens)</span><input type="number" min={2048} max={2000000} required value={form.context_tokens} onChange={e => setForm({ ...form, context_tokens: Number(e.target.value) })} /></label>
        <label className="workspace-modal-field"><span>Maximum output tokens</span><input type="number" min={64} max={64000} required value={form.max_output_tokens} onChange={e => setForm({ ...form, max_output_tokens: Number(e.target.value) })} /></label></div>
      <details><summary>Compatibility and cost settings</summary><div className="workspace-modal-form">
        {form.kind === "openai" && <><label className="workspace-modal-field"><span>Instruction role</span><select value={form.system_role} onChange={e => setForm({ ...form, system_role: e.target.value })}><option>system</option><option>developer</option></select></label>
          <label className="workspace-modal-field"><span>Output limit parameter</span><select value={form.token_parameter} onChange={e => setForm({ ...form, token_parameter: e.target.value })}><option>max_tokens</option><option>max_completion_tokens</option></select></label>
          <label className="workspace-modal-field"><span>Reasoning effort (only if model supports it)</span><select value={form.reasoning} onChange={e => setForm({ ...form, reasoning: e.target.value })}><option value="">Provider default</option><option>low</option><option>medium</option><option>high</option></select></label>
          <label><input type="checkbox" checked={form.include_usage} onChange={e => setForm({ ...form, include_usage: e.target.checked })} /> Request streamed token usage</label></>}
        <p className="muted">Optional USD per million tokens. Estimates use the rates you enter; provider billing may include other charges.</p>
        <div className="field-grid">{(["input_price", "output_price"] as const).map(key => <label key={key} className="workspace-modal-field"><span>{key === "input_price" ? "Input price" : "Output price"}</span><input type="number" min={0} step="any" value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value === "" ? null : Number(e.target.value) })} /></label>)}</div>
      </div></details>
      {error && <p role="alert" className="error-notice">{error}</p>}
      <div className="workspace-modal-actions"><button type="button" className="workspace-modal-secondary" onClick={onClose}>Cancel</button><button className="workspace-modal-primary" disabled={busy}>{busy ? "Saving…" : "Save connection"}</button></div>
    </form>
  </Modal>;
}

export function ProviderSettings({ models, onAdd, onEdit, onDelete }: { models: Provider[]; onAdd: () => void; onEdit: (p: Provider) => void; onDelete: (id: string) => void }) {
  const [status, setStatus] = useState<Record<string, string>>({});
  async function test(id: string) {
    setStatus(s => ({ ...s, [id]: "Testing…" }));
    try { const result = await api<{ detail: string }>(`/models/${id}/test`, "POST"); setStatus(s => ({ ...s, [id]: result.detail })); }
    catch (e) { setStatus(s => ({ ...s, [id]: (e as Error).message })); }
  }
  return <section className="feature-page"><div className="page-heading"><div><p className="eyebrow">Connections</p><h1>Your models</h1></div><button className="workspace-modal-primary" onClick={onAdd}>Add your model</button></div>
    <p className="muted">Connect multiple providers and switch models in any conversation. Connection tests send a small prompt and may incur a small provider charge.</p>
    {!models.length && <div className="empty-card">Add a connection to start chatting. No model is configured yet.</div>}
    <div className="feature-grid">{models.map(p => <article className="feature-card" key={p.id}><h2>{p.label}</h2><p>{p.model}</p><p className="muted">{p.kind} · {p.base_url}</p><p className="muted">{p.has_key ? "API key saved" : "No API key"} · {p.context_tokens.toLocaleString()} context tokens · {p.supports_tools === true ? "Tool use: yes (can research)" : p.supports_tools === false ? "Tool use: no" : "Tool use: not tested"}</p>
      <div className="action-row"><button onClick={() => onEdit(p)}>Edit</button><button disabled={status[p.id] === "Testing…"} onClick={() => test(p.id)}>Test connection</button><button onClick={() => onDelete(p.id)}>Remove</button></div><p role="status">{status[p.id]}</p>
    </article>)}</div>
  </section>;
}
