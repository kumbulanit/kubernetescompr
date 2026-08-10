"""
AxisPay reporting-service
=========================
Read-only aggregates for the merchant portal and the Day 5 dashboards.

Deliberately READ-HEAVY and read-only. It is the one service that should be
scaled independently of the payment path — a merchant running a large report
must never slow down an authorisation. On Day 4 it gets its own Ingress path,
and on Day 5 its own dashboard panel.
"""
from collections import defaultdict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from axispay_common import DownstreamClient, create_app, get_settings
from axispay_common.money import format_minor

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["reporting"])
payments: Optional[DownstreamClient] = None


async def _fetch(limit: int = 200) -> List[Dict[str, Any]]:
    rows = await payments.get("/api/v1/payments", params={"limit": limit})
    return rows if isinstance(rows, list) else rows.get("data", [])


@router.get("/reports/volume", summary="Volume and fees by currency")
async def volume(limit: int = Query(200, ge=1, le=200)) -> Dict[str, Any]:
    rows = await _fetch(limit)
    agg: Dict[str, Dict[str, int]] = defaultdict(lambda: {"count": 0, "gross": 0, "fees": 0})
    for p in rows:
        a = agg[p["currency"]]
        a["count"] += 1; a["gross"] += p["amount_minor"]; a["fees"] += p.get("fee_minor") or 0
    return {"by_currency": [
        {"currency": c, "count": v["count"], "gross_minor": v["gross"], "fees_minor": v["fees"],
         "display_gross": format_minor(v["gross"], c), "display_fees": format_minor(v["fees"], c)}
        for c, v in sorted(agg.items())], "total_payments": len(rows)}


@router.get("/reports/approval-rate", summary="Approval rate by acquirer")
async def approval_rate(limit: int = Query(200, ge=1, le=200)) -> Dict[str, Any]:
    rows = await _fetch(limit)
    agg: Dict[str, Dict[str, int]] = defaultdict(lambda: {"approved": 0, "total": 0})
    for p in rows:
        acq = p.get("acquirer") or "unrouted"
        agg[acq]["total"] += 1
        if p["status"] in ("captured", "authorized", "settled"):
            agg[acq]["approved"] += 1
    return {"by_acquirer": [
        {"acquirer": a, "approved": v["approved"], "total": v["total"],
         "approval_pct": round(100 * v["approved"] / v["total"], 1) if v["total"] else None}
        for a, v in sorted(agg.items(), key=lambda kv: -kv[1]["total"])]}


@router.get("/reports/top-merchants", summary="Top merchants by volume")
async def top_merchants(limit: int = Query(10, ge=1, le=25)) -> Dict[str, Any]:
    rows = await _fetch(200)
    agg: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"count": 0, "gross": 0, "currency": "ZAR"})
    for p in rows:
        a = agg[p["merchant_id"]]
        a["count"] += 1; a["gross"] += p["amount_minor"]; a["currency"] = p["currency"]
    top = sorted(agg.items(), key=lambda kv: -kv[1]["gross"])[:limit]
    return {"top_merchants": [
        {"merchant_id": m, "txn_count": v["count"], "gross_minor": v["gross"],
         "display": format_minor(v["gross"], v["currency"])} for m, v in top]}


async def _startup(app) -> None:
    global payments
    payments = DownstreamClient("payment-service", settings.payment_service_url,
                                settings.downstream_timeout_seconds)
    # Reporting can serve a cached or empty report if payment-service is down.
    # Non-critical: a reporting outage must not take the whole service out of
    # rotation, and it certainly must not affect the payment path.
    app.state.readiness.register("payment-service", payments.probe, critical=False)


async def _shutdown(app) -> None:
    if payments: await payments.close()


app = create_app(service_name="reporting-service",
                 description="AxisPay read-only aggregates. Scaled independently of the payment path.",
                 settings=settings, routers=[router],
                 on_startup=_startup, on_shutdown=_shutdown)
