# Reusable AI Chat Frontend Research Report

Research date: 2026-03-28

## 1. Goal

Build this project into a reusable, production-ready AI chat frontend that can serve as the base for future products instead of rebuilding the same chat UI repeatedly.

This report covers:

- what is publicly confirmed about ChatGPT, Gemini, Claude, Kimi, and DeepSeek
- which frontend patterns are worth copying
- which backend connection technologies are used or officially supported
- the recommended architecture for this repo
- a phased implementation plan

## 2. Name corrections

Use these names consistently:

- OpenAI / ChatGPT
- Google Gemini
- Anthropic Claude
- Moonshot AI / Kimi
- DeepSeek

## 3. Important research caveat

The exact consumer web-app framework for most of these products is not publicly documented by the companies. For that reason, this report separates:

- `Confirmed`: directly stated in official docs/help centers
- `Inferred`: architecture conclusion based on official product behavior or official API docs

Where the exact frontend stack is not public, do not base your architecture on guesses like "they probably use X framework". Base it on the capabilities they clearly expose.

## 4. Executive summary

The strongest shared pattern across the leading AI chat products is not a specific CSS library or React framework. It is this architecture:

1. A persistent workspace shell with sidebar history and project-level context.
2. A streaming chat surface with support for files, tools, long-running jobs, and generated artifacts.
3. A server-side backend-for-frontend layer that hides provider keys and normalizes different model vendors.
4. SSE as the default text streaming transport.
5. WebSockets only where true real-time sessions are needed, especially voice/video.
6. A provider adapter layer so the UI is not tied to one model company.
7. Artifact-style side panels for code, documents, apps, and structured outputs.

For this repo, the best long-term move is:

- keep the current React + TypeScript direction
- stop treating it as a single hard-coded chat page
- turn it into a reusable AI workspace platform with provider adapters, projects, files, streaming, and artifact panels

## 5. What each product publicly confirms

### 5.1 ChatGPT / OpenAI

#### Confirmed frontend/product patterns

- ChatGPT Projects group chats, files, instructions, and reusable context into one workspace.
- Canvas is a dedicated editing interface for writing and coding work.
- Canvas can render `React/HTML` in a sandbox environment.
- Canvas supports rendered web previews, code execution controls, version history, and sharing.
- ChatGPT supports file uploads, app links, and project-scoped sources.

#### Confirmed background connection technologies

- OpenAI recommends the `Responses API` for new work.
- OpenAI supports streaming responses using `server-sent events (SSE)`.
- OpenAI explicitly says API keys must not be exposed in client-side code.
- The Responses API supports built-in tools like web search, file search, computer use, and remote MCP.

#### What this means architecturally

- `Confirmed`: OpenAI is optimized for workspace-style chat plus artifacts/canvas.
- `Confirmed`: streaming text should be treated as a first-class transport.
- `Confirmed`: the secure pattern is browser -> your backend -> OpenAI, not browser -> OpenAI with a long-lived API key.
- `Inferred`: if you want a ChatGPT-style frontend base, you need project context, files, artifacts, and streaming from day one.

#### Do not overclaim

- The exact ChatGPT consumer web framework is not publicly documented in the official sources used here.

### 5.2 Google Gemini

#### Confirmed frontend/product patterns

- Gemini Apps has Gems for reusable customized assistants.
- Gemini Canvas lets users create and edit docs, apps, slides, and code.
- Gemini Canvas supports direct code editing, preview, console/log viewing, auto-save, share/export, and file input.
- When a Gemini Canvas app needs persistent storage, Gemini can create a `Firestore` database instance automatically.

#### Confirmed background connection technologies

- Gemini has a standard REST content generation endpoint and a streaming endpoint using `SSE`.
- Gemini Live API uses a stateful `WebSocket (WSS)` connection for low-latency real-time voice and vision interactions.
- Google recommends `ephemeral tokens` for secure client-to-server Live API access from web or mobile clients.
- Gemini supports implicit and explicit context caching.
- Gemini SDKs are officially available for JavaScript/TypeScript and other languages.

#### What this means architecturally

- `Confirmed`: Gemini separates standard chat from real-time multimodal sessions.
- `Confirmed`: WebSockets are justified for live voice/video, not for normal text chat.
- `Confirmed`: ephemeral credentials are the right pattern if the browser must connect directly to a realtime model session.
- `Inferred`: your base frontend should support two transports:
  - default `HTTP + SSE` for normal chat
  - optional `WebSocket/WebRTC-adjacent real-time channel` for voice/live modes

#### Do not overclaim

- The exact Gemini consumer web-app frontend framework is not publicly documented in the official sources used here.

### 5.3 Anthropic Claude

#### Confirmed frontend/product patterns

- Claude Projects are self-contained workspaces with chat history and knowledge bases.
- Claude Artifacts can be documents, code snippets, single-page HTML sites, SVGs, diagrams, and interactive `React` components.
- AI-powered artifacts run on Anthropic infrastructure.
- Artifacts support persistent storage and MCP integration.
- Claude exposes artifact sharing, versioning, and a side-by-side artifact workspace model.

#### Confirmed background connection technologies

- Claude's Messages API is stateless, so full conversation history is typically sent with each request.
- Claude supports streaming with `server-sent events (SSE)`.
- Anthropic supports prompt caching.
- Anthropic has a Files API.
- Claude tooling and external service connectivity are increasingly organized around tool use and `MCP`.

#### What this means architecturally

- `Confirmed`: Claude strongly validates the artifact panel pattern.
- `Confirmed`: a chat app should treat "generated deliverables" as first-class UI objects, not just plain assistant text.
- `Confirmed`: prompt caching matters when projects include large repeated context.
- `Inferred`: your base frontend should make artifacts, tools, and project knowledge visible in the UI instead of hiding them inside raw chat messages.

#### Do not overclaim

- The exact Claude consumer web-app frontend framework is not publicly documented in the official sources used here.

### 5.4 Moonshot AI / Kimi

#### Confirmed frontend/product patterns

- Kimi Web/App exposes multiple working modes: Instant, Thinking, Agent, and Agent Swarm.
- Kimi K2.5 is positioned around visual coding, live editing, website generation, docs, sheets, slides, and deep research.
- Kimi product pages emphasize preview and download workflows for generated outputs.
- Kimi supports file, image, and video input in product workflows.

#### Confirmed background connection technologies

- Kimi documents an OpenAI-compatible API surface.
- Kimi documents compatibility for `/v1/chat/completions` and `/v1/files` style endpoints.
- Kimi supports streaming output from the API.
- Kimi supports tool calls.
- Kimi supports file upload, extracted content retrieval, and file-based Q&A.
- Kimi recommends streaming especially for thinking models because of large outputs and longer reasoning traces.

#### What this means architecturally

- `Confirmed`: Kimi is optimized for output-centric workflows, not just plain Q&A.
- `Confirmed`: if you want Kimi-style experiences, your UI needs specialized surfaces for websites, docs, sheets, and research reports.
- `Confirmed`: provider compatibility with OpenAI-style APIs makes Kimi a strong candidate for an adapter-based backend.
- `Inferred`: your reusable frontend should support "mode switching" at the workspace level and "output type switching" at the result level.

#### Do not overclaim

- The exact Kimi consumer web-app frontend framework is not publicly documented in the official sources used here.

### 5.5 DeepSeek

#### Confirmed frontend/product patterns

- DeepSeek App publicly highlights cross-platform chat history sync.
- DeepSeek App highlights web search, Deep-Think mode, file upload, and text extraction.

#### Confirmed background connection technologies

- DeepSeek documents an OpenAI-compatible API format.
- DeepSeek supports `/chat/completions`.
- DeepSeek supports streaming via data-only `SSE`.
- DeepSeek supports function calling.
- DeepSeek supports JSON output.
- DeepSeek supports context caching and exposes cache hit/miss usage fields.

#### What this means architecturally

- `Confirmed`: DeepSeek fits very well into a provider abstraction built around OpenAI-style chat completion flows.
- `Confirmed`: streaming, structured output, and caching should be in your platform contract, not bolted on later.
- `Inferred`: DeepSeek is easiest to support if your backend normalizes providers behind a shared chat/tool/file interface.

#### Do not overclaim

- The exact DeepSeek consumer web-app frontend framework is not publicly documented in the official sources used here.

## 6. Cross-product pattern comparison

| Product | Publicly confirmed frontend/runtime clues | Publicly confirmed backend connection tech | What to copy |
|---|---|---|---|
| ChatGPT | Projects, Canvas, file uploads, app links, React/HTML sandbox, version history | Responses API, SSE streaming, server-side keys, built-in tools, MCP | project workspaces, artifact editing, tool-aware streaming |
| Gemini | Gems, Canvas, app/code preview, console, auto-save, Firestore-backed app storage | REST + SSE, Live API over WSS, ephemeral tokens, caching | separate normal chat from live sessions, secure short-lived realtime auth |
| Claude | Projects, Artifacts, React components, HTML apps, persistent storage, MCP | Messages API, SSE, files, prompt caching, tool use | artifact side panel, project knowledge, cached long context |
| Kimi | multi-mode UX, website/docs/sheets/slides outputs, visual coding, preview/download | OpenAI-compatible API, streaming, tool calls, files | mode-based UX, output-specific surfaces, provider abstraction |
| DeepSeek | sync, search, deep-think, file upload | OpenAI-compatible API, SSE, function calling, JSON output, caching | low-friction provider adapter support |

## 7. What to build as the reusable base

Do not build a "single provider chat page".

Build a reusable `AI workspace frontend`.

### Core product principles

- provider-agnostic
- streaming-first
- project-aware
- artifact-aware
- file-aware
- tool-aware
- mobile-safe
- ops-friendly

### Minimum reusable capabilities

1. Workspace shell

- left sidebar for chats, projects, pinned items
- top context bar for model, provider, workspace mode, environment
- main thread view
- right-side artifact/details panel

2. Chat thread system

- token streaming
- markdown rendering
- code blocks with copy and expand
- citations and sources
- tool execution states
- retry and partial failure handling

3. Project and memory layer

- projects/workspaces
- project instructions
- attached files and links
- conversation history persistence
- saved outputs

4. Artifact system

- documents
- code
- structured JSON output
- charts/tables
- HTML/React preview
- downloadable outputs

5. Provider abstraction

- OpenAI
- Gemini
- Anthropic
- Kimi
- DeepSeek

6. Ops and governance

- auth
- rate limiting
- observability
- audit trails
- model usage tracking
- safe secret handling

## 8. Recommended production architecture

### 8.1 Recommended stack

For a professional reusable base, I recommend:

- Frontend framework: `Next.js` with `React` and `TypeScript`
- Server-side orchestration/BFF: `Next.js route handlers` or a separate Node service
- Data fetching and client cache: `TanStack Query`
- Validation/contracts: `Zod`
- State for UI-only interactions: `Zustand` or scoped React state
- Styling system: `Tailwind CSS` plus a small internal design system
- Auth: `Auth.js`, `Clerk`, or `Supabase Auth`
- Database: `PostgreSQL`
- File/object storage: `S3-compatible storage`
- Background jobs: `BullMQ`, `Cloud Tasks`, or serverless queues
- Observability: `Sentry` + `OpenTelemetry`

### 8.2 Why `Next.js` is the better long-term base

Your current repo uses `Vite + React + TypeScript`, which is fine for a prototype. It is not yet the strongest reusable base for many future AI products.

`Next.js` is a better default base because it gives you:

- server routes for BFF patterns
- auth-friendly middleware
- easier session handling
- better deployment ergonomics
- simpler file upload flows
- one place for web app + backend-for-frontend concerns

If you want to keep this repo and avoid a rewrite immediately, keep the current Vite app for Phase 1, but plan a migration path to a framework-level app shell.

### 8.3 Transport recommendations

Use these rules:

- Normal text chat: `HTTP + SSE`
- Long-running generation jobs: `HTTP start + job polling or event stream`
- Realtime voice/video: `WebSocket`
- Large file upload: `direct-to-object-storage presigned upload`

Why:

- SSE is simpler, proxy-friendly, and ideal for token streaming
- WebSockets are best reserved for true bidirectional live sessions
- presigned upload keeps large files out of your app server hot path

### 8.4 Backend-for-frontend pattern

Never connect the browser directly to provider APIs with permanent keys.

Use:

`Browser -> Your BFF/API -> Provider adapter -> Model vendor`

Benefits:

- keys stay server-side
- providers can be swapped without changing the frontend contract
- usage limits and audit logging are centralized
- retries and fallbacks can happen server-side
- caching and normalization happen once

### 8.5 Provider adapter contract

Design one normalized internal contract like this:

```ts
export interface ChatProvider {
  send(request: NormalizedChatRequest): Promise<NormalizedChatResponse>;
  stream(request: NormalizedChatRequest): AsyncIterable<NormalizedStreamEvent>;
  upload?(file: UploadedFileInput): Promise<NormalizedFileRef>;
  listModels?(): Promise<ModelDescriptor[]>;
}
```

Normalized stream events should include:

- `message.start`
- `message.delta`
- `message.complete`
- `tool.call`
- `tool.result`
- `artifact.created`
- `citation.added`
- `error`

This is the key to future-proofing the frontend.

## 9. What this repo should become

Current repo observations:

- the UI is a single React chat shell
- conversation state is local/in-memory
- provider integration is a single `fetch` call to `/chat`
- no auth, persistence, files, projects, or streaming contract yet

That means the current app is a good visual seed, but not yet a reusable platform.

## 10. Concrete repo plan

### Phase 1. Stabilize the current frontend

Keep the current code, but harden the core contract first.

Do this:

1. Replace the single-response JSON flow with streaming.
2. Replace mock conversation persistence with server-backed persistence.
3. Add a normalized domain model for:
   - projects
   - conversations
   - messages
   - artifacts
   - citations
   - tool runs
4. Move model/provider definitions out of hard-coded mock data.
5. Add feature flags so provider-specific features do not leak into the core UI.

### Phase 2. Add reusable platform features

Build these modules as reusable primitives:

- `project switcher`
- `conversation store`
- `file upload tray`
- `artifact side panel`
- `provider/model switcher`
- `tool activity timeline`
- `source/citation inspector`

### Phase 3. Add provider adapters

Implement adapters in this order:

1. OpenAI
2. Anthropic
3. Gemini
4. DeepSeek
5. Kimi

Reason:

- OpenAI and Anthropic define many of the artifact/tool/workspace patterns
- Gemini adds a strong realtime model
- DeepSeek and Kimi are easier once an OpenAI-compatible adapter exists

### Phase 4. Add production readiness

- authentication
- per-user/project permissions
- usage metering
- quotas
- structured logging
- request tracing
- error monitoring
- rate limiting
- moderation/safety hooks
- feature flags

## 11. Specific changes recommended for the current codebase

### Current integration seam

The current backend seam is already visible in [chatClient.ts](d:\#Code\VS Code\llm-chat-frontend\frontend\src\lib\chatClient.ts).

This should evolve from:

- single `POST /chat`
- one JSON response

to:

- `POST /api/chat/stream`
- SSE event stream
- normalized provider events

### Current UI shell

The current shell lives in [App.tsx](d:\#Code\VS Code\llm-chat-frontend\frontend\src\App.tsx).

Refactor it into:

- `AppShell`
- `Sidebar`
- `ThreadView`
- `Composer`
- `ArtifactPanel`
- `ProjectBar`
- `ToolRunPanel`

### Current type model

The current types live in [types.ts](d:\#Code\VS Code\llm-chat-frontend\frontend\src\types.ts).

Extend them to include:

```ts
type ProviderId = "openai" | "anthropic" | "google" | "moonshot" | "deepseek";

interface Project {
  id: string;
  name: string;
  instructions?: string;
}

interface Citation {
  id: string;
  title: string;
  url?: string;
  provider?: ProviderId;
}

interface Artifact {
  id: string;
  type: "document" | "code" | "html" | "json" | "table" | "chart";
  title: string;
  content: string;
}

interface ToolRun {
  id: string;
  toolName: string;
  status: "queued" | "running" | "done" | "error";
}
```

## 12. UI guidance for a professional base

Copy these patterns from the market leaders:

- clean sidebar with persistent history
- one excellent composer, not many competing inputs
- streaming response that feels alive immediately
- artifact pane for substantial outputs
- clear file and project context visibility
- subtle but obvious tool activity
- strong empty state with mode-aware suggestions

Avoid these mistakes:

- exposing provider-specific raw API shapes in the UI
- mixing ordinary chat text with large code/doc outputs in the same narrow column
- overusing WebSockets for simple text chat
- storing provider keys in the browser
- tying the whole app to a single model vendor

## 13. Recommended build order

1. Define normalized contracts.
2. Add SSE streaming end-to-end.
3. Add persistence for conversations and projects.
4. Add files and artifact side panel.
5. Add OpenAI adapter.
6. Add Anthropic adapter.
7. Add Gemini realtime mode.
8. Add Kimi and DeepSeek adapters.
9. Add auth, observability, quotas, and admin controls.

## 14. Final recommendation

If the goal is "one frontend base for all future AI projects", then the right product is not:

- a ChatGPT clone

The right product is:

- a provider-agnostic AI workspace platform

Use ChatGPT, Gemini, Claude, Kimi, and DeepSeek as references for:

- workspace UX
- streaming behavior
- artifacts
- files
- tools
- realtime transport choices

Do not imitate them by guessing their hidden frontend frameworks.

Imitate the publicly visible architecture patterns, then implement your own clean reusable platform around them.

## 15. Sources

OpenAI

- ChatGPT Projects: https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt
- ChatGPT Canvas: https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it
- File uploads: https://help.openai.com/en/articles/8555545-uploading-files-with-advanced-data-analysis-in-chatgpt
- Responses API: https://platform.openai.com/docs/guides/migrate-to-responses
- Streaming responses: https://platform.openai.com/docs/guides/streaming-responses
- API authentication: https://platform.openai.com/docs/api-reference/authentication

Google Gemini

- Gemini API overview/reference: https://ai.google.dev/api
- Gemini Live API overview: https://ai.google.dev/gemini-api/docs/live-api
- Gemini ephemeral tokens: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens
- Gemini context caching: https://ai.google.dev/gemini-api/docs/caching
- Gemini Canvas: https://support.google.com/gemini/answer/16047321
- Gemini Canvas safety and Firestore storage: https://support.google.com/gemini/answer/16419134
- Gemini Gems: https://support.google.com/gemini/answer/15236321

Anthropic Claude

- Claude Artifacts: https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them
- Claude Projects: https://support.claude.com/en/articles/9517075-what-are-projects
- Claude Messages API: https://platform.claude.com/docs/en/build-with-claude/working-with-messages
- Claude streaming: https://platform.claude.com/docs/en/build-with-claude/streaming
- Claude prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Claude Files API: https://docs.claude.com/en/api/files-create

Moonshot AI / Kimi

- Kimi K2.5 product page: https://www.kimi.com/ai-models/kimi-k2-5
- Kimi features overview: https://www.kimi.com/features/
- Kimi Docs: https://www.kimi.com/features/docs
- Kimi API OpenAI compatibility: https://platform.moonshot.ai/docs/guide/migrating-from-openai-to-kimi
- Kimi thinking models: https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model
- Kimi streaming: https://platform.moonshot.ai/docs/guide/utilize-the-streaming-output-feature-of-kimi-api
- Kimi tool calls: https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls
- Kimi file-based Q&A: https://platform.moonshot.ai/docs/guide/use-kimi-api-for-file-based-qa

DeepSeek

- DeepSeek app intro: https://api-docs.deepseek.com/news/news250115
- DeepSeek quick start: https://api-docs.deepseek.com/
- DeepSeek chat completions reference: https://api-docs.deepseek.com/api/create-chat-completion
- DeepSeek function calling: https://api-docs.deepseek.com/guides/function_calling/
- DeepSeek context caching: https://api-docs.deepseek.com/guides/kv_cache/
