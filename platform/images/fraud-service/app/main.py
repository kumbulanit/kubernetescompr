"""
AxisPay fraud-service
=====================
Returns a risk score 0-100 and a decision: approve / review / decline.

Scoring inputs (all fictional, all deterministic so labs are reproducible):
  * velocity      — how many payments this card has attempted recently
  * amount        — deviation from the merchant's typical ticket size
  * geography     — issuer country vs merchant country mismatch
  * merchant risk — MCC-based baseline

Day 2: velocity counters are in memory. That is WRONG and deliberately so —
with three replicas, each pod sees only its own share of the traffic, so the
velocity check is a third as effective as it looks. Students find this in the
L2.4 challenge. Day 3 moves the counters into Redis and fixes it.

This service is CPU-bound on purpose. It does real work per request so that
the Day 2 HPA lab has something to scale on. Without a service that actually
consumes CPU, an autoscaling lab is theatre.
"""
import hashlib
import math
import time
from collections import defaultdict, deque
from typing import Any, Deque, Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from axispay_common import create_app, get_settings
from axispay_common.logging import log_with
from axispay_common.seed import MERCHANTS_BY_ID, TOKENS_BY_ID

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["fraud"])

# card_token -> timestamps of recent attempts (in memory: see module docstring)
_VELOCITY: Dict[str, Deque[float]] = defaultdict(lambda: deque(maxlen=64))
VELOCITY_WINDOW_SECONDS = 300

# MCC risk baselines. Higher = riskier merchant category.
_MCC_RISK = {
    "4722": 18,  # travel agencies — high chargeback
    "5967": 25,  # direct marketing
    "7995": 30,  # betting
    "6012": 22,  # financial institutions
    "5912": 6,   # pharmacies
    "5411": 4,   # grocery
    "5499": 5,   # food specialty
    "7372": 10,  # software
    "4214": 7,   # freight
}


class ScoreRequest(BaseModel):
    merchant_id: str
    card_token: str
    amount_minor: int = Field(..., gt=0)
    currency: str


class ScoreResponse(BaseModel):
    score: int
    decision: str
    reasons: List[str]
    scored_by_pod: str


def _work_factor(payload: str) -> float:
    """Deterministic CPU load, ~4-8 ms.

    A real fraud engine evaluates a model. This stands in for that cost so the
    HPA lab scales on genuine CPU consumption rather than a sleep() — you
    cannot demonstrate horizontal scaling with a service that does no work.
    """
    digest = payload.encode()
    for _ in range(1200):
        digest = hashlib.sha256(digest).digest()
    return int.from_bytes(digest[:2], "big") / 65535.0


@router.post("/score", response_model=ScoreResponse, summary="Score a payment for risk")
async def score(body: ScoreRequest, request: Request) -> Dict[str, Any]:
    now = time.monotonic()
    reasons: List[str] = []
    total = 0

    # --- 1. velocity -----------------------------------------------------
    hits = _VELOCITY[body.card_token]
    hits.append(now)
    recent = sum(1 for t in hits if now - t <= VELOCITY_WINDOW_SECONDS)
    if recent > 8:
        total += 45; reasons.append(f"velocity: {recent} attempts in 5 min")
    elif recent > 4:
        total += 22; reasons.append(f"velocity: {recent} attempts in 5 min")
    elif recent > 2:
        total += 8; reasons.append(f"velocity: {recent} attempts in 5 min")

    # --- 2. merchant category --------------------------------------------
    merchant = MERCHANTS_BY_ID.get(body.merchant_id)
    if merchant:
        mcc_risk = _MCC_RISK.get(merchant["mcc"], 8)
        total += mcc_risk
        if mcc_risk >= 18:
            reasons.append(f"merchant category {merchant['mcc']} is elevated risk")
    else:
        total += 30; reasons.append("unknown merchant")

    # --- 3. amount deviation ---------------------------------------------
    # Typical ticket approximated from the merchant's fixed fee band.
    typical = (merchant or {}).get("fixed_fee_minor", 150) * 900
    if body.amount_minor > typical * 6:
        total += 25; reasons.append("amount far above typical ticket size")
    elif body.amount_minor > typical * 3:
        total += 10; reasons.append("amount above typical ticket size")

    # --- 4. geography -----------------------------------------------------
    card = TOKENS_BY_ID.get(body.card_token)
    if card and merchant and card["issuer_country"] != merchant["country"]:
        total += 12
        reasons.append(f"cross-border: card {card['issuer_country']} vs merchant {merchant['country']}")

    # --- 5. model evaluation (the CPU cost) --------------------------------
    noise = _work_factor(f"{body.merchant_id}{body.card_token}{body.amount_minor}")
    total += int(noise * 8)

    total = max(0, min(100, total))
    decision = "decline" if total >= 75 else "review" if total >= 45 else "approve"
    if not reasons:
        reasons.append("no risk signals")

    if decision != "approve":
        log_with(request.app.state.log, "warning", "elevated risk",
                 merchant_id=body.merchant_id, score=total, decision=decision, reasons=reasons)

    return {"score": total, "decision": decision, "reasons": reasons,
            "scored_by_pod": settings.pod_name}


@router.get("/velocity/{card_token}", summary="Inspect velocity counters (lab aid)")
async def velocity(card_token: str) -> Dict[str, Any]:
    now = time.monotonic()
    hits = _VELOCITY.get(card_token, deque())
    return {
        "card_token": card_token,
        "recent_attempts": sum(1 for t in hits if now - t <= VELOCITY_WINDOW_SECONDS),
        "window_seconds": VELOCITY_WINDOW_SECONDS,
        # This field is the point of the L2.4 challenge: each replica has its
        # own counters, so the number below is only this pod's view.
        "counted_by_pod": settings.pod_name,
        "warning": "in-memory per-pod counters — see Day 3 for the Redis fix",
    }


app = create_app(
    service_name="fraud-service",
    description="AxisPay risk scoring. CPU-bound by design so autoscaling is demonstrable.",
    settings=settings,
    routers=[router],
)
