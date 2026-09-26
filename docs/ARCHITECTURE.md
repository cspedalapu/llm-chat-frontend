# Architecture

This repo is a **shell** (the interface and the plumbing every product shares) plus
one **domain** implementation (a multi-provider chat backend). Forks keep the shell
and replace or extend the domain. The labels below say which is which.

```text
Browser ──/api/*──▶ Vite dev proxy / nginx ──(strips /api)──▶ Backend (FastAPI)
   │                                                           │
   React app                                                   SQLite + encrypted keys
   (frontend/src)                                              (CHAT_DATA_DIR)
                                                               │
                                                               ▼
                                                   Model providers (OpenAI-compatible,
                                                   Anthropic, Gemini, Ollama)
```

The only coupling between the two halves is **[API-CONTRACT.md](API-CONTRACT.md)**.

---

## Frontend (`frontend/src`)

React 18 + TypeScript + Vite. No router, no state library: `App.tsx` holds view
state, and `useWorkspace` holds server data.

| Path | Role | Shell / domain |
|---|---|---|
| `app.config.ts` | Brand, copy, feature flags, nav. **The file forks edit first.** | Config |
| `extensions/` | Registries for fork pages, message add-ons, composer tools, auth headers. **Fork code goes here.** | Fork space |
| `App.tsx` | View switching, modals, wiring. Reads config, capabilities and extensions. | Shell |
| `hooks/useWorkspace.ts` | Loads `/workspace`, runs streaming generation, exposes `has(capability)`. | Shell |
| `hooks/usePreferences.ts` + `components/CustomizePanel.tsx` | The user's show/hide choices (browser storage) and the Customize window. | Shell |
| `lib/chatClient.ts` | `api()`, `streamReply()` (SSE parser), `download()`. All HTTP goes through here. | Shell |
| `lib/capabilities.ts` | Known capability names and the `has()` helper. | Shell |
| `components/Sidebar.tsx` + `components/sidebar/` | Nav, projects, chat list, account menu. | Shell |
| `components/Composer.tsx` | Pill message box: + menu (attach, Sources ▸, Assistant ▸, tools), thinking effort, send/stop, chips. | Shell |
| `components/ChatMessage.tsx` | User bubble; assistant markdown, sources, add-ons; icon actions and a More menu. | Shell |
| `components/ChatHeader.tsx`, `ChatFiles.tsx` | Model picker, Share, the ••• chat menu (with Move to project ▸), files in this chat. | Shell |
| `components/Menu.tsx` | The one dropdown/submenu component every menu uses (outside click, Escape, keyboard). | Shell |
| `components/icons.tsx` | SVG icons plus `navIcons`, the name map used by the config. | Shell |
| `components/research/` | The Research tab: `ResearchPage` (history · run · tools), `NewResearch`, `PlanReview`, `RunView`, `Timeline`, `ReportView`, `ToolsPanel`, `ToolsDirectory`. | Shell, `research` capability |
| `hooks/useResearch.ts`, `lib/research.ts` | Run list, one live run (event replay + resumable stream), typed API client. | Shell |
| `components/ProviderSettings.tsx` | Model connection editor (`models.manage`). | Domain |
| `components/Library.tsx`, `SearchChats.tsx`, `WorkspaceTools.tsx`, `ProjectEditor.tsx` | Optional feature pages. | Shell, capability-gated |
| `styles.css`, `workspace.css`, `chat.css`, `research.css` | All styling, loaded in that order. `chat.css` holds the chat surface (header, menus, messages, composer, responsive drawer). Type scale uses `--text-*` tokens. | Shell |
| `types.ts` | Frontend view of the contract shapes. | Shell |

**How a capability flows:** the backend lists `"documents"` in `/workspace` →
`useWorkspace` builds `has()` → `App.tsx` passes `has("documents")` into the
Composer, Library, nav filter, and so on → the controls render or don't.

**Three layers decide whether a control shows:** the config enables it
(`app.config.ts`), the backend supports it (capabilities), and the user hasn't
hidden it (Customize). The Customize window only lists what passes the first two.

## Backend (`backend/app`)

FastAPI + SQLite (standard library `sqlite3`, WAL mode, FTS5 for search).

| Module | Role | Shell / domain |
|---|---|---|
| `main.py` | App setup, the security middleware (origins, client header, auth hook, burst limit, size cap), CRUD routes, `CAPABILITIES`, `API_VERSION`. | Shell (routes: domain) |
| `auth.py` | `authenticate(request)` hook, the CSRF header constant, public paths. | Shell, **fork fills in** |
| `generation.py` | `/generate` SSE streaming, cancellation, idempotency, daily quota, `/usage`. | Domain (protocol: shell) |
| `providers.py` | Request building and stream parsing for OpenAI-compatible, Anthropic, Gemini and Ollama. | Domain |
| `context.py` | System-prompt assembly and context-window packing (projects, presets, summary, sources). | Domain |
| `documents.py` | Text/PDF extraction, chunking, FTS5 retrieval. | Domain |
| `store.py` | Schemaless JSON record store over SQLite; restart recovery. | Domain |
| `secrets.py` | Fernet encryption of API keys; `public_provider()` strips secrets. | Domain |
| `contracts.py` | Pydantic request models and validation limits. | Domain |
| `tool_calling.py` | One non-streaming model turn with tool calls, normalized across OpenAI-compatible, Anthropic, Gemini and Ollama; `supports_tools()` probe. | Shell |
| `research/` | The Research engine: `engine.py` (plan → parallel researchers with tools → writer → citation check, with budgets, steering, approvals), `store.py` (runs, events, sources, tool-call log), `prompts.py`, `citations.py`, `export.py` (Markdown, .docx), `routes.py` (API). | Shell (prompts: domain) |
| `tools/` | Research tools behind one interface (`base.py`): `web.py` (SearXNG / Tavily / Brave search, page reader), `academic.py` (OpenAlex, arXiv, Semantic Scholar, PubMed), `library.py`, `cloud.py` (Google Drive, OneDrive), `mcp.py` (remote MCP servers), `net.py` (SSRF-guarded HTTP), `registry.py` (sources → tools). | Shell, **forks add tools here** |
| `connectors.py`, `oauth.py` | Tool connections per owner: config, encrypted secrets, status, permissions; OAuth 2.1 + PKCE for Google, Microsoft and MCP. | Shell |
| `tables.py` | Excel, CSV and Word reading, table summaries. | Shell |

Tests: `backend/tests/test_api.py` covers behaviour, `test_contract.py` covers
the contract, and `fake_provider.py` is the e2e model fixture.

## Examples and tests

| Path | Purpose |
|---|---|
| `examples/minimal_backend/` | Core-tier backend, in memory. The starting point when a fork replaces the backend. |
| `frontend/tests/workspace.spec.ts` | Full-feature e2e suite against the real backend and a fake provider. |
| `frontend/tests/core-tier.spec.ts` | e2e suite against the minimal backend; proves the UI degrades cleanly. |
| `.github/workflows/ci.yml` | Runs everything above on each push and pull request. |

## Runtime and deployment

- **Dev:** `docker compose --profile dev up` runs the Vite dev server (5173) and the backend (8000). Ports are bound to `127.0.0.1`.
- **Prod-style:** `docker compose --profile prod up` builds the frontend into unprivileged nginx (8080), which serves the bundle, proxies `/api` and sets CSP headers (`frontend/nginx.conf`).
- **Data:** `CHAT_DATA_DIR` (default `./data`) holds `workspace.sqlite3` and `secret.key`. Back them up together.
- **Environment variables:**

  | Variable | Used for |
  |---|---|
  | `CHAT_ALLOWED_ORIGINS` | Extra CORS origins |
  | `CHAT_ALLOWED_HOSTS` | Extra `Host` values, for deploying beyond localhost |
  | `VITE_API_BASE_URL` | Frontend API base (default `/api`) |
  | `API_PROXY_TARGET` | Where the Vite proxy sends `/api` |
  | `CHAT_PUBLIC_URL` | Public app URL; OAuth redirect URLs are built from it |
  | `GOOGLE_OAUTH_*`, `MICROSOFT_OAUTH_*` | Enable Drive / OneDrive sign-in for Research |
  | `RESEARCH_ALLOW_PRIVATE_NETWORK` | Allow research to open private-network pages (off in production) |
  | `RESEARCH_CONTACT_EMAIL`, `SEMANTIC_SCHOLAR_API_KEY` | Academic API etiquette / limits |

  All of them are listed in `.env.example`; Research setup is in [RESEARCH.md](RESEARCH.md).

## Security model (base)

A single-user local workspace: local origins only, the client header on writes,
auth that always returns the local user, keys encrypted at rest and never returned
to the browser, a 10 MB request cap, a burst limiter on generate and upload, and a
daily request cap. A fork exposed to the network must at minimum:

1. Implement `auth.authenticate`.
2. Set `CHAT_ALLOWED_HOSTS` and `CHAT_ALLOWED_ORIGINS`.
3. Scope the data per user. The store is single-tenant today.
