"""
AxisPay loadgen
===============
Generates realistic merchant traffic against edge-gateway and keeps a running
tally of successes and failures.

It exists for one reason: **to make claims falsifiable.**

"Rolling updates are zero-downtime" is an assertion. A counter that reads
4,812 requests / 0 failures across a rollout is evidence. In L2.6 students
run a rollout with the readiness probe in place and watch the failure counter
stay at zero, then remove the probe and watch it climb. That before/after is
the most persuasive five minutes of the week.

It is also the load source for the HPA lab (L2.4).
"""
import asyncio
import os
import random
import time
from collections import Counter
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from axispay_common import create_app, get_settings
from axispay_common.logging import log_with
from axispay_common.metrics import PAYMENTS
from axispay_common.seed import API_KEYS, CARD_TOKENS

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["loadgen"])

TARGET = os.getenv("TARGET_URL", "http://edge-gateway.axispay-edge.svc.cluster.local:8080")
RPS = float(os.getenv("REQUESTS_PER_SECOND", "5"))
AMOUNTS = [4999, 12500, 45000, 129900, 250000, 780000, 1_450_000]

STATE: Dict[str, Any] = {
    "running": False, "started_at": None, "rps": RPS,
    "sent": 0, "ok": 0, "failed": 0,
    "status_counts": Counter(), "latency_ms": [], "last_error": None,
}
_client: Optional[httpx.AsyncClient] = None
_token: Optional[str] = None
_task: Optional[asyncio.Task] = None


async def _get_token() -> Optional[str]:
    global _token
    if _token:
        return _token
    try:
        r = await _client.post(f"{TARGET}/api/v1/login",
                               json={"api_key": "ak_live_kalahari_7QK2XD9P4A"}, timeout=5.0)
        if r.status_code == 200:
            _token = r.json()["access_token"]
    except Exception:
        _token = None
    return _token


async def _one_request() -> None:
    token = await _get_token()
    if not token:
        STATE["failed"] += 1; STATE["status_counts"]["no_token"] += 1
        return
    amount = random.choice(AMOUNTS)
    started = time.perf_counter()
    try:
        r = await _client.post(
            f"{TARGET}/api/v1/charges",
            headers={"Authorization": f"Bearer {token}",
                     "Idempotency-Key": f"lg-{time.time_ns()}-{random.randint(0,9999)}"},
            json={"amount_minor": amount, "currency": "ZAR",
                  "card_token": random.choice(CARD_TOKENS)["card_token"],
                  "description": "loadgen"},
            timeout=10.0,
        )
        elapsed = (time.perf_counter() - started) * 1000
        STATE["latency_ms"].append(elapsed)
        if len(STATE["latency_ms"]) > 2000:
            STATE["latency_ms"] = STATE["latency_ms"][-2000:]
        STATE["sent"] += 1
        STATE["status_counts"][str(r.status_code)] += 1
        # 409 is a legitimate business outcome (fraud declined, KYC), not an
        # availability failure. Counting it as one would make the SLO lie.
        if r.status_code in (200, 201, 409):
            STATE["ok"] += 1
        else:
            STATE["failed"] += 1
            STATE["last_error"] = f"HTTP {r.status_code}: {r.text[:120]}"
        if r.status_code == 401:
            globals()["_token"] = None      # token expired — re-login next tick
    except Exception as exc:
        STATE["sent"] += 1; STATE["failed"] += 1
        STATE["status_counts"]["exception"] += 1
        STATE["last_error"] = f"{type(exc).__name__}: {exc}"


async def _loop() -> None:
    while STATE["running"]:
        interval = 1.0 / max(STATE["rps"], 0.1)
        await asyncio.gather(_one_request(), asyncio.sleep(interval))


class Control(BaseModel):
    rps: Optional[float] = None


@router.post("/loadgen/start", summary="Start generating traffic")
async def start(body: Control = Control()) -> Dict[str, Any]:
    global _task
    if body.rps:
        STATE["rps"] = body.rps
    if not STATE["running"]:
        STATE.update(running=True, started_at=time.time(), sent=0, ok=0, failed=0,
                     status_counts=Counter(), latency_ms=[], last_error=None)
        _task = asyncio.create_task(_loop())
    return await stats()


@router.post("/loadgen/stop", summary="Stop generating traffic")
async def stop() -> Dict[str, Any]:
    STATE["running"] = False
    return await stats()


@router.get("/loadgen/stats", summary="Live tally — this is the evidence")
async def stats() -> Dict[str, Any]:
    lat = sorted(STATE["latency_ms"])
    def pct(p: float) -> Optional[float]:
        return round(lat[min(int(len(lat) * p), len(lat) - 1)], 1) if lat else None
    elapsed = time.time() - STATE["started_at"] if STATE["started_at"] else 0
    return {
        "running": STATE["running"], "target": TARGET,
        "requests_per_second": STATE["rps"], "elapsed_seconds": round(elapsed, 1),
        "sent": STATE["sent"], "ok": STATE["ok"], "failed": STATE["failed"],
        "availability_pct": round(100 * STATE["ok"] / STATE["sent"], 3) if STATE["sent"] else None,
        "latency_ms": {"p50": pct(0.50), "p95": pct(0.95), "p99": pct(0.99)},
        "status_counts": dict(STATE["status_counts"]),
        "last_error": STATE["last_error"],
    }


async def _startup(app) -> None:
    global _client
    _client = httpx.AsyncClient(trust_env=False, timeout=10.0)
    if os.getenv("AUTOSTART", "true").lower() == "true":
        await start(Control())
        log_with(app.state.log, "info", "loadgen autostarted", target=TARGET, rps=STATE["rps"])


async def _shutdown(app) -> None:
    STATE["running"] = False
    if _client:
        await _client.aclose()


app = create_app(
    service_name="loadgen",
    description="Generates merchant traffic so availability claims can be measured, not asserted.",
    settings=settings, routers=[router],
    on_startup=_startup, on_shutdown=_shutdown,
)
