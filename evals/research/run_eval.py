"""Research quality evaluation (roadmap R-29).

Runs every question in a JSON file through a running backend's Research API, waits for
each report and records what matters for quality and cost: citation check totals,
sources read, tool calls, time and model cost. Compare the output between versions,
prompts or models to see whether a change helped.

    python evals/research/run_eval.py --base-url http://127.0.0.1:8000 \\
        --model-id <model id from GET /models> --questions evals/research/questions.json

Questions file: a JSON list of {"question": str, "depth"?: "quick"|"standard"|"deep",
"sources"?: [..], "expect"?: [substrings the report should contain]}.
Needs a real model and a configured web search: it spends provider credit.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

import httpx

HEADERS = {"X-Workspace-Client": "local-chat"}
TERMINAL = {"completed", "failed", "cancelled", "interrupted"}


def run_one(client: httpx.Client, model_id: str, item: dict, timeout: float) -> dict:
    started = time.monotonic()
    body = {
        "question": item["question"],
        "depth": item.get("depth", "quick"),
        "model_id": model_id,
        "sources": item.get("sources", ["web", "academic"]),
        "plan_first": False,
    }
    response = client.post("/research/runs", json=body)
    if response.status_code != 200:
        return {"question": item["question"], "status": "rejected", "error": response.text[:300]}
    run_id = response.json()["id"]
    while time.monotonic() - started < timeout:
        run = client.get(f"/research/runs/{run_id}").json()
        if run["status"] in TERMINAL:
            break
        time.sleep(2)
    else:
        client.post(f"/research/runs/{run_id}/cancel")
        run = client.get(f"/research/runs/{run_id}").json()
    totals = (run.get("citation_check") or {}).get("totals", {})
    checked = sum(totals.values()) or 0
    report = run.get("report") or ""
    expected = item.get("expect", [])
    return {
        "question": item["question"],
        "run_id": run_id,
        "status": run["status"],
        "seconds": round(time.monotonic() - started, 1),
        "tool_calls": run["counts"]["tool_calls"],
        "sources_read": run["counts"]["sources_read"],
        "cost": run["usage"]["cost"],
        "citations": checked,
        "supported_ratio": round(totals.get("supported", 0) / checked, 2) if checked else None,
        "missing": totals.get("missing", 0),
        "expected_found": sum(e.lower() in report.lower() for e in expected),
        "expected_total": len(expected),
        "error": run.get("error", ""),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--model-id", required=True)
    parser.add_argument(
        "--questions", default=str(Path(__file__).with_name("questions.example.json"))
    )
    parser.add_argument("--timeout", type=float, default=900, help="seconds per question")
    parser.add_argument("--out", default="", help="write results as JSON here")
    args = parser.parse_args()

    items = json.loads(Path(args.questions).read_text(encoding="utf-8"))
    results = []
    with httpx.Client(base_url=args.base_url.rstrip("/"), headers=HEADERS, timeout=60) as client:
        for index, item in enumerate(items, 1):
            print(f"[{index}/{len(items)}] {item['question'][:70]}", flush=True)
            result = run_one(client, args.model_id, item, args.timeout)
            results.append(result)
            print(
                f"    {result['status']}: {result.get('citations', 0)} citations, "
                f"supported {result.get('supported_ratio')}, missing {result.get('missing', 0)}, "
                f"{result.get('seconds')}s, ${result.get('cost', 0):.4f}",
                flush=True,
            )

    done = [r for r in results if r["status"] == "completed"]
    ratios = [r["supported_ratio"] for r in done if r["supported_ratio"] is not None]
    summary = {
        "completed": f"{len(done)}/{len(results)}",
        "mean_supported_ratio": round(statistics.fmean(ratios), 2) if ratios else None,
        "missing_citations": sum(r["missing"] for r in done),
        "median_seconds": statistics.median([r["seconds"] for r in done]) if done else None,
        "total_cost": round(sum(r["cost"] for r in done), 4),
    }
    print(json.dumps(summary, indent=2))
    if args.out:
        Path(args.out).write_text(
            json.dumps({"summary": summary, "results": results}, indent=2), encoding="utf-8"
        )
    return 0 if len(done) == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
