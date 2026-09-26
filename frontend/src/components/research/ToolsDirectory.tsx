import { useEffect, useState } from "react";
import { Connector, ConnectorDirectory, Permission, tools } from "@/lib/research";
import { Modal } from "../Modal";
import { connectorState, STATUS_TEXT } from "./ToolsPanel";

const PERMISSIONS: { id: Permission; label: string }[] = [
  { id: "allow", label: "Always allow" }, { id: "ask", label: "Ask each time" }, { id: "block", label: "Blocked" },
];
const lines = (text: string) => text.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);

function Permissions({ connector, onSave }: { connector: Connector; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  if (!connector.tools.length) return null;
  return <table className="perm-table">
    <thead><tr><th scope="col">Tool</th><th scope="col">Permission</th></tr></thead>
    <tbody>{connector.tools.map(t => <tr key={t.name}>
      <td><strong>{t.name}</strong><span className="muted">{t.description}</span></td>
      <td>{t.access === "write"
        ? <span className="perm-locked" title="Research only reads; tools that change things are never run.">Blocked in research</span>
        : <select aria-label={`Permission for ${t.name}`} value={t.permission}
          onChange={e => void onSave({ permissions: { [t.name]: e.target.value } })}>
          {PERMISSIONS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>}</td>
    </tr>)}</tbody>
  </table>;
}

function WebSearchSettings({ connector, directory, onSave }: { connector: Connector; directory: ConnectorDirectory; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const [provider, setProvider] = useState(connector.config.provider || "");
  const [baseUrl, setBaseUrl] = useState(connector.config.base_url || "");
  const [key, setKey] = useState("");
  const [price, setPrice] = useState(connector.config.price_per_1k ?? "");
  const [allowed, setAllowed] = useState((connector.config.allowed_domains || []).join("\n"));
  const [blocked, setBlocked] = useState((connector.config.blocked_domains || []).join("\n"));
  return <form className="tool-form" onSubmit={e => {
    e.preventDefault();
    void onSave({
      provider, base_url: provider === "searxng" ? baseUrl : "", ...(key ? { api_key: key } : {}),
      price_per_1k: price === "" ? null : Number(price), allowed_domains: lines(allowed), blocked_domains: lines(blocked),
    }).then(() => setKey(""));
  }}>
    <label className="workspace-modal-field" htmlFor="ws-provider"><span>Search provider</span>
      <select id="ws-provider" value={provider} onChange={e => setProvider(e.target.value)}>
        <option value="">Choose…</option>
        {Object.entries(directory.search_providers).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
    {provider === "searxng" && <label className="workspace-modal-field" htmlFor="ws-base"><span>SearXNG URL</span>
      <input id="ws-base" type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://search.example.org" />
    </label>}
    {(provider === "tavily" || provider === "brave") && <label className="workspace-modal-field" htmlFor="ws-key">
      <span>API key {connector.has_secret ? "(saved; leave blank to keep)" : ""}</span>
      <input id="ws-key" type="password" autoComplete="new-password" value={key} onChange={e => setKey(e.target.value)} />
    </label>}
    <details><summary>Cost and site rules</summary><div className="workspace-modal-form">
      <label className="workspace-modal-field" htmlFor="ws-price"><span>Price per 1,000 searches (USD, for tracking)</span>
        <input id="ws-price" type="number" min={0} step="any" value={price} onChange={e => setPrice(e.target.value)} /></label>
      <div className="field-grid">
        <label className="workspace-modal-field" htmlFor="ws-allow"><span>Only these sites (one per line)</span>
          <textarea id="ws-allow" rows={3} value={allowed} onChange={e => setAllowed(e.target.value)} placeholder="gov.in&#10;who.int" /></label>
        <label className="workspace-modal-field" htmlFor="ws-block"><span>Never these sites</span>
          <textarea id="ws-block" rows={3} value={blocked} onChange={e => setBlocked(e.target.value)} placeholder="example-spam.com" /></label>
      </div>
    </div></details>
    <button className="workspace-modal-primary">Save web search</button>
  </form>;
}

function AcademicSettings({ connector, directory, onSave }: { connector: Connector; directory: ConnectorDirectory; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const chosen: string[] = connector.config.databases || [];
  return <fieldset className="tool-form"><legend className="visually-hidden">Paper databases</legend>
    {Object.entries(directory.academic_databases).map(([id, label]) => <label key={id} className="research-check">
      <input type="checkbox" checked={chosen.includes(id)} disabled={chosen.length === 1 && chosen.includes(id)}
        onChange={e => void onSave({ databases: e.target.checked ? [...chosen, id] : chosen.filter(d => d !== id) })} /> {label}
    </label>)}
  </fieldset>;
}

function AddMcp({ onAdded }: { onAdded: () => Promise<void> }) {
  const [form, setForm] = useState({ name: "", url: "", auth: "none", token: "", client_id: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="tool-form" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError("");
    try { await tools.addMcp(form); setForm({ name: "", url: "", auth: "none", token: "", client_id: "" }); await onAdded(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }}>
    <div className="field-grid">
      <label className="workspace-modal-field" htmlFor="mcp-name"><span>Name</span>
        <input id="mcp-name" required maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Company knowledge base" /></label>
      <label className="workspace-modal-field" htmlFor="mcp-auth"><span>Sign-in</span>
        <select id="mcp-auth" value={form.auth} onChange={e => setForm({ ...form, auth: e.target.value })}>
          <option value="none">None</option><option value="bearer">Access token</option><option value="oauth">OAuth sign-in</option>
        </select></label>
    </div>
    <label className="workspace-modal-field" htmlFor="mcp-url"><span>Server URL (Streamable HTTP)</span>
      <input id="mcp-url" required type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://tools.example.com/mcp" /></label>
    {form.auth === "bearer" && <label className="workspace-modal-field" htmlFor="mcp-token"><span>Access token</span>
      <input id="mcp-token" type="password" autoComplete="new-password" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} /></label>}
    {form.auth === "oauth" && <label className="workspace-modal-field" htmlFor="mcp-client"><span>Client ID (leave blank if the server supports automatic registration)</span>
      <input id="mcp-client" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} /></label>}
    {error && <p role="alert" className="error-notice">{error}</p>}
    <button className="workspace-modal-primary" disabled={busy}>{busy ? "Connecting…" : "Add server"}</button>
  </form>;
}

function ConnectorCard({ connector, directory, onChanged }: { connector: Connector; directory: ConnectorDirectory; onChanged: () => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const state = connectorState(connector);
  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true); setMessage("");
    try { const result = await fn(); if (done) setMessage(done); else if (result && typeof result === "object" && "detail" in result) setMessage(String((result as { detail: string }).detail)); await onChanged(); }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  const save = (body: Record<string, unknown>) => run(() => tools.update(connector.id, body), "Saved.");
  async function signIn() {
    const { url } = await tools.signIn(connector.id);
    const popup = window.open(url, "connector-auth", "width=520,height=680");
    if (!popup) { window.location.assign(url); return; }
    await new Promise<void>(resolve => {
      const onMessage = (event: MessageEvent) => { if (event.data?.type === "connector-auth") finish(); };
      const timer = window.setInterval(() => { if (popup.closed) finish(); }, 800);
      function finish() { window.clearInterval(timer); window.removeEventListener("message", onMessage); resolve(); }
      window.addEventListener("message", onMessage);
    });
  }
  return <article className={"tool-card " + state} aria-labelledby={`tool-${connector.id}`}>
    <header className="tool-card-head">
      <div>
        <h3 id={`tool-${connector.id}`}>{connector.name}</h3>
        <p className="muted">{connector.description}</p>
      </div>
      <span className={"tool-badge " + state}>{state === "off" ? "Off" : STATUS_TEXT[state] || state}</span>
    </header>
    {connector.status_detail && <p className={"tool-detail " + (state === "error" ? "error" : "")}>{connector.status_detail}</p>}
    {connector.key === "web_search" && <WebSearchSettings connector={connector} directory={directory} onSave={save} />}
    {connector.key === "academic" && <AcademicSettings connector={connector} directory={directory} onSave={save} />}
    {connector.type === "mcp" && <p className="muted mono-line">{connector.config.url}</p>}
    <Permissions connector={connector} onSave={save} />
    <div className="tool-card-actions">
      {connector.status !== "unavailable" && <label className="research-check">
        <input type="checkbox" checked={connector.enabled} onChange={e => void save({ enabled: e.target.checked })} /> Use in research</label>}
      {(connector.type === "oauth" || (connector.type === "mcp" && connector.config.auth === "oauth")) && connector.status !== "unavailable" &&
        <button type="button" className="ghost-pill small" disabled={busy} onClick={() => void run(signIn, "")}>{connector.has_secret ? "Reconnect" : "Connect"}</button>}
      {connector.status !== "unavailable" && <button type="button" className="ghost-pill small" disabled={busy} onClick={() => void run(() => tools.test(connector.id))}>Test</button>}
      {connector.type !== "builtin" && connector.has_secret && connector.type === "oauth" &&
        <button type="button" className="ghost-pill small" disabled={busy} onClick={() => void run(() => tools.remove(connector.id), "Disconnected.")}>Disconnect</button>}
      {connector.type === "mcp" && <button type="button" className="ghost-pill small danger" disabled={busy} onClick={() => void run(() => tools.remove(connector.id), "Removed.")}>Remove</button>}
    </div>
    {message && <p role="status" className="tool-message">{message}</p>}
  </article>;
}

/** Manage tools: set up, sign in, permissions, custom MCP servers. */
export function ToolsDirectory({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [directory, setDirectory] = useState<ConnectorDirectory | null>(null);
  const [error, setError] = useState("");
  async function load() {
    try { setDirectory(await tools.directory()); setError(""); onChanged(); } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, []); // load once when the window opens
  const groups: [string, string, (c: Connector) => boolean][] = [
    ["Built in", "Available to every research run once set up.", c => c.type === "builtin"],
    ["Sign in", "Read-only access to your files. Your administrator configures these apps on the server.", c => c.type === "oauth"],
    ["Custom tools (MCP)", "Any server that speaks the Model Context Protocol. Only its read-only tools run during research.", c => c.type === "mcp"],
  ];
  return <Modal title="Manage tools" onClose={onClose}>
    <div className="tools-directory">
      {error && <p role="alert" className="error-notice">{error}</p>}
      {!directory ? <p className="muted">Loading…</p> : groups.map(([title, note, match]) => <section key={title} className="tool-group">
        <h2>{title}</h2><p className="muted">{note}</p>
        {directory.connectors.filter(match).map(c => <ConnectorCard key={c.id} connector={c} directory={directory} onChanged={load} />)}
        {title.startsWith("Custom") && <details className="tool-add"><summary>Add an MCP server</summary><AddMcp onAdded={load} /></details>}
      </section>)}
      {directory && <p className="muted tool-redirect">Sign-in redirect URL for your OAuth apps: <code>{directory.redirect_uri}</code></p>}
    </div>
  </Modal>;
}
