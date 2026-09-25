import { useState } from "react";
import { api } from "@/lib/chatClient";
import { DocumentRecord } from "@/types";
import { FileIcon } from "./icons";
import { Modal } from "./Modal";

type Preview = DocumentRecord & { chunks: { id: string; page: number; text: string }[] };

/** "View files in chat": documents attached in this chat plus its project's files. */
export function ChatFiles({ attached, project, onClose }: { attached: DocumentRecord[]; project: DocumentRecord[]; onClose: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const open = (id: string) => api<Preview>("/documents/" + id).then(setPreview).catch(e => setError((e as Error).message));
  const group = (title: string, items: DocumentRecord[], note: string) => <section className="files-group">
    <h3>{title}</h3>
    {!items.length ? <p className="muted">{note}</p> : <ul className="files-list">{items.map(d => <li key={d.id}>
      <FileIcon aria-hidden="true" /><span className="files-name">{d.name}</span>
      <span className="muted">{d.pages} page(s) · {new Date(d.createdAt).toLocaleDateString()}</span>
      <button type="button" onClick={() => open(d.id)}>View text</button>
    </li>)}</ul>}
  </section>;
  if (preview) return <Modal title={preview.name} onClose={() => setPreview(null)}>
    <div className="document-preview">{preview.chunks.map(chunk => <section key={chunk.id}><h3>Page {chunk.page}</h3><pre>{chunk.text}</pre></section>)}</div>
  </Modal>;
  return <Modal title="Files in this chat" onClose={onClose}>
    <div className="workspace-modal-form">
      {group("Attached in this chat", attached, "No files attached to this chat.")}
      {project.length > 0 && group("From the project", project, "")}
      {error && <p role="alert" className="error-notice">{error}</p>}
    </div>
  </Modal>;
}
