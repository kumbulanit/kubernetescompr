"""Error types and RFC-7807-shaped problem responses.

Every service returns errors in the same envelope, so the gateway can pass
them through unchanged and a merchant sees one consistent contract.
"""
from typing import Any, Dict, Optional

from fastapi import Request
from fastapi.responses import JSONResponse

from axispay_common.context import correlation_id


class AxisPayError(Exception):
    status_code = 500
    error_code = "internal_error"

    def __init__(self, message: str, detail: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail or {}


class NotFoundError(AxisPayError):
    status_code = 404
    error_code = "not_found"


class ValidationError(AxisPayError):
    status_code = 422
    error_code = "validation_failed"


class UnauthorisedError(AxisPayError):
    status_code = 401
    error_code = "unauthorised"


class ConflictError(AxisPayError):
    status_code = 409
    error_code = "conflict"


class DownstreamError(AxisPayError):
    """A dependency is BROKEN — unreachable, timed out, or returned 5xx.

    502, not 500: the fault is on the other side of the boundary. That
    distinction is what tells an on-call engineer which team to page.
    """
    status_code = 502
    error_code = "downstream_unavailable"


class UpstreamRejectedError(AxisPayError):
    """A dependency REJECTED the request — 4xx, not 5xx. Very different thing.

    This exists because of a bug found while testing this platform, and it is
    worth understanding.

    When a merchant sends an unsupported currency, payment-service correctly
    replies 422. If edge-gateway treats every non-2xx from a downstream service
    as a failure, it converts that 422 into a 502 "downstream unavailable".
    The consequences are bad in three directions at once:

      * The merchant is told AxisPay is broken, when in fact their request was
        invalid — so they retry it, forever, and it fails every time.
      * The 5xx error-rate metric climbs, the availability SLO burns, and
        Alertmanager pages the platform team at 03:00 for a customer typo.
      * The real cause — a validation failure — is invisible on every dashboard.

    Rule: propagate the ORIGINAL status for 4xx. A client error stays a client
    error no matter how many services it passes through.
    """
    error_code = "rejected"

    def __init__(self, message: str, status_code: int = 400,
                 detail: Optional[Dict[str, Any]] = None,
                 error_code: Optional[str] = None) -> None:
        super().__init__(message, detail)
        self.status_code = status_code
        if error_code:
            self.error_code = error_code


async def axispay_error_handler(request: Request, exc: AxisPayError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.error_code,
            "message": exc.message,
            "detail": exc.detail,
            "correlation_id": correlation_id(),
        },
    )
