"""Checks every [n] in a report against the text we actually retrieved for source n.

This is a lexical check, not proof: a citation counts as `supported` when enough of
the citing sentence's distinctive words appear in the source text. It reliably catches
invented source numbers and citations to pages that were never read, and flags weak
matches for a human to look at. The UI labels it as an automated check.
"""

from __future__ import annotations

import re

CITATION = re.compile(r"\[(\d{1,3}(?:\s*[,;]\s*\d{1,3})*)\]")
SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])|\n+")
WORD = re.compile(r"[A-Za-z][A-Za-z\-']{3,}|\d[\d.,%]*")
# Common words that say nothing about whether a source supports a claim.
_STOP_WORDS = (
    "about above after again against also although among another because been before "
    "being below between both could does doing during each either every from further "
    "have having here hers himself however into itself just many might more most much "
    "must neither other ought over same should since some such than that their theirs "
    "them themselves then there these they this those through under until very were what "
    "when where which while whom whose with within without would your yours according "
    "report reports shows show study studies data source sources said says based percent"
)
STOP = frozenset(_STOP_WORDS.split())
SUPPORTED = 0.34


def _terms(text: str) -> set[str]:
    return {w.lower().strip(".,") for w in WORD.findall(text)} - STOP


def check(report: str, sources: dict[int, dict]) -> dict:
    """`sources`: {n: {"content": str, "snippet": str}}. Returns per-citation results and totals."""
    results = []
    for sentence in (s for s in SENTENCE.split(report) if s.strip()):
        numbers = [
            int(n) for group in CITATION.findall(sentence) for n in re.split(r"\s*[,;]\s*", group)
        ]
        if not numbers:
            continue
        claim = CITATION.sub("", sentence).strip(" #*-")
        terms = _terms(claim)
        for n in dict.fromkeys(numbers):
            source = sources.get(n)
            if source is None:
                status, score = "missing", 0.0
            else:
                body = source.get("content") or ""
                haystack = _terms(body or source.get("snippet", ""))
                score = len(terms & haystack) / len(terms) if terms else 1.0
                if not body:
                    status = "snippet_only"
                else:
                    status = "supported" if score >= SUPPORTED else "weak"
            results.append(
                {"n": n, "status": status, "score": round(score, 2), "claim": claim[:240]}
            )
    totals = {
        k: sum(r["status"] == k for r in results)
        for k in ("supported", "weak", "snippet_only", "missing")
    }
    return {"citations": results, "totals": totals, "checked": len(results)}
