# LLM Chat Frontend Foundation

This repository is the starting point for a reusable AI chat frontend that can be extended for future projects instead of rebuilding the same base UI repeatedly.

The current foundation includes:

- a `React + TypeScript + Vite` frontend in [frontend](d:\#Code\VS Code\llm-chat-frontend\frontend)
- a minimal `FastAPI` backend in [backend](d:\#Code\VS Code\llm-chat-frontend\backend)
- a root-level `Docker Compose` setup for running frontend and backend together
- a Python `requirements.txt` and local `.venv` workflow for backend utilities, scripts, and API development
- a repo-level `.gitignore` to keep generated frontend files and local environments out of version control

## Current Stack

- Frontend: `React 18`, `TypeScript`, `Vite`
- Backend: `FastAPI`, `Pydantic`, `Uvicorn`
- Containerization: `Docker`, `Docker Compose`
- Python tooling: `httpx`, `pytest`, `ruff`

## Repository Layout

```text
.
|-- docs/
|   `-- base-frontend-report.md
|-- backend/
|   |-- app/
|   |-- Dockerfile
|   `-- .dockerignore
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

The frontend is already wired to call the backend at `http://localhost:8000`.

## Local Development

### Frontend only

From the `frontend` folder:

```bash
npm install
npm run dev
```

### Backend only

From the repository root:

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

macOS / Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

API endpoints:

```text
GET  http://localhost:8000/health
GET  http://localhost:8000/models
POST http://localhost:8000/chat
GET  http://localhost:8000/docs
```

### Frontend build

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

### Development stack

Start frontend and backend together in Docker:

```bash
docker compose up --build
```

Then open:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
Docs:     http://localhost:8000/docs
```

### Production-style container

Build and run the backend plus the optimized static frontend with Nginx:

```bash
docker compose --profile prod up --build backend frontend-prod
```

Then open:

```text
Frontend: http://localhost:8080
Backend:  http://localhost:8000
```

## Included Docker Setup

The Docker setup provides:

- a `backend` container running `FastAPI + Uvicorn`
- a `development` frontend image for Vite dev server usage
- a `production` image that builds the app and serves it through `Nginx`
- SPA-friendly routing via `nginx.conf`

## Python Requirements Included

The `requirements.txt` is intentionally small and focused on the starter backend plus common future needs:

- `fastapi` for the API layer
- `uvicorn` for API serving
- `pydantic` for typed validation
- `python-multipart` for file uploads
- `httpx` for calling model/provider APIs
- `pytest` and `pytest-asyncio` for tests
- `ruff` for linting

## Suggested Next Steps

1. Keep the frontend and backend running together in Docker for day-to-day development.
2. Replace the seeded backend logic with a real provider adapter layer.
3. Move toward a normalized API contract for chat, projects, files, artifacts, and streaming.
4. Add persistence, authentication, and provider configuration once the UI flow is stable.
