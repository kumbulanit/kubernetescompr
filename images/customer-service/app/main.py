"""
AxisPay customer-service
========================
Cardholder profiles and card TOKENS.

There is no PAN column, no PAN field and no PAN anywhere in this service. It
stores a token of the form tok_… plus brand and last four digits — enough to
show a customer "Visa ending 4242" and nothing else.

That boundary is what keeps axispay-edge out of the cardholder data
environment, and it is why this service lives in axispay-core while the
gateway does not.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field, field_validator

from axispay_common import create_app, get_settings
from axispay_common.errors import NotFoundError, ValidationError
from axispay_common.ids import new_token
from axispay_common.logging import log_with
from axispay_common.seed import CARD_TOKENS, MERCHANTS_BY_ID, TOKENS_BY_ID

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["customers"])

# Replaced by PostgreSQL on Day 3 (L3.5). Same shape, same API.
_CUSTOMERS: Dict[str, Dict[str, Any]] = {}
_BY_TOKEN: Dict[str, str] = {}


def _seed() -> None:
    merchants = [m for m in MERCHANTS_BY_ID.values() if m["active"]][:6]
    names = ["Thabo Molefe", "Nomsa Dlamini", "Sipho Naidoo",
             "Lerato Mahlangu", "Aisha Abubakar", "Kwame Mensah"]
    for i, card in enumerate(CARD_TOKENS):
        m = merchants[i % len(merchants)]
        name = names[i % len(names)]
        cid = f"cus_seed{i:016x}"
        _CUSTOMERS[cid] = {
            "customer_id": cid, "merchant_id": m["merchant_id"],
            "full_name": name,
            "email": name.lower().replace(" ", ".") + "@example.com",
            "country": m["country"],
            "card_token": card["card_token"], "card_brand": card["brand"],
            "card_last4": card["last4"], "issuer_country": card["issuer_country"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _BY_TOKEN[card["card_token"]] = cid


class ResolveRequest(BaseModel):
    merchant_id: str
    card_token: str = Field(..., examples=["tok_a71ef4c2900bd5386ff1240e"])
    email: Optional[str] = None
    full_name: Optional[str] = None

    @field_validator("card_token")
    @classmethod
    def _must_be_a_token(cls, v: str) -> str:
        # Defence in depth. A card number must never enter this platform —
        # not even to be rejected further down the call chain.
        if not v.startswith("tok_"):
            raise ValueError("card_token must be a token (tok_...); raw card numbers are never accepted")
        return v


class Customer(BaseModel):
    customer_id: str
    merchant_id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    country: Optional[str] = None
    card_token: str
    card_brand: str
    card_last4: str
    issuer_country: Optional[str] = None
    created_at: str


@router.post("/customers/resolve", response_model=Customer, summary="Find or create a customer by card token")
async def resolve(body: ResolveRequest, request: Request) -> Dict[str, Any]:
    existing = _BY_TOKEN.get(body.card_token)
    if existing:
        return _CUSTOMERS[existing]

    card = TOKENS_BY_ID.get(body.card_token)
    if not card:
        raise ValidationError("unknown card token", {"card_token": body.card_token})
    if body.merchant_id not in MERCHANTS_BY_ID:
        raise NotFoundError("merchant not found", {"merchant_id": body.merchant_id})

    cid = f"cus_{new_token()[4:]}"
    rec = {
        "customer_id": cid, "merchant_id": body.merchant_id,
        "full_name": body.full_name, "email": body.email,
        "country": MERCHANTS_BY_ID[body.merchant_id]["country"],
        "card_token": body.card_token, "card_brand": card["brand"],
        "card_last4": card["last4"], "issuer_country": card["issuer_country"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _CUSTOMERS[cid] = rec
    _BY_TOKEN[body.card_token] = cid
    log_with(request.app.state.log, "info", "customer created",
             customer_id=cid, merchant_id=body.merchant_id, card_brand=card["brand"])
    return rec


@router.get("/customers/{customer_id}", response_model=Customer, summary="Fetch a customer")
async def get_customer(customer_id: str) -> Dict[str, Any]:
    rec = _CUSTOMERS.get(customer_id)
    if not rec:
        raise NotFoundError("customer not found", {"customer_id": customer_id})
    return rec


@router.get("/customers", response_model=List[Customer], summary="List customers")
async def list_customers(merchant_id: Optional[str] = Query(None), limit: int = Query(50, ge=1, le=200)):
    rows = list(_CUSTOMERS.values())
    if merchant_id:
        rows = [c for c in rows if c["merchant_id"] == merchant_id]
    return rows[:limit]


async def _startup(app) -> None:
    _seed()
    log_with(app.state.log, "info", "seeded customers", count=len(_CUSTOMERS))


app = create_app(
    service_name="customer-service",
    description="AxisPay cardholder profiles and card tokens. No PAN exists here.",
    settings=settings, routers=[router], on_startup=_startup,
)
