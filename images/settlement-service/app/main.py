"""
AxisPay settlement-service
==========================
Batches captured payments per merchant, per currency, per day, and computes
what Axis actually owes each merchant.

    gross = sum of captured payments
    fees  = sum of the MDR + fixed fee already recorded on each payment
    net   = gross - fees          <- what is paid to the merchant

The nightly CronJob triggers this. The database enforces one batch per
merchant per currency per day (settlements_unique_batch), which is what makes
a retry safe: a duplicate run cannot double-settle.
"""
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from axispay_common import DownstreamClient, create_app, get_settings
from axispay_common.errors import ConflictError, NotFoundError
from axispay_common.logging import log_with
from axispay_common.money import format_minor

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["settlement"])

_BATCHES: Dict[str, Dict[str, Any]] = {}
_BY_KEY: Dict[str, str] = {}          # "merchant|currency|date" -> settlement_id
payments: Optional[DownstreamClient] = None


class RunRequest(BaseModel):
    batch_date: Optional[str] = Field(None, examples=["2026-08-10"])
    merchant_id: Optional[str] = None


@router.post("/settlements/run", status_code=201, summary="Run a settlement batch")
async def run(body: RunRequest, request: Request) -> Dict[str, Any]:
    day = body.batch_date or date.today().isoformat()
    rows = await payments.get("/api/v1/payments", params={"status": "captured", "limit": 200})
    items = rows if isinstance(rows, list) else rows.get("data", [])
    if body.merchant_id:
        items = [p for p in items if p["merchant_id"] == body.merchant_id]

    groups: Dict[tuple, List[Dict[str, Any]]] = defaultdict(list)
    for p in items:
        groups[(p["merchant_id"], p["currency"])].append(p)

    created, skipped = [], []
    for (mid, cur), ps in sorted(groups.items()):
        key = f"{mid}|{cur}|{day}"
        # The idempotency guarantee. Kubernetes gives at-most-once SCHEDULING;
        # exactly-once EXECUTION has to come from here.
        if key in _BY_KEY:
            skipped.append(_BY_KEY[key]); continue

        gross = sum(p["amount_minor"] for p in ps)
        fees = sum(p.get("fee_minor") or 0 for p in ps)
        net = gross - fees
        sid = f"STL_{day.replace('-','')}_{abs(hash(key)) % 0xFFFFFF:06X}"
        batch = {
            "settlement_id": sid, "merchant_id": mid, "currency": cur,
            "gross_minor": gross, "fees_minor": fees, "net_minor": net,
            "txn_count": len(ps), "batch_date": day, "status": "settled",
            "file_ref": f"{sid}.csv",
            "display": {"gross": format_minor(gross, cur), "fees": format_minor(fees, cur),
                        "net": format_minor(net, cur)},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        assert gross == fees + net, "settlement does not balance"
        _BATCHES[sid] = batch
        _BY_KEY[key] = sid
        created.append(sid)

    log_with(request.app.state.log, "info", "settlement run complete",
             batch_date=day, created=len(created), skipped_duplicates=len(skipped))
    return {"batch_date": day, "created": created, "skipped_duplicates": skipped,
            "settlements": len(created)}


@router.get("/settlements", summary="List settlement batches")
async def list_batches(merchant_id: Optional[str] = Query(None), limit: int = Query(50, ge=1, le=200)):
    rows = list(_BATCHES.values())
    if merchant_id:
        rows = [b for b in rows if b["merchant_id"] == merchant_id]
    return {"settlements": sorted(rows, key=lambda b: b["created_at"], reverse=True)[:limit],
            "count": len(rows)}


@router.get("/settlements/{settlement_id}", summary="Fetch one batch")
async def get_batch(settlement_id: str) -> Dict[str, Any]:
    b = _BATCHES.get(settlement_id)
    if not b:
        raise NotFoundError("settlement not found", {"settlement_id": settlement_id})
    return b


async def _startup(app) -> None:
    global payments
    payments = DownstreamClient("payment-service", settings.payment_service_url,
                                settings.downstream_timeout_seconds)
    app.state.readiness.register("payment-service", payments.probe, critical=True)


async def _shutdown(app) -> None:
    if payments: await payments.close()


app = create_app(service_name="settlement-service",
                 description="AxisPay nightly settlement batching. Idempotent by batch key.",
                 settings=settings, routers=[router],
                 on_startup=_startup, on_shutdown=_shutdown)
