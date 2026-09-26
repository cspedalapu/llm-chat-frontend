# Research: Setup and How It Works

The **Research** tab runs planned, cited research. It proposes a plan, researchers use
tools to find and read sources, and a writer produces a report in which every `[n]` is
checked against the text that was actually retrieved.

This guide is for whoever runs the app (operator) and whoever uses it (user). The
design and roadmap are in [RESEARCH-PLAN.md](RESEARCH-PLAN.md); the API is in
[API-CONTRACT.md §5](API-CONTRACT.md#5-research).

---

## 1. What you need

| Item | Needed for | Where |
|---|---|---|
| A model that supports **tool use** | Every run | LLMs → Add model → **Test connection** (it reports "Tool use: yes") |
| A web search provider | The *Web search* source | Research → Manage tools → Web search |
| Nothing | *Academic papers*, *Your library* | Ready out of the box |
| Google / Microsoft OAuth apps | Drive / OneDrive sources | Server environment variables (§3) |

Models that work: OpenAI-compatible (OpenAI, DeepSeek, xAI Grok, OpenRouter, …),
Anthropic, Gemini, and Ollama models that support tools. A model that fails the tool-use
test isn't offered for research.

## 2. Web search

Pick one provider under **Manage tools → Web search**.

| Provider | Cost | Setup |
|---|---|---|
| **SearXNG** | Free, self-hosted | Run it, enable the JSON format, enter its URL |
| **Tavily** | Paid API, free tier | Paste the API key |
| **Brave Search** | Paid API | Paste the API key |

Running SearXNG next to the app:

```yaml
# docker-compose.override.yml
services:
  searxng:
    image: searxng/searxng:latest
    ports: ["127.0.0.1:8888:8080"]
    volumes: ["./searxng:/etc/searxng"]   # settings.yml must list `json` under search.formats
```

Then enter `http://searxng:8080` as the URL (from the backend container). SearXNG is on a
private network, so set `RESEARCH_ALLOW_PRIVATE_NETWORK=1`. Understand what that does
first (§6).

Optional settings:
- **Price per 1,000 searches:** used for the cost column in tracking.
- **Only these sites / Never these sites:** applied to search results and page reads.

## 3. Google Drive and Microsoft 365 (operator)

Both are read-only. Each user signs in with their own account; tokens are stored encrypted.

Redirect URL to register with both providers:

```
<CHAT_PUBLIC_URL>/api/connectors/oauth/callback      e.g. http://localhost:5173/api/connectors/oauth/callback
```

**Google Drive**
1. Google Cloud Console → create a project → enable the **Google Drive API**.
2. OAuth consent screen: add the scope `…/auth/drive.readonly`.
3. Credentials → OAuth client ID → *Web application* → add the redirect URL.
4. Set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.

**Microsoft OneDrive / SharePoint**
1. Microsoft Entra ID → App registrations → New registration → *Web* redirect URL.
2. API permissions (delegated): `Files.Read.All`, `Sites.Read.All`, `User.Read`, `offline_access`.
3. Certificates & secrets → new client secret.
4. Set `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`, and
   `MICROSOFT_OAUTH_TENANT`: `common`, `organizations`, or your tenant id.

Restart the backend. The tools then show **Connect** instead of *Not available*.
See `.env.example` for all variables.

## 4. Custom tools (MCP)

Any remote server that speaks the [Model Context Protocol](https://modelcontextprotocol.io)
(Streamable HTTP) can be added under **Manage tools → Add an MCP server**.

- **Sign-in:** none, an access token, or OAuth. OAuth endpoints are discovered from the
  server; a client is registered automatically if the server allows it, otherwise enter a
  client ID.
- **Read vs. write:** a tool counts as read-only only if the server marks it
  `readOnlyHint`. Every other tool is **blocked in research**.
- **URL rules:** remote servers must use HTTPS. The backend must be able to reach the URL.

## 5. Running research (user)

1. **Ask:** the question, depth (Quick / Standard / Deep), research model, optional
   separate writer model, sources.
2. **Review the plan** (on by default): edit, add or remove parts, and answer any
   clarifying questions. Nothing is searched until you start.
3. **Watch it run:**
   - The **Activity** tab shows each search and page read with its result.
   - **Add an instruction** steers the run at the next step.
   - **Stop** ends it. The run keeps going if you leave the tab.
4. **Read the report:** citation chips link to the sources list. Export as Markdown,
   Word or PDF (print), or **Continue in chat** to ask follow-ups.

**Budgets.** Each depth caps tool calls and time; you can also set a cost cap.

| Depth | Parts | Tool calls | Time |
|---|---|---|---|
| Quick | 1 | 10 | ~4 min |
| Standard | 3 | 40 | ~12 min |
| Deep | 5 | 120 | ~30 min |

When a budget runs out, the researchers stop searching and write up what they found.

**Permissions** (per tool, in Manage tools):

| Setting | What happens |
|---|---|
| Always allow | Runs without asking |
| Ask each time | The run pauses with **Allow once / Always allow / Deny** |
| Blocked | Never runs |

**Citation check.** Every `[n]` is compared with the text retrieved for source *n*:

| Colour | Meaning |
|---|---|
| Green | The sentence's key words appear in the source |
| Amber | Weak match, or only a search snippet was read |
| Red, struck through | The number isn't a source at all |

It compares wording; it doesn't prove a claim. Read the sources for anything important.

## 6. Security model

- **Read-only.** Research never runs tools that change things.
- **Untrusted content.** Web pages and tool output are wrapped as data, and the models are
  told never to follow instructions inside them. Only pages from search results, tool
  output or your question can be opened, which stops "visit this URL with the user's
  data" tricks.
- **Network.** Pages on private, loopback or link-local addresses are refused, every
  redirect is re-checked, and downloads are size-capped.
  `RESEARCH_ALLOW_PRIVATE_NETWORK=1` turns this off. Use it only for trusted local
  services, never on a public deployment.
- **Secrets.** API keys, OAuth tokens and client secrets are encrypted with the workspace
  key and never returned to the browser.
- **Isolation.** Runs, connections and tool calls are stored per owner (the user from
  `auth.authenticate`). Every route checks ownership.
- **OAuth.** Authorization code with PKCE (S256), a single-use state that expires in 10
  minutes, and the `resource` parameter on MCP tokens.

## 7. Measuring quality

`evals/research/run_eval.py` runs a list of questions against a live backend and reports:
- completion
- citation support ratio and missing citations
- time and cost

Put your own questions in a JSON file (see `questions.example.json`) and run it before
and after changing prompts, models or tools.

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "None of the chosen sources is ready" | Set up web search, or pick Academic / Library |
| A model is missing from the research list | It failed the tool-use test; pick another |
| "arXiv is limiting requests" | arXiv allows about one request every 3 s; runs space requests, but heavy use can still hit it. OpenAlex covers most of the same papers |
| Semantic Scholar rate limit | Set `SEMANTIC_SCHOLAR_API_KEY` |
| Drive / OneDrive show *Not available* | The server's OAuth variables aren't set (§3) |
| SearXNG "private or local networks" error | Set `RESEARCH_ALLOW_PRIVATE_NETWORK=1` (§2, §6) |
| Run shows *Interrupted* | The server restarted during it; use **Re-run** |
