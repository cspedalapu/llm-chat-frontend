# Base Roadmap — turning this repo into the permanent foundation

**Goal:** every future product (a research tool, a support bot, anything chat-shaped) starts by
forking this repo. The interface stays the same, the backend can be replaced completely,
and the UI is adjusted per product without rewriting it.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` dropped
**IDs:** `B-n` for roadmap tasks. Use them in commit messages (`B-4: move nav into config`).
**Created:** 2026-09-25 · **Owner:** Chandrasekhar · **Execution:** one pass, after review

---

## 0. Decisions needed before work starts

Answer these first; they change what gets built. Proposed defaults are in *italics*.

| # | Question | Proposed default | Answer |
|---|---|---|---|
| D-1 | Licence for the base? | *MIT if it may be public or shared; "All rights reserved" if private* | |
| D-2 | Placeholder tabs (Images, Apps, Deep Research) — tracker item O-8 | *Keep the code; hide them behind feature flags, off by default* | |
| D-3 | Auth in the base? | *No auth implementation; define a single hook point (header/token middleware) that forks fill in* | |
| D-4 | How forks receive base updates | *True git fork with `upstream` remote; fixes to shared UI land here first* | |
| D-5 | Squash the "Update X.tsx" history? | *No — rewrite nothing already pushed; write good messages from now on* | |
| D-6 | Depth of extension points (Phase 4) | *Minimal registries only (renderers, composer modes, nav); no plugin system* | |

---

## Progress summary

| Phase | Tasks | Done | Makes the base… |
|---|---|---|---|
| 1. Save & stabilise | B-1 – B-2 | 0 / 2 | safe to build on |
| 2. Truthful docs | B-3 – B-4 | 0 / 2 | understandable |
| 3. The contract | B-5 – B-7 | 0 / 3 | backend-swappable ← **core of the idea** |
| 4. Configurable shell | B-8 – B-11 | 0 / 4 | re-brandable & mouldable |
| 5. Fork guide | B-12 – B-13 | 0 / 2 | usable by other people |
| 6. Team readiness | B-14 – B-16 | 0 / 3 | maintainable long-term |

Estimated readiness as a base: **~40% now → ~80% after Phase 5 → ~90% after Phase 6.**

---

## Phase 1 — Save & stabilise

- [ ] **B-1 Commit the in-flight work.**
  Review the 7 modified files + new `icons.tsx`, run all four health checks
  (PROJECT-TRACKER §1), commit in logical groups with descriptive messages.
  *Done when:* `git status` is clean and all checks are green.

- [ ] **B-2 Repo hygiene.**
  Remove/ignore stray files (`frontend/*.log`, `test-results/`, `browser-tests/`,
  `vite.config.d.ts`, `instructions.txt` if obsolete). Confirm `.gitignore` covers `data/`.
  *Done when:* a fresh clone contains only source, config and docs.

## Phase 2 — Truthful docs

- [ ] **B-3 Rewrite `README.md`.**
  Current README is stale: says the backend returns placeholders, lists a non-existent
  `/chat` endpoint, claims no persistence. New README: what this is (the base), features,
  architecture diagram, quick start, health checks, links to the other docs.
  *Done when:* every statement in it is true today.

- [ ] **B-4 Architecture overview** (`docs/ARCHITECTURE.md`).
  Frontend layers (components → hooks → `lib/chatClient`) and backend modules
  (`main`, `generation`, `providers`, `context`, `documents`, `store`, `secrets`) —
  one paragraph each, marking which are **shell** (keep) vs **domain** (replace per fork).

## Phase 3 — The contract (most important)

- [ ] **B-5 Write `docs/API-CONTRACT.md`.**
  Document all ~25 routes and the SSE stream protocol (`start`, `delta`, `done`,
  errors, heartbeat). Split into tiers:
  - **Core** — the minimum a replacement backend must implement for the UI to work
    (`/health`, `/workspace`, `/models`, `/conversations*`, generate stream).
  - **Optional** — features the UI hides gracefully if absent
    (documents, presets, search, usage, settings, projects).

- [ ] **B-6 Capabilities endpoint.**
  Backend advertises which optional features it supports (e.g. in `/health` or
  `/workspace`); frontend hides UI for missing ones instead of erroring.
  *Done when:* a backend that implements only the Core tier gives a clean, working UI.

- [ ] **B-7 Contract test.**
  A test that runs against any backend URL and checks the Core tier + stream format.
  Forks run it to prove their new backend is compatible.

## Phase 4 — Configurable shell

- [ ] **B-8 Single config file for branding.**
  Extend `frontend/src/lib/appConfig.ts`: app name, description, logo, empty-state
  copy, composer placeholder. Wire the currently unused `appDescription` /
  `composerPlaceholder`, and make `index.html` `<title>` come from config.

- [ ] **B-9 Nav & feature flags.**
  Move `navItems` out of `Sidebar.tsx` (lines 62-69) into config, each with an
  `enabled` flag. Apply D-2 to the placeholder tabs. Combine with B-6 capabilities.

- [ ] **B-10 Extension points** (scope per D-6).
  Small registries a fork can add to without editing core components:
  message renderers (e.g. research sources), composer modes/tools, extra nav pages.

- [ ] **B-11 Break up the big files.**
  `Sidebar.tsx` (764 lines) → nav, chat list, projects list, menus.
  `styles.css` (2,313 lines, 43% unused per O-3) → split by area; delete what
  Phase 4 confirms is dead.

## Phase 5 — Fork guide

- [ ] **B-12 Write `docs/FORKING.md`.**
  Step by step: fork, rename (B-8), choose features (B-9), replace or extend the backend
  (B-5/B-7), add UI (B-10), pull base updates (D-4). Includes "do not edit these files
  in a fork" list to keep merges from upstream painless.

- [ ] **B-13 Dry run.**
  Actually create a throwaway fork (e.g. "research-demo") following only FORKING.md;
  fix every step that was unclear. *Done when:* the guide works without outside help.

## Phase 6 — Team readiness

- [ ] **B-14 CI.** GitHub Actions: ruff, pytest, `tsc`, build, Playwright on every push/PR.
- [ ] **B-15 LICENSE + CONTRIBUTING.md** (per D-1): setup, checks, commit-message
  convention, where base changes vs fork changes belong.
- [ ] **B-16 Auth hook point** (per D-3): one documented middleware slot + frontend
  request-header slot (replaces the fixed `X-Workspace-Client: local-chat`).

---

## Out of scope for this roadmap

Existing product items stay in `PROJECT-TRACKER.md` §4 and are **not** blockers for the base:
O-1 (mic / voice / apps menu), O-9 (web search backend). These belong to future forks or a
later pass.

## Log

| Date | Change |
|---|---|
| 2026-09-25 | Roadmap created; awaiting review of §0 decisions. |
