import { buildMockResponse } from "@/data/mockData.ts";
import { defaultModelOptions, getModelLabel } from "@/lib/models.ts";
import { AssistantResult, Message, ModelId, ModelOption, ResolutionSource } from "@/types.ts";

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
export const hasApiBaseUrl = apiBaseUrl.length > 0;

interface RequestAssistantReplyArgs {
  query: string;
  model: ModelId;
  history: Message[];
}

function normalizeModelOptions(input: unknown): ModelOption[] {
  if (!Array.isArray(input)) {
    return defaultModelOptions;
  }

  const options = input.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const id = String(record.id ?? "").trim();
    const label = String(record.label ?? id).trim();

    return id ? [{ id, label }] : [];
  });

  return options.length > 0 ? options : defaultModelOptions;
}

function normalizeSources(input: unknown): ResolutionSource[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((source, index) => {
    const record = typeof source === "object" && source !== null ? source as Record<string, unknown> : {};
    return {
      title: String(record.title ?? record.error_message ?? `Retrieved source ${index + 1}`),
      system: String(record.system ?? "Backend retrieval"),
      origin: String(record.origin ?? "API response"),
      summary: String(record.summary ?? record.openai_resolution ?? record.gemini_resolution ?? "Retrieved from backend."),
      confidence: String(record.confidence ?? "Matched")
    };
  });
}

function normalizeApiResponse(payload: Record<string, unknown>, requestedModel: ModelId): AssistantResult {
  const sectionsRecord =
    typeof payload.sections === "object" && payload.sections !== null
      ? payload.sections as Record<string, unknown>
      : {};

  const steps = Array.isArray(sectionsRecord.steps)
    ? sectionsRecord.steps.map((step) => String(step))
    : Array.isArray(payload.steps)
      ? (payload.steps as unknown[]).map((step) => String(step))
      : [];

  const prevention = Array.isArray(sectionsRecord.prevention)
    ? sectionsRecord.prevention.map((item) => String(item))
    : Array.isArray(payload.prevention)
      ? (payload.prevention as unknown[]).map((item) => String(item))
      : [];

  const responseModel = String(payload.model ?? requestedModel) as ModelId;
  const generationLabel = String(
    payload.generation_label ??
    payload.generationLabel ??
    getModelLabel(responseModel) ??
    getModelLabel(requestedModel)
  );

  return {
    answer: String(payload.answer ?? payload.response ?? "The backend responded without a final answer."),
    diagnosticLabel: String(payload.diagnostic_label ?? payload.label ?? "Knowledge base match"),
    sections: {
      businessContext: String(
        sectionsRecord.businessContext ??
        payload.business_context ??
        "Retrieved from the backend API."
      ),
      rootCause: String(
        sectionsRecord.rootCause ??
        payload.root_cause ??
        "Review the backend answer and retrieved sources for the exact cause."
      ),
      steps,
      prevention
    },
    sources: normalizeSources(payload.sources ?? payload.retrieved_results),
    latencyMs: Number(payload.latency_ms ?? payload.latencyMs ?? 0),
    mode: "api",
    model: responseModel,
    requestedModel: String(payload.requested_model ?? payload.requestedModel ?? requestedModel),
    generationModel: String(payload.generation_model ?? payload.generationModel ?? responseModel),
    generationLabel,
    generationNote: String(payload.generation_note ?? payload.generationNote ?? "")
  };
}

export async function fetchAvailableModels(): Promise<ModelOption[]> {
  if (!hasApiBaseUrl) {
    return defaultModelOptions;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/models`);

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status} from ${apiBaseUrl}/models`);
    }

    const payload = await response.json() as unknown;
    return normalizeModelOptions(payload);
  } catch {
    return defaultModelOptions;
  }
}

export async function requestAssistantReply({
  query,
  model,
  history
}: RequestAssistantReplyArgs): Promise<AssistantResult> {
  if (hasApiBaseUrl) {
    const response = await fetch(`${apiBaseUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        model,
        top_k: 3,
        history: history.map((message) => ({
          role: message.role,
          text: message.text
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status} from ${apiBaseUrl}/chat`);
    }

    const payload = await response.json() as Record<string, unknown>;
    return normalizeApiResponse(payload, model);
  }

  await new Promise((resolve) => window.setTimeout(resolve, 700));
  return buildMockResponse(query, model);
}
