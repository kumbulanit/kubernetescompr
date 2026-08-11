"""
AxisPay ledger-service
======================
The double-entry ledger. Append-only.

Every payment produces a balanced journal:

    DR  acquirer_receivable   gross     (money owed to us by the acquirer)
    CR  merchant_payable      net       (money we owe the merchant)
    CR  fee_income            fee       (what Axis earned)

    sum(DR) == sum(CR), always, per journal.

TWO RULES, both enforced rather than hoped for:

  1. APPEND ONLY. A correction is a new, opposite journal — never an update
     and never a delete. An auditor must be able to see what was believed at
     any point in time, including what was believed wrongly.

  2. EVERY JOURNAL BALANCES. This service REFUSES to post an unbalanced
     journal. On Day 3 the same invariant is also a CHECK constraint in
     PostgreSQL, so it holds even for a human with psql during an incident.
"""
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel, Field, field_validator

from axispay_common import create_app, get_settings
from axispay_common.errors import NotFoundError, ValidationError
from axispay_common.ids import new_journal_id
from axispay_common.logging import log_with
from axispay_common.money import format_minor

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["ledger"])

_ENTRIES: List[Dict[str, Any]] = []
_BY_JOURNAL: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

ACCOUNTS = {"acquirer_receivable", "merchant_payable", "fee_income",
            "settlement_clearing", "chargeback_reserve"}


class Entry(BaseModel):
    account: str
    direction: str = Field(..., pattern="^(DR|CR)$")
    amount_minor: int = Field(..., gt=0)

    @field_validator("account")
    @classmethod
    def _known_account(cls, v: str) -> str:
        if v not in ACCOUNTS:
            raise ValueError(f"unknown account '{v}'; known: {', '.join(sorted(ACCOUNTS))}")
        return v


class JournalRequest(BaseModel):
    currency: str = Field(..., min_length=3, max_length=3)
    payment_id: Optional[str] = None
    entries: List[Entry] = Field(..., min_length=2)


@router.post("/entries", status_code=201, summary="Post a balanced journal")
async def post_journal(body: JournalRequest, request: Request) -> Dict[str, Any]:
    debits = sum(e.amount_minor for e in body.entries if e.direction == "DR")
    credits = sum(e.amount_minor for e in body.entries if e.direction == "CR")

    # The refusal that makes this a ledger rather than a log.
    if debits != credits:
        log_with(request.app.state.log, "error", "REJECTED unbalanced journal",
                 payment_id=body.payment_id, debits=debits, credits=credits,
                 difference=debits - credits)
        raise ValidationError(
            "journal does not balance — refusing to post",
            {"total_debits": debits, "total_credits": credits, "difference": debits - credits},
        )

    jid = new_journal_id()
    now = datetime.now(timezone.utc).isoformat()
    rows = [{
        "entry_id": len(_ENTRIES) + i + 1, "journal_id": jid,
        "account": e.account, "direction": e.direction,
        "amount_minor": e.amount_minor, "currency": body.currency.upper(),
        "payment_id": body.payment_id, "created_at": now,
    } for i, e in enumerate(body.entries)]

    _ENTRIES.extend(rows)
    _BY_JOURNAL[jid].extend(rows)
    log_with(request.app.state.log, "info", "journal posted",
             journal_id=jid, payment_id=body.payment_id,
             amount=format_minor(debits, body.currency), entries=len(rows))
    return {"journal_id": jid, "entries": len(rows),
            "total_debits": debits, "total_credits": credits, "balanced": True}


@router.get("/journals/{journal_id}", summary="Fetch one journal")
async def get_journal(journal_id: str) -> Dict[str, Any]:
    rows = _BY_JOURNAL.get(journal_id)
    if not rows:
        raise NotFoundError("journal not found", {"journal_id": journal_id})
    d = sum(r["amount_minor"] for r in rows if r["direction"] == "DR")
    c = sum(r["amount_minor"] for r in rows if r["direction"] == "CR")
    return {"journal_id": journal_id, "entries": rows,
            "total_debits": d, "total_credits": c, "balanced": d == c}


@router.get("/balance", summary="THE invariant — imbalance must be zero")
async def balance(currency: Optional[str] = Query(None)) -> Dict[str, Any]:
    by_cur: Dict[str, Dict[str, int]] = defaultdict(lambda: {"debits": 0, "credits": 0})
    by_acct: Dict[str, int] = defaultdict(int)
    for e in _ENTRIES:
        if currency and e["currency"] != currency.upper():
            continue
        if e["direction"] == "DR":
            by_cur[e["currency"]]["debits"] += e["amount_minor"]
            by_acct[e["account"]] += e["amount_minor"]
        else:
            by_cur[e["currency"]]["credits"] += e["amount_minor"]
            by_acct[e["account"]] -= e["amount_minor"]

    positions = [{
        "currency": cur, "total_debits": v["debits"], "total_credits": v["credits"],
        "imbalance": v["debits"] - v["credits"],
        "display": format_minor(v["debits"], cur),
    } for cur, v in sorted(by_cur.items())]

    return {
        "positions": positions,
        "account_balances_minor": dict(by_acct),
        "total_entries": len(_ENTRIES),
        "journals": len(_BY_JOURNAL),
        # If this is ever False, a human must explain it before close of business.
        "all_balanced": all(p["imbalance"] == 0 for p in positions),
        "computed_by_pod": settings.pod_name,
    }


@router.get("/entries", summary="List entries (append-only)")
async def list_entries(payment_id: Optional[str] = Query(None), limit: int = Query(100, ge=1, le=500)):
    rows = _ENTRIES
    if payment_id:
        rows = [e for e in rows if e["payment_id"] == payment_id]
    return {"entries": rows[-limit:], "count": len(rows)}


app = create_app(
    service_name="ledger-service",
    description="AxisPay double-entry ledger. Append-only; refuses unbalanced journals.",
    settings=settings, routers=[router],
)
