"""
AxisPay audit-service
=====================
Append-only audit log. Seven-year retention.

Write-only from the platform's perspective: there is no update endpoint and no
delete endpoint, deliberately. An auditor must be able to see what was believed
at any point in time — including what was believed wrongly.

Every event carries a correlation_id, which is what lets you reconstruct a
single payment's journey across every service that touched it. That is the
Day 5 payoff for the header edge-gateway has been minting since Day 1.
"""
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field

from axispay_common import create_app, get_settings
from axispay_common.context import correlation_id
from axispay_common.logging import log_with

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["audit"])

_EVENTS: List[Dict[str, Any]] = []
_BY_CORRELATION: Dict[str, List[int]] = defaultdict(list)
_BY_ENTITY: Dict[str, List[int]] = defaultdict(list)
_SEEN: set = set()          # (correlation_id, action, entity_id) — dedupe


class AuditEvent(BaseModel):
    actor: str = Field(..., examples=["payment-service"])
    action: str = Field(..., examples=["payment.captured"])
    entity_type: str = Field(..., examples=["payment"])
    entity_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


@router.post("/audit", status_code=201, summary="Record an audit event (append only)")
async def record(body: AuditEvent, request: Request) -> Dict[str, Any]:
    cid = correlation_id()
    # RabbitMQ delivers AT LEAST ONCE, so a consumer WILL occasionally see the
    # same event twice. Dedupe on the natural key rather than trusting the
    # broker — the same reason the database has a unique constraint.
    key = (cid, body.action, body.entity_id)
    if key in _SEEN:
        log_with(request.app.state.log, "info", "duplicate audit event ignored",
                 action=body.action, entity_id=body.entity_id)
        return {"recorded": False, "reason": "duplicate", "correlation_id": cid}

    _SEEN.add(key)
    idx = len(_EVENTS)
    ev = {
        "event_id": idx + 1,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "actor": body.actor, "action": body.action,
        "entity_type": body.entity_type, "entity_id": body.entity_id,
        "correlation_id": cid, "payload": body.payload or {},
    }
    _EVENTS.append(ev)
    _BY_CORRELATION[cid].append(idx)
    if body.entity_id:
        _BY_ENTITY[f"{body.entity_type}:{body.entity_id}"].append(idx)
    return {"recorded": True, "event_id": ev["event_id"], "correlation_id": cid}


@router.get("/audit/trace/{correlation_id_value}", summary="Every event for one request")
async def trace(correlation_id_value: str) -> Dict[str, Any]:
    idxs = _BY_CORRELATION.get(correlation_id_value, [])
    return {"correlation_id": correlation_id_value,
            "events": [_EVENTS[i] for i in idxs], "count": len(idxs)}


@router.get("/audit/entity/{entity_type}/{entity_id}", summary="Full history of one entity")
async def entity(entity_type: str, entity_id: str) -> Dict[str, Any]:
    idxs = _BY_ENTITY.get(f"{entity_type}:{entity_id}", [])
    return {"entity": f"{entity_type}:{entity_id}",
            "events": [_EVENTS[i] for i in idxs], "count": len(idxs)}


@router.get("/audit", summary="Recent events")
async def recent(action: Optional[str] = Query(None), limit: int = Query(100, ge=1, le=500)):
    rows = _EVENTS
    if action:
        rows = [e for e in rows if e["action"] == action]
    return {"events": rows[-limit:], "total": len(_EVENTS)}


app = create_app(service_name="audit-service",
                 description="AxisPay append-only audit log. No update, no delete — by design.",
                 settings=settings, routers=[router])
