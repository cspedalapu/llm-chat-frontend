// Research runs and tool connections (capabilities `research`, `research.connectors`).
// Shapes mirror backend/app/research/routes.py; see docs/API-CONTRACT.md.
import { apiBaseUrl, api, checkResponse, requestHeaders } from "@/lib/chatClient";

export type RunStatus = "planning" | "awaiting_approval" | "researching" | "writing"
  | "completed" | "failed" | "cancelled" | "interrupted";
export const ACTIVE: RunStatus[] = ["planning", "researching", "writing"];
export type Depth = "quick" | "standard" | "deep";
export type Permission = "allow" | "ask" | "block";

export interface SubQuestion { id?: string; question: string; approach?: string }
export interface Plan { title: string; clarifying_questions: string[]; sub_questions: SubQuestion[] }
export interface Counts { tool_calls: number; sources_found: number; sources_read: number }
export interface RunSummary {
  id: string; title: string; question: string; status: RunStatus; depth: Depth;
  createdAt: string; updatedAt: string; counts: Counts; error?: string;
}
export interface RunSource { n: number; url: string; title: string; snippet: string; kind: string; tool: string; read: boolean }
export interface Citation { n: number; status: "supported" | "weak" | "snippet_only" | "missing"; score: number; claim: string }
export interface Approval { call_id: string; tool: string; summary: string }
export interface Run extends RunSummary {
  model_id: string; writer_model_id?: string | null; sources: string[]; plan_first: boolean;
  answers: string; plan: Plan | null; report: string; warning?: string;
  budget: { max_calls: number; minutes: number; max_cost: number | null };
  usage: { input: number; output: number; cost: number; unpriced: boolean };
  steer: { id: string; text: string; at: string; applied: boolean }[];
  pending_approvals: Approval[];
  citation_check: { citations: Citation[]; totals: Record<Citation["status"], number>; checked: number } | null;
  sources_list: RunSource[]; last_seq: number; startedAt?: string; finishedAt?: string;
}
export interface RunEvent { seq: number; type: string; at: string; data: Record<string, any> }
export interface DepthPreset { label: string; sub_questions: number; max_calls: number; minutes: number; turns: number }
export interface SourceOption { id: string; connector_id: string; name: string; type: string; status: string; enabled: boolean; ready: boolean }
export interface ResearchOptions {
  depths: Record<Depth, DepthPreset>; sources: SourceOption[];
  models: { id: string; label: string; supports_tools?: boolean | null }[];
}
export interface ConnectorTool { name: string; access: "read" | "write"; description: string; permission: Permission }
export interface Connector {
  id: string; key: string; type: "builtin" | "oauth" | "mcp"; name: string; description: string;
  enabled: boolean; status: string; status_detail: string; has_secret: boolean; configured?: boolean;
  config: Record<string, any>; tools: ConnectorTool[]; updatedAt: string;
}
export interface ToolUsage { connector: string; calls: number; errors: number; today: number; cost: number; last_used: string; avg_latency_ms: number }
export interface ConnectorDirectory {
  connectors: Connector[]; usage: ToolUsage[]; search_providers: Record<string, string>;
  academic_databases: Record<string, string>; redirect_uri: string;
}

export const research = {
  options: () => api<ResearchOptions>("/research/options"),
  runs: () => api<RunSummary[]>("/research/runs"),
  run: (id: string) => api<Run>(`/research/runs/${id}`),
  start: (body: { question: string; depth: Depth; model_id: string; writer_model_id?: string | null; sources: string[]; plan_first: boolean; max_cost?: number | null }) =>
    api<Run>("/research/runs", "POST", body),
  plan: (id: string, body: { action: "approve" | "replan"; sub_questions?: SubQuestion[]; answers?: string }) =>
    api<Run>(`/research/runs/${id}/plan`, "POST", body),
  steer: (id: string, text: string) => api(`/research/runs/${id}/steer`, "POST", { text }),
  cancel: (id: string) => api(`/research/runs/${id}/cancel`, "POST"),
  remove: (id: string) => api(`/research/runs/${id}`, "DELETE"),
  rerun: (id: string) => api<Run>(`/research/runs/${id}/rerun`, "POST"),
  decide: (id: string, callId: string, decision: "allow" | "deny" | "always") =>
    api(`/research/runs/${id}/approvals/${callId}`, "POST", { decision }),
  toChat: (id: string) => api<{ id: string }>(`/research/runs/${id}/chat`, "POST"),
  exportUrl: (id: string, format: "md" | "docx") => `${apiBaseUrl}/research/runs/${id}/export?format=${format}`,
};

export const tools = {
  directory: () => api<ConnectorDirectory>("/connectors"),
  update: (id: string, body: Record<string, unknown>) => api<Connector>(`/connectors/${id}`, "PATCH", body),
  addMcp: (body: { name: string; url: string; auth: string; token?: string; client_id?: string; client_secret?: string }) =>
    api<Connector>("/connectors", "POST", body),
  remove: (id: string) => api(`/connectors/${id}`, "DELETE"),
  test: (id: string) => api<{ ok: boolean; detail: string; connector: Connector }>(`/connectors/${id}/test`, "POST"),
  signIn: (id: string) => api<{ url: string }>(`/connectors/${id}/auth/start`, "POST"),
};

/** Download an export with the same auth headers as other requests. */
export async function downloadExport(id: string, format: "md" | "docx", name: string) {
  const response = await fetch(research.exportUrl(id, format), { headers: requestHeaders(false) });
  await checkResponse(response);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = `${name}.${format}`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Follow a run's server-sent events from `after`. Resolves when the server ends the
 * stream (run finished or waiting for plan approval); rejects on network errors so the
 * caller can reconnect from the last seen sequence number.
 */
export async function followRun(id: string, after: number, signal: AbortSignal, onEvent: (event: RunEvent) => void) {
  const response = await fetch(`${apiBaseUrl}/research/runs/${id}/events?after=${after}`, { signal, headers: requestHeaders(false) });
  await checkResponse(response);
  if (!response.body) throw new Error("Live updates are unavailable in this browser.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const lines = frame.split("\n");
        const type = lines.find(line => line.startsWith("event:"))?.slice(6).trim();
        const data = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
        if (!type || !data) continue;
        const payload = JSON.parse(data);
        if (type === "end") return payload as { seq: number; status: RunStatus };
        onEvent({ seq: payload.seq, type, at: payload.at, data: payload.data });
      }
      if (done) throw new Error("Live updates were interrupted.");
    }
  } finally { reader.releaseLock(); }
}
