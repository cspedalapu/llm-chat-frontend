import { useState } from "react";
import { research, Run, SubQuestion } from "@/lib/research";

/** Step 3 of a run: edit the sub-questions, answer clarifying questions, then start. */
export function PlanReview({ run, onChanged }: { run: Run; onChanged: () => void }) {
  const plan = run.plan!;
  const [subs, setSubs] = useState<SubQuestion[]>(plan.sub_questions.map(s => ({ question: s.question, approach: s.approach || "" })));
  const [answers, setAnswers] = useState(run.answers || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(action: "approve" | "replan") {
    setBusy(true); setError("");
    try {
      await research.plan(run.id, { action, answers, sub_questions: action === "approve" ? subs.filter(s => s.question.trim().length >= 3) : undefined });
      onChanged();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const update = (i: number, question: string) => setSubs(subs.map((s, j) => j === i ? { ...s, question } : s));
  return <section className="plan-review" aria-labelledby="plan-title">
    <h2 id="plan-title">Review the plan</h2>
    <p className="muted">Edit, remove or add parts. Nothing is searched until you start.</p>
    {plan.clarifying_questions.length > 0 && <div className="plan-clarify">
      <h3>A few questions first (optional)</h3>
      <ul>{plan.clarifying_questions.map(q => <li key={q}>{q}</li>)}</ul>
      <label className="visually-hidden" htmlFor="plan-answers">Your answers</label>
      <textarea id="plan-answers" rows={2} maxLength={4000} value={answers} onChange={e => setAnswers(e.target.value)}
        placeholder="Answer here; the researchers will take it into account." />
    </div>}
    <ol className="plan-steps">
      {subs.map((s, i) => <li key={i}>
        <label className="visually-hidden" htmlFor={`plan-step-${i}`}>Part {i + 1}</label>
        <input id={`plan-step-${i}`} value={s.question} maxLength={400} onChange={e => update(i, e.target.value)} />
        <button type="button" className="icon-text" aria-label={`Remove part ${i + 1}`} disabled={subs.length === 1}
          onClick={() => setSubs(subs.filter((_, j) => j !== i))}>Remove</button>
      </li>)}
    </ol>
    {subs.length < 8 && <button type="button" className="link-button" onClick={() => setSubs([...subs, { question: "", approach: "" }])}>+ Add a part</button>}
    <p className="muted plan-estimate">Budget: up to {run.budget.max_calls} tool calls and about {run.budget.minutes} minutes
      {run.budget.max_cost ? `, stopping at $${run.budget.max_cost.toFixed(2)} of model cost` : ""}.</p>
    {error && <p role="alert" className="error-notice">{error}</p>}
    <div className="research-actions">
      <button type="button" className="ghost-pill" disabled={busy} onClick={() => void send("replan")}>Regenerate plan</button>
      <button type="button" className="primary-pill" disabled={busy || !subs.some(s => s.question.trim().length >= 3)}
        onClick={() => void send("approve")}>{busy ? "Starting…" : "Start research"}</button>
    </div>
  </section>;
}
