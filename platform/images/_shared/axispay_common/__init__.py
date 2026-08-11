"""
axispay_common — shared runtime for every AxisPay microservice.

Every service in the platform is built on this library, which is why all sixteen
services expose an identical operational surface:

    /healthz    liveness   — is the process alive?
    /readyz     readiness  — can THIS instance serve traffic right now?
    /startupz   startup    — has initialisation finished?
    /metrics    Prometheus exposition
    /api/v1/_info          — version, pod, node  (makes load balancing visible)

That uniformity is a teaching decision. Once a student understands one service,
they understand all sixteen, and probe / metric / policy manifests become
predictable rather than bespoke.
"""

__version__ = "1.0.0"

from axispay_common.app import create_app
from axispay_common.config import Settings, get_settings
from axispay_common.context import correlation_id
from axispay_common.errors import (AxisPayError, ConflictError, DownstreamError, NotFoundError,
                                   UnauthorisedError, UpstreamRejectedError, ValidationError)
from axispay_common.http import DownstreamClient
from axispay_common.ids import new_correlation_id, new_merchant_id, new_payment_id, new_reference, new_token
from axispay_common.money import Money, format_minor, parse_major_to_minor
from axispay_common.readiness import ReadinessRegistry

__all__ = [
    "create_app", "Settings", "get_settings", "correlation_id",
    "AxisPayError", "ConflictError", "DownstreamError", "NotFoundError",
    "UnauthorisedError", "UpstreamRejectedError", "ValidationError",
    "DownstreamClient", "ReadinessRegistry", "Money", "format_minor",
    "parse_major_to_minor", "new_correlation_id", "new_merchant_id",
    "new_payment_id", "new_reference", "new_token", "__version__",
]
