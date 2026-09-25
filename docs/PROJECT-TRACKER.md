# Project Tracker

Running record of what exists, what changed, and what is still open. Written because
the project sat dormant from **2026-03-30 to 2026-09-22** and context was lost.

**How to use this file:** update the status tables whenever something lands, is removed,
or is deliberately deferred. Every open item has an ID (`O-n`) — reference it in commit
messages so the history stays searchable. Move finished items into §5 with a date.

- **Last updated:** 2026-09-24
- **Baseline commit:** `a576cc0` (uncommitted work on top)
- **Health:** ruff clean · 31 backend tests · `tsc` clean · 3/3 e2e passing

---

## 1. Health checks

Run these before committing. All four must be green.

| Check | Command | Expected |
|---|---|---|
| Lint | `./.venv-dev/Scripts/python.exe -m ruff check backend` | `All checks passed!` |
| Backend tests | `./.venv-dev/Scripts/python.exe -m pytest backend -q --basetemp=<writable>` | 31 passed |
| Types | `cd frontend && npx tsc --noEmit` | exit 0 |
| End-to-end | `cd frontend && npx playwright test` | 3 passed |

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

### Placeholder — visible in nav, no backend

Images · Apps · Deep Research. Each renders an honest "not connected" notice.

**Decision still open (O-8):** keep as roadmap signal, or remove from primary nav.

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
| **O-3** | 91 of 210 CSS classes unused (43%) | Low | **Deliberately kept.** `project-*` (17) and `result-*` (9) are scaffolding for further restoration. Deleting now would block that. |
| **O-6** | No auth on the API | Low (local) | Fine while loopback-only. Needs a deployment decision before it can be designed. |
| **O-8** | Three placeholder nav tabs | Low | Product call: roadmap signal vs clutter. |
| **O-9** | Web search has no backend | Medium | The only unavailable tool that is realistically buildable. Needs a provider choice + API key. |

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

---

## 7. Commands

```bash
# Run the stack (dev UI 5173, prod UI 8080, backend 8000)
docker compose --profile dev up -d --build

# Backend
./.venv-dev/Scripts/python.exe -m ruff check backend
./.venv-dev/Scripts/python.exe -m pytest backend -q --basetemp=<writable-dir>

# Frontend
cd frontend && npx tsc --noEmit && npm run build

# End-to-end (starts its own servers)
cd frontend && npx playwright test
```
