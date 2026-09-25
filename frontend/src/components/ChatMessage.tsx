import { Fragment, ReactNode, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { messageAddons } from "@/extensions";
import { Message } from "@/types";
import { BookmarkIcon, BranchIcon, CheckIcon, CopyIcon, DotsIcon, EditIcon, InfoIcon, MemoryIcon, RefreshIcon } from "./icons";
import { Menu, MenuItem, MenuNote } from "./Menu";

function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return <div className="code-block"><button onClick={async e => {
    try { await navigator.clipboard.writeText(e.currentTarget.parentElement?.querySelector("pre")?.textContent || ""); setCopied(true); }
    catch { setCopied(false); }
  }}>{copied ? "Copied" : "Copy code"}</button><pre>{children}</pre></div>;
}

function CopyAction({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const label = state === "done" ? "Copied" : state === "failed" ? "Copy unavailable" : "Copy";
  return <button type="button" className="icon-action" aria-label={label} title={label} onClick={async () => {
    try { await navigator.clipboard.writeText(text); setState("done"); setTimeout(() => setState("idle"), 1500); } catch { setState("failed"); }
  }}>{state === "done" ? <CheckIcon /> : <CopyIcon />}</button>;
}

export function ChatMessage({ message, busy, onBranch, onRetry, onSave, onMemory }: {
  message: Message; busy?: boolean; onBranch?: () => void; onRetry?: () => void; onSave?: () => void; onMemory?: () => void;
}) {
  const [details, setDetails] = useState(false);
  const result = message.result;

  if (message.role === "user") {
    return <article className="msg msg-user">
      <div className="msg-user-bubble">{message.text}</div>
      <div className="msg-actions msg-actions-user">
        <CopyAction text={message.text} />
        {onBranch && <button type="button" className="icon-action" aria-label="Edit in new branch" title="Edit in new branch" disabled={busy} onClick={onBranch}><EditIcon /></button>}
      </div>
    </article>;
  }

  const finished = message.state !== "streaming";
  const hasMore = Boolean(onBranch || onMemory || result);
  return <article className="msg msg-assistant">
    <div className={"msg-assistant-body" + (message.state === "error" ? " error" : "")}>
      <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
        img: ({ alt }) => <span>[Image: {alt || "external image"}]</span>,
      }}>{message.text}</ReactMarkdown></div>
      {message.state === "streaming" && (message.text
        ? <span role="status" className="stream-status">Generating…</span>
        : <span role="status" aria-label="Generating response" className="loading"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></span>)}
      {result?.error && <p role="alert" className="msg-error">{result.error}</p>}
      {(message.state === "cancelled" || message.state === "interrupted") && <p className="muted">{message.state === "cancelled" ? "Stopped. Partial response saved." : "Interrupted by a server restart. Partial response saved."}</p>}
      {result?.context_note && <p className="muted">{result.context_note}</p>}
      {result?.source_note && <p className="muted">{result.source_note}</p>}
      {result?.sources?.length ? <details className="source-list"><summary>Reference passages ({result.sources.length})</summary>
        <p className="muted">Passages supplied to the model. Check that each cited passage supports its claim.</p>
        {result.sources.map(source => <details key={source.id}><summary>[{source.number}] {source.title} · page {source.page}</summary><blockquote>{source.excerpt}</blockquote></details>)}
      </details> : null}
      {messageAddons.map(addon => <Fragment key={addon.id}>{addon.render(message)}</Fragment>)}
      {details && result && <div className="generation-details" role="region" aria-label="Response details">
        <p>Answered by {result.generationLabel || "Assistant"} · {result.generationModel}</p>
        <p>Input: {result.usage?.input ?? "unreported"} tokens · Output: {result.usage?.output ?? "unreported"} tokens</p>
        <p>{((result.latencyMs || 0) / 1000).toFixed(1)}s total{result.first_token_ms !== undefined ? " · " + (result.first_token_ms / 1000).toFixed(1) + "s to first text" : ""}</p>
        <p>Estimated cost: {result.estimated_cost !== undefined ? "$" + result.estimated_cost.toFixed(6) : "not configured or usage unavailable"}</p>
        {result.finish_reason && <p>Finish: {result.finish_reason}</p>}
      </div>}
    </div>
    {finished && <div className="msg-actions">
      <CopyAction text={message.text} />
      {onRetry && <button type="button" className="icon-action" disabled={busy} onClick={onRetry}
        aria-label={message.state === "error" ? "Retry in new branch" : "Regenerate in new branch"} title={message.state === "error" ? "Retry" : "Regenerate"}><RefreshIcon /></button>}
      {onSave && <button type="button" className={"icon-action" + (message.saved ? " active" : "")} disabled={busy} onClick={onSave}
        aria-pressed={Boolean(message.saved)} aria-label={message.saved ? "Unsave" : "Save answer"} title={message.saved ? "Remove from saved answers" : "Save answer"}><BookmarkIcon /></button>}
      {hasMore && <Menu label="More actions" trigger={<DotsIcon />} placement="top">{close => <>
        {result?.generationLabel && <MenuNote>Answered by {result.generationLabel}</MenuNote>}
        {onBranch && <MenuItem icon={BranchIcon} disabled={busy} onSelect={() => { close(); onBranch(); }}>Branch here</MenuItem>}
        {onMemory && <MenuItem icon={MemoryIcon} disabled={busy} onSelect={() => { close(); onMemory(); }}>Save to project memory</MenuItem>}
        {result && <MenuItem icon={InfoIcon} onSelect={() => { close(); setDetails(value => !value); }}>{details ? "Hide response details" : "Response details"}</MenuItem>}
      </>}</Menu>}
    </div>}
  </article>;
}
