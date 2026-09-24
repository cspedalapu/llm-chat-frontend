import { FormEvent, useRef, useState } from "react";
import { DocumentRecord, Preset } from "@/types";

// Sent per message and applied over the connection default. Providers that do not
// expose a thinking-effort parameter ignore it.
const EFFORTS = [{ id: "", label: "Standard" }, { id: "low", label: "Low" }, { id: "medium", label: "Medium" }, { id: "high", label: "High" }];
function readDraft(key: string) { try { return localStorage.getItem(key) || ""; } catch { return ""; } }
export function Composer({ draftKey, initialText = "", busy, disabled, documents, presets, selectedDocuments, onDocuments,
  presetId, onPreset, reasoning, onReasoning, onSend, onStop, onUpload, placeholder = "Ask anything", empty = false,
}: { draftKey: string; initialText?: string; busy: boolean; disabled: boolean; documents: DocumentRecord[]; presets: Preset[];
  selectedDocuments: string[]; onDocuments: (ids: string[]) => void; presetId: string; onPreset: (id: string) => void;
  reasoning: string; onReasoning: (value: string) => void;
  onSend: (text: string, accepted: () => void) => Promise<void>; onStop: () => void;
  onUpload: (files: File[]) => Promise<void>; placeholder?: string; empty?: boolean;
}) {
  const storageKey = "local-chat:draft:" + draftKey;
  const [draft, setDraft] = useState(() => initialText || readDraft(storageKey));
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  function update(text: string) { setDraft(text); try { if (text) localStorage.setItem(storageKey, text); else localStorage.removeItem(storageKey); } catch { setError("Browser draft storage is unavailable."); } }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!draft.trim() || busy || submitting || disabled) return;
    setSubmitting(true); setError("");
    try { await onSend(draft.trim(), () => update("")); } catch (e) { setError((e as Error).message); }
    finally { setSubmitting(false); }
  }
  return <form className={"composer-panel functional-composer" + (empty ? " empty composer-panel-hero" : "")} onSubmit={submit}>
    <textarea aria-label="Message" value={draft} maxLength={32000} onChange={e => update(e.target.value)} placeholder={placeholder} rows={empty ? 2 : 2}
      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
    <div className="composer-toolbar"><div className="composer-options">
      <input ref={fileRef} className="visually-hidden" type="file" multiple accept=".pdf,.txt,.md,.csv,.json,.py,.js,.ts,.log" onChange={async e => {
        const files = Array.from(e.target.files || []); e.target.value = ""; setUploading(true); setError("");
        try { await onUpload(files); } catch (e) { setError((e as Error).message); } finally { setUploading(false); }
      }} />
      <button type="button" className="composer-icon-button" aria-label="Attach files" title="Attach text documents" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "…" : "+"}</button>
      <details className="composer-source-picker"><summary>Sources {selectedDocuments.length ? `(${selectedDocuments.length})` : ""}</summary><div className="source-picker-panel">
        <p className="muted">Project files are searched automatically. Select other library files to include.</p>
        {!documents.length && <p>No documents yet. Attach a file to begin.</p>}
        {documents.map(d => <label key={d.id}><input type="checkbox" checked={selectedDocuments.includes(d.id)} onChange={e => onDocuments(e.target.checked ? [...selectedDocuments, d.id] : selectedDocuments.filter(id => id !== d.id))} /> {d.name}</label>)}
      </div></details>
      <div className="composer-menu-root">
        <button type="button" className={"composer-mode-button" + (thinkingOpen ? " active" : "")} aria-haspopup="menu"
          aria-expanded={thinkingOpen} aria-label={"Thinking effort: " + (EFFORTS.find(e => e.id === reasoning)?.label || "Standard")}
          onClick={() => setThinkingOpen(open => !open)}>
          <span>Thinking</span><span className="composer-mode-caret" aria-hidden="true">▾</span>
        </button>
        {thinkingOpen && <div className="composer-thinking-menu" role="menu" aria-label="Thinking effort">
          <p className="composer-thinking-menu-label">Thinking effort</p>
          {EFFORTS.map(effort => <button key={effort.id} type="button" role="menuitemradio" aria-checked={reasoning === effort.id}
            className={"composer-thinking-menu-item" + (reasoning === effort.id ? " active" : "")}
            onClick={() => { onReasoning(effort.id); setThinkingOpen(false); }}>
            <span className="composer-thinking-menu-label-text">{effort.label}</span>
            {reasoning === effort.id && <span className="composer-thinking-menu-check" aria-hidden="true">✓</span>}
          </button>)}
        </div>}
      </div>
      <select aria-label="Assistant preset" value={presetId} onChange={e => onPreset(e.target.value)}><option value="">Default assistant</option>{presets.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
    </div>
    {busy ? <button type="button" className="composer-submit" onClick={onStop}>Stop</button> : <button className="composer-submit" disabled={disabled || submitting || uploading || !draft.trim()}>{submitting ? "Sending…" : "Send"}</button>}
    </div>
    {selectedDocuments.length > 0 && <div className="attachment-chips">{selectedDocuments.map(id => <button type="button" key={id} onClick={() => onDocuments(selectedDocuments.filter(other => other !== id))}>{documents.find(d => d.id === id)?.name || "Document"} ×</button>)}</div>}
    {error && <p className="error-notice" role="alert">{error}</p>}
  </form>;
}
