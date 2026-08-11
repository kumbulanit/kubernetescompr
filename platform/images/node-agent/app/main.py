"""
AxisPay node-agent
==================
Runs as a DaemonSet — exactly one instance per node, automatically.

In a real payments platform this is where you put node-level collection that
must exist everywhere: host metrics, log shipping, security agents, PCI file
integrity monitoring. Here it reports node identity and basic host facts, which
is enough to make the DaemonSet's defining behaviour visible: add a node and
an instance appears on it without anyone changing a replica count.

Day 5 replaces the pattern with Alloy shipping logs to Loki — same shape,
real payload.
"""
import os
import platform
import time
from typing import Any, Dict

from fastapi import APIRouter

from axispay_common import create_app, get_settings

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["node-agent"])
_STARTED = time.time()


def _read(path: str, default: str = "unavailable") -> str:
    try:
        with open(path) as fh:
            return fh.read().strip()
    except Exception:
        return default


@router.get("/node", summary="What this agent sees about its node")
async def node() -> Dict[str, Any]:
    load = _read("/proc/loadavg", "0 0 0").split()[:3]
    mem: Dict[str, int] = {}
    try:
        for line in open("/proc/meminfo"):
            k, v = line.split(":", 1)
            if k in ("MemTotal", "MemAvailable"):
                mem[k] = int(v.strip().split()[0]) // 1024
    except Exception:
        pass
    return {
        "node_name": settings.node_name,
        "pod_name": settings.pod_name,
        "pod_ip": settings.pod_ip,
        "kernel": platform.release(),
        "cpu_count": os.cpu_count(),
        "load_average": {"1m": load[0], "5m": load[1], "15m": load[2]},
        "memory_mb": {"total": mem.get("MemTotal"), "available": mem.get("MemAvailable")},
        "agent_uptime_seconds": round(time.time() - _STARTED, 1),
        # A DaemonSet guarantees ONE of these per node. Query every replica and
        # the set of node_name values is the set of nodes in your cluster.
        "daemonset_invariant": "exactly one node-agent per node",
    }


app = create_app(
    service_name="node-agent",
    description="Per-node agent. Demonstrates the DaemonSet workload type.",
    settings=settings, routers=[router],
)
