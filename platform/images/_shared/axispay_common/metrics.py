"""Prometheus metrics.

The four series defined here are the golden signals for a payment platform,
and they are what students query on Day 5:

    traffic   axispay_http_requests_total
    latency   axispay_http_request_duration_seconds
    errors    axispay_http_requests_total{status=~"5.."}
    saturation  in-flight gauge + container metrics from cAdvisor

axispay_payments_total is the business metric — the one an operations manager
actually cares about. Approval rate per acquirer comes from it.
"""
import logging
import time

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUESTS = Counter(
    "axispay_http_requests_total", "Total HTTP requests",
    ["service", "method", "path", "status"],
)
LATENCY = Histogram(
    "axispay_http_request_duration_seconds", "HTTP request duration",
    ["service", "method", "path"],
    # Buckets chosen around the 300 ms p99 SLO so the histogram is useful
    # exactly where the alert threshold sits.
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1.0, 2.5, 5.0),
)
IN_FLIGHT = Gauge("axispay_http_requests_in_flight", "In-flight HTTP requests", ["service"])
PAYMENTS = Counter(
    "axispay_payments_total", "Payments by outcome",
    ["service", "status", "currency"],
)
BUILD_INFO = Gauge("axispay_build_info", "Build metadata", ["service", "version", "pod", "node"])


class MetricsMiddleware(BaseHTTPMiddleware):
    """Records the golden signals AND emits one structured access log per request.

    The access log is not decoration. On Day 5 students take a latency spike in
    Grafana and pull back every log line for that one payment across all seven
    services it touched. That only works if EVERY service logs every request
    with the correlation ID — including services like merchant-service that
    have no business-event log of their own.

    Probe endpoints are excluded. The kubelet hits /healthz and /readyz every
    few seconds per pod; logging those would bury real traffic and, on Day 5,
    would be the single largest contributor to Loki storage.
    """

    SILENT_PATHS = frozenset({"/healthz", "/readyz", "/startupz", "/metrics"})

    def __init__(self, app, service: str) -> None:
        super().__init__(app)
        self.service = service
        self.log = logging.getLogger(f"{service}.access")

    async def dispatch(self, request: Request, call_next):
        # Use the route template, not the raw path — otherwise every payment ID
        # becomes its own label value and Prometheus cardinality explodes.
        # This is a real production failure mode, and it is called out in the
        # Day 5 slides as a "common mistake".
        path = request.url.path
        IN_FLIGHT.labels(self.service).inc()
        started = time.perf_counter()
        status = "500"
        try:
            response = await call_next(request)
            status = str(response.status_code)
            return response
        finally:
            route = request.scope.get("route")
            template = getattr(route, "path", path)
            elapsed = time.perf_counter() - started
            LATENCY.labels(self.service, request.method, template).observe(elapsed)
            REQUESTS.labels(self.service, request.method, template, status).inc()
            IN_FLIGHT.labels(self.service).dec()

            if path not in self.SILENT_PATHS:
                self.log.info(
                    "request",
                    extra={"extra_fields": {
                        "method": request.method,
                        "path": path,
                        "route": template,
                        "status": int(status),
                        "duration_ms": round(elapsed * 1000, 2),
                    }},
                )


def metrics_response() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
