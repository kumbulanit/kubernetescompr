"""
AxisPay merchant-service
========================
Merchant master data: legal entity, KYC status, MCC, pricing (MDR in basis
points plus a fixed fee), settlement currency and webhook endpoint.

payment-service calls this on every authorisation to work out what to charge
the merchant. That makes it a hard dependency of the payment path, which is
why it is registered as a CRITICAL readiness check by its callers.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from axispay_common import create_app, get_settings
from axispay_common.errors import NotFoundError
from axispay_common.money import Money
from axispay_common.seed import MERCHANTS, MERCHANTS_BY_ID

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["merchants"])


class Merchant(BaseModel):
    merchant_id: str
    legal_name: str
    trading_name: str
    country: str
    mcc: str
    kyc_status: str
    mdr_bps: int
    fixed_fee_minor: int
    settlement_currency: str
    webhook_url: str
    active: bool


@router.get("/merchants", response_model=List[Merchant], summary="List merchants")
async def list_merchants(
    country: Optional[str] = Query(None, description="ISO-3166 alpha-2, e.g. ZA"),
    active: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=100),
) -> List[Dict[str, Any]]:
    rows = MERCHANTS
    if country:
        rows = [m for m in rows if m["country"] == country.upper()]
    if active is not None:
        rows = [m for m in rows if m["active"] is active]
    return rows[:limit]


@router.get("/merchants/{merchant_id}", response_model=Merchant, summary="Fetch one merchant")
async def get_merchant(merchant_id: str) -> Dict[str, Any]:
    merchant = MERCHANTS_BY_ID.get(merchant_id)
    if not merchant:
        raise NotFoundError("merchant not found", {"merchant_id": merchant_id})
    return merchant


@router.get("/merchants/{merchant_id}/pricing", summary="Quote the fee for an amount")
async def quote_pricing(merchant_id: str, amount_minor: int, currency: str) -> Dict[str, Any]:
    """Fee = (amount x MDR bps) + fixed fee. Integer arithmetic throughout.

    Students see this on Day 1 and it becomes the settlement calculation on
    Day 4 — the same function, moved into a batch job.
    """
    merchant = MERCHANTS_BY_ID.get(merchant_id)
    if not merchant:
        raise NotFoundError("merchant not found", {"merchant_id": merchant_id})

    gross = Money(amount_minor, currency.upper())
    variable = gross.basis_points(merchant["mdr_bps"])
    fixed = Money(merchant["fixed_fee_minor"], currency.upper())
    fee = variable + fixed
    net = gross - fee

    return {
        "merchant_id": merchant_id,
        "currency": currency.upper(),
        "gross_minor": gross.amount_minor,
        "mdr_bps": merchant["mdr_bps"],
        "variable_fee_minor": variable.amount_minor,
        "fixed_fee_minor": fixed.amount_minor,
        "total_fee_minor": fee.amount_minor,
        "net_minor": net.amount_minor,
        "display": {"gross": str(gross), "fee": str(fee), "net": str(net)},
    }


app = create_app(
    service_name="merchant-service",
    description="AxisPay merchant master data and pricing.",
    settings=settings,
    routers=[router],
)
