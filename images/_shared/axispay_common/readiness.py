"""Readiness, liveness and startup — the three probes, and why they differ.

This module encodes the single most important operational distinction in the
course. Students meet it on Day 2 (M2.3), but the code exists from Day 1 so
they can read it before they need it.

    LIVENESS  "Is this process broken beyond recovery?"
              Consequence of failure: kubelet RESTARTS the container.
              MUST NOT check dependencies. If liveness checked the database,
              then a 30-second database blip would restart every replica of
              every service simultaneously — turning a brief dependency
              outage into a full platform outage. This is the classic
              cascading-failure bug, and it is why `live()` below returns
              True unconditionally.

    READINESS "Can THIS instance serve a request right now?"
              Consequence of failure: pod is removed from Service Endpoints.
              Traffic stops arriving. The pod is NOT restarted.
              SHOULD check dependencies — that is the entire point.

    STARTUP   "Has initialisation finished?"
              Consequence of failure: kubelet keeps waiting, and liveness is
              suspended until it passes. Protects slow starters from being
              killed before they ever come up.
"""
import asyncio
import time
from typing import Awaitable, Callable, Dict, List, Tuple

Check = Callable[[], Awaitable[bool]]


class ReadinessRegistry:
    """Dependency-aware readiness for one service instance."""

    def __init__(self, startup_delay_seconds: float = 0.0) -> None:
        self._checks: Dict[str, Tuple[Check, bool]] = {}
        self._started_at = time.monotonic()
        self._startup_delay = startup_delay_seconds
        self._startup_complete = startup_delay_seconds <= 0
        self._forced_unready = False   # toggled by the Day 2 probe lab

    # -- registration ----------------------------------------------------
    def register(self, name: str, check: Check, critical: bool = True) -> None:
        """A non-critical dependency degrades the service but does not make it
        unready. Example: on Day 5, Redis being down slows fraud scoring but
        payments still work — so Redis is registered as non-critical and the
        pod keeps serving. That is graceful degradation, expressed in code."""
        self._checks[name] = (check, critical)

    # -- the three probes ------------------------------------------------
    def live(self) -> bool:
        """Liveness. Deliberately unconditional. See the module docstring."""
        return True

    async def startup(self) -> bool:
        if not self._startup_complete:
            if time.monotonic() - self._started_at >= self._startup_delay:
                self._startup_complete = True
        return self._startup_complete

    async def ready(self) -> Tuple[bool, Dict[str, str]]:
        if self._forced_unready:
            return False, {"_forced": "unready (set via /api/v1/_admin/unready)"}
        if not await self.startup():
            return False, {"_startup": "initialising"}

        detail: Dict[str, str] = {}
        failures: List[str] = []
        names = list(self._checks)
        results = await asyncio.gather(
            *(self._run(self._checks[n][0]) for n in names), return_exceptions=True
        )
        for name, result in zip(names, results):
            _, critical = self._checks[name]
            ok = result is True
            detail[name] = "ok" if ok else ("degraded" if not critical else "failed")
            if not ok and critical:
                failures.append(name)
        return (not failures), detail

    async def _run(self, check: Check) -> bool:
        try:
            return await asyncio.wait_for(check(), timeout=2.0)
        except Exception:
            return False

    # -- lab controls ----------------------------------------------------
    def force_unready(self, value: bool) -> None:
        """Lets students take one pod out of a Service without deleting it, and
        watch Endpoints change live. Used in L2.3."""
        self._forced_unready = value

    @property
    def uptime_seconds(self) -> float:
        return time.monotonic() - self._started_at
