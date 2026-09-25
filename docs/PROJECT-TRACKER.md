# Project Tracker

Running record of what exists, what changed, and what is still open. Written because
the project sat dormant from **2026-03-30 to 2026-09-22** and context was lost.

**How to use this file:** update the status tables whenever something lands, is removed,
or is deliberately deferred. Every open item has an ID (`O-n`) — reference it in commit
messages so the history stays searchable. Move finished items into §5 with a date.

- **Last updated:** 2026-09-25
- **Role of this repo:** the permanent base every new product forks. See
  [BASE-ROADMAP.md](BASE-ROADMAP.md) and [FORKING.md](FORKING.md).
- **Health:** ruff clean · 49 backend tests (33 behaviour + 16 contract) · `tsc` clean ·
  3/3 full e2e · 1/1 core-tier e2e

---

## 1. Health checks

Run these before committing. All must be green. CI (`.github/workflows/ci.yml`)
runs the same set, plus the contract test against `examples/minimal_backend`.

| Check | Command | Expected |
|---|---|---|
| Lint | `./.venv-dev/Scripts/python.exe -m ruff check backend examples` | `All checks passed!` |
| Backend + contract tests | `./.venv-dev/Scripts/python.exe -m pytest backend -q --basetemp=<writable>` | 49 passed |
| Types | `cd frontend && npm run typecheck` | exit 0 |
| End-to-end, full | `cd frontend && npm run test:e2e` | 3 passed |
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

### Placeholder — hidden by default, no backend

Images · Apps · Deep Research. Hidden unless `features.placeholderPages` is on in
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

---

## 6. Gotchas

Things that cost time before. Check here first.

- **Stale `node_modules` volume.** `docker compose down` does *not* clear the anonymous
  volume. A missing dependency that *is* in `package.json` means you need `down -v`.
- **Backend source is baked into the image.** No bind mount, so backend edits need
  `docker compose build backend`. Lint/test on the host instead.
- **pytest on Windows.** Default temp dir is permission-denied. Use `--basetemp=<writable>`.
- **Port 8000 is usually taken** by an unrelated `voicebite-backend` container.
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
- **`ruff.toml` lives at the repo root** so `backend/` and `examples/` share it.
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
