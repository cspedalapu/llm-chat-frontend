import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import { appConfig } from "@/app.config";
import { composerTools } from "@/extensions";
import { DocumentRecord, Preset } from "@/types";
import { ArrowUpIcon, ChevronIcon, FileIcon, PaperclipIcon, PlusIcon, SparkIcon, StopIcon } from "./icons";
import { Menu, MenuDivider, MenuItem, MenuNote, SubMenu } from "./Menu";

// Sent per message and applied over the connection default. Providers that do not
// expose a thinking-effort parameter ignore it.
const EFFORTS = [{ id: "", label: "Standard" }, { id: "low", label: "Low" }, { id: "medium", label: "Medium" }, { id: "high", label: "High" }];
const ACCEPT = ".pdf,.txt,.md,.csv,.json,.py,.js,.ts,.log";
// Past this height the text gets the full width and the controls move below it.
const MULTILINE_PX = 52;
function readDraft(key: string) { try { return localStorage.getItem(key) || ""; } catch { return ""; } }

/**
 * Which optional controls to show: backend capabilities combined with the user's
 * Customize choices. `documents` allows attaching; `sources` shows the picker.
 */
export interface ComposerFeatures { documents: boolean; tools: boolean; sources: boolean; presets: boolean; reasoning: boolean }
export function Composer({ draftKey, initialText = "", busy, disabled, features, documents, presets, selectedDocuments, onDocuments,
  presetId, onPreset, reasoning, onReasoning, onSend, onStop, onUpload, placeholder = "Ask anything", empty = false,
}: { draftKey: string; initialText?: string; busy: boolean; disabled: boolean; features: ComposerFeatures; documents: DocumentRecord[]; presets: Preset[];
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
  const [multiline, setMultiline] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const tools = composerTools.filter(tool => tool.available !== false || appConfig.features.placeholderTools);
  const hasToolsMenu = features.tools && (features.documents || features.sources || features.presets || tools.length > 0);
  const preset = presets.find(p => p.id === presetId);
  const effort = EFFORTS.find(e => e.id === reasoning) || EFFORTS[0];

  useLayoutEffect(() => {
    const element = textRef.current; if (!element) return;
    // Empty needs no measuring (and a first measure can run before the grid has a width).
    if (!draft) { element.style.height = ""; setMultiline(false); return; }
    element.style.height = "auto";
    element.style.height = Math.min(element.scrollHeight, 220) + "px";
    // Empty is always one line. Once expanded, stay expanded until cleared: the wider
    // textarea would otherwise shrink the text back under the threshold and flicker.
    setMultiline(current => draft !== "" && (current || element.scrollHeight > MULTILINE_PX || draft.includes("\n")));
  }, [draft]);

  function update(text: string) { setDraft(text); try { if (text) localStorage.setItem(storageKey, text); else localStorage.removeItem(storageKey); } catch { setError("Browser draft storage is unavailable."); } }
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!draft.trim() || busy || submitting || disabled) return;
    setSubmitting(true); setError("");
    try { await onSend(draft.trim(), () => update("")); } catch (e) { setError((e as Error).message); }
    finally { setSubmitting(false); }
  }
  const toggleDocument = (id: string) => onDocuments(selectedDocuments.includes(id) ? selectedDocuments.filter(other => other !== id) : [...selectedDocuments, id]);

  return <form className={"composer" + (empty ? " composer-hero" : "") + (multiline ? " composer-multiline" : "")} onSubmit={submit}>
    {features.documents && <input ref={fileRef} className="visually-hidden" type="file" multiple accept={ACCEPT} onChange={async e => {
      const files = Array.from(e.target.files || []); e.target.value = ""; setUploading(true); setError("");
      try { await onUpload(files); } catch (e) { setError((e as Error).message); } finally { setUploading(false); }
    }} />}
    {(selectedDocuments.length > 0 || preset) && <div className="composer-chips attachment-chips">
      {preset && <button type="button" className="chip chip-assistant" onClick={() => onPreset("")} aria-label={"Remove assistant " + preset.title}><SparkIcon />{preset.title}<span aria-hidden="true">×</span></button>}
      {selectedDocuments.map(id => <button type="button" className="chip" key={id} onClick={() => onDocuments(selectedDocuments.filter(other => other !== id))}>
        <FileIcon />{documents.find(d => d.id === id)?.name || "Document"}<span aria-hidden="true">×</span></button>)}
    </div>}
    <div className="composer-row">
      {hasToolsMenu && <div className="composer-leading">
        <Menu label="Tools" trigger={uploading ? "…" : <PlusIcon />} triggerClassName="composer-round" placement={empty ? "bottom" : "top"} disabled={uploading}>{close => <>
          {features.documents && <MenuItem icon={PaperclipIcon} onSelect={() => { close(); fileRef.current?.click(); }}>Attach text documents</MenuItem>}
          {features.sources && <SubMenu icon={FileIcon} label={"Sources" + (selectedDocuments.length ? ` (${selectedDocuments.length})` : "")}>
            <MenuNote>Project files are searched automatically. Select other library files to include.</MenuNote>
            {!documents.length && <MenuNote>No documents yet. Attach a file to begin.</MenuNote>}
            {documents.map(d => <MenuItem key={d.id} checked={selectedDocuments.includes(d.id)} onSelect={() => toggleDocument(d.id)}
              hint={"Uploaded " + new Date(d.createdAt).toLocaleString()}>{d.name}</MenuItem>)}
          </SubMenu>}
          {features.presets && <SubMenu icon={SparkIcon} label="Assistant">
            <MenuItem checked={!presetId} onSelect={() => { onPreset(""); close(); }}>Default assistant</MenuItem>
            {presets.map(p => <MenuItem key={p.id} checked={presetId === p.id} onSelect={() => { onPreset(p.id); close(); }}>{p.title}</MenuItem>)}
            {!presets.length && <MenuNote>No saved assistants yet. Create one under Workspace.</MenuNote>}
          </SubMenu>}
          {tools.length > 0 && (features.documents || features.sources || features.presets) && <MenuDivider />}
          {tools.map(tool => <MenuItem key={tool.id} disabled={tool.available === false} hint={tool.available === false ? "Not connected in this release" : undefined}
            onSelect={() => { close(); tool.run?.({ draft, setDraft: update }); }}>{tool.label}</MenuItem>)}
        </>}</Menu>
      </div>}
      <textarea ref={textRef} aria-label="Message" value={draft} maxLength={32000} rows={1} onChange={e => update(e.target.value)} placeholder={placeholder}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} />
      <div className="composer-trailing">
        {features.reasoning && <Menu label={"Thinking effort: " + effort.label} align="end" placement={empty ? "bottom" : "top"} triggerClassName="composer-effort"
          trigger={<><span>{effort.label}</span><ChevronIcon className="composer-effort-caret" aria-hidden="true" /></>}>{close => <>
          <MenuNote>Thinking effort</MenuNote>
          {EFFORTS.map(e => <MenuItem key={e.id} checked={reasoning === e.id} onSelect={() => { onReasoning(e.id); close(); }}>{e.label}</MenuItem>)}
        </>}</Menu>}
        {busy
          ? <button type="button" className="composer-send stop" aria-label="Stop" title="Stop" onClick={onStop}><StopIcon /></button>
          : <button className="composer-send" aria-label="Send" title={submitting ? "Sending…" : "Send"} disabled={disabled || submitting || uploading || !draft.trim()}><ArrowUpIcon /></button>}
      </div>
    </div>
    {error && <p className="error-notice" role="alert">{error}</p>}
  </form>;
}
