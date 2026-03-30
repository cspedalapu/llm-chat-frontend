# LLM Workspace Frontend Foundation

This repository is a reusable AI workspace foundation built for chat-first SaaS products. It combines a React frontend, a minimal FastAPI backend, and Docker-based local development so new products can start from a working shell instead of rebuilding the same app structure each time.

## Current Product Shape

The app already includes a substantial workspace shell:

- a left navigation rail with `New chat`, `Search chats`, `Images`, `Library`, `Apps`, `Deep Research`, `Workspace`, and `LLMs`
- a chat workspace with a centered conversation thread and composer actions
- a project system with create, rename, and project-specific workspace views
- `Your Chats` and `Projects` sections in the sidebar
- a model-management flow with `Add your Model`
- placeholder product pages for non-chat workspaces
- a backend API contract for `health`, `models`, and `chat`

The backend is intentionally still a starter implementation. It returns a placeholder response until a real provider such as OpenAI, Anthropic, Gemini, DeepSeek, Kimi, or a local model is connected.

## Tech Stack

- Frontend: `React 18`, `TypeScript`, `Vite`
- Backend: `FastAPI`, `Pydantic`, `Uvicorn`
- Local Python tooling: `httpx`, `pytest`, `pytest-asyncio`, `ruff`
- Containers: `Docker`, `Docker Compose`

## Repository Layout

```text
.
|-- backend/
|   |-- app/
|   |-- .dockerignore
|   `-- Dockerfile
|-- docs/
|   `-- base-frontend-report.md
|-- frontend/
|   |-- src/
|   |-- .dockerignore
|   |-- .env.example
|   |-- Dockerfile
|   |-- nginx.conf
|   `-- package.json
|-- docker-compose.yml
|-- README.md
`-- requirements.txt
```

## Quick Start

### 1. Frontend local development

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### 2. Backend local development

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

macOS / Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at `http://localhost:8000`.

### 3. Full stack with Docker

```bash
docker compose up -d --build
```

Available URLs:

- Frontend dev server: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`

### 4. Production-style frontend preview

```bash
docker compose --profile prod up -d --build backend frontend-prod
```

Available URLs:

- Frontend via Nginx: `http://localhost:8080`
- Backend API: `http://localhost:8000`

## Environment Variables

Frontend environment variables live in `frontend/.env`.

Start from:

```bash
cp frontend/.env.example frontend/.env
```

Current frontend variable:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Backend API Endpoints

- `GET /health`
- `GET /models`
- `POST /chat`
- `GET /docs`

Current backend behavior:

- `/models` returns the starter list of available models
- `/chat` returns a placeholder assistant response until a real model provider is wired in

## Docker Files

This repo includes two Dockerfiles:

- [`backend/Dockerfile`](./backend/Dockerfile): builds the FastAPI backend image
- [`frontend/Dockerfile`](./frontend/Dockerfile): supports both Vite development and Nginx production builds

The root [`docker-compose.yml`](./docker-compose.yml) ties them together for local development and production-style preview.

## Python Requirements

The root [`requirements.txt`](./requirements.txt) is for the backend and local Python tooling only. It does not manage frontend dependencies.

It currently includes:

- backend runtime dependencies
- file-upload support
- HTTP client utilities for future provider integrations
- test tooling
- lint tooling

## Current Limitations

- no real LLM provider is connected yet
- authentication is not implemented yet
- persistence is not implemented yet
- several workspace pages are still placeholder pages with product copy

## Notes

- The project path currently contains `#`, and Vite warns that this can cause issues in some environments.
- The frontend and backend are ready for UI iteration, API contract work, provider integration, and future SaaS features such as auth, storage, and organization-level workflows.
