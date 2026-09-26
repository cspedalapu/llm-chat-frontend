import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIVE, followRun, research, Run, RunEvent, RunSummary } from "@/lib/research";

/** The run list. Polls only while something is running. */
export function useResearchRuns() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { setRuns(await research.runs()); setError(""); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const anyActive = runs.some(r => ACTIVE.includes(r.status));
  useEffect(() => {
    if (!anyActive) return;
    const timer = window.setInterval(() => { void refresh(); }, 4000);
    return () => window.clearInterval(timer);
  }, [anyActive, refresh]);
  return { runs, error, refresh };
}

/**
 * One run, kept live: loads it, replays its event log, then follows new events.
 * Reconnects from the last sequence number if the stream drops while the run is active.
 */
export function useRun(runId: string | null) {
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0); // bump to resume following (e.g. after approval)
  const lastSeq = useRef(0);
  const refetchTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!runId) return;
    try { setRun(await research.run(runId)); setError(""); } catch (e) { setError((e as Error).message); }
  }, [runId]);

  // Most events change counts or state held on the run; refetch at most every ~0.7s.
  const scheduleRefresh = useCallback(() => {
    if (refetchTimer.current !== undefined) return;
    refetchTimer.current = window.setTimeout(() => { refetchTimer.current = undefined; void refresh(); }, 700);
  }, [refresh]);

  useEffect(() => {
    setRun(null); setEvents([]); lastSeq.current = 0; setError("");
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    let stopped = false;
    (async () => {
      await refresh();
      while (!stopped) {
        try {
          const end = await followRun(runId, lastSeq.current, controller.signal, event => {
            lastSeq.current = event.seq;
            setEvents(current => [...current, event]);
            if (event.type === "report_delta") {
              setRun(current => current && ({ ...current, report: event.data.replace ? event.data.text : current.report + event.data.text }));
            } else {
              scheduleRefresh();
            }
          });
          lastSeq.current = Math.max(lastSeq.current, end.seq);
          await refresh();
          return; // run finished or is waiting for approval; `resume()` starts following again
        } catch (e) {
          if (controller.signal.aborted) return;
          setError((e as Error).message);
          await new Promise(resolve => setTimeout(resolve, 1500));
          const latest = await research.run(runId).catch(() => null);
          if (latest) setRun(latest);
          if (!latest || !ACTIVE.includes(latest.status)) return;
          setError("");
        }
      }
    })();
    return () => { stopped = true; controller.abort(); window.clearTimeout(refetchTimer.current); refetchTimer.current = undefined; };
  }, [runId, generation, refresh, scheduleRefresh]);

  const resume = useCallback(() => setGeneration(n => n + 1), []);
  return { run, events, error, setError, refresh, resume };
}
