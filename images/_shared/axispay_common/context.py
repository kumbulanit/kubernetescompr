"""Correlation IDs.

edge-gateway mints an X-Correlation-Id for every inbound merchant request and
every downstream call carries it forward. On Day 1 students implement this
without being told why.

On Day 5, in Loki, they take a single latency spike in Grafana and pull back
every log line from all seven services involved in that one payment — because
of this file. The callback to Monday is deliberate and it lands hard.
"""
from contextvars import ContextVar
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

from axispay_common.ids import new_correlation_id

HEADER = "X-Correlation-Id"

_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="-")


def correlation_id() -> str:
    return _correlation_id.get()


def set_correlation_id(value: Optional[str]) -> str:
    cid = value or new_correlation_id()
    _correlation_id.set(cid)
    return cid


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Accept an inbound correlation ID or mint one, and always echo it back."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        cid = set_correlation_id(request.headers.get(HEADER))
        request.state.correlation_id = cid
        response = await call_next(request)
        response.headers[HEADER] = cid
        return response
