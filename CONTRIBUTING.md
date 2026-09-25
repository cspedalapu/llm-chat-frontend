# Contributing

This repo is the long-lived base that other products fork. A change here reaches
every fork that merges it, so keep the base generic, tested and documented.

## Setup

Prerequisites: Python 3.12+, Node 20+. Docker is optional.

```bash
# Backend tooling. The e2e config expects this exact venv path on Windows;
# elsewhere, set TEST_PYTHON to your interpreter.
python -m venv .venv-dev
./.venv-dev/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# .venv-dev/bin/python -m pip install -r requirements.txt           # macOS / Linux

cd frontend && npm install && npx playwright install chromium
```

## Health checks

All of these must pass before you commit. CI runs the same set on every push.

| Check | Command | Expected |
|---|---|---|
| Lint | `python -m ruff check backend examples` | `All checks passed!` |
| Backend + contract tests | `python -m pytest backend -q` | all pass |
| Types | `cd frontend && npm run typecheck` | exit 0 |
| Build | `cd frontend && npm run build` | builds |
| e2e, full features | `cd frontend && npm run test:e2e` | all pass |
| e2e, core tier | `cd frontend && npm run test:e2e:core` | all pass |

On Windows, pytest's default temp dir can be permission-denied. Add
`--basetemp=<a writable dir>`. More gotchas are in
[docs/PROJECT-TRACKER.md §6](docs/PROJECT-TRACKER.md#6-gotchas).

## Where a change belongs

| Change | Base or fork? |
|---|---|
| Bug fix, accessibility, performance, security in shared code | **Base** |
| New extension point (a registry, a hook, a config key) | **Base** |
| New optional capability useful to many products | **Base**: update the contract doc, `CAPABILITIES` (backend and `lib/capabilities.ts`), the contract test, and gate the UI with `has()` |
| Product branding, product pages, product-specific backend | **Fork**: `app.config.ts`, `extensions/`, your backend |

Rules for the base:

- **Nothing product-specific.** If only one product needs it, it goes in that fork
  or behind an extension point.
- **UI for an optional feature must be gated** with `has("<capability>")`, so
  core-tier backends keep working. The core-tier e2e suite checks this.
- **Core-tier contract changes are breaking.** Bump `API_VERSION` and explain the
  change. See [docs/API-CONTRACT.md §5](docs/API-CONTRACT.md#5-changing-the-contract).
- **Show unavailable features honestly.** A control with nothing behind it is either
  hidden or clearly marked unavailable, never faked.
- Match the style of the surrounding code. The type scale uses the `--text-*`
  tokens; don't add raw font sizes.

## Commits

- One logical change per commit, with a message that says what and why.
  `Update Sidebar.tsx` tells a future reader nothing.
- Reference tracker IDs when there is one: `B-9: move nav into config`,
  `O-9: add web search backend`.
- Update [docs/PROJECT-TRACKER.md](docs/PROJECT-TRACKER.md) when something lands,
  is removed or is deferred.
