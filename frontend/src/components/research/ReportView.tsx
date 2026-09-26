import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Citation, Run } from "@/lib/research";

const RANK: Record<Citation["status"], number> = { missing: 0, weak: 1, snippet_only: 2, supported: 3 };
const LABEL: Record<Citation["status"], string> = {
  supported: "Matches the source text", weak: "Weak match: check the source",
  snippet_only: "Only a search snippet was read", missing: "No such source",
};

/** Report with clickable [n] citations, coloured by the automated check, plus the sources list. */
export function ReportView({ run }: { run: Run }) {
  const [focused, setFocused] = useState<number | null>(null);
  const worst = useMemo(() => {
    const map = new Map<number, Citation["status"]>();
    for (const c of run.citation_check?.citations || []) {
      const prev = map.get(c.n);
      if (!prev || RANK[c.status] < RANK[prev]) map.set(c.n, c.status);
    }
    return map;
  }, [run.citation_check]);
  // [n] -> a link the renderer turns into a citation chip.
  const text = useMemo(() => (run.report || "").replace(/\[(\d{1,3})\](?!\()/g, "[$1](#src-$1)"), [run.report]);
  const totals = run.citation_check?.totals;

  function jump(n: number) {
    setFocused(n);
    document.getElementById(`src-${run.id}-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return <div className="report-layout">
    <article className="research-report markdown">
      {run.warning && <p className="research-hint warn">{run.warning}</p>}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        a: ({ children, href }) => {
          if (href?.startsWith("#src-")) {
            const n = Number(href.slice(5));
            const status = worst.get(n);
            return <button type="button" className={"cite " + (status || "unchecked")} onClick={() => jump(n)}
              title={status ? LABEL[status] : "Source " + n} aria-label={`Source ${n}${status ? ": " + LABEL[status] : ""}`}>{n}</button>;
          }
          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
        },
        img: ({ alt }) => <span>[Image: {alt || "external image"}]</span>,
      }}>{text}</ReactMarkdown>
    </article>
    <aside className="report-sources" aria-label="Sources">
      <h3>Sources <span className="muted">({run.sources_list.length})</span></h3>
      {totals && <p className="muted report-check">Automated check: {totals.supported} matched, {totals.weak} weak,
        {" "}{totals.snippet_only} snippet only, {totals.missing} missing. It compares wording, so still read the sources for anything important.</p>}
      <ol>{run.sources_list.map(s => {
        const status = worst.get(s.n);
        return <li key={s.n} id={`src-${run.id}-${s.n}`} className={focused === s.n ? "focused" : ""}>
          <span className={"cite-num " + (status || "")}>{s.n}</span>
          <div>
            {s.url.startsWith("http") ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : <span>{s.title}</span>}
            <p className="muted">{s.kind}{s.read ? " · read in full" : " · snippet only"}{status ? " · " + LABEL[status] : ""}</p>
          </div>
        </li>;
      })}</ol>
    </aside>
  </div>;
}
