"""
AxisPay edge-gateway
====================
The single public entry point. Everything a merchant sends arrives here.

Responsibilities:
  * terminate the public merchant API contract
  * authenticate the caller via auth-service
  * mint the X-Correlation-Id that ties the whole request together
  * fan out to core services
  * never expose an internal service directly

Day 1: reached with kubectl port-forward.
Day 4: reached through an Ingress with TLS, and it becomes the ONLY workload
       permitted to receive traffic from outside the cluster (NetworkPolicy).

Note what this service does NOT do: it never touches the data tier. That is
NetworkPolicy rule S2 in the architecture document, and it is enforced on
Day 4. A gateway with a database connection is a gateway that has put the DMZ
inside the cardholder data environment.
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, Request, Response
from pydantic import BaseModel, Field

from axispay_common import DownstreamClient, create_app, get_settings
from axispay_common.context import correlation_id
from axispay_common.errors import UnauthorisedError
from axispay_common.logging import log_with

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["gateway"])

auth: Optional[DownstreamClient] = None
payments: Optional[DownstreamClient] = None
merchants: Optional[DownstreamClient] = None


class LoginRequest(BaseModel):
    api_key: str = Field(..., examples=["ak_test_sandbox_0000000000"])


class ChargeRequest(BaseModel):
    amount_minor: int = Field(..., gt=0, examples=[129900])
    currency: str = Field("ZAR", examples=["ZAR"])
    card_token: str = Field(..., examples=["tok_a71ef4c2900bd5386ff1240e"])
    description: Optional[str] = Field(None, max_length=140)
    capture: bool = True


async def _authenticate(authorization: Optional[str]) -> Dict[str, Any]:
    """Verify the bearer token with auth-service.

    The gateway does NOT verify the signature itself. Centralising verification
    means the signing key lives in exactly one Secret, read by exactly one
    service — which is what makes key rotation on Day 5 a one-object change
    instead of a platform-wide redeploy.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorisedError("missing or malformed Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    result = await auth.post("/api/v1/verify", json={"token": token})
    if not result.get("valid"):
        raise UnauthorisedError("token rejected")
    return result


@router.post("/login", summary="Exchange an API key for a bearer token")
async def login(body: LoginRequest) -> Dict[str, Any]:
    return await auth.post("/api/v1/token", json={"api_key": body.api_key})


@router.post("/charges", status_code=201, summary="Take a payment (the merchant-facing endpoint)")
async def create_charge(
    body: ChargeRequest,
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
) -> Dict[str, Any]:
    identity = await _authenticate(authorization)
    merchant_id = identity["merchant_id"]

    log_with(request.app.state.log, "info", "charge received",
             merchant_id=merchant_id, amount_minor=body.amount_minor,
             currency=body.currency, pod=settings.pod_name)

    headers = {"Idempotency-Key": idempotency_key} if idempotency_key else {}
    payment, downstream = await payments.post_with_response(
        "/api/v1/payments",
        json={
            "merchant_id": merchant_id,
            "amount_minor": body.amount_minor,
            "currency": body.currency,
            "card_token": body.card_token,
            "description": body.description,
            "capture": body.capture,
        },
        headers=headers,
    )

    # Propagate the idempotent-replay signal to the merchant. Without this the
    # gateway always answers 201 "Created", so a client that retries after a
    # timeout believes it created a SECOND payment. It did not — but it has no
    # way to know that, and a merchant reconciling their books will see a
    # discrepancy that does not exist.
    if downstream.status_code == 200:
        response.status_code = 200
        response.headers["Idempotent-Replay"] = "true"

    response.headers["X-Correlation-Id"] = correlation_id()
    return payment


@router.get("/charges/{payment_id}", summary="Retrieve a payment")
async def get_charge(payment_id: str, authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    identity = await _authenticate(authorization)
    payment = await payments.get(f"/api/v1/payments/{payment_id}")
    # Authorisation, not just authentication: a merchant may only read its own
    # payments. Omitting this check is one of the most common — and most
    # serious — mistakes in a multi-tenant payment API.
    if payment.get("merchant_id") != identity["merchant_id"]:
        raise UnauthorisedError("this payment does not belong to your merchant account")
    return payment


@router.get("/charges", summary="List your payments")
async def list_charges(authorization: Optional[str] = Header(None), limit: int = 50) -> Dict[str, Any]:
    identity = await _authenticate(authorization)
    rows = await payments.get(
        "/api/v1/payments", params={"merchant_id": identity["merchant_id"], "limit": limit}
    )
    return {"merchant_id": identity["merchant_id"], "payments": rows.get("data", rows)}


@router.get("/account", summary="Your merchant profile")
async def account(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    identity = await _authenticate(authorization)
    return await merchants.get(f"/api/v1/merchants/{identity['merchant_id']}")


@router.get("/platform-status", summary="Reachability of every downstream service")
async def platform_status() -> Dict[str, Any]:
    """A student-facing view of the platform. Used constantly in labs, and it
    is the first thing to run when something breaks."""
    results = {}
    for name, client in (("auth-service", auth), ("payment-service", payments), ("merchant-service", merchants)):
        results[name] = "reachable" if client and await client.probe() else "UNREACHABLE"
    return {
        "gateway_pod": settings.pod_name,
        "gateway_node": settings.node_name,
        "downstream": results,
        "correlation_id": correlation_id(),
    }


async def _startup(app) -> None:
    global auth, payments, merchants
    t = settings.downstream_timeout_seconds
    auth = DownstreamClient("auth-service", settings.auth_service_url, t)
    payments = DownstreamClient("payment-service", settings.payment_service_url, t)
    merchants = DownstreamClient("merchant-service", settings.merchant_service_url, t)

    # auth and payment are on the critical path — without them the gateway
    # cannot serve a charge, so it should leave the Service.
    # merchant-service is reachable indirectly through payment-service, so a
    # direct outage here degrades /account only: non-critical.
    app.state.readiness.register("auth-service", auth.probe, critical=True)
    app.state.readiness.register("payment-service", payments.probe, critical=True)
    app.state.readiness.register("merchant-service", merchants.probe, critical=False)


async def _shutdown(app) -> None:
    for client in (auth, payments, merchants):
        if client:
            await client.close()


app = create_app(
    service_name="edge-gateway",
    description="AxisPay public API gateway — the merchant-facing entry point.",
    settings=settings,
    routers=[router],
    on_startup=_startup,
    on_shutdown=_shutdown,
)
