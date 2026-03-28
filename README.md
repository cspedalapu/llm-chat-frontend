# LLM Chat Frontend Foundation

This repository is the starting point for a reusable AI chat frontend that can be extended for future projects instead of rebuilding the same base UI repeatedly.

The current foundation includes:

- a `React + TypeScript + Vite` frontend in [frontend](d:\#Code\VS Code\llm-chat-frontend\frontend)
- a root-level `Docker Compose` setup for containerized development and production-style serving
- a Python `requirements.txt` and local `.venv` workflow for future backend utilities, scripts, and tooling
- a repo-level `.gitignore` to keep generated frontend files and local environments out of version control

## Current Stack

- Frontend: `React 18`, `TypeScript`, `Vite`
- Containerization: `Docker`, `Docker Compose`
- Future Python tooling/backend foundation: `FastAPI`, `Uvicorn`, `Pydantic`, `httpx`, `pytest`, `ruff`

## Repository Layout

```text
.
|-- docs/
|   `-- base-frontend-report.md
|-- frontend/
|   |-- src/
|   |-- Dockerfile
|   |-- .dockerignore
|   |-- .env.example
|   |-- nginx.conf
|   `-- package.json
|-- .gitignore
|-- docker-compose.yml
|-- README.md
`-- requirements.txt
```

## Files Intentionally Ignored

The repo ignores generated or local-only files such as:

- `frontend/node_modules/`
- `frontend/dist/`
- `*.log`
- `.venv/`
- Python cache files
- local `.env` files
- TypeScript build info files

This keeps the repository cleaner and prevents large or machine-specific files from being committed.

## Environment Variables

Frontend variables live in the `frontend` app.

Start with:

```bash
cp frontend/.env.example frontend/.env
```

Example:

```env
VITE_API_BASE_URL=http://localhost:8000
```

If you are only working on the UI for now, you can leave `VITE_API_BASE_URL` empty and the frontend will fall back to mock behavior if the app supports it.

## Local Frontend Development

From the `frontend` folder:

```bash
npm install
npm run dev
```

Build locally:

```bash
npm run build
```

## Python Virtual Environment

The repo also includes a Python requirements file for future backend scripts, automation, and API scaffolding.

Create a local virtual environment at the repo root:

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

macOS / Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Docker Usage

### Development container

Start the frontend in Docker with live reload:

```bash
docker compose up --build frontend
```

Then open:

```text
http://localhost:5173
```

### Production-style container

Build and run the optimized static frontend with Nginx:

```bash
docker compose --profile prod up --build frontend-prod
```

Then open:

```text
http://localhost:8080
```

## Included Docker Setup

The Docker setup provides:

- a `development` image for Vite dev server usage
- a `production` image that builds the app and serves it through `Nginx`
- SPA-friendly routing via `nginx.conf`

## Python Requirements Included

The `requirements.txt` is intentionally small and focused on common future needs:

- `fastapi` for a future API layer
- `uvicorn` for local API serving
- `pydantic` for typed validation
- `python-multipart` for file uploads
- `httpx` for calling model/provider APIs
- `pytest` and `pytest-asyncio` for tests
- `ruff` for linting

## Suggested Next Steps

1. Keep the frontend in Docker for day-to-day development.
2. Add a backend service later if you want the frontend to talk to a real provider adapter.
3. Move toward a normalized API contract for chat, projects, files, artifacts, and streaming.
4. When ready, add an API container to `docker-compose.yml` and wire `VITE_API_BASE_URL` to it.
