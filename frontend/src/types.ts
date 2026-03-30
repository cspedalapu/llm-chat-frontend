export type ModelId = string;
export type ProjectTemplate = "investing" | "homework" | "writing" | "travel";

export interface ModelOption {
  id: ModelId;
  label: string;
}

export interface ResolutionSource {
  title: string;
  system: string;
  origin: string;
  summary: string;
  confidence: string;
}

export interface ResolutionSections {
  businessContext: string;
  rootCause: string;
  steps: string[];
  prevention: string[];
}

export interface AssistantResult {
  answer: string;
  diagnosticLabel: string;
  sections: ResolutionSections;
  sources: ResolutionSource[];
  latencyMs: number;
  mode: "mock" | "api";
  model: ModelId;
  requestedModel?: string;
  generationModel?: string;
  generationLabel?: string;
  generationNote?: string;
}

export interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
  timestamp: string;
  result?: AssistantResult;
  state?: "ready" | "error";
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  model: ModelId;
  projectId?: string | null;
  messages: Message[];
}

export interface ProjectSummary {
  id: string;
  title: string;
  kind: "new" | "folder" | "monitor" | "more";
  instructions?: string;
  template?: ProjectTemplate | null;
}
