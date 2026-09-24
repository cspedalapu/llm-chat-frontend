# Project Tracker

Running record of what exists, what changed, and what is still open. Written because
the project sat dormant from **2026-03-30 to 2026-09-22** and context was lost.

Update this file whenever a feature lands, is removed, or is deliberately deferred.

- **Last updated:** 2026-09-23
- **Baseline commit:** `a576cc0`

---

## 1. Timeline

| Date | What happened |
|---|---|
| 2026-03-28 → 03-30 | Original build. 59 commits in ~2 days. Mock data only; rich UI shell. |
| 2026-03-30 → 09-22 | Dormant. No commits for ~6 months. |
| 2026-09-22 | Security + hygiene pass (ports, non-root, tests, CSP, input caps). |
| 2026-09-22 | Typography pass: 17px → 16px base, 48 ad-hoc sizes → 6 tokens. |
| 2026-09-23 (21:12–21:45) | **Codex rebuild.** Real backend + provider integration; UI largely replaced. |
| 2026-09-23 | Restoration pass: effects returned, dead code removed, e2e suite green. |

---

## 2. Feature status

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
| Landing typewriter | Rotating prompt + blinking caret. **Restored 09-23.** |
| Typing indicator | Three pulsing dots while awaiting first token. **Restored 09-23.** |

### Placeholder — visible in nav, no backend

| Tab | State |
|---|---|
| Images | Renders an honest "not connected" notice. |
| Apps | Same. |
| Deep Research | Same. |

**Decision needed:** keep as roadmap signal, or remove from primary nav. Three of the
main sidebar entries currently lead to a dead end.

### Removed

| Thing | When | Why |
|---|---|---|
| Mock response engine | 09-23 | Superseded by real providers. Frontend `mockData.ts` emptied by Codex; backend `mock_engine.py` (273 lines, imported by nothing) deleted 09-23. |
| Rich composer | 09-23 | Mode selector, tools/apps/thinking menus, mic, voice submit. Were UI shells over mock data. **Not restored — see Open item O-1.** |
| Structured result cards | 09-23 | `result-grid` / `result-card` / `result-block`. Replaced by markdown rendering. |

---

## 3. Open items

| ID | Item | Impact | Notes |
|---|---|---|---|
| **O-1** | Rich composer not restored | Medium | 28 CSS classes still defined, unused. Would need rewiring to the real provider flow. |
| **O-2** | `workspace.css` bypasses the type scale | Medium | 27 raw font-sizes, 12 distinct values, 0 uses of `--text-*`. Two competing visual systems. |
| **O-3** | ~49% of `styles.css` orphaned | Low | 104 of 210 classes unused. Dead weight; some is O-1/O-2 fallout. |
| **O-4** | `Sidebar.tsx` is 986 lines | Low | Larger than `App.tsx` + all feature components combined. |
| **O-5** | Presets vs Projects overlap | Low | They compose correctly in code, but the UI gives no guidance on which to use. |
| **O-6** | No auth on the API | Low (local) | Fine while loopback-only. Blocker before any deployment. |
| **O-7** | No per-IP rate limit | Low | Replaced by a daily request cap. No burst protection. |

---

## 4. Resolved

| Item | Fixed | How |
|---|---|---|
| Dev ports exposed to LAN | 09-22 | Published ports bound to `127.0.0.1`. |
| Containers ran as root | 09-22 | `appuser` / `node` / nginx-unprivileged. |
| No tests | 09-22 | Backend suite added; now 28 tests. |
| No security headers | 09-22 | CSP + 4 headers in `nginx.conf`. |
| Unbounded chat input | 09-22 | 8k chars, 50-message history cap. |
| Fonts oversized | 09-22 | 6-token type scale; sidebar 18.6px → 14px. |
| Sidebar duplicated in a11y tree | 09-23 | `opacity:0` left hidden nav focusable. Added `visibility: hidden`. |
| Textarea value leaked into label | 09-23 | Populated `<textarea>` inside `<label>` polluted the accessible name. Added explicit `aria-label`. |
| Project "Category" did nothing | 09-23 | Stored but never read. Now injected as a framing hint in `context.py`. |
| Dead `mock_engine.py` | 09-23 | Deleted, plus its ruff per-file-ignore. |
| `SIM117` lint error | 09-23 | Merged nested `with` in `providers.py`. |
| Stale CSP `connect-src` | 09-23 | API is same-origin via `/api`; narrowed to `'self'`. |
| 3 e2e tests failing | 09-23 | Two were races (typing before the modal closed); one was the a11y bug. All 3 pass. |
| Hardcoded test port | 09-23 | `TEST_API_URL` override added to the spec. |

---

## 5. Gotchas

Things that cost time before. Check here first.

- **Stale `node_modules` volume.** `docker compose down` does *not* clear the anonymous
  volume. A missing dependency that is correctly listed in `package.json` means you need
  `docker compose down -v`.
- **Backend source is baked into the image.** There is no bind mount any more, so backend
  edits need `docker compose build backend`. Lint/test on the host instead: `./.venv-dev/Scripts/python.exe -m ruff check backend`.
- **pytest on Windows.** The default temp dir is permission-denied here. Use
  `--basetemp=<writable dir>`.
- **Port 8000 is usually taken** by an unrelated `voicebite-backend` container.
- **e2e tests are serial.** Test 2 depends on test 1 creating the provider. Running one
  alone fails legitimately.
- **The app does nothing without a provider.** No mock fallback exists. A blank-looking
  app usually means no model is configured, not a bug.

---

## 6. Commands

```bash
# Run the stack (dev UI on 5173, prod UI on 8080, backend on 8000)
docker compose --profile dev up -d --build

# Backend checks (host)
./.venv-dev/Scripts/python.exe -m ruff check backend
./.venv-dev/Scripts/python.exe -m pytest backend -q --basetemp=<writable-dir>

# Frontend checks
cd frontend && npx tsc --noEmit && npm run build

# End-to-end (starts its own servers)
cd frontend && npx playwright test
```
