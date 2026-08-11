"""
AxisPay routing-service
=======================
Chooses which acquirer to send an authorisation to, then simulates the call.

Routing is the product. A merchant integrates once; this service decides, per
transaction, which of five acquirers gets it — based on currency support,
card brand, amount band, cost in basis points and live success rate.

The acquirer call is SIMULATED with a deterministic latency and a per-acquirer
success rate. That gives Day 2 a realistic p99 tail to reason about, and Day 5
a genuine approval-rate metric to chart per acquirer.
"""
import hashlib
import random
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from axispay_common import create_app, get_settings
from axispay_common.errors import ConflictError
from axispay_common.ids import new_journal_id
from axispay_common.logging import log_with
from axispay_common.seed import MERCHANTS_BY_ID, TOKENS_BY_ID

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["routing"])

ACQUIRERS: List[Dict[str, Any]] = [
    {"code": "ACQ_MERIDIAN",  "name": "Meridian Acquiring",   "currencies": ["ZAR", "USD", "GBP", "EUR"],
     "cost_bps": 65, "success_rate": 0.974, "base_latency_ms": 95},
    {"code": "ACQ_VELA",      "name": "Vela Payment Services", "currencies": ["ZAR", "BWP", "KES"],
     "cost_bps": 58, "success_rate": 0.961, "base_latency_ms": 120},
    {"code": "ACQ_KOPANO",    "name": "Kopano Financial",      "currencies": ["ZAR", "NGN", "KES", "BWP"],
     "cost_bps": 72, "success_rate": 0.983, "base_latency_ms": 140},
    {"code": "ACQ_NORTHSTAR", "name": "Northstar Card Systems", "currencies": ["USD", "EUR", "GBP"],
     "cost_bps": 51, "success_rate": 0.968, "base_latency_ms": 85},
    {"code": "ACQ_ATLAS",     "name": "Atlas Interchange",     "currencies": ["ZAR", "USD", "EUR", "GBP", "NGN", "KES", "BWP"],
     "cost_bps": 88, "success_rate": 0.991, "base_latency_ms": 165},
]
ACQ_BY_CODE = {a["code"]: a for a in ACQUIRERS}

# Priority-ordered routing rules. First match wins.
ROUTING_RULES: List[Dict[str, Any]] = [
    {"priority": 10, "currency": "ZAR", "min_minor": 0,      "max_minor": 50_000,     "acquirer": "ACQ_VELA"},
    {"priority": 20, "currency": "ZAR", "min_minor": 50_000, "max_minor": 500_000,    "acquirer": "ACQ_MERIDIAN"},
    {"priority": 30, "currency": "ZAR", "min_minor": 500_000, "max_minor": 10**12,    "acquirer": "ACQ_ATLAS"},
    {"priority": 40, "currency": "NGN", "min_minor": 0,      "max_minor": 10**12,     "acquirer": "ACQ_KOPANO"},
    {"priority": 50, "currency": "KES", "min_minor": 0,      "max_minor": 10**12,     "acquirer": "ACQ_KOPANO"},
    {"priority": 60, "currency": "BWP", "min_minor": 0,      "max_minor": 10**12,     "acquirer": "ACQ_VELA"},
    {"priority": 70, "currency": "USD", "min_minor": 0,      "max_minor": 10**12,     "acquirer": "ACQ_NORTHSTAR"},
    {"priority": 80, "currency": "EUR", "min_minor": 0,      "max_minor": 10**12,     "acquirer": "ACQ_NORTHSTAR"},
    {"priority": 90, "currency": "GBP", "min_minor": 0,      "max_minor": 10**12,     "acquirer": "ACQ_MERIDIAN"},
]


class RouteRequest(BaseModel):
    merchant_id: str
    card_token: str
    amount_minor: int = Field(..., gt=0)
    currency: str
    payment_id: str


class RouteResponse(BaseModel):
    acquirer: str
    acquirer_name: str
    approved: bool
    auth_code: Optional[str] = None
    decline_reason: Optional[str] = None
    cost_bps: int
    acquirer_latency_ms: int
    routed_by_pod: str


def _select(currency: str, amount_minor: int) -> Dict[str, Any]:
    cur = currency.upper()
    for rule in sorted(ROUTING_RULES, key=lambda r: r["priority"]):
        if rule["currency"] == cur and rule["min_minor"] <= amount_minor < rule["max_minor"]:
            return ACQ_BY_CODE[rule["acquirer"]]
    # Fallback: cheapest acquirer that supports the currency.
    candidates = [a for a in ACQUIRERS if cur in a["currencies"]]
    if not candidates:
        raise ConflictError(f"no acquirer supports {cur}", {"currency": cur})
    return min(candidates, key=lambda a: a["cost_bps"])


@router.post("/route", response_model=RouteResponse, summary="Select an acquirer and authorise")
async def route(body: RouteRequest, request: Request) -> Dict[str, Any]:
    acq = _select(body.currency, body.amount_minor)

    # Deterministic per-payment outcome so labs are reproducible: the same
    # payment_id always produces the same approval decision and latency.
    seed = int(hashlib.sha256(body.payment_id.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    approved = rng.random() < acq["success_rate"]
    jitter = rng.randint(-25, 60)
    latency_ms = max(20, acq["base_latency_ms"] + jitter)

    # Simulate the network round trip to the acquirer. This is the largest
    # single component of the 300 ms latency budget, and it is where the
    # Day 2 timeout and probe conversations get their teeth.
    time.sleep(latency_ms / 1000.0)

    result: Dict[str, Any] = {
        "acquirer": acq["code"], "acquirer_name": acq["name"],
        "approved": approved, "cost_bps": acq["cost_bps"],
        "acquirer_latency_ms": latency_ms, "routed_by_pod": settings.pod_name,
        "auth_code": None, "decline_reason": None,
    }
    if approved:
        result["auth_code"] = new_journal_id()[4:10].upper()
    else:
        result["decline_reason"] = rng.choice(
            ["insufficient_funds", "do_not_honour", "issuer_unavailable", "expired_card"])
        log_with(request.app.state.log, "info", "acquirer declined",
                 acquirer=acq["code"], payment_id=body.payment_id, reason=result["decline_reason"])
    return result


@router.get("/acquirers", summary="List acquirers")
async def acquirers() -> Dict[str, Any]:
    return {"acquirers": ACQUIRERS, "count": len(ACQUIRERS)}


@router.get("/rules", summary="List routing rules in priority order")
async def rules() -> Dict[str, Any]:
    return {"rules": sorted(ROUTING_RULES, key=lambda r: r["priority"])}


app = create_app(
    service_name="routing-service",
    description="AxisPay acquirer selection and simulated authorisation.",
    settings=settings,
    routers=[router],
)
