import { getModelLabel } from "@/lib/models.ts";
import { AssistantResult, Conversation, ModelId, ProjectSummary, ResolutionSections, ResolutionSource } from "@/types.ts";

export const suggestedPrompts = [
  "Why is my API returning 401 unauthorized?",
  "Help me debug a request timeout to an external service",
  "Why is my CSV upload failing validation?",
  "How should I handle rate limits from a model provider?"
];

interface MockResolutionTemplate {
  keywords: string[];
  diagnosticLabel: string;
  answerLead: string;
  sections: ResolutionSections;
  sources: ResolutionSource[];
  latencyMs: number;
}

const fallbackTemplate: MockResolutionTemplate = {
  keywords: [],
  diagnosticLabel: "General troubleshooting guidance",
  answerLead:
    "I could not map this message to one of the seeded starter scenarios, so the safest next step is to capture more context and route the request through a real provider-backed workflow.",
  sections: {
    businessContext:
      "The request looks like a normal application or integration issue, but the exact subsystem and failure boundary are not clear yet.",
    rootCause:
      "The starter UI only has a small set of seeded fallback cases. A real provider adapter or retrieval layer should supply more precise diagnostics once connected.",
    steps: [
      "Capture the complete error text, status code, and the operation that triggered it.",
      "Record the affected environment, endpoint, payload shape, and any recent changes.",
      "Route the enriched request through the backend so a real provider adapter can classify and answer it."
    ],
    prevention: [
      "Use a standard troubleshooting template for incidents and regressions.",
      "Store verified fixes with tags for service, environment, and failure type."
    ]
  },
  sources: [
    {
      title: "Starter troubleshooting fallback",
      system: "Frontend fallback",
      origin: "Mock response",
      summary: "The UI is ready for backend-backed answers once a provider adapter is connected.",
      confidence: "Starter"
    }
  ],
  latencyMs: 620
};

const templates: MockResolutionTemplate[] = [
  {
    keywords: ["401", "403", "unauthorized", "forbidden", "token", "credential", "auth"],
    diagnosticLabel: "Authentication or credential issue",
    answerLead:
      "This looks like an authentication boundary problem. Start by checking whether the failing request is using the right token, scope, and environment-specific credentials.",
    sections: {
      businessContext:
        "This kind of issue usually appears when a frontend, backend, or automation worker talks to an API that expects a valid token or signed request.",
      rootCause:
        "The most common causes are expired tokens, wrong environment secrets, missing scopes, or credentials being sent to the wrong base URL.",
      steps: [
        "Confirm the request is targeting the intended environment and base URL.",
        "Inspect the token or API key source and verify it is current and correctly injected.",
        "Check whether the target service expects additional scopes, headers, or signed fields.",
        "Retry with a freshly issued credential after correcting the configuration."
      ],
      prevention: [
        "Separate local, staging, and production credentials clearly.",
        "Add credential rotation and expiry monitoring."
      ]
    },
    sources: [
      {
        title: "Credential and token checks",
        system: "API gateway",
        origin: "Starter guidance",
        summary: "Validate token freshness, scope, and environment alignment first.",
        confidence: "High match"
      },
      {
        title: "Secret configuration review",
        system: "Backend configuration",
        origin: "Starter guidance",
        summary: "Confirm the backend is loading the correct secret and forwarding it in the expected format.",
        confidence: "Medium match"
      }
    ],
    latencyMs: 860
  },
  {
    keywords: ["timeout", "timed out", "latency", "504", "gateway timeout", "slow"],
    diagnosticLabel: "Timeout or upstream latency issue",
    answerLead:
      "This points to a slow dependency or missing timeout strategy. Check where the request is spending time and whether retry behavior is making the issue worse.",
    sections: {
      businessContext:
        "These issues usually appear when the app depends on an external model, database, search service, or third-party API with unpredictable response times.",
      rootCause:
        "Common causes include long upstream processing, serial retries, missing caching, oversized payloads, or timeouts that are too aggressive for the workload.",
      steps: [
        "Measure the time spent in each dependency call and identify the slowest segment.",
        "Check client and server timeout values to make sure they are aligned.",
        "Reduce payload size or parallelize slow downstream calls if possible.",
        "Add bounded retries with backoff only if the failing dependency is safely retryable."
      ],
      prevention: [
        "Track p95 and p99 latency for critical dependencies.",
        "Introduce caching or queue-based workflows for expensive operations."
      ]
    },
    sources: [
      {
        title: "Timeout budget review",
        system: "Application observability",
        origin: "Starter guidance",
        summary: "Compare client, proxy, and upstream timeout values before tuning retries.",
        confidence: "High match"
      },
      {
        title: "Dependency latency inspection",
        system: "Service diagnostics",
        origin: "Starter guidance",
        summary: "Trace the slowest dependency and remove unnecessary serial work.",
        confidence: "Medium match"
      }
    ],
    latencyMs: 910
  },
  {
    keywords: ["csv", "upload", "file", "schema", "column", "parse", "validation"],
    diagnosticLabel: "File schema or validation mismatch",
    answerLead:
      "This looks like a file-shape mismatch. Review the incoming file format, required columns, and the validation rules applied during parsing.",
    sections: {
      businessContext:
        "These problems usually appear when users upload CSV, JSON, or spreadsheet data that the app expects in a strict format.",
      rootCause:
        "Typical causes are missing columns, renamed headers, wrong encodings, invalid delimiters, or field-level validation that does not match the uploaded data.",
      steps: [
        "Inspect the uploaded file and compare it with the documented expected schema.",
        "Validate required columns, delimiters, encoding, and data types before parsing.",
        "Return field-level validation errors instead of one generic failure message.",
        "Retry the import after normalizing the input file."
      ],
      prevention: [
        "Publish a template file or schema example for users.",
        "Add preflight validation before expensive import or processing steps."
      ]
    },
    sources: [
      {
        title: "Input schema validation",
        system: "File ingestion pipeline",
        origin: "Starter guidance",
        summary: "Check headers, encoding, and type expectations before processing the upload.",
        confidence: "Likely match"
      }
    ],
    latencyMs: 770
  },
  {
    keywords: ["429", "rate limit", "quota", "throttle", "throttled", "capacity"],
    diagnosticLabel: "Rate limit or quota pressure",
    answerLead:
      "This looks like a throughput limit rather than a functional bug. Check whether burst traffic, retries, or multiple parallel jobs are exhausting provider or service quotas.",
    sections: {
      businessContext:
        "These issues often appear in chat apps, data pipelines, or automation workflows that call the same API repeatedly in short bursts.",
      rootCause:
        "The most common causes are unbounded concurrency, lack of backoff, or daily or per-minute quotas being reached sooner than expected.",
      steps: [
        "Inspect request volume, concurrency, and retry behavior around the failure window.",
        "Honor provider retry-after guidance and add exponential backoff with jitter.",
        "Queue or batch non-interactive work so user-facing traffic gets priority.",
        "Review whether a higher-capacity plan or caching strategy is needed."
      ],
      prevention: [
        "Set concurrency guards at the worker and API layers.",
        "Track quota usage before user-facing requests begin to fail."
      ]
    },
    sources: [
      {
        title: "Rate-limit handling strategy",
        system: "Provider integration",
        origin: "Starter guidance",
        summary: "Use backoff, concurrency limits, and work queues to smooth spikes.",
        confidence: "Likely match"
      }
    ],
    latencyMs: 830
  }
];

function pickTemplate(query: string): MockResolutionTemplate {
  const normalized = query.toLowerCase();
  return (
    templates.find((template) =>
      template.keywords.some((keyword) => normalized.includes(keyword))
    ) ?? fallbackTemplate
  );
}

export function buildMockResponse(query: string, model: ModelId): AssistantResult {
  const template = pickTemplate(query);
  const modeSpecificTail =
    model === "gpt-4o-mini"
      ? " Once a provider adapter is connected, the backend can swap this seeded answer for a real model response."
      : " Once a local model adapter is connected, the backend can replace this seeded answer without changing the UI flow.";

  return {
    answer: `${template.answerLead}${modeSpecificTail}`,
    diagnosticLabel: template.diagnosticLabel,
    sections: template.sections,
    sources: template.sources,
    latencyMs: template.latencyMs,
    mode: "mock",
    model,
    requestedModel: model,
    generationModel: model,
    generationLabel: getModelLabel(model)
  };
}

export const seededProjects: ProjectSummary[] = [];

export const seededConversations: Conversation[] = [];
