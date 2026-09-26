import { Connector, ConnectorDirectory } from "@/lib/research";

export const STATUS_TEXT: Record<string, string> = {
  ready: "Ready", needs_setup: "Set up", needs_auth: "Sign in", error: "Error", unavailable: "Not available",
};

export function connectorState(c: Connector): string {
  if (!c.enabled && c.status === "ready") return "off";
  return c.status;
}

/** Right-hand column of the Research tab: what's connected, and how much it's used. */
export function ToolsPanel({ directory, onManage }: { directory: ConnectorDirectory | null; onManage: () => void }) {
  if (!directory) return <aside className="research-tools" aria-label="Tools"><h2>Tools</h2><p className="muted">Loading…</p></aside>;
  const usage = new Map(directory.usage.map(u => [u.connector, u]));
  const today = directory.usage.reduce((sum, u) => sum + (u.today || 0), 0);
  const cost = directory.usage.reduce((sum, u) => sum + (u.cost || 0), 0);
  return <aside className="research-tools" aria-label="Tools">
    <h2>Tools</h2>
    <ul className="tool-list">
      {directory.connectors.map(c => {
        const state = connectorState(c);
        const used = usage.get(c.id);
        return <li key={c.id} className={"tool-item " + state}>
          <span className="tool-dot" aria-hidden="true" />
          <div className="tool-copy">
            <span className="tool-name">{c.name}</span>
            <span className="tool-meta">{state === "off" ? "Off" : STATUS_TEXT[state] || state}{used ? ` · ${used.today} today` : ""}</span>
          </div>
          {state !== "ready" && state !== "off" && state !== "unavailable" && <button type="button" className="link-button" onClick={onManage}>
            {state === "needs_auth" ? "Connect" : state === "error" ? "Fix" : "Set up"}</button>}
        </li>;
      })}
    </ul>
    <p className="muted tool-totals">{today} tool call{today === 1 ? "" : "s"} today{cost ? ` · $${cost.toFixed(3)} search cost` : ""}</p>
    <button type="button" className="ghost-pill full" onClick={onManage}>Manage tools</button>
  </aside>;
}
