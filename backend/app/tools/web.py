"""Web search (pluggable provider) and page reading.

Search providers: SearXNG (self-hosted, free), Tavily, Brave. The operator picks one
in the tools directory; the model only ever sees `web_search` and `read_page`.
"""

from __future__ import annotations

import io
import re
from html.parser import HTMLParser

from pypdf import PdfReader

from . import net
from .base import Source, Tool, ToolContext, ToolError, ToolResult, object_schema

PAGE_TEXT_CHARS = 60_000  # kept for citation checks
SEARCH_PROVIDERS = {
    "searxng": "SearXNG (self-hosted)",
    "tavily": "Tavily",
    "brave": "Brave Search",
}


class _TextExtractor(HTMLParser):
    """Readable text from HTML: skips scripts, styles, navigation and forms."""

    SKIP = {
        "script",
        "style",
        "noscript",
        "svg",
        "nav",
        "footer",
        "header",
        "form",
        "aside",
        "iframe",
        "template",
    }
    BLOCK = {
        "p",
        "div",
        "section",
        "article",
        "li",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "tr",
        "br",
        "pre",
        "blockquote",
        "td",
        "th",
        "dd",
        "dt",
        "figcaption",
        "main",
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.title = ""
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1
        elif tag == "title":
            self._in_title = True
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1
        elif tag == "title":
            self._in_title = False
        elif tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self._skip:
            self.parts.append(data)

    def text(self) -> str:
        raw = "".join(self.parts)
        lines = (re.sub(r"[ \t ]+", " ", line).strip() for line in raw.splitlines())
        return "\n".join(line for line in lines if line)


def html_to_text(html: str) -> tuple[str, str]:
    parser = _TextExtractor()
    parser.feed(html)
    parser.close()
    return parser.title.strip(), parser.text()


def pdf_to_text(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    if reader.is_encrypted:
        raise ToolError("The PDF is encrypted.")
    return "\n".join((page.extract_text() or "") for page in reader.pages[:80])


# ------------------------------------------------------------------ search


async def _searxng(config: dict, query: str, count: int) -> list[Source]:
    base = (config.get("base_url") or "").rstrip("/")
    if not base:
        raise ToolError("SearXNG needs a base URL. Set it in the tools directory.")
    response = await net.api_request("GET", base + "/search", params={"q": query, "format": "json"})
    net.raise_for_status(response, "SearXNG")
    return [
        Source(title=r.get("title") or r["url"], url=r["url"], snippet=r.get("content") or "")
        for r in response.json().get("results", [])[:count]
        if r.get("url")
    ]


async def _tavily(config: dict, query: str, count: int) -> list[Source]:
    key = config.get("api_key")
    if not key:
        raise ToolError("Tavily needs an API key. Add it in the tools directory.")
    response = await net.api_request(
        "POST",
        "https://api.tavily.com/search",
        headers={"Authorization": "Bearer " + key},
        json={"query": query, "max_results": count, "search_depth": "basic"},
    )
    net.raise_for_status(response, "Tavily")
    return [
        Source(title=r.get("title") or r["url"], url=r["url"], snippet=r.get("content") or "")
        for r in response.json().get("results", [])[:count]
        if r.get("url")
    ]


async def _brave(config: dict, query: str, count: int) -> list[Source]:
    key = config.get("api_key")
    if not key:
        raise ToolError("Brave Search needs an API key. Add it in the tools directory.")
    response = await net.api_request(
        "GET",
        "https://api.search.brave.com/res/v1/web/search",
        headers={"X-Subscription-Token": key, "Accept": "application/json"},
        params={"q": query, "count": count},
    )
    net.raise_for_status(response, "Brave Search")
    results = response.json().get("web", {}).get("results", [])
    return [
        Source(
            title=r.get("title") or r["url"],
            url=r["url"],
            snippet=re.sub("<[^>]+>", "", r.get("description", "")),
        )
        for r in results[:count]
        if r.get("url")
    ]


ADAPTERS = {"searxng": _searxng, "tavily": _tavily, "brave": _brave}


def search_tool(config: dict) -> Tool:
    """`config` = {provider, base_url?, api_key?} from the web_search connector."""
    adapter = ADAPTERS.get(config.get("provider", ""))

    async def run(args: dict, ctx: ToolContext) -> ToolResult:
        if adapter is None:
            raise ToolError("No web search provider is set up. Choose one in the tools directory.")
        query = str(args.get("query", "")).strip()[:400]
        if not query:
            raise ToolError("Search needs a query.")
        found = await adapter(config, query, min(int(args.get("count") or 6), 10))
        found = [
            s
            for s in found
            if net.domain_permitted(s.url, ctx.allowed_domains, ctx.blocked_domains)
        ]
        ctx.allowed_urls.update(s.url for s in found)
        return ToolResult(sources=found)

    return Tool(
        name="web_search",
        description="Search the web. Returns numbered results with title, URL and a snippet. "
        "Use read_page on a result to read the full text before relying on it.",
        parameters=object_schema(
            {
                "query": {"type": "string", "description": "A focused search query."},
                "count": {"type": "integer", "description": "Results to return, 1-10 (default 6)."},
            },
            ["query"],
        ),
        connector="web_search",
        run=run,
        label="Web search",
    )


# ------------------------------------------------------------------ page reading


async def read_url(url: str, ctx: ToolContext) -> Source:
    if url not in ctx.allowed_urls:
        raise ToolError("Only pages from search results or the research question can be opened.")
    if not net.domain_permitted(url, ctx.allowed_domains, ctx.blocked_domains):
        raise ToolError("That site is blocked by the research settings.")
    response = await net.get(url, headers={"Accept": "text/html,application/pdf,text/plain;q=0.8"})
    if response.status_code >= 400:
        raise ToolError(f"The page returned HTTP {response.status_code}.")
    kind = response.headers.get("content-type", "").lower()
    if "pdf" in kind or url.lower().endswith(".pdf"):
        title, text = url.rsplit("/", 1)[-1], pdf_to_text(response.content)
    elif "html" in kind or "xml" in kind or not kind:
        title, text = html_to_text(response.text)
    elif kind.startswith("text/") or "json" in kind:
        title, text = url.rsplit("/", 1)[-1], response.text
    else:
        raise ToolError("That page is not text, HTML or PDF.")
    if not text.strip():
        raise ToolError("No readable text on that page.")
    return Source(title=(title or url)[:300], url=url, content=text[:PAGE_TEXT_CHARS], kind="web")


def read_page_tool() -> Tool:
    async def run(args: dict, ctx: ToolContext) -> ToolResult:
        return ToolResult(sources=[await read_url(str(args.get("url", "")).strip(), ctx)])

    return Tool(
        name="read_page",
        description="Read the full text of a web page or PDF. Only URLs returned by web_search "
        "(or given in the research question) can be opened.",
        parameters=object_schema(
            {"url": {"type": "string", "description": "The exact URL to read."}}, ["url"]
        ),
        connector="web_search",
        run=run,
        label="Read page",
    )
