# LLM Workspace: the base for chat-shaped products

A complete AI chat workspace, built to be **forked**. Every new product (a research
tool, a support assistant, an internal copilot) starts from this repo. It keeps the
same interface and swaps or extends the backend underneath.

- **Works today:** multi-provider streaming chat, projects, cited document
  retrieval, search, saved assistants, usage and cost tracking. See [Features](#features).
- **Swappable backend:** the UI depends only on a documented
  [API contract](docs/API-CONTRACT.md). A contract test proves any backend
  compatible, and a 150-line [minimal backend](examples/minimal_backend/app.py)
  shows the smallest one that works.
- **Mouldable UI:** rebrand and reshape in [one config file](frontend/src/app.config.ts);
  add pages, message add-ons and tools in [`extensions/`](frontend/src/extensions/)
  without touching core components.

**Starting a new product?** Read **[docs/FORKING.md](docs/FORKING.md)**.

---

## Features

| Area | What it does |
|---|---|
| Models | OpenAI-compatible (OpenAI, DeepSeek, OpenRouter, …), Anthropic, Gemini, Ollama. Streaming, per-message thinking effort, connection test. |
| Keys | Encrypted at rest (Fernet); never sent back to the browser. |
| Conversations | Rename, pin, archive, move to project, branch, edit in branch, regenerate, save answers, export to Markdown. |
| Projects | Instructions, memory and documents, injected into every project chat. |
| Documents | Upload text, Markdown, CSV, JSON, code and text PDFs; full-text retrieval with numbered citations. |
| Assistants | Reusable instructions and output formats. |
| Search | Full-text search across titles and messages. |
| Usage | Tokens, latency, estimated cost; daily request cap; burst limiter. |
| Resilience | Idempotent sends, stop with partial output saved, restart recovery, context-window packing. |

Nothing is mocked. With no model connection configured, the app asks you to add one.

## Quick start

**Docker** (simplest):

```bash
docker compose --profile dev up -d --build
```

Open http://localhost:5173 and choose **Model → + Add your model**. The backend API
docs are at http://localhost:8000/docs. For a production-style build behind nginx,
use `docker compose --profile prod up -d --build` and open http://localhost:8080.

**Without Docker:**

```bash
python -m venv .venv-dev
./.venv-dev/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# .venv-dev/bin/python -m pip install -r requirements.txt           # macOS / Linux
./.venv-dev/Scripts/python.exe -m uvicorn backend.app.main:app --port 8000

cd frontend && npm install && npm run dev                           # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://127.0.0.1:8000`. Override that with
`API_PROXY_TARGET`.

**Try the UI on the minimal backend** (no model provider needed):

```bash
./.venv-dev/Scripts/python.exe -m uvicorn app:app --app-dir examples/minimal_backend --port 8000
```

## Repository layout

```text
backend/app/            FastAPI backend: routes, generation, providers, store, auth hook
backend/tests/          behaviour tests, contract test, fake provider for e2e
examples/minimal_backend/  core-tier reference backend (in memory, echo model)
frontend/src/
  app.config.ts         brand, copy, feature flags, nav      <- forks edit this
  extensions/           fork pages, message add-ons, tools   <- fork code goes here
  components/ hooks/ lib/   the shared shell
frontend/tests/         Playwright suites (full features, core tier)
docs/                   contract, architecture, forking guide, tracker, roadmap
```

## Documentation

| Doc | For |
|---|---|
| [docs/FORKING.md](docs/FORKING.md) | Starting a new product from this base |
| [docs/API-CONTRACT.md](docs/API-CONTRACT.md) | What any backend must implement |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit; shell and domain |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup, health checks, where changes belong |
| [docs/PROJECT-TRACKER.md](docs/PROJECT-TRACKER.md) | Status, open items, gotchas |
| [docs/BASE-ROADMAP.md](docs/BASE-ROADMAP.md) | The plan that made this repo a base |

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `CHAT_DATA_DIR` | `./data` | SQLite database and `secret.key`. Back them up together. |
| `CHAT_ALLOWED_ORIGINS` | – | Extra CORS origins, comma-separated |
| `CHAT_ALLOWED_HOSTS` | – | Extra accepted `Host` values, for deploying beyond localhost |
| `VITE_API_BASE_URL` | `/api` | Frontend API base |
| `API_PROXY_TARGET` | `http://127.0.0.1:8000` | Vite dev/preview proxy target |

## Status and limits

- Single-user and local by design: local origins only, with a no-op auth hook. Before
  exposing a fork to a network, read the security section of
  [ARCHITECTURE.md](docs/ARCHITECTURE.md#security-model-base).
- The Images, Apps and Deep Research tabs are hidden placeholders
  (`features.placeholderPages`). Nothing is behind them yet.

## License

[MIT](LICENSE)
