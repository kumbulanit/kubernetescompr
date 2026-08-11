"""
AxisPay payment-service
=======================
The orchestrator. Owns the payment lifecycle and is the service everything
else in the platform exists to support.

Lifecycle:
    created -> risk_checked -> routed -> authorized -> captured -> settled
    with refunded / voided / declined / failed as terminal branches.

Day 1 scope: created -> authorized -> captured, with merchant-service as the
only downstream dependency and payments held in memory. Fraud, routing and
ledger are wired in on Days 2-3, and PostgreSQL replaces the dictionary on
Day 3 without this file's business logic changing.

IDEMPOTENCY is implemented from day one, not bolted on later. In payments,
retrying a request must never charge a customer twice. A client that times
out and retries with the same Idempotency-Key gets the SAME payment back,
not a second one. Students see this work on Day 1 and understand why it
matters on Day 2 when a rolling update causes real retries.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, Query, Request, Response
from pydantic import BaseModel, Field, field_validator

from axispay_common import DownstreamClient, create_app, get_settings
from axispay_common.errors import ConflictError, NotFoundError, ValidationError
from axispay_common.ids import new_payment_id, new_reference
from axispay_common.logging import log_with
from axispay_common.metrics import PAYMENTS
from axispay_common.money import Money, format_minor
from axispay_common.seed import TOKENS_BY_ID

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["payments"])

# In-memory stores — replaced by PostgreSQL on Day 3 (L3.5).
_PAYMENTS: Dict[str, Dict[str, Any]] = {}
_IDEMPOTENCY: Dict[str, str] = {}       # idempotency key -> payment_id

merchants: Optional[DownstreamClient] = None
fraud: Optional[DownstreamClient] = None
routing: Optional[DownstreamClient] = None


# ----------------------------------------------------------------- schemas
class PaymentRequest(BaseModel):
    merchant_id: str = Field(..., examples=["MER_7QK2XD9P4A"])
    amount_minor: int = Field(..., gt=0, examples=[129900],
                              description="Integer, MINOR units. 129900 ZAR = R1,299.00")
    currency: str = Field(..., min_length=3, max_length=3, examples=["ZAR"])
    card_token: str = Field(..., examples=["tok_a71ef4c2900bd5386ff1240e"],
                            description="A card TOKEN. AxisPay never receives a card number.")
    description: Optional[str] = Field(None, max_length=140)
    capture: bool = Field(True, description="Capture immediately, or authorise only")

    @field_validator("currency")
    @classmethod
    def _currency_supported(cls, v: str) -> str:
        v = v.upper()
        if v not in settings.currencies:
            raise ValueError(f"unsupported currency {v}; supported: {', '.join(settings.currencies)}")
        return v

    @field_validator("card_token")
    @classmethod
    def _looks_like_token(cls, v: str) -> str:
        # Defence in depth: refuse anything that looks like a PAN. A card number
        # must never enter this platform, not even to be rejected later.
        if not v.startswith("tok_"):
            raise ValueError("card_token must be a token (tok_...); raw card numbers are never accepted")
        return v


class Payment(BaseModel):
    payment_id: str
    reference: str
    merchant_id: str
    amount_minor: int
    currency: str
    status: str
    card_brand: Optional[str] = None
    card_last4: Optional[str] = None
    fee_minor: Optional[int] = None
    net_minor: Optional[int] = None
    description: Optional[str] = None
    risk_score: Optional[int] = None
    acquirer: Optional[str] = None
    auth_code: Optional[str] = None
    decline_reason: Optional[str] = None
    created_at: str
    updated_at: str
    display_amount: Optional[str] = None


# ----------------------------------------------------------------- routes
@router.post("/payments", response_model=Payment, status_code=201, summary="Create a payment")
async def create_payment(
    body: PaymentRequest,
    request: Request,
    response: Response,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
) -> Dict[str, Any]:
    log = request.app.state.log

    # --- 1. Idempotency ---------------------------------------------------
    if idempotency_key and idempotency_key in _IDEMPOTENCY:
        existing = _PAYMENTS[_IDEMPOTENCY[idempotency_key]]
        response.status_code = 200
        response.headers["Idempotent-Replay"] = "true"
        log_with(log, "info", "idempotent replay", payment_id=existing["payment_id"])
        return existing

    # --- 2. Validate the card token --------------------------------------
    card = TOKENS_BY_ID.get(body.card_token)
    if not card:
        raise ValidationError("unknown card token", {"card_token": body.card_token})

    # --- 3. Merchant lookup and pricing (downstream call) ----------------
    merchant = await merchants.get(f"/api/v1/merchants/{body.merchant_id}")
    if not merchant.get("active"):
        raise ConflictError("merchant is not active", {"merchant_id": body.merchant_id})
    if merchant.get("kyc_status") != "verified":
        raise ConflictError(
            "merchant KYC is not verified — payments are not permitted",
            {"merchant_id": body.merchant_id, "kyc_status": merchant.get("kyc_status")},
        )

    pricing = await merchants.get(
        f"/api/v1/merchants/{body.merchant_id}/pricing",
        params={"amount_minor": body.amount_minor, "currency": body.currency},
    )

    # --- 4. Risk and routing (v1.1.0 — added on Day 2) --------------------
    # Gated by a feature flag so the SAME image can run with the Day 1 flow or
    # the Day 2 flow. L2.6 rolls out 1.0.0 -> 1.1.0 with this flag enabled,
    # which is a realistic release: new image AND new configuration together.
    now = datetime.now(timezone.utc)
    payment_id = new_payment_id()
    risk_score: Optional[int] = None
    acquirer: Optional[str] = None
    auth_code: Optional[str] = None
    decline_reason: Optional[str] = None
    status = "captured" if body.capture else "authorized"

    if settings.enable_risk_routing:
        assessment = await fraud.post("/api/v1/score", json={
            "merchant_id": body.merchant_id, "card_token": body.card_token,
            "amount_minor": body.amount_minor, "currency": body.currency,
        })
        risk_score = assessment["score"]
        if assessment["decision"] == "decline":
            PAYMENTS.labels("payment-service", "declined", body.currency).inc()
            log_with(log, "warning", "payment declined by fraud",
                     payment_id=payment_id, score=risk_score, reasons=assessment["reasons"])
            raise ConflictError("payment declined by risk assessment",
                                {"score": risk_score, "reasons": assessment["reasons"]})

        decision = await routing.post("/api/v1/route", json={
            "merchant_id": body.merchant_id, "card_token": body.card_token,
            "amount_minor": body.amount_minor, "currency": body.currency,
            "payment_id": payment_id,
        })
        acquirer = decision["acquirer"]
        if decision["approved"]:
            auth_code = decision["auth_code"]
        else:
            status = "declined"
            decline_reason = decision["decline_reason"]

    money = Money(body.amount_minor, body.currency)

    payment: Dict[str, Any] = {
        "payment_id": payment_id,
        "reference": new_reference(now),
        "merchant_id": body.merchant_id,
        "amount_minor": body.amount_minor,
        "currency": body.currency,
        "status": status,
        "card_brand": card["brand"],
        "card_last4": card["last4"],
        "fee_minor": pricing["total_fee_minor"],
        "net_minor": pricing["net_minor"],
        "description": body.description,
        "risk_score": risk_score,
        "acquirer": acquirer,
        "auth_code": auth_code,
        "decline_reason": decline_reason,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "display_amount": format_minor(body.amount_minor, body.currency),
    }
    _PAYMENTS[payment_id] = payment
    if idempotency_key:
        _IDEMPOTENCY[idempotency_key] = payment_id

    PAYMENTS.labels("payment-service", status, body.currency).inc()
    log_with(log, "info", "payment created",
             payment_id=payment_id, merchant_id=body.merchant_id, status=status,
             amount_minor=body.amount_minor, currency=body.currency,
             reference=payment["reference"], pod=settings.pod_name,
             risk_score=risk_score, acquirer=acquirer)
    return payment


@router.get("/payments/{payment_id}", response_model=Payment, summary="Fetch a payment")
async def get_payment(payment_id: str) -> Dict[str, Any]:
    payment = _PAYMENTS.get(payment_id)
    if not payment:
        raise NotFoundError("payment not found", {"payment_id": payment_id})
    return payment


@router.get("/payments", response_model=List[Payment], summary="List payments")
async def list_payments(
    merchant_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> List[Dict[str, Any]]:
    rows = list(_PAYMENTS.values())
    if merchant_id:
        rows = [p for p in rows if p["merchant_id"] == merchant_id]
    if status:
        rows = [p for p in rows if p["status"] == status]
    return sorted(rows, key=lambda p: p["created_at"], reverse=True)[:limit]


@router.post("/payments/{payment_id}/refund", response_model=Payment, summary="Refund a payment")
async def refund_payment(payment_id: str, request: Request) -> Dict[str, Any]:
    payment = _PAYMENTS.get(payment_id)
    if not payment:
        raise NotFoundError("payment not found", {"payment_id": payment_id})
    if payment["status"] != "captured":
        raise ConflictError(
            "only captured payments can be refunded",
            {"payment_id": payment_id, "status": payment["status"]},
        )
    payment["status"] = "refunded"
    payment["updated_at"] = datetime.now(timezone.utc).isoformat()
    PAYMENTS.labels("payment-service", "refunded", payment["currency"]).inc()
    log_with(request.app.state.log, "info", "payment refunded", payment_id=payment_id)
    return payment


@router.get("/payments-stats", summary="Aggregate counters (used by the Day 5 dashboard)")
async def stats() -> Dict[str, Any]:
    rows = list(_PAYMENTS.values())
    by_status: Dict[str, int] = {}
    by_currency: Dict[str, int] = {}
    for p in rows:
        by_status[p["status"]] = by_status.get(p["status"], 0) + 1
        by_currency[p["currency"]] = by_currency.get(p["currency"], 0) + p["amount_minor"]
    return {
        "total_payments": len(rows),
        "by_status": by_status,
        "volume_minor_by_currency": by_currency,
        "served_by_pod": settings.pod_name,
    }


# ----------------------------------------------------------------- wiring
async def _startup(app) -> None:
    global merchants, fraud, routing
    t = settings.downstream_timeout_seconds
    merchants = DownstreamClient("merchant-service", settings.merchant_service_url, t)
    # merchant-service is on the payment path, so it is a CRITICAL readiness
    # check: if it is unreachable, this pod cannot serve payments and must be
    # taken out of the Service. It must NOT affect liveness — see readiness.py.
    app.state.readiness.register("merchant-service", merchants.probe, critical=True)

    if settings.enable_risk_routing:
        fraud = DownstreamClient("fraud-service", settings.fraud_service_url, t)
        routing = DownstreamClient("routing-service", settings.routing_service_url, t)
        # Both are on the payment path from v1.1.0, so both are CRITICAL: if
        # either is unreachable this pod cannot authorise a payment and must
        # leave the Service. Note it must still NOT affect liveness — a fraud
        # outage that restarted every payment pod would turn a degraded
        # service into a total one.
        app.state.readiness.register("fraud-service", fraud.probe, critical=True)
        app.state.readiness.register("routing-service", routing.probe, critical=True)


async def _shutdown(app) -> None:
    for client in (merchants, fraud, routing):
        if client:
            await client.close()


app = create_app(
    service_name="payment-service",
    description="AxisPay payment orchestration — the core of the platform.",
    settings=settings,
    routers=[router],
    on_startup=_startup,
    on_shutdown=_shutdown,
)
