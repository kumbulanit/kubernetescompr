"""
AxisPay recon-worker
====================
A batch reconciliation run. Not a server — it starts, does work, prints a
report and EXITS. That exit code is the whole point: a Kubernetes Job is
complete when its pod exits 0, and failed when it exits non-zero.

What it reconciles: every payment recorded by payment-service against the
acquirer's settlement position. In a real platform a mismatch here is a
"break" and someone has to explain it before close of business.

Run modes (set via RECON_MODE):
    normal   reconcile and exit 0
    breaks   find discrepancies, report them, still exit 0 (breaks are data)
    fail     exit 1 — used in L2.5 to demonstrate backoffLimit and Job retries
"""
import json
import os
import sys
import time
from typing import Any, Dict, List

import httpx

PAYMENT_URL = os.getenv("PAYMENT_SERVICE_URL",
                        "http://payment-service.axispay-core.svc.cluster.local:8080")
MODE = os.getenv("RECON_MODE", "normal")
POD = os.getenv("POD_NAME", "local")
NODE = os.getenv("NODE_NAME", "local")


def log(msg: str, **fields: Any) -> None:
    print(json.dumps({"service": "recon-worker", "pod": POD, "node": NODE,
                      "msg": msg, **fields}), flush=True)


def main() -> int:
    started = time.time()
    log("reconciliation started", mode=MODE, target=PAYMENT_URL)

    if MODE == "fail":
        # Deliberate failure for the Job backoffLimit demonstration in L2.5.
        log("reconciliation FAILED", error="simulated acquirer file unavailable")
        return 1

    try:
        with httpx.Client(trust_env=False, timeout=15.0) as client:
            stats = client.get(f"{PAYMENT_URL}/api/v1/payments-stats").json()
            payments = client.get(f"{PAYMENT_URL}/api/v1/payments",
                                  params={"limit": 200}).json()
    except Exception as exc:
        log("could not reach payment-service", error=str(exc))
        return 1

    rows: List[Dict[str, Any]] = payments if isinstance(payments, list) else payments.get("data", [])
    by_currency: Dict[str, Dict[str, int]] = {}
    breaks: List[Dict[str, Any]] = []

    for p in rows:
        cur = p.get("currency", "???")
        b = by_currency.setdefault(cur, {"count": 0, "gross_minor": 0, "fees_minor": 0, "net_minor": 0})
        b["count"] += 1
        b["gross_minor"] += p.get("amount_minor", 0)
        b["fees_minor"] += p.get("fee_minor") or 0
        b["net_minor"] += p.get("net_minor") or 0

        # The invariant a payments reconciliation actually checks.
        gross, fee, net = p.get("amount_minor", 0), p.get("fee_minor"), p.get("net_minor")
        if fee is not None and net is not None and gross != fee + net:
            breaks.append({"payment_id": p.get("payment_id"), "gross": gross,
                           "fee": fee, "net": net, "difference": gross - (fee + net)})

    for cur, b in sorted(by_currency.items()):
        balanced = b["gross_minor"] == b["fees_minor"] + b["net_minor"]
        log("currency position", currency=cur, count=b["count"],
            gross_minor=b["gross_minor"], fees_minor=b["fees_minor"],
            net_minor=b["net_minor"], balanced=balanced)

    log("reconciliation complete",
        total_payments=stats.get("total_payments", len(rows)),
        currencies=len(by_currency), breaks=len(breaks),
        duration_seconds=round(time.time() - started, 2))

    if breaks:
        for b in breaks[:10]:
            log("BREAK", **b)
    # Breaks are a finding, not a failure. The Job succeeded; a human now has
    # something to investigate. Exiting non-zero here would make Kubernetes
    # retry the reconciliation, which would not fix the underlying data.
    return 0


if __name__ == "__main__":
    sys.exit(main())
