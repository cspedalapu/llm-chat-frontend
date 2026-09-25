# Research Tab: Plan

**Goal:** one tab dedicated to research, and only research. The user asks a question,
picks the models and sources, approves a plan, watches the research happen, and
gets a cited report. The same tab is where research tools are connected (web
search, academic databases, Google, Microsoft, Excel, custom tools) and where
every call to an external tool is tracked.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` dropped
**IDs:** `R-n` for tasks, `DR-n` for decisions. Use them in commit messages.
**Created:** 2026-09-25 · **Status:** draft for review · **Owner:** Chandrasekhar

---

## 1. What the industry does (research summary, Sept 2026)

Researched from official docs where reachable. Some app-UI details were only
confirmable from secondary sources; those are marked *(unverified)*.

| | ChatGPT (OpenAI) | Claude (Anthropic) | Gemini (Google) | Grok (xAI) | DeepSeek | Perplexity |
|---|---|---|---|---|---|---|
| How you start | Deep research in the + tools menu | + → Research toggle | Deep Research button | Mode picker (Expert/Heavy) *(unverified)* | Search + DeepThink toggles | Research mode selector |
| Clarify / plan | Clarifying questions → **editable plan** | Plans internally, no approval step | **Editable plan → "Start research"** | None | None | None *(unverified)* |
| While running | Live progress; **interrupt and steer** | Parallel searches, stop anytime | Steps, sites browsed | Thinking trace + sources | Reasoning trace | Steps + sources |
| Run length | 5–30 min, background, notifies | 5–15 min, up to 45 (Advanced) | 5–10 min | ~2 min *(unverified)* | Seconds | 2–4 min |
| Output | Report + TOC, citations, PDF/DOCX | Report, inline citations | Canvas report → Docs, audio | Cited answer | Cited answer | Report → PDF/MD/Page |
| Sources | Web, chosen sites, files, apps, MCP | Web, Google Workspace, M365, MCP | Web, Gmail, Drive, Chat, files | Web + **X posts** | Web | Web / **Academic** / Social / Finance |
| Connectors | Drive, SharePoint, Box, Dropbox, GitHub, Teams, Outlook, custom MCP | Gmail, Calendar, Drive, M365, directory + custom MCP | Workspace | Collections (API) | None | Drive, OneDrive, SharePoint, Box, Dropbox |
| Tool permissions | Admin: all / read-only / custom; writes need confirm | **Always allow / Needs approval / Blocked**, admin ceiling | – | – | – | – |

**How they are built** (from the engineering write-ups and API docs):

- **Multi-agent research:** Claude uses a lead agent that writes a plan, runs 3–5
  sub-researchers in parallel, and then a separate citation pass. It uses about 15× the
  tokens of a chat. Depth scales with the question: a simple fact takes 3–10 tool calls,
  complex topics use 10+ sub-agents.
- **Plan approval is the differentiator.** OpenAI (in the app) and Gemini (in the
  app and the API, `collaborative_planning`) let the user edit the plan before spending
  minutes and money.
- **Runs are background jobs.** Every vendor runs long research asynchronously, with a
  resumable event stream or polling, cancel, and a completion notice.
- **Tools come in over MCP** (Model Context Protocol). ChatGPT and Claude both accept
  custom remote MCP servers. Current spec: Streamable HTTP and OAuth 2.1 with PKCE.
- **Research is read-only.** OpenAI lets research use custom tools for search and fetch
  only; Claude requires approval for writes by default.
- **Dedicated research models are fading.** OpenAI retired `o3-deep-research` and
  `o4-mini-deep-research` on 2026-07-23 and recommends a reasoning model plus a search
  tool. Gemini offers an async Deep Research agent; DeepSeek has no hosted search.
  **So we run our own research loop, which works with any model we support.**
- **Known weaknesses to design against:**
  - prompt injection from web and connector content
  - hallucinated or misattributed citations
  - preferring SEO pages over authoritative sources
  - over-spending on simple questions
  - runs that can't be reproduced

**Search tool prices seen (per 1,000 searches):**

| Provider | Price per 1,000 |
|---|---|
| Perplexity Search API | $5 (fast mode $1) |
| Grok web search | $5 |
| Claude web search | $10 |
| Gemini search grounding | $14 (after 5,000 free a month) |
| Tavily, Brave, Exa, SearXNG | not yet verified |

---

## 2. What we will build

### The Research tab

It replaces the existing "Deep Research" placeholder. It's a nav item, can be hidden
in Customize, and shows only when the backend reports the `research` capability.

```text
┌──────────────┬─────────────────────────────────────────────┬──────────────────┐
│ Research     │  New research                               │ Tools            │
│ history      │  ┌───────────────────────────────────────┐  │ ● Web search  ✓  │
│              │  │ What do you want to research?         │  │ ● arXiv       ✓  │
│ ● Running    │  └───────────────────────────────────────┘  │ ● Your library ✓ │
│   EV market  │  Depth: Quick · Standard · Deep             │ ○ Google Drive   │
│ ✓ Thesis lit │  Model: [Claude …▾]  Writer: [same ▾]       │   Connect        │
│ ✓ Competitor │  Sources: [Web] [Academic] [Library] [+]    │ ○ OneDrive/Excel │
│              │  ☑ Show me the plan first                   │   Connect        │
│              │                        [Start research]     │                  │
│              │                                             │ Calls today: 42  │
│              │                                             │ Manage tools →   │
└──────────────┴─────────────────────────────────────────────┴──────────────────┘
```

A run goes through five screens in the centre column:

1. **Ask:** the question, depth, model(s), sources, and "plan first".
2. **Clarify** (optional, 0–3 questions): only when the question is ambiguous.
3. **Plan review:** editable list of sub-questions and the sources for each. Add,
   remove or reword, then **Start** or **Cancel**. Cost and time estimate shown.
4. **Live run:** a timeline of steps (searching "…", reading *page title*, calling
   *tool*). It shows counters for sources found, sources read and tool calls, plus the
   elapsed time and budget. **Stop** and **Add instruction** steer the run mid-way. The
   run keeps going if you leave the tab.
5. **Report:** table of contents, inline `[n]` citations, and a sources panel
   (cited vs. consulted, with a flag on citations that failed verification). Export as
   Markdown / DOCX / PDF, **Continue in chat**, or **Re-run**.

The **Tools** panel on the right shows each connected tool: status (connected, needs
sign-in, error), last used, and call count. **Manage tools** opens the tools directory.

### Tools and connectors

All tools implement one internal interface: `search`, `fetch` or `read`, plus a
description of what they can access. Research only ever calls **read** tools.

| Tool | Type | Needs from you |
|---|---|---|
| Web search | Built-in adapter, pick one provider (DR-1) | API key |
| Web page reader | Built-in fetch + text extraction (HTML, PDF) | – |
| Your library | Built-in, reuses our document search | – |
| arXiv, OpenAlex, Semantic Scholar, PubMed | Built-in academic adapters (free public APIs) | – |
| Excel / CSV | Built-in: read sheets as tables, summary stats | – |
| Google Drive / Docs / Sheets | OAuth connector, read-only scopes (DR-4) | Google OAuth client |
| Microsoft OneDrive / SharePoint / Excel | OAuth connector via Microsoft Graph, read-only (DR-4) | Azure app registration |
| Google Cloud | Needs clarifying (DR-3) | – |
| **Any other tool** | **Custom remote MCP server**: paste a URL, sign in | The server URL |

- **Permissions:** each tool is set to *Always allow*, *Ask each time* or *Blocked*.
  Write-capable tools are blocked in research.
- **Tracking:** every tool call is logged with run, tool, query, status, time and cost
  estimate. It shows up in the live timeline, the Tools panel and the Usage page.

### Models

- **Per run:** you pick the research model and, optionally, a separate writer model
  for the final report (e.g. cheap and fast for searching, strong for writing).
- **Only tool-capable models are offered.** Each model connection gets a tested
  "supports tools" flag. OpenAI-compatible (OpenAI, DeepSeek, Grok, OpenRouter),
  Anthropic and Gemini all support tool calling; Ollama only for models that do.

### How a run works (backend)

```text
clarify? → plan (editable) → research loop ×N in parallel → synthesize → verify citations
               │                    │                                    │
               └── user approves    └── search / fetch / read tools      └── flags unsupported [n]
```

- **Depth sets the budget:**

  | Depth | Sub-questions | Tool calls | Minutes |
  |---|---|---|---|
  | Quick | 1 | ≤10 | ~2 |
  | Standard | 3 | ≤40 | ~8 |
  | Deep | 5+ | ≤120 | ~20 |

  A cost cap is also configurable.
- **Background task:** the run is saved in SQLite as it goes, so it survives a page
  reload. A server restart marks it *interrupted*, as chat already does.
- **Events:** an SSE stream with sequence numbers, so a dropped connection resumes
  where it stopped.
- **Untrusted content:**
  - Fetched content is treated as data, never as instructions.
  - Only URLs from search results or supplied by you are fetched (the same
    anti-exfiltration rule Claude uses).
  - You can allow or block domains.
- **Citation verification:** each `[n]` must point to text we actually fetched;
  unsupported ones are flagged, never silently kept.

### Contract

Research is a new **optional capability** (`research`, plus `research.connectors`).
Backends without it simply don't show the tab. That keeps it in line with the base: any
fork can turn it off, and a research-focused fork can build on it.

New routes (documented in API-CONTRACT.md and covered by the contract test):

| Route | Purpose |
|---|---|
| `GET/POST /research/runs`, `GET /research/runs/{id}` | List, start, read a run |
| `POST /research/runs/{id}/plan` | Edit or approve the plan |
| `POST /research/runs/{id}/steer`, `/cancel` | Add instruction, stop |
| `GET /research/runs/{id}/events?after=` | Resumable SSE progress stream |
| `GET /research/runs/{id}/export?format=md\|docx\|pdf` | Export the report |
| `GET/POST /connectors`, `PATCH/DELETE /connectors/{id}` | Tools directory, add custom MCP, permissions |
| `GET /connectors/{id}/auth/start`, `/connectors/oauth/callback` | OAuth sign-in |
| `POST /connectors/{id}/test`, `GET /tool-calls?run_id=` | Health check, call log |

---

## 3. Decisions needed

Each has a recommendation; confirm or change.

| # | Question | Recommendation | Answer |
|---|---|---|---|
| DR-1 | Web search provider | **Pluggable, start with one paid API** (Tavily, Brave or Perplexity Search; prices to verify) **plus SearXNG** as a free self-hosted option. Our own search tool works for every model, including DeepSeek. | |
| DR-2 | Build it in the base or in a fork? | **Base, as an optional capability.** Research is useful to most products; forks can switch it off. | |
| DR-3 | "Google Cloud" means… | Google **Drive / Docs / Sheets** (Workspace)? Or **GCP** data (BigQuery, Cloud Storage)? | |
| DR-4 | Google and Microsoft: official MCP servers or direct APIs? | **Direct read-only APIs first** (Drive API, Microsoft Graph). The reference Google Drive MCP server is archived. Use MCP for everything else. | |
| DR-5 | Excel depth | **Read and summarise first** (sheets → tables, stats). Running code on data (charts, analysis) comes later, sandboxed. | |
| DR-6 | Default depth budgets | As in §2 (Quick / Standard / Deep). | |
| DR-7 | First milestone scope | **M1 = web + academic + library + Excel upload.** Google and Microsoft follow in M2. | |

**Needed from you before the matching phase starts:**
- a search API key (DR-1)
- a Google OAuth client ID and secret (Phase 5)
- an Azure app registration (Phase 5)
- 5–10 real research questions you care about, used as the test set

---

## 4. Tasks

### Phase 1: Foundations (the model can use tools)
- [ ] **R-1 Tool calling in `providers.py`** for OpenAI-compatible, Anthropic, Gemini and
  Ollama. Normalise tool calls and results; stream text and tool events. Add a
  "supports tools" check to *Test connection*.
- [ ] **R-2 Tool interface and registry** (`backend/app/tools/`): search/fetch/read kinds,
  a read/write flag, the JSON schema given to the model, an execution timeout.
- [ ] **R-3 Web search adapter** (DR-1) plus a **fetch-and-extract** tool (HTML → text,
  PDF), with domain allow/block lists.
- [ ] **R-4 Library tool:** expose our existing document search to research.
- [ ] **R-5 Tool-call log:** a `tool_calls` table (run, tool, query, status, latency, cost),
  written for every call.

### Phase 2: Research engine
- [ ] **R-6 Data model and lifecycle:** `research_runs`, `research_steps`,
  `research_sources`; background task; restart recovery.
- [ ] **R-7 Clarify and plan:** optional clarifying questions; an editable plan; approve
  or cancel.
- [ ] **R-8 Research loop:** parallel sub-researchers with the depth budgets (calls,
  time, cost); notes tied to source IDs.
- [ ] **R-9 Report writing and citation check:** the writer model builds the report from
  the notes with `[n]` citations; each citation is verified against fetched text.
- [ ] **R-10 Live events, steer, cancel:** resumable SSE stream; "Add instruction" is
  applied at the next step.
- [ ] **R-11 Tests:** fake model plus fake search in pytest; contract routes; budget and
  cancel cases.

### Phase 3: The Research tab (first usable version, M1)
- [ ] **R-12 Page and history:** three-column layout; run list with status; phone layout.
- [ ] **R-13 New research form:** question, depth, research and writer models
  (tool-capable only), source chips, plan-first switch.
- [ ] **R-14 Plan review:** edit, reorder, add or remove sub-questions; estimate; start.
- [ ] **R-15 Live timeline:** steps, counters, budget bar, Stop, Add instruction.
- [ ] **R-16 Report view:** table of contents, citations, sources panel with verification
  flags; export as MD, DOCX and PDF.
- [ ] **R-17 Continue in chat:** open a normal chat seeded with the report; "Research
  this" in the chat composer's + menu hands a question to the tab.
- [ ] **R-18 e2e tests** for the full flow against the fake model and fake search.

### Phase 4: Tools and tracking
- [ ] **R-19 Tools directory:** built-in tools plus connected ones, with status, what each
  can read, and enable/disable.
- [ ] **R-20 Custom remote MCP:** add by URL; list its tools; mark read vs write.
- [ ] **R-21 OAuth 2.1 with PKCE** for MCP and OAuth connectors; tokens encrypted with
  the existing key store.
- [ ] **R-22 Permissions:** Always allow / Ask each time / Blocked per tool; writes
  blocked in research.
- [ ] **R-23 Tracking panel:** per-tool calls, errors and cost; totals on the Usage page.

### Phase 5: Integrations
- [ ] **R-24 Academic:** arXiv, OpenAlex, Semantic Scholar, PubMed adapters; an
  "Academic" source chip.
- [ ] **R-25 Excel/CSV:** upload or pick from the library; sheets become tables; summary
  stats for the model (DR-5).
- [ ] **R-26 Google Drive / Docs / Sheets**, read-only (DR-3, DR-4).
- [ ] **R-27 Microsoft OneDrive / SharePoint / Excel** via Graph, read-only (DR-4).
- [ ] **R-28 Google Cloud** as clarified in DR-3.

### Phase 6: Quality and safety
- [ ] **R-29 Evaluation set:** your 5–10 questions, re-run after every change. Checks
  citation accuracy, sources used, cost and time.
- [ ] **R-30 Prompt-injection hardening:** content marking, fetch rules, a test with a
  malicious page.
- [ ] **R-31 Docs:** API contract, FORKING (how a fork adds a research tool), user help.

### Milestones

| Milestone | Tasks | You can… |
|---|---|---|
| **M1** | R-1 – R-18, R-24, R-25 | Run cited web, academic, library and Excel research in the tab |
| **M2** | R-19 – R-23 | Connect any MCP tool, set permissions, see all tool activity |
| **M3** | R-26 – R-28 | Research across Google and Microsoft files |
| **M4** | R-29 – R-31 | Rely on it: measured quality, hardened, documented |

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Our provider layer has no tool calling today | R-1 comes first; it's the foundation for everything else |
| Cost runs away on Deep runs | Hard budgets per depth, estimate on the plan screen, live budget bar |
| Wrong or invented citations | Citation check pass (R-9), flagged in the UI, measured in R-29 |
| Prompt injection from web and connector content | Read-only tools, content marking, fetch rules, domain lists (R-30) |
| Google and Microsoft OAuth setup friction | Clear setup guide; M1 doesn't depend on them |
| Single-user store (O-12) | Fine locally; per-user tokens are needed before multi-user deployment |

## Log

| Date | Change |
|---|---|
| 2026-09-25 | Plan drafted from research into OpenAI, Anthropic, Google, xAI, DeepSeek, Perplexity. |
