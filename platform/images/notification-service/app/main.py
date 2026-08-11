"""
AxisPay notification-service
============================
Delivers merchant webhooks with exponential-backoff retry and a dead-letter
queue.

Delivery is simulated — no outbound HTTP leaves the cluster — but the RETRY
SEMANTICS are real, because they are what students need to reason about:

    attempt 1  immediately
    attempt 2  +2s      attempt 3  +4s      attempt 4  +8s      attempt 5  +16s
    after 5    -> dead_letter, and a human has to look at it

A merchant whose endpoint is down must not block every other merchant's
notifications, which is why failures are per-notification rather than
per-consumer.
"""
import random
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from axispay_common import DownstreamClient, create_app, get_settings
from axispay_common.errors import NotFoundError
from axispay_common.ids import new_token
from axispay_common.logging import log_with

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["notifications"])

MAX_ATTEMPTS = 5
_NOTIFICATIONS: Dict[str, Dict[str, Any]] = {}
merchants: Optional[DownstreamClient] = None


class NotifyRequest(BaseModel):
    merchant_id: str
    payment_id: Optional[str] = None
    event: str = Field(..., examples=["payment.captured"])
    channel: str = Field("webhook", pattern="^(webhook|email|sms)$")


def _backoff_seconds(attempt: int) -> int:
    return 2 ** attempt


@router.post("/notifications", status_code=201, summary="Queue a merchant notification")
async def notify(body: NotifyRequest, request: Request) -> Dict[str, Any]:
    merchant = await merchants.get(f"/api/v1/merchants/{body.merchant_id}")
    nid = f"ntf_{new_token()[4:14]}"

    # Deterministic per-notification outcome so labs are reproducible.
    rng = random.Random(hash(nid) & 0xFFFFFFFF)
    delivered = rng.random() < 0.90
    attempts = 1 if delivered else rng.randint(2, MAX_ATTEMPTS)
    status = "delivered" if delivered else ("failed" if attempts < MAX_ATTEMPTS else "dead_letter")

    rec = {
        "notification_id": nid, "merchant_id": body.merchant_id,
        "payment_id": body.payment_id, "event": body.event, "channel": body.channel,
        "endpoint": merchant.get("webhook_url"), "status": status, "attempts": attempts,
        "next_retry_seconds": None if status != "failed" else _backoff_seconds(attempts),
        "last_error": None if delivered else "connection timeout after 10s",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _NOTIFICATIONS[nid] = rec
    if status == "dead_letter":
        log_with(request.app.state.log, "warning", "notification dead-lettered",
                 notification_id=nid, merchant_id=body.merchant_id, attempts=attempts)
    return rec


@router.post("/notifications/{notification_id}/retry", summary="Retry a failed delivery")
async def retry(notification_id: str, request: Request) -> Dict[str, Any]:
    rec = _NOTIFICATIONS.get(notification_id)
    if not rec:
        raise NotFoundError("notification not found", {"notification_id": notification_id})
    if rec["status"] == "delivered":
        return rec
    rec["attempts"] += 1
    if rec["attempts"] >= MAX_ATTEMPTS:
        rec["status"] = "dead_letter"; rec["next_retry_seconds"] = None
    else:
        rec["next_retry_seconds"] = _backoff_seconds(rec["attempts"])
    return rec


@router.get("/notifications", summary="List notifications")
async def list_all(status: Optional[str] = Query(None), limit: int = Query(50, ge=1, le=200)):
    rows = list(_NOTIFICATIONS.values())
    if status:
        rows = [n for n in rows if n["status"] == status]
    counts: Dict[str, int] = defaultdict(int)
    for n in _NOTIFICATIONS.values():
        counts[n["status"]] += 1
    return {"notifications": rows[:limit], "count": len(rows), "by_status": dict(counts)}


async def _startup(app) -> None:
    global merchants
    merchants = DownstreamClient("merchant-service", settings.merchant_service_url,
                                 settings.downstream_timeout_seconds)
    app.state.readiness.register("merchant-service", merchants.probe, critical=True)


async def _shutdown(app) -> None:
    if merchants: await merchants.close()


app = create_app(service_name="notification-service",
                 description="AxisPay merchant webhooks with backoff retry and a dead-letter queue.",
                 settings=settings, routers=[router],
                 on_startup=_startup, on_shutdown=_shutdown)
