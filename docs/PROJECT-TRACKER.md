# Project Tracker

Running record of what exists, what changed, and what is still open. Written because
the project sat dormant from **2026-03-30 to 2026-09-22** and context was lost.

**How to use this file:** update the status tables whenever something lands, is removed,
or is deliberately deferred. Every open item has an ID (`O-n`) — reference it in commit
messages so the history stays searchable. Move finished items into §5 with a date.

- **Last updated:** 2026-09-26
- **Status:** ⏸ **On hold since 2026-09-26.** Start with "Where we stopped" below.
- **Role of this repo:** the permanent base every new product forks. See
  [BASE-ROADMAP.md](BASE-ROADMAP.md) and [FORKING.md](FORKING.md).
- **Health:** ruff clean · 76 backend tests (33 behaviour + 25 research + 18 contract) ·
  `tsc` clean · 6/6 full e2e · 1/1 core-tier e2e

---

## Where we stopped (2026-09-26)

**State:** paused by the owner. All work is committed and pushed (`main` = `origin/main`,
last commit `133f480`). All health checks were green at pause (see Health above).

**Done in the last sessions (2026-09-25 → 26):**
- Base made forkable: capabilities, API contract + contract test, minimal backend,
  `app.config.ts`, `extensions/`, auth hook, CI, docs (BASE-ROADMAP.md, all done).
- ChatGPT-style UI: pill composer, icon message actions, header Share + ••• menu,
  Pinned, phone drawer, Customize window.
- **Research tab** (RESEARCH-PLAN.md, 29/31 done): plan approval, parallel tool-using
  researchers, cited report with citation check, tools directory (web, papers, library,
  Drive, OneDrive, MCP), permissions, tracking, exports. Guide: RESEARCH.md.

**Pick up here, in this order:**
1. **Push-triggered CI (O-11):** confirm the GitHub Actions run on `133f480` is green,
   especially the Linux e2e job, which has never run on GitHub.
2. **Choose a web search provider (O-14 / DR-1):** Tavily or Brave key, or a SearXNG
   server. Then run one real research question end to end.
3. **Real OAuth apps (O-15):** create the Google and Microsoft apps (`.env.example`,
   RESEARCH.md §3) and test Drive / OneDrive sign-in against the real services.
4. **Answer DR-3 (O-16):** does "Google Cloud" mean Drive/Docs/Sheets (done) or GCP data
   such as BigQuery / Cloud Storage? That unblocks R-28.
5. **Eval set (O-18):** add 5–10 real research questions and run
   `evals/research/run_eval.py` against a real model.

**Ideas raised but not started:**
- One-click model presets in "Add your model" (GitHub Models, NVIDIA NIM, OpenRouter,
  Groq…). All of them already work via the OpenAI-compatible type; presets would only
  pre-fill the URL and settings.
- Rename the sidebar "Workspace" item to "Assistants & usage", and the footer label
  "Local workspace" (the word "workspace" meant three different things).

**Environment notes:**
- The Docker stack was left running on ports 8001 (backend), 5173 (dev UI) and 8082
  (prod UI), because 8000/8080 belong to VoiceBite. Stop it with
  `docker compose --profile dev --profile prod down`. Data lives in the `workspace-data`
  volume and holds only test data; `down -v` wipes it.
- The owner commits and pushes changes themselves. Leave work uncommitted for review.

---

## 1. Health checks

Run these before committing. All must be green. CI (`.github/workflows/ci.yml`)
runs the same set, plus the contract test against `examples/minimal_backend`.

| Check | Command | Expected |
|---|---|---|
| Lint | `./.venv-dev/Scripts/python.exe -m ruff check backend examples evals` | `All checks passed!` |
| Backend + contract tests | `./.venv-dev/Scripts/python.exe -m pytest backend -q --basetemp=<writable>` | 76 passed |
| Types | `cd frontend && npm run typecheck` | exit 0 |
| End-to-end, full | `cd frontend && npm run test:e2e` | 6 passed |
| End-to-end, core tier | `cd frontend && npm run test:e2e:core` | 1 passed |

---

## 2. Timeline

| Date | What happened |
|---|---|
| 2026-03-28 → 03-30 | Original build. 59 commits in ~2 days. Mock data only; rich UI shell. |
| 2026-03-30 → 09-22 | Dormant. No commits for ~6 months. |
| 2026-09-22 | Security + hygiene pass (ports, non-root, tests, CSP, input caps). |
| 2026-09-22 | Typography: 17px → 16px base, 48 ad-hoc sizes → 6 tokens. |
| 2026-09-23 | **Codex rebuild.** Real backend + providers; UI largely replaced. |
| 2026-09-23 | Restoration: effects returned, dead code removed, e2e suite green. |
| 2026-09-24 | Composer partly restored, CSS unified, burst limit, sidebar split. |
| 2026-09-25 | **Made the permanent base** (BASE-ROADMAP B-1 to B-16): capabilities + contract test, minimal backend, `app.config.ts`, `extensions/`, auth hook, CI, docs, dry-run fork. |

---

## 3. Feature status

### Working

| Feature | Notes |
|---|---|
| Multi-provider chat | OpenAI, Anthropic, Gemini, Ollama. Streaming. |
| Encrypted key storage | Fernet; `0600` key file; keys never sent to the browser. |
| Conversations | Create, rename, archive, pin, branch, regenerate. |
| Projects | Instructions + memory + category, injected into the system prompt. |
| Documents | Upload, extract, FTS5 chunk retrieval with citations. |
| Presets ("Assistants") | Reusable instructions + output format. |
| Search | FTS5 across titles and message content. |
| Usage & cost | Per-request tokens, estimated cost, daily request cap. |
| Export | Chats, projects and presets as JSON. |
| Landing typewriter | Rotating prompt + blinking caret. |
| Typing indicator | Three pulsing dots while awaiting first token. |
| **Thinking effort** | Per-message Standard/Low/Medium/High, overrides the connection default. |
| **Tools menu** | Attach documents live; unavailable tools shown disabled, not faked. |
| **Research tab (09-25)** | Plan → approve → parallel tool-using researchers → cited report with citation check; steer, stop, per-tool Ask/Allow/Block, budgets, export MD/DOCX/PDF, continue in chat. Tools: SearXNG/Tavily/Brave, OpenAlex/arXiv/Semantic Scholar/PubMed, library + Excel/Word, Google Drive, OneDrive/SharePoint, custom MCP (none/token/OAuth). Tool-call tracking. See RESEARCH.md. |
| **Chat UI (09-25 redesign)** | ChatGPT-style: pill composer with + menu (attach, Sources ▸, Assistant ▸), compact thinking effort, round send/stop; user bubbles and icon actions (copy, regenerate, save, More); header Share + ••• menu (view files, rename, context, pin, archive, delete, Move to project ▸); home suggestions; Pinned section; Show more projects; phone drawer. |
| **Customize** | Account menu → Customize: users hide Library, Workspace, LLMs, the tools menu, Sources, Thinking and the assistant picker. Fixed: New chat, Search chats, Projects, chat history, model selector. Hiding never deletes anything. Defined in `app.config.ts`. |

### Placeholder — hidden by default, no backend

Images · Apps. (Deep Research became the real Research tab on 09-25.) Hidden unless `features.placeholderPages` is on in
`app.config.ts`, and then they render an honest "not connected" notice. A fork that
registers `extensions.pages[key]` gets its own page there instead. (O-8, resolved 09-25.)

### Base infrastructure (09-25)

| Thing | Where |
|---|---|
| Capabilities: UI hides what the backend lacks | `GET /workspace` → `capabilities`; `lib/capabilities.ts` |
| Executable API contract | `docs/API-CONTRACT.md`, `backend/tests/test_contract.py` |
| Core-tier reference backend | `examples/minimal_backend/app.py` |
| Brand, copy, nav, feature flags | `frontend/src/app.config.ts` |
| Fork extension points | `frontend/src/extensions/` (pages, message add-ons, composer tools, auth headers) |
| Auth hook | `backend/app/auth.py` + `frontend/src/extensions/auth.ts` |
| CI | `.github/workflows/ci.yml` |

### Removed

| Thing | When | Why |
|---|---|---|
| Mock response engine | 09-23 | Superseded by real providers. Frontend `mockData.ts` emptied; backend `mock_engine.py` (273 lines) deleted. |
| Structured result cards | 09-23 | `result-grid` / `result-card` / `result-block`. Replaced by markdown rendering. Still recoverable — see O-3. |
| Landing setup button | 09-24 | "Add your first model" removed at user request. Three other entry points remain. |

---

## 4. Open items

| ID | Item | Impact | Why still open |
|---|---|---|---|
| **O-1** | Rich composer not fully restored | Medium | Thinking effort + tools menu done. Apps menu, mic and voice submit remain — all decoration with no backend. |
| **O-3** | Reserved unused CSS remains | Low | 48 dead classes deleted 09-25. **Still deliberately kept:** `project-*`, `result-*` (restoration scaffolding) and `composer-apps-*`, `composer-mic-button`, `composer-voice-submit` (O-1). |
| **O-6** | No real auth | Low (local) | Hook point exists (`backend/app/auth.py`, `extensions/auth.ts`). Implementing it is a per-fork deployment decision. |
| **O-9** | Web search has no backend | Medium | The only unavailable tool that is realistically buildable. Needs a provider choice + API key. |
| **O-10** | `styles.css` still one 1,939-line file | Low | No section boundaries to split on safely; splitting by guesswork risks cascade changes. Split when a restyle pass defines areas. |
| **O-11** | CI e2e job not yet run on GitHub | Medium | Backend and frontend jobs dry-run clean in `python:3.12-slim` / `node:20-alpine`. The Linux Playwright job is confirmed only after the first push. |
| **O-12** | Store is single-tenant | Low (local) | Any fork with multiple users must scope records per `request.state.user`. Documented in ARCHITECTURE.md. |
| **O-14** | Research: web search needs a provider key | Medium | DR-1: pick Tavily / Brave (key) or run SearXNG. Until then only Academic, Library and connected drives work. |
| **O-15** | Research: Google/Microsoft sign-in untested against the real services | Medium | Flows are unit-tested with mocks; needs real OAuth apps (`.env.example`) to verify end to end. |
| **O-16** | Research: "Google Cloud" (R-28) not built | Low | Waiting for DR-3: Workspace files (done via Drive) or GCP data such as BigQuery / Cloud Storage? |
| **O-17** | Research: arXiv and Semantic Scholar rate limits | Low | arXiv answers 406 when requests are < 3 s apart (now spaced + retried); Semantic Scholar needs `SEMANTIC_SCHOLAR_API_KEY` for reliable use. OpenAlex and PubMed verified live. |
| **O-18** | Research eval set needs real questions | Low | `evals/research/run_eval.py` is ready; add 5–10 of your questions and run it against a real model. |
| **O-13** | Customize choices are per browser | Low | Saved in `localStorage`, so they don't follow a user to another device. Move them into the backend once forks have real users (O-6, O-12). |

---

## 5. Resolved

| Item | Fixed | How |
|---|---|---|
| Dev ports exposed to LAN | 09-22 | Published ports bound to `127.0.0.1`. |
| Containers ran as root | 09-22 | `appuser` / `node` / nginx-unprivileged. |
| No tests | 09-22 | Backend suite added. |
| No security headers | 09-22 | CSP + 4 headers in `nginx.conf`. |
| Unbounded chat input | 09-22 | 8k chars, 50-message history cap. |
| Fonts oversized | 09-22 | 6-token type scale; sidebar 18.6px → 14px. |
| Sidebar duplicated in a11y tree | 09-23 | `opacity:0` left hidden nav focusable. Added `visibility: hidden`. |
| Textarea value leaked into label | 09-23 | Populated `<textarea>` inside `<label>` polluted the accessible name. Added `aria-label`. |
| Project "Category" did nothing | 09-23 | Stored but never read. Now a framing hint in `context.py`. |
| Dead `mock_engine.py` | 09-23 | Deleted, plus its ruff per-file-ignore. |
| `SIM117` lint error | 09-23 | Merged nested `with` in `providers.py`. |
| Stale CSP `connect-src` | 09-23 | API is same-origin via `/api`; narrowed to `'self'`. |
| 3 e2e tests failing | 09-23 | Two races, one a11y bug. All 3 pass. |
| Hardcoded test port | 09-23 | `TEST_API_URL` override added. |
| **O-2** `workspace.css` off-scale | 09-24 | 26 declarations tokenised; 0 raw sizes left. Added `--text-3xl`. |
| **O-4** `Sidebar.tsx` 986 lines | 09-24 | 23 icons extracted to `icons.tsx`. Now 764 + 226. |
| **O-5** Presets vs Projects unclear | 09-24 | Reciprocal guidance added to both editors. |
| **O-7** No burst protection | 09-24 | Per-IP limiter on `/generate` + `/documents`; cheap routes exempt. Covered by a test. |
| **O-8** Placeholder nav tabs | 09-25 | Hidden behind `features.placeholderPages` (off). Fork pages can take over the keys. |
| Stale README | 09-25 | Rewritten; it described a placeholder backend and a `/chat` endpoint that no longer exist. |
| Dead files | 09-25 | `schemas.py`, `lib/models.ts`, `data/mockData.ts`, `instructions.txt` deleted; `vite.config.d.ts` untracked. |
| Backend `.dockerignore` ignored | 09-25 | Build context is the repo root, so it was never read; `node_modules`, `.venv` and `data/` (incl. `secret.key`) went to the daemon. Now `backend/Dockerfile.dockerignore`. |
| Export crash on backends without `sources` | 09-25 | `result.sources` optional in the type; guarded. |
| `Sidebar.tsx` 764 lines | 09-25 | Menus and rows moved to `components/sidebar/`; 565 remain. |
| Stop cancelled the wrong request | 09-25 | Clicking Stop before the reply started cancelled the *previous* turn's request id, so the new reply kept streaming. `stop()` now prefers the request this tab started. |
| Tablet layout stacked the sidebar on top | 09-25 | 700–960px now keeps the side-by-side layout; under 700px the sidebar is a drawer. |

---

## 6. Gotchas

Things that cost time before. Check here first.

- **Stale `node_modules` volume.** `docker compose down` does *not* clear the anonymous
  volume. A missing dependency that *is* in `package.json` means you need `down -v`.
- **Backend source is baked into the image.** No bind mount, so backend edits need
  `docker compose build backend`. Lint/test on the host instead.
- **pytest on Windows.** Default temp dir is permission-denied. Use `--basetemp=<writable>`.
- **Ports 8000 and 8080 are usually taken** by unrelated `voicebite-*` containers (8081 by
  Keycloak). Use `BACKEND_PORT=8001 FRONTEND_PROD_PORT=8082 docker compose --profile dev --profile prod up -d --build`.
- **`frontend-prod` only starts with `--profile prod`** (since 09-25; before, it started on every `up`).
- **e2e tests are serial.** Test 2 depends on test 1 creating the provider. Running one
  alone fails legitimately.
- **The app does nothing without a provider.** No mock fallback. A blank-looking app
  usually means no model configured, not a bug.
- **Burst limiter state is module-level.** Tests must clear `main._burst` between cases;
  the `client` fixture does this.
- **Don't assert `toContainText` on a `<textarea>`.** Use `toHaveValue`.
- **Git Bash rewrites `/api`.** `VITE_API_BASE_URL=/api npx vite` in Git Bash becomes
  `C:/Program Files/Git/api`. Prefix with `MSYS_NO_PATHCONV=1`, or use PowerShell.
- **`frontend/.env.local` overrides the API base.** A local
  `VITE_API_BASE_URL=http://127.0.0.1:8000` sends the browser straight to the backend
  (CORS applies) instead of through the `/api` proxy.
- **`ruff.toml` lives at the repo root** so `backend/`, `examples/` and `evals/` share it.
- **e2e research fetches the local fixture**, so the test backend runs with
  `RESEARCH_ALLOW_PRIVATE_NETWORK=1` (playwright.config.ts). Never set it in production.
- **arXiv throttles by IP.** Rapid manual testing can get 406s for a while; wait a minute.
- **Run pytest as `python -m pytest`.** A bare `pytest` doesn't put the repo root on
  `sys.path`, so `import backend` fails.

---

## 7. Commands

```bash
# Run the stack (dev UI 5173, prod UI 8080, backend 8000)
docker compose --profile dev up -d --build

# Backend
./.venv-dev/Scripts/python.exe -m ruff check backend examples
./.venv-dev/Scripts/python.exe -m pytest backend -q --basetemp=<writable-dir>

# Contract test against any running backend
CONTRACT_BASE_URL=http://127.0.0.1:8000 ./.venv-dev/Scripts/python.exe -m pytest backend/tests/test_contract.py -q

# Frontend
cd frontend && npm run typecheck && npm run build

# End-to-end (each starts its own servers)
cd frontend && npm run test:e2e && npm run test:e2e:core
```
