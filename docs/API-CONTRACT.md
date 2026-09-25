# API Contract

Everything the frontend expects from a backend. Implement this and the UI works
without changes, whatever sits behind it: a different model provider, an agent
pipeline, a research engine, or a proxy to another service.

- **Version:** `1`. Reported by `GET /health` as `api_version`. It is bumped only for
  breaking changes to this document.
- **Executable form:** [`backend/tests/test_contract.py`](../backend/tests/test_contract.py).
  If this document and the test disagree, the test wins. Fix the document.
- **Reference implementations:**
  - [`examples/minimal_backend/app.py`](../examples/minimal_backend/app.py): core tier only, about 150 lines.
  - [`backend/app/`](../backend/app/): every capability.

```bash
# Check any running backend against the contract
CONTRACT_BASE_URL=http://127.0.0.1:8000 python -m pytest backend/tests/test_contract.py -q
```

---

## 1. Conventions

| Topic | Rule |
|---|---|
| Base path | The browser calls `/api/...`. The Vite dev server and nginx strip `/api` before proxying, so the backend serves routes at the root (`/health`, not `/api/health`). |
| Format | JSON request and response bodies, except file upload (multipart) and generation (SSE). |
| Errors | A non-2xx status with `{"detail": "<human-readable message>"}`. The UI shows `detail` as-is, so write it for end users. FastAPI validation errors (`detail` as a list) are also understood. |
| Client header | The frontend sends `X-Workspace-Client: local-chat` on every request. The base backend rejects writes that lack it, which blocks CSRF from other sites. Replacement backends should keep the check. |
| Auth | Headers from `frontend/src/extensions/auth.ts` are added to every request. Answer `401` when there is no valid identity; the UI calls `onUnauthorized()`. |
| IDs | Opaque strings. The UI never parses them. |
| Timestamps | ISO 8601 strings with a timezone, e.g. `2026-09-25T10:00:00+00:00`. |
| Unknown fields | Ignore unknown request fields. The UI sends optional fields (`document_ids`, `preset_id`, `reasoning`) whether or not you support them. Extra response fields are allowed and are passed through. |

---

## 2. Capabilities

`GET /workspace` returns `capabilities: string[]`. The **core tier** is always required.
Every other feature is optional. The UI hides its controls unless the capability is
listed. Unknown strings are allowed, so forks can add their own.

| Capability | Routes | UI shown only when listed |
|---|---|---|
| `models.manage` | `GET/POST /models`, `PATCH/DELETE /models/{id}`, `POST /models/{id}/test` | LLMs page, "+ Add your model" |
| `projects` | `POST /projects`, `PATCH/DELETE /projects/{id}` | Projects sidebar section, project pages, "Move to project" |
| `documents` | `POST /documents`, `GET/DELETE /documents/{id}` | Upload, Sources picker, Library documents, citations |
| `presets` | `POST /presets`, `PATCH/DELETE /presets/{id}` | Saved assistants, the preset picker in the composer |
| `search` | `GET /search` | Search chats page |
| `usage` | `GET /usage` | Usage section on the Workspace page |
| `settings` | `PATCH /settings` | Daily-limit setting |
| `branching` | `POST /conversations/{id}/branch` | Branch, edit in new branch, regenerate |
| `bookmarks` | `PATCH /conversations/{id}/messages/{messageId}` | "Save answer", Library saved answers |
| `cancel` | `POST /generations/{requestId}/cancel` | Server-side stop (without it, Stop just drops the stream) |
| `reasoning` | `reasoning` field on generate | Thinking-effort menu |

The nav entries in `frontend/src/app.config.ts` declare which capability they need
(`requires`).

---

## 3. Core tier (required)

### `GET /health`

```json
{ "status": "ok", "api_version": "1", "service": "any-name" }
```

Must answer without authentication, because load balancers and the e2e harness use it.

### `GET /workspace`

Everything the UI needs on load and after every change.

```json
{
  "capabilities": ["projects", "documents"],
  "models": [{ "id": "echo", "label": "Echo" }],
  "conversations": [Conversation, "..."],
  "projects": [], "documents": [], "presets": [],
  "settings": { "daily_request_limit": 200 }
}
```

- `capabilities`, `models` and `conversations` are required. The other keys can be
  left out; the UI defaults them to empty.
- A model needs only `id` and `label`. With `models.manage`, the full connection
  object is returned instead: `kind`, `base_url`, `model`, `has_key`,
  `context_tokens`, and so on. See `Provider` in `frontend/src/types.ts`. Never
  return secrets.
- Sort `conversations` newest first by `updatedAt`.

### Conversation and Message

```jsonc
// Conversation
{
  "id": "c1", "title": "New chat", "preview": "", "updatedAt": "<iso>",
  "model": "echo", "messages": [Message],
  "projectId": null, "archived": false, "pinned": false,  // optional
  "summary": "", "parentId": "c0"                          // optional
}
// Message
{
  "id": "m1", "role": "user" | "assistant", "text": "...", "timestamp": "<iso>",
  "state": "ready" | "streaming" | "error" | "cancelled" | "interrupted",  // assistant only; default "ready"
  "result": AssistantResult,                                              // assistant only, optional
  "saved": false, "documentIds": [], "presetId": null                     // optional
}
```

`AssistantResult`: every field is optional, and the UI shows what is present.

| Field | Shown as |
|---|---|
| `generationLabel` | Name above the reply |
| `generationModel`, `usage {input, output}`, `latencyMs`, `first_token_ms`, `estimated_cost`, `finish_reason` | "Response details" |
| `error` | Error text in the bubble |
| `sources: [{id, documentId, title, page, excerpt, number}]` | "Reference passages" |
| `context_note`, `source_note` | Muted notes |
| `request_id` | Used by Stop to cancel the right generation |
| `extensions: {<name>: any}` | Fork data, rendered by `extensions.messageAddons` |

### `POST /conversations`

Body (all fields optional): `{ "title": "New chat", "model": "echo", "projectId": null }`.
Returns the new `Conversation` with `messages: []`.

### `GET /conversations/{id}`

Returns the `Conversation`, or `404` if it doesn't exist.

### `PATCH /conversations/{id}`

Partial update. Any of `title`, `archived`, `pinned`, `summary`, `projectId`.
Returns the updated `Conversation`. Return `409` while a reply is streaming if you
cannot apply the change safely.

### `DELETE /conversations/{id}`

Returns `{"ok": true}`. After that, `GET` returns `404`.

### `POST /conversations/{id}/generate`

Request:

```json
{
  "request_id": "uuid from the client",
  "query": "user text",
  "model": "echo",
  "expected_message_count": 4,
  "document_ids": [], "preset_id": null, "reasoning": ""
}
```

Check these before starting the stream:

| Condition | Status |
|---|---|
| Conversation not found | `404` |
| `expected_message_count` ≠ current message count (another tab changed it) | `409` |
| Unknown model | `404` |
| Over a quota | `429` |

Otherwise respond `200` with `Content-Type: text/event-stream` and these events,
in this order:

```text
event: start
data: {"conversation": Conversation, "message_id": "<assistant message id>"}

event: delta            (zero or more)
data: {"text": "next chunk"}

event: done             (exactly one, always last)
data: {"state": "ready", "text": "<full text>", "result": AssistantResult, "message_id": "<same id>"}
```

- In `start`, `conversation` must already contain the new user message and an empty
  assistant message (`state: "streaming"`) with id `message_id`.
- The UI appends each `delta.text` to that message. `done` replaces the message's
  `state`, `text` and `result`.
- Failures after `start` are **not** HTTP errors: send `done` with `state: "error"`
  and `result.error`. Keep any partial text.
- If the client disconnects, treat it as a stop: save the partial text with
  `state: "cancelled"`.
- Comment lines (`: heartbeat`) are allowed at any time and keep proxies from
  timing out. The base backend sends one every 10 seconds.
- Once the stream ends, `GET /conversations/{id}` must return both messages,
  with the assistant text matching `done.text`.
- **Idempotency (recommended):** replaying the same `request_id` with the same body
  should return only `done` for the original message, not generate again. Reusing
  the id with a different body should return `409`.

---

## 4. Optional routes

Shapes as implemented by `backend/app/`. The contract test checks the parts listed.

| Route | Body | Returns |
|---|---|---|
| `GET /models` | – | `Provider[]` (no secrets) |
| `POST /models`, `PATCH /models/{id}` | `ProviderInput` (see `backend/app/contracts.py`) | `Provider` |
| `DELETE /models/{id}` | – | `{ok: true}` |
| `POST /models/{id}/test` | – | `{ok: true, detail}` or `502 {detail}` |
| `POST /projects`, `PATCH /projects/{id}` | `{title, instructions?, memory?, template?}` | `Project` |
| `DELETE /projects/{id}` | – | `{ok: true}`; its chats and documents are kept, with `projectId: null` |
| `POST /documents` | multipart `file`, optional `project_id` | `{id, name, projectId, pages, createdAt}` |
| `GET /documents/{id}` | – | document plus `chunks: [{id, page, text}]` |
| `DELETE /documents/{id}` | – | `{ok: true}` |
| `POST /presets`, `PATCH /presets/{id}` | `{title, instructions, model?, output_format?}` | `Preset` |
| `DELETE /presets/{id}` | – | `{ok: true}` |
| `GET /search?q=&archived=false` | – | `[{id, title, preview, archived, projectId}]` |
| `GET /usage` | – | `{requests, today, input_tokens, output_tokens, estimated_cost, unpriced_requests, recent[]}` |
| `PATCH /settings` | `{daily_request_limit}` | settings |
| `POST /conversations/{id}/branch` | `{message_id, include_message}` | new `Conversation` with `parentId` |
| `PATCH /conversations/{id}/messages/{messageId}` | `{saved: bool}` | `Conversation` |
| `POST /generations/{requestId}/cancel` | – | `{ok: true}`, including when nothing is running |

---

## 5. Changing the contract

- **Adding** an optional capability or an optional field is not breaking. Add it
  here, to `CAPABILITIES` in `backend/app/main.py` and `frontend/src/lib/capabilities.ts`,
  and to the contract test.
- **Changing or removing** anything in the core tier is breaking: bump
  `API_VERSION`, note it in the README, and give forks a migration note.
- Fork-only features belong in fork-named capabilities (e.g. `research.jobs`), so
  they never clash with the base.
