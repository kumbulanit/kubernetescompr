"""Application factory.

create_app() wires the identical operational surface onto every AxisPay
service: correlation IDs, JSON logging, metrics, error handling, the three
probes, /metrics and /api/v1/_info.

A service module then only has to describe its business behaviour. That is why
payment-service/app/main.py is short enough to read on a slide.
"""
import logging
import os
import signal
from contextlib import asynccontextmanager
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse

from axispay_common.config import Settings, get_settings
from axispay_common.context import CorrelationIdMiddleware
from axispay_common.errors import AxisPayError, axispay_error_handler
from axispay_common.logging import configure_logging, log_with
from axispay_common.metrics import BUILD_INFO, MetricsMiddleware, metrics_response
from axispay_common.readiness import ReadinessRegistry

__all__ = ["create_app"]


def create_app(
    service_name: str,
    description: str,
    settings: Optional[Settings] = None,
    routers: Optional[List[APIRouter]] = None,
    on_startup: Optional[Callable[[FastAPI], Any]] = None,
    on_shutdown: Optional[Callable[[FastAPI], Any]] = None,
) -> FastAPI:
    cfg = settings or get_settings()
    cfg.service_name = service_name
    log = configure_logging(service_name, cfg.service_version, cfg.pod_name, cfg.environment, cfg.log_level)
    readiness = ReadinessRegistry(startup_delay_seconds=cfg.startup_delay_seconds)

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        log_with(log, "info", "starting", version=cfg.service_version, node=cfg.node_name,
                 namespace=cfg.namespace, startup_delay=cfg.startup_delay_seconds)
        BUILD_INFO.labels(service_name, cfg.service_version, cfg.pod_name, cfg.node_name).set(1)
        if on_startup:
            await _maybe_await(on_startup(application))
        log_with(log, "info", "ready to serve", port=cfg.port)
        yield
        # ---------------------------------------------------------------
        # GRACEFUL SHUTDOWN (taught in D2 M2.6)
        #
        # Kubernetes sends SIGTERM, waits terminationGracePeriodSeconds, then
        # SIGKILL. On SIGTERM we FIRST mark ourselves unready so the endpoint
        # controller removes this pod from the Service, THEN finish in-flight
        # work. Reversing that order severs live payments mid-authorisation.
        # ---------------------------------------------------------------
        log_with(log, "info", "SIGTERM received — draining", uptime=readiness.uptime_seconds)
        readiness.force_unready(True)
        if on_shutdown:
            await _maybe_await(on_shutdown(application))
        log_with(log, "info", "shutdown complete")

    app = FastAPI(
        title=f"AxisPay — {service_name}",
        description=description,
        version=cfg.service_version,
        lifespan=lifespan,
        docs_url="/api/v1/docs",
        openapi_url="/api/v1/openapi.json",
    )

    app.state.settings = cfg
    app.state.readiness = readiness
    app.state.log = log

    # Middleware order matters: correlation ID must be outermost so that the
    # metrics and error layers can both see it.
    app.add_middleware(MetricsMiddleware, service=service_name)
    app.add_middleware(CorrelationIdMiddleware)
    app.add_exception_handler(AxisPayError, axispay_error_handler)

    _mount_operational_routes(app, cfg, readiness, service_name)

    for router in routers or []:
        app.include_router(router)

    return app


def _mount_operational_routes(app: FastAPI, cfg: Settings, readiness: ReadinessRegistry, service_name: str) -> None:
    ops = APIRouter(tags=["operational"])

    @ops.get("/healthz", summary="Liveness — never checks dependencies")
    async def healthz() -> JSONResponse:
        return JSONResponse({"status": "alive", "service": service_name})

    @ops.get("/readyz", summary="Readiness — checks dependencies")
    async def readyz() -> JSONResponse:
        ok, detail = await readiness.ready()
        return JSONResponse(
            status_code=200 if ok else 503,
            content={"status": "ready" if ok else "not_ready", "service": service_name, "checks": detail},
        )

    @ops.get("/startupz", summary="Startup — has initialisation finished?")
    async def startupz() -> JSONResponse:
        ok = await readiness.startup()
        return JSONResponse(
            status_code=200 if ok else 503,
            content={"status": "started" if ok else "starting", "service": service_name},
        )

    @ops.get("/metrics", summary="Prometheus exposition", include_in_schema=False)
    async def metrics():
        return metrics_response()

    @ops.get("/api/v1/_info", summary="Which pod answered this request?")
    async def info() -> Dict[str, Any]:
        # THE most useful endpoint in the course. It is how students prove
        # load balancing (D1 L1.5), rollout progress (D2 L2.6) and
        # anti-affinity spread (D4 L4.6) — with nothing but curl.
        return {
            "service": service_name,
            "version": cfg.service_version,
            "environment": cfg.environment,
            "pod_name": cfg.pod_name,
            "pod_ip": cfg.pod_ip,
            "node_name": cfg.node_name,
            "namespace": cfg.namespace,
            "uptime_seconds": round(readiness.uptime_seconds, 1),
        }

    @ops.post("/api/v1/_admin/unready", summary="Lab control: force this pod out of Endpoints")
    async def set_unready(value: bool = True) -> Dict[str, Any]:
        readiness.force_unready(value)
        return {"forced_unready": value, "pod": cfg.pod_name}

    app.include_router(ops)


async def _maybe_await(value: Any) -> Any:
    if hasattr(value, "__await__"):
        return await value
    return value
