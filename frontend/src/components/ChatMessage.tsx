import { ReactNode, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "@/types";

function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return <div className="code-block"><button onClick={async e => {
    try { await navigator.clipboard.writeText(e.currentTarget.parentElement?.querySelector("pre")?.textContent || ""); setCopied(true); }
    catch { setCopied(false); }
  }}>{copied ? "Copied" : "Copy code"}</button><pre>{children}</pre></div>;
}
export function ChatMessage({ message, busy, onBranch, onRetry, onSave, onMemory }: {
  message: Message; busy?: boolean; onBranch?: () => void; onRetry?: () => void; onSave?: () => void; onMemory?: () => void;
}) {
  const [copyLabel, setCopyLabel] = useState("Copy");
  const assistant = message.role === "assistant";
  const result = message.result;
  return <article className={"message-row " + message.role}>
    {assistant && <div className="message-meta assistant"><strong>{result?.generationLabel || "Assistant"}</strong><span>{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>}
    <div className={"message-bubble " + message.role + (message.state === "error" ? " error" : "")}>
      {assistant ? <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
        img: ({ alt }) => <span>[Image: {alt || "external image"}]</span>,
      }}>{message.text}</ReactMarkdown></div> : <p className="user-text">{message.text}</p>}
      {message.state === "streaming" && (message.text
        ? <span role="status" className="stream-status">Generating…</span>
        : <span role="status" aria-label="Generating response" className="loading"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>)}
      {result?.error && <p role="alert">{result.error}</p>}
      {(message.state === "cancelled" || message.state === "interrupted") && <p className="muted">{message.state === "cancelled" ? "Stopped. Partial response saved." : "Interrupted by a server restart. Partial response saved."}</p>}
      {result?.context_note && <p className="muted">{result.context_note}</p>}
      {result?.source_note && <p className="muted">{result.source_note}</p>}
      {result?.sources?.length ? <details className="source-list"><summary>Reference passages ({result.sources.length})</summary>
        <p className="muted">Passages supplied to the model. Check that each cited passage supports its claim.</p>
        {result.sources.map(source => <details key={source.id}><summary>[{source.number}] {source.title} · page {source.page}</summary><blockquote>{source.excerpt}</blockquote></details>)}
      </details> : null}
      {assistant && result && message.state !== "streaming" && <details className="generation-details"><summary>Response details</summary>
        <p>Model: {result.generationModel}</p><p>Input: {result.usage?.input ?? "unreported"} tokens · Output: {result.usage?.output ?? "unreported"} tokens</p>
        <p>{((result.latencyMs || 0) / 1000).toFixed(1)}s total{result.first_token_ms !== undefined ? " · " + (result.first_token_ms / 1000).toFixed(1) + "s to first text" : ""}</p>
        <p>Estimated cost: {result.estimated_cost !== undefined ? "$" + result.estimated_cost.toFixed(6) : "not configured or usage unavailable"}</p>
        {result.finish_reason && <p>Finish: {result.finish_reason}</p>}
      </details>}
    </div>
    <div className="message-actions">
      <button onClick={async () => { try { await navigator.clipboard.writeText(message.text); setCopyLabel("Copied"); } catch { setCopyLabel("Copy unavailable"); } }}>{copyLabel}</button>
      {onBranch && <button disabled={busy} onClick={onBranch}>{assistant ? "Branch here" : "Edit in new branch"}</button>}
      {assistant && onRetry && <button disabled={busy} onClick={onRetry}>{message.state === "error" ? "Retry in new branch" : "Regenerate in new branch"}</button>}
      {assistant && onSave && <button disabled={busy} onClick={onSave} aria-pressed={Boolean(message.saved)}>{message.saved ? "Unsave" : "Save answer"}</button>}
      {assistant && onMemory && <button disabled={busy} onClick={onMemory}>Save to project memory</button>}
    </div>
  </article>;
}
