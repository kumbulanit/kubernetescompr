"""
AxisPay auth-service
====================
Exchanges a merchant API key for a short-lived bearer token, and verifies
tokens on behalf of edge-gateway.

Holds NO cardholder data. That is why it lives in axispay-edge (the DMZ) and
not in axispay-core (the cardholder data environment) — keeping it out of the
CDE keeps it out of PCI scope, which is a real architectural decision and not
an arbitrary namespace choice.

Day 1: tokens are held in memory.
Day 3: the signing key moves to a Kubernetes Secret.
Day 5: RBAC and a dedicated ServiceAccount are applied.
"""
import hashlib
import hmac
import json
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode
from typing import Any, Dict

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from axispay_common import create_app, get_settings
from axispay_common.errors import UnauthorisedError
from axispay_common.logging import log_with
from axispay_common.seed import API_KEYS, MERCHANTS_BY_ID

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["auth"])


# --------------------------------------------------------------------------
# Minimal JWT-style token. Deliberately hand-rolled and deliberately simple:
# the course is about Kubernetes, not about JOSE. It is signed with HMAC so
# students can see that a token is *verifiable*, not *secret*.
# --------------------------------------------------------------------------
def _b64(raw: bytes) -> str:
    return urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(payload: Dict[str, Any], key: str) -> str:
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    signature = _b64(hmac.new(key.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{signature}"


def _verify(token: str, key: str) -> Dict[str, Any]:
    try:
        header, body, signature = token.split(".")
    except ValueError:
        raise UnauthorisedError("malformed token")
    expected = _b64(hmac.new(key.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        raise UnauthorisedError("invalid token signature")
    payload = json.loads(_unb64(body))
    if payload.get("exp", 0) < int(time.time()):
        raise UnauthorisedError("token expired")
    return payload


class TokenRequest(BaseModel):
    api_key: str = Field(..., examples=["ak_test_sandbox_0000000000"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    merchant_id: str


class VerifyRequest(BaseModel):
    token: str


@router.post("/token", response_model=TokenResponse, summary="Exchange an API key for a bearer token")
async def issue_token(body: TokenRequest, request: Request) -> TokenResponse:
    merchant_id = API_KEYS.get(body.api_key)
    if not merchant_id:
        # Never echo the key back — it would land in logs and in Loki on Day 5.
        log_with(request.app.state.log, "warning", "token request rejected", reason="unknown_api_key")
        raise UnauthorisedError("unknown API key")

    merchant = MERCHANTS_BY_ID[merchant_id]
    if not merchant["active"]:
        raise UnauthorisedError("merchant is not active", {"merchant_id": merchant_id})

    now = int(time.time())
    payload = {
        "sub": merchant_id,
        "name": merchant["trading_name"],
        "scopes": ["payments:create", "payments:read", "merchants:read"],
        "iat": now,
        "exp": now + settings.token_ttl_seconds,
        "iss": "axispay-auth",
    }
    log_with(request.app.state.log, "info", "token issued", merchant_id=merchant_id)
    return TokenResponse(
        access_token=_sign(payload, settings.jwt_signing_key),
        expires_in=settings.token_ttl_seconds,
        merchant_id=merchant_id,
    )


@router.post("/verify", summary="Verify a bearer token")
async def verify_token(body: VerifyRequest) -> Dict[str, Any]:
    payload = _verify(body.token, settings.jwt_signing_key)
    return {
        "valid": True,
        "merchant_id": payload["sub"],
        "merchant_name": payload.get("name"),
        "scopes": payload.get("scopes", []),
        "expires_at": payload["exp"],
    }


app = create_app(
    service_name="auth-service",
    description="Issues and verifies AxisPay merchant bearer tokens.",
    settings=settings,
    routers=[router],
)
