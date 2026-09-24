import { useEffect, useState } from "react";
import { api } from "@/lib/chatClient";
import { Conversation } from "@/types";
export function SearchChats({ onOpen, onRestore }: { onOpen: (id: string) => void; onRestore: (id: string) => Promise<void> }) {
  const [query, setQuery] = useState(""); const [archived, setArchived] = useState(false);
  const [results, setResults] = useState<Conversation[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => { setLoading(true); try {
      const items = await api<Conversation[]>(`/search?q=${encodeURIComponent(query)}&archived=${archived}`);
      if (!cancelled) { setResults(items); setError(""); }
    } catch (e) { if (!cancelled) setError((e as Error).message); } finally { if (!cancelled) setLoading(false); } }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, archived]);
  return <section className="feature-page"><p className="eyebrow">Find your work</p><h1>Search chats</h1>
    <label className="workspace-modal-field"><span>Search titles and message content</span><input autoFocus type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search conversations…" /></label>
    <label><input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /> Include archived chats</label>
    {error && <p role="alert">{error}</p>}{loading && <p role="status">Searching…</p>}
    {!results.length && !loading && <div className="empty-card">No matching chats.</div>}
    <div className="result-list">{results.map(c => <article className="feature-card" key={c.id}><button className="text-button" onClick={() => onOpen(c.id)}><h2>{c.title}{c.archived ? " · archived" : ""}</h2><p>{c.preview}</p></button>
      {c.archived && <button onClick={() => onRestore(c.id).then(() => setResults(items => items.map(item => item.id === c.id ? { ...item, archived: false } : item))).catch(e => setError(e.message))}>Restore chat</button>}
    </article>)}</div>
  </section>;
}
