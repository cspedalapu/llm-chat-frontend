# Base Roadmap: turning this repo into the permanent foundation

**Goal:** every future product (a research tool, a support bot, anything chat-shaped)
starts by forking this repo. The interface stays the same, the backend can be
replaced completely, and the UI is adjusted per product without rewriting it.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` dropped
**IDs:** `B-n` for roadmap tasks, used in commit messages (`B-9: …`).
**Created:** 2026-09-25 · **Completed:** 2026-09-25 (one pass) · **Owner:** Chandrasekhar

Follow-ups that remain are tracked as `O-n` items in
[PROJECT-TRACKER.md §4](PROJECT-TRACKER.md#4-open-items).

---

## 0. Decisions

All six went with the proposed default. Change any of them by editing the file named.

| # | Question | Decision | Where it lives |
|---|---|---|---|
| D-1 | Licence | **MIT**, because the GitHub repo is public | `LICENSE` |
| D-2 | Placeholder tabs (Images, Apps, Deep Research) | **Kept, hidden by default** | `features.placeholderPages` in `app.config.ts` |
| D-3 | Auth in the base | **Hook point only**, no login implementation | `backend/app/auth.py`, `frontend/src/extensions/auth.ts` |
| D-4 | How forks get base updates | **Git fork with an `upstream` remote** | `docs/FORKING.md` §1 and §7 |
| D-5 | Rewrite the "Update X.tsx" history | **No.** Pushed history is left as is; new commits use descriptive messages | `CONTRIBUTING.md` |
| D-6 | Depth of extension points | **Minimal registries**: pages, message add-ons, composer tools, auth headers | `frontend/src/extensions/` |

---

## Progress summary

| Phase | Tasks | Done | Result |
|---|---|---|---|
| 1. Save & stabilise | B-1 – B-2 | 2 / 2 | Clean tree, dead files gone |
| 2. Accurate docs | B-3 – B-4 | 2 / 2 | README and architecture match the code |
| 3. The contract | B-5 – B-7 | 3 / 3 | Backend is swappable, proven by a test and a second backend |
| 4. Configurable shell | B-8 – B-11 | 4 / 4 | One config file, extension registries, capability-gated UI |
| 5. Fork guide | B-12 – B-13 | 2 / 2 | Guide written, then followed end to end in a practice fork |
| 6. Team readiness | B-14 – B-16 | 3 / 3 | CI, licence, contributing guide, auth hook |

---

## Phase 1: Save & stabilise

- [x] **B-1 Commit the in-flight work.** You had already committed it before this
  pass started (commits `bb1d68e`…`55ddd69`). All checks green at the start: ruff,
  31 tests, `tsc`.
- [x] **B-2 Repo hygiene.** Deleted `backend/app/schemas.py`, `lib/models.ts`,
  `data/mockData.ts` and `instructions.txt`. Untracked `vite.config.d.ts`. Archived
  the March research report in `docs/archive/`. Ignored Playwright output.

## Phase 2: Accurate docs

- [x] **B-3 Rewrite `README.md`.** The old one described a placeholder backend and a
  `/chat` endpoint that no longer exists.
- [x] **B-4 `docs/ARCHITECTURE.md`.** Every module is marked shell or domain; covers
  runtime, environment variables and the security model.

## Phase 3: The contract

- [x] **B-5 `docs/API-CONTRACT.md`.** Covers the core tier, the SSE protocol, the
  capability table, optional routes and versioning rules.
- [x] **B-6 Capabilities.** `GET /workspace` returns `capabilities`, and `GET /health`
  returns `api_version`. The UI hides 11 optional features when they're absent.
  Verified by `examples/minimal_backend` and the core-tier e2e suite.
- [x] **B-7 Contract test.** `backend/tests/test_contract.py` runs in-process
  (16 pass) or against any server via `CONTRACT_BASE_URL`. The minimal backend
  passes all 6 core checks, with 10 optional checks correctly skipped.

## Phase 4: Configurable shell

- [x] **B-8 Branding config.** `frontend/src/app.config.ts` holds brand, copy and flags;
  `index.html` title and description are filled from it at build time.
- [x] **B-9 Nav and feature flags.** Nav moved into config with `requires`, `placeholder`
  and `enabled`. Placeholder tabs are hidden (D-2).
- [x] **B-10 Extension points.** `extensions/index.tsx` registers pages, message add-ons
  and composer tools. Message results can carry `extensions.<name>` data.
- [x] **B-11 Break up big files.** `Sidebar.tsx` went from 764 to 565 lines, with the
  menus and rows moved to `components/sidebar/`. 48 dead CSS classes (54 rules)
  were deleted: `styles.css` went from 2,313 to 1,939 lines. *Deferred:* splitting
  `styles.css` into files (**O-10**), because it has no section boundaries to split
  on safely.

## Phase 5: Fork guide

- [x] **B-12 `docs/FORKING.md`.** Covers forking, rebranding, the three backend paths,
  extensions, auth, upstream merges, and a checklist.
- [x] **B-13 Dry run.** A throwaway "Research Desk" fork followed the guide: rebrand,
  a research page, a confidence add-on, a composer tool, and a replacement backend
  built from the minimal example. It passed the contract test and worked in the
  browser, with only `app.config.ts`, `extensions/` and its own backend touched.
  The run found three problems, all fixed in the base:
  - the guide's JSX didn't compile (`index.ts` → `index.tsx`)
  - the contract test hit the Windows temp-dir bug in remote mode
  - the minimal backend hard-coded its reply label

## Phase 6: Team readiness

- [x] **B-14 CI.** `.github/workflows/ci.yml` runs lint, tests, the contract test
  against the minimal backend, typecheck, build and both e2e suites. The backend and
  frontend jobs dry-ran clean in containers. The Linux e2e job is unconfirmed until
  the first push (**O-11**).
- [x] **B-15 LICENSE and CONTRIBUTING.md.**
- [x] **B-16 Auth hook point.** The backend `authenticate()` runs on every non-public
  route and sets `request.state.user`; the frontend merges `authHeaders()` into every
  request. Covered by 2 tests.

---

## Found along the way (fixed)

- **Backend `.dockerignore` was never read.** The build context is the repo root, so
  every build sent `node_modules`, `.venv` and `data/` (including `secret.key`) to
  the Docker daemon. It's now `backend/Dockerfile.dockerignore`; verified by
  building the image.
- **Chat export crashed** when a backend omits `result.sources`.

## Log

| Date | Change |
|---|---|
| 2026-09-25 | Roadmap created. |
| 2026-09-25 | All 16 tasks carried out in one pass with default decisions; follow-ups O-10 to O-12 opened. |
