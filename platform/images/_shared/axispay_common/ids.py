"""Identifier generation.

Formats are fixed in documents/reference/01-ARCHITECTURE.md §6.2 and are used consistently
across every service, manifest, lab and slide. Students learn to recognise an
AxisPay identifier on sight, which makes log correlation far easier on Day 5.
"""
import secrets
import uuid
from datetime import datetime, timezone

_MERCHANT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # no I/O/0/1 — avoids read-aloud errors


def new_merchant_id() -> str:
    """MER_7QK2XD9P4A"""
    return "MER_" + "".join(secrets.choice(_MERCHANT_ALPHABET) for _ in range(10))


def new_payment_id() -> str:
    """pay_9f2c41ab77de0c3518be4d6a"""
    return "pay_" + secrets.token_hex(12)


def new_token() -> str:
    """tok_a71ef4c2900bd5386ff1240e — a card TOKEN. No PAN exists in this platform."""
    return "tok_" + secrets.token_hex(12)


def new_reference(when: "datetime | None" = None) -> str:
    """AXP-20260803-4c9a1f77 — the reference a merchant quotes in a support ticket."""
    when = when or datetime.now(timezone.utc)
    return f"AXP-{when:%Y%m%d}-{secrets.token_hex(4)}"


def new_correlation_id() -> str:
    return str(uuid.uuid4())


def new_journal_id() -> str:
    return "jnl_" + secrets.token_hex(10)
