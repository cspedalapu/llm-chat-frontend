# Starting a New Product From This Base

Every new chat-shaped product starts here: a research tool, a support assistant, an
internal copilot. You keep the interface, replace or extend the backend, and adjust
the UI through config and extensions instead of rewriting components.

The running example below is a **research tool**. Swap in your own product as you
read.

---

## 1. Create the fork, linked to the base

Keep the base as an `upstream` remote, so improvements made here keep flowing into
your product.

```bash
# On GitHub: "Use this template" or "Fork" into e.g. research-tool, then:
git clone https://github.com/<you>/research-tool.git
cd research-tool
git remote add upstream https://github.com/cspedalapu/llm-chat-frontend.git
git fetch upstream
```

Without GitHub's fork button:

```bash
git clone https://github.com/cspedalapu/llm-chat-frontend.git research-tool
cd research-tool
git remote rename origin upstream
git remote add origin https://github.com/<you>/research-tool.git
git push -u origin main
```

Check that everything is green before you change anything. See
[CONTRIBUTING.md](../CONTRIBUTING.md#health-checks).

## 2. Rebrand: one file

Edit **`frontend/src/app.config.ts`**:

```ts
brand: {
  name: "Research Desk",
  description: "Evidence-first research assistant.",
  workspaceLabel: "Research",
  accountName: "Personal",
},
copy: {
  emptyStateTitle: "What should we research?",
  emptyStatePrompts: ["Market sizing", "Literature review", "Competitor scan"],
  composerPlaceholder: "Ask a research question",
  ...
},
```

The page title and meta description in `index.html` come from here at build time.
To change the logo, replace `LogoIcon` in `components/icons.tsx`. To change the main
colours (background, surfaces, borders, text), edit the `:root` tokens at the top of
`styles.css`. Some accent colours are still hard-coded further down the file.

## 3. Choose the features

In the same file:

- **`nav`**: reorder, rename or remove entries. Set `enabled: false` to hide an item
  without deleting it. Add entries with your own `key` (see step 5).
- **`requires`**: an item is shown only if the backend advertises that capability.
- **`features.placeholderPages`**: shows the base's "not connected" roadmap tabs.
  Leave it off in a real product.
- **`features.placeholderTools`**: shows the disabled entries in the composer "+"
  menu.

## 4. Decide what to do with the backend

Pick one path. The UI works with all three, because it only depends on
[API-CONTRACT.md](API-CONTRACT.md).

| Path | When | How |
|---|---|---|
| **A. Extend** `backend/app` | Your product is still a multi-provider chat at heart | Add routes and modules next to the existing ones |
| **B. Replace** from the minimal backend | Different engine: an agent pipeline, retrieval over your corpus, a different language | Start from `examples/minimal_backend/app.py`, change `reply()`, add capabilities one at a time |
| **C. Proxy** | The real engine already exists as a service | A thin backend that speaks the contract and forwards calls |

Whichever you pick, prove compatibility:

```bash
uvicorn <your app> --port 8000
CONTRACT_BASE_URL=http://127.0.0.1:8000 python -m pytest backend/tests/test_contract.py -q
```

Advertise exactly what you implement in `GET /workspace` → `capabilities`. The UI
hides everything else. If your backend lives somewhere other than `backend/`, point
`backend` in `docker-compose.yml` and the `webServer` commands in
`frontend/playwright*.config.ts` at it.

## 5. Add product UI through `frontend/src/extensions/`

Put fork code in `extensions/` (in sub-folders if you like) and register it in
`extensions/index.ts`. Core components read these registries, so you don't edit them.

### A new page

```tsx
// extensions/research/ResearchPage.tsx
import type { ExtensionPageProps } from "@/extensions";
import { api } from "@/lib/chatClient";

export function ResearchPage({ data, openChat }: ExtensionPageProps) {
  return <section className="feature-page"><h1>Research jobs</h1>…</section>;
}
```

```ts
// extensions/index.ts
import { ResearchPage } from "./research/ResearchPage";
export const pages: Record<string, ExtensionPage> = { deep_research: ResearchPage };
```

The nav entry with `key: "deep_research"` now opens your page. A registered page is
shown even though the entry is marked `placeholder`. Use a new key for a new nav
entry, and add an icon to `navIcons` if you need one.

### Extra data under each answer

The backend adds fork data to the assistant message's result:

```json
"result": { "extensions": { "research": { "confidence": 0.8, "queries": ["…"] } } }
```

The frontend renders it with a message add-on:

```tsx
export const messageAddons: MessageAddon[] = [{
  id: "research",
  render: message => {
    const info = message.result?.extensions?.research as { confidence: number } | undefined;
    return info ? <p className="muted">Confidence {Math.round(info.confidence * 100)}%</p> : null;
  },
}];
```

### A composer tool

```ts
export const composerTools: ComposerTool[] = [
  { id: "template", label: "Insert research template",
    run: ({ draft, setDraft }) => setDraft(draft + "\nQuestion:\nScope:\nSources to prefer:") },
];
```

### Sending extra options with each message

`useWorkspace.send()` builds the generate body. Add your field there, then read it in
the backend. Backends ignore unknown fields, so the base stays compatible.

## 6. Add authentication (if the product leaves localhost)

1. **Backend:** implement `authenticate()` in `backend/app/auth.py`. Return a user
   dict, or `None` to answer 401. Read it in routes with `request.state.user`.
2. **Frontend:** return the credentials header from `authHeaders()` in
   `frontend/src/extensions/auth.ts`, or rely on a same-origin cookie. Handle
   `onUnauthorized()` by redirecting to sign-in.
3. Set `CHAT_ALLOWED_HOSTS` and `CHAT_ALLOWED_ORIGINS` for your domain.
4. Scope stored data per user. The base store is single-tenant.

## 7. Keep receiving base updates

```bash
git fetch upstream
git merge upstream/main      # conflicts stay small if you followed the rules below
```

**Change these freely in a fork:** `app.config.ts`, everything under `extensions/`,
`styles.css` `:root` tokens, `LogoIcon`, your backend.

**Avoid editing these in a fork.** Fix them in the base instead, then merge:
`App.tsx`, `hooks/`, `lib/`, `components/` (except the logo), `types.ts`,
`backend/tests/test_contract.py`, `docs/API-CONTRACT.md`.

If you find yourself editing a shared file because an extension point is missing,
add the extension point to the base. Every other fork then gets it too.

## 8. Checklist for a new fork

- [ ] `upstream` remote points at the base
- [ ] `app.config.ts`: brand, copy and nav updated
- [ ] Backend chosen (A, B or C) and passes the contract test
- [ ] `capabilities` list matches what is actually implemented
- [ ] Product UI lives in `extensions/`
- [ ] Auth done, if deployed beyond localhost
- [ ] README rewritten for the product, with a link back to the base
- [ ] CI green
