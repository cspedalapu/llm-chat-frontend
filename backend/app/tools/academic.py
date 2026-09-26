"""Scholarly search over free public APIs: OpenAlex, arXiv, Semantic Scholar, PubMed.

Abstracts are kept as source content so citations to a paper can be checked against
what we actually retrieved.
"""

from __future__ import annotations

import asyncio
import os
import time
from xml.etree import ElementTree

from . import net
from .base import Source, Tool, ToolContext, ToolError, ToolResult, object_schema

DATABASES = {
    "openalex": "OpenAlex",
    "arxiv": "arXiv",
    "semantic_scholar": "Semantic Scholar",
    "pubmed": "PubMed",
}


def _paper(
    title: str, url: str, abstract: str, year, authors: list[str], venue: str = ""
) -> Source:
    byline = ", ".join(a for a in authors[:3] if a) + (" et al." if len(authors) > 3 else "")
    meta = " · ".join(str(x) for x in (byline, year, venue) if x)
    return Source(
        title=title.strip()[:300],
        url=url,
        snippet=(meta + (" — " if meta else "") + abstract[:300]).strip(),
        content=((meta + "\n") if meta else "") + abstract,
        kind="paper",
    )


def _openalex_abstract(index: dict | None) -> str:
    if not index:
        return ""
    words: dict[int, str] = {}
    for word, positions in index.items():
        for position in positions:
            words[position] = word
    return " ".join(words[i] for i in sorted(words))


async def openalex(query: str, count: int) -> list[Source]:
    params = {"search": query, "per-page": count}
    if os.environ.get("RESEARCH_CONTACT_EMAIL"):
        params["mailto"] = os.environ["RESEARCH_CONTACT_EMAIL"]  # OpenAlex "polite pool"
    response = await net.api_request("GET", "https://api.openalex.org/works", params=params)
    net.raise_for_status(response, "OpenAlex")
    out = []
    for work in response.json().get("results", []):
        location = work.get("primary_location") or {}
        url = work.get("doi") or location.get("landing_page_url") or work.get("id")
        if not url:
            continue
        out.append(
            _paper(
                work.get("display_name") or work.get("title") or url,
                url,
                _openalex_abstract(work.get("abstract_inverted_index")),
                work.get("publication_year"),
                [a.get("author", {}).get("display_name", "") for a in work.get("authorships", [])],
                (location.get("source") or {}).get("display_name", ""),
            )
        )
    return out


# arXiv asks clients for one request every 3 seconds and answers 406 when they come
# faster. Parallel researchers share this gate so the whole backend stays polite.
ARXIV_SPACING_SECONDS = 3.1
_arxiv_gate = asyncio.Lock()
_arxiv_last = 0.0


async def _arxiv_get(params: dict):
    global _arxiv_last
    async with _arxiv_gate:
        for attempt in range(2):
            wait = _arxiv_last + ARXIV_SPACING_SECONDS - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
            response = await net.api_request(
                "GET", "https://export.arxiv.org/api/query", params=params
            )
            _arxiv_last = time.monotonic()
            if response.status_code not in (406, 429, 503) or attempt:
                return response
    return response


async def arxiv(query: str, count: int) -> list[Source]:
    response = await _arxiv_get({"search_query": "all:" + query, "start": 0, "max_results": count})
    if response.status_code == 406:
        raise ToolError("arXiv is limiting requests right now. Try again in a minute.")
    net.raise_for_status(response, "arXiv")
    atom = "{http://www.w3.org/2005/Atom}"
    root = ElementTree.fromstring(response.content)
    out = []
    for entry in root.findall(atom + "entry"):
        url = (entry.findtext(atom + "id") or "").strip()
        if not url:
            continue
        out.append(
            _paper(
                " ".join((entry.findtext(atom + "title") or url).split()),
                url,
                " ".join((entry.findtext(atom + "summary") or "").split()),
                (entry.findtext(atom + "published") or "")[:4],
                [a.findtext(atom + "name") or "" for a in entry.findall(atom + "author")],
                "arXiv",
            )
        )
    return out


async def semantic_scholar(query: str, count: int) -> list[Source]:
    headers = {}
    if os.environ.get("SEMANTIC_SCHOLAR_API_KEY"):
        headers["x-api-key"] = os.environ["SEMANTIC_SCHOLAR_API_KEY"]
    response = await net.api_request(
        "GET",
        "https://api.semanticscholar.org/graph/v1/paper/search",
        headers=headers,
        params={"query": query, "limit": count, "fields": "title,abstract,url,year,authors,venue"},
    )
    net.raise_for_status(response, "Semantic Scholar")
    return [
        _paper(
            p.get("title") or p["url"],
            p["url"],
            p.get("abstract") or "",
            p.get("year"),
            [a.get("name", "") for a in p.get("authors", [])],
            p.get("venue") or "",
        )
        for p in response.json().get("data", [])
        if p.get("url")
    ]


async def pubmed(query: str, count: int) -> list[Source]:
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
    found = await net.api_request(
        "GET",
        base + "esearch.fcgi",
        params={"db": "pubmed", "term": query, "retmax": count, "retmode": "json"},
    )
    net.raise_for_status(found, "PubMed")
    ids = found.json().get("esearchresult", {}).get("idlist", [])
    if not ids:
        return []
    fetched = await net.api_request(
        "GET", base + "efetch.fcgi", params={"db": "pubmed", "id": ",".join(ids), "retmode": "xml"}
    )
    net.raise_for_status(fetched, "PubMed")
    out = []
    for article in ElementTree.fromstring(fetched.content).iter("PubmedArticle"):
        pmid = article.findtext(".//PMID") or ""
        abstract = " ".join("".join(node.itertext()) for node in article.iter("AbstractText"))
        authors = [
            f"{a.findtext('ForeName') or ''} {a.findtext('LastName') or ''}".strip()
            for a in article.iter("Author")
        ]
        title_node = article.find(".//ArticleTitle")
        title = "".join(title_node.itertext()) if title_node is not None else pmid
        out.append(
            _paper(
                title,
                f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                abstract,
                article.findtext(".//PubDate/Year") or "",
                authors,
                article.findtext(".//Journal/Title") or "",
            )
        )
    return out


SEARCHERS = {
    "openalex": openalex,
    "arxiv": arxiv,
    "semantic_scholar": semantic_scholar,
    "pubmed": pubmed,
}


def papers_tool(enabled: list[str] | None = None) -> Tool:
    enabled = [d for d in (enabled or list(SEARCHERS)) if d in SEARCHERS]

    async def run(args: dict, ctx: ToolContext) -> ToolResult:
        query = str(args.get("query", "")).strip()[:300]
        if not query:
            raise ToolError("Paper search needs a query.")
        database = args.get("database") or "all"
        count = min(int(args.get("count") or 5), 10)
        # "all" = broad index plus preprints; fast and complementary.
        chosen = [
            d for d in (["openalex", "arxiv"] if database == "all" else [database]) if d in enabled
        ]
        if not chosen:
            raise ToolError("That paper database is not enabled.")
        results = await asyncio.gather(
            *(SEARCHERS[d](query, count) for d in chosen), return_exceptions=True
        )
        sources, errors = [], []
        for name, result in zip(chosen, results, strict=True):
            if isinstance(result, Exception):
                reason = result if isinstance(result, ToolError) else "request failed"
                errors.append(f"{DATABASES[name]}: {reason}")
            else:
                sources.extend(result)
        if not sources and errors:
            raise ToolError("; ".join(errors))
        ctx.allowed_urls.update(s.url for s in sources)
        return ToolResult(sources=sources, text="; ".join(errors))

    return Tool(
        name="search_papers",
        description="Search scholarly papers. Returns title, authors, year, venue and abstract. "
        "Prefer this over web_search for scientific or academic questions.",
        parameters=object_schema(
            {
                "query": {"type": "string", "description": "Keywords or a short topic."},
                "database": {
                    "type": "string",
                    "enum": ["all", *enabled],
                    "description": "Which database; 'all' searches OpenAlex and arXiv.",
                },
                "count": {
                    "type": "integer",
                    "description": "Results per database, 1-10 (default 5).",
                },
            },
            ["query"],
        ),
        connector="academic",
        run=run,
        label="Paper search",
    )
