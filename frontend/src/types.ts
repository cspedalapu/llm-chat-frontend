export type ModelId = string;
export type ProjectTemplate = "investing" | "homework" | "writing" | "travel";
export interface Provider {
  id: string; label: string; kind: "openai" | "anthropic" | "gemini" | "ollama";
  base_url: string; model: string; has_key: boolean; context_tokens: number;
  max_output_tokens: number; input_price: number | null; output_price: number | null;
  system_role: "system" | "developer"; token_parameter: "max_tokens" | "max_completion_tokens";
  include_usage: boolean; reasoning: "" | "low" | "medium" | "high";
  /** Result of the tool-use check in Test connection; undefined until tested. */
  supports_tools?: boolean;
}
export interface Source { id: string; documentId: string; title: string; page: number; excerpt: string; number: number }
export interface AssistantResult {
  model: string; generationModel: string; generationLabel: string; sources?: Source[];
  latencyMs?: number; first_token_ms?: number; usage: { input?: number; output?: number };
  estimated_cost?: number; context_trimmed?: boolean; context_note?: string;
  source_note?: string; error?: string; request_id: string; finish_reason?: string;
  /** Fork-specific data, keyed by add-on name. Rendered by extensions.messageAddons. */
  extensions?: Record<string, unknown>;
}
export interface Message {
  id: string; role: "assistant" | "user"; text: string; timestamp: string;
  result?: AssistantResult; state?: "ready" | "error" | "streaming" | "cancelled" | "interrupted";
  saved?: boolean; documentIds?: string[]; presetId?: string | null;
}
export interface Conversation {
  id: string; title: string; preview: string; updatedAt: string; model: string;
  projectId?: string | null; messages: Message[]; archived?: boolean; pinned?: boolean;
  summary?: string; parentId?: string;
}
export interface ProjectSummary {
  id: string; title: string; kind: "new" | "folder" | "monitor" | "more";
  instructions?: string; memory?: string; template?: ProjectTemplate | null;
}
export interface DocumentRecord { id: string; name: string; projectId: string | null; pages: number; createdAt: string }
export interface Preset { id: string; title: string; instructions: string; model: string; output_format: string }
export interface WorkspaceData {
  /** Optional contract features the backend implements; see lib/capabilities.ts. */
  capabilities: string[];
  conversations: Conversation[]; projects: ProjectSummary[]; models: Provider[];
  documents: DocumentRecord[]; presets: Preset[]; settings: { daily_request_limit: number };
}
export interface Usage {
  requests: number; today: number; input_tokens: number; output_tokens: number;
  estimated_cost: number; unpriced_requests: number;
  recent: (AssistantResult & { id: string; status: string; createdAt: string })[];
}
