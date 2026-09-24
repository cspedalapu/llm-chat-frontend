import { useState } from "react";
import { ProjectSummary } from "@/types";
import { Modal } from "./Modal";
export function ProjectEditor({ project, appendedMemory, onSave, onClose }: {
  project?: ProjectSummary; appendedMemory?: string; onSave: (value: { title: string; instructions: string; memory: string; template: string }) => Promise<void>; onClose: () => void;
}) {
  const [title, setTitle] = useState(project?.title || "");
  const [instructions, setInstructions] = useState(project?.instructions || "");
  const [memory, setMemory] = useState([project?.memory, appendedMemory].filter(Boolean).join("\n\n"));
  const [template, setTemplate] = useState(project?.template || "writing");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <Modal title={project ? "Project settings" : "Create project"} onClose={onClose}><form className="workspace-modal-form" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError("");
    try { await onSave({ title: title.trim(), instructions, memory, template }); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>
    <label className="workspace-modal-field"><span>Project name</span><input required maxLength={150} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label className="workspace-modal-field"><span>Category</span><select value={template} onChange={e => setTemplate(e.target.value as typeof template)}><option value="writing">Writing</option><option value="homework">Learning</option><option value="investing">Research</option><option value="travel">Planning</option></select></label>
    <label className="workspace-modal-field"><span>Instructions</span><textarea rows={5} maxLength={12000} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Goals, tone, constraints, and how the assistant should respond" /></label>
    <label className="workspace-modal-field"><span>Project memory</span><textarea rows={6} maxLength={12000} value={memory} onChange={e => setMemory(e.target.value)} placeholder="Facts and decisions to reuse in every project chat" /></label>
    <p className="muted">These instructions and memories are sent to your selected provider in project chats. You control what is saved here.</p>
    {error && <p role="alert" className="error-notice">{error}</p>}<button disabled={busy} className="workspace-modal-primary">{busy ? "Saving…" : "Save project"}</button>
  </form></Modal>;
}
