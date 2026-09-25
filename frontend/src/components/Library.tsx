import { useRef, useState } from "react";
import { api } from "@/lib/chatClient";
import { Conversation, DocumentRecord } from "@/types";
import { Modal } from "./Modal";
export function Library({ documents, conversations, onUpload, onDelete, onOpen, showDocuments = true, showSaved = true }: {
  documents: DocumentRecord[]; conversations: Conversation[]; onUpload: (files: File[]) => Promise<void>;
  onDelete: (id: string) => void; onOpen: (id: string) => void; showDocuments?: boolean; showSaved?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [preview, setPreview] = useState<(DocumentRecord & { chunks: { id: string; page: number; text: string }[] }) | null>(null);
  const saved = conversations.flatMap(c => c.messages.filter(m => m.saved).map(m => ({ conversation: c, message: m })));
  return <section className="feature-page"><div className="page-heading"><div><p className="eyebrow">Keep useful context</p><h1>Library</h1></div>{showDocuments && <button disabled={busy} className="workspace-modal-primary" onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Upload documents"}</button>}</div>
    {showDocuments && <><p className="muted">Text PDFs, Markdown, text, CSV, JSON and code files. Up to 10 MB and 500,000 extracted characters per file. Scanned PDFs need OCR first.</p>
    <input className="visually-hidden" ref={input} type="file" multiple accept=".pdf,.txt,.md,.csv,.json,.py,.js,.ts,.log" onChange={async e => { const files = Array.from(e.target.files || []); e.target.value = ""; setBusy(true); try { await onUpload(files); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }} />
    {error && <p role="alert">{error}</p>}<h2>Documents</h2>{!documents.length && <div className="empty-card">No documents yet.</div>}
    <div className="feature-grid">{documents.map(d => <article className="feature-card" key={d.id}><h3>{d.name}</h3><p className="muted">{d.pages} page(s) · {d.projectId ? "Project document" : "Library document"}</p><div className="action-row"><button onClick={() => api<typeof preview>(`/documents/${d.id}`).then(setPreview).catch(e => setError(e.message))}>View extracted text</button><button onClick={() => onDelete(d.id)}>Delete</button></div></article>)}</div></>}
    {showSaved && <><h2>Saved answers</h2>{!saved.length && <div className="empty-card">Use “Save answer” under an assistant response to keep it here.</div>}
    <div className="feature-grid">{saved.map(({ conversation: c, message: m }) => <article className="feature-card" key={m.id}><h3>{c.title}</h3><p className="saved-excerpt">{m.text.slice(0, 400)}</p><button onClick={() => onOpen(c.id)}>Open conversation</button></article>)}</div></>}
    {preview && <Modal title={preview.name} onClose={() => setPreview(null)}><div className="document-preview">{preview.chunks.map(chunk => <section key={chunk.id}><h3>Page {chunk.page}</h3><pre>{chunk.text}</pre></section>)}</div></Modal>}
  </section>;
}
