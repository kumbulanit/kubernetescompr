"""
AxisPay alert-sink
==================
Somewhere for Alertmanager to deliver to.

WHY THIS EXISTS
---------------
Alertmanager routing is easy to write and hard to believe. You add a route,
you add an inhibit rule, you apply it — and then what? The usual answer is
"trigger a real incident and see whether the right channel lights up", which
is neither fast nor safe.

This service is the receiver at the end of every route. It accepts the
Alertmanager webhook payload, records it, and exposes what arrived so a lab
can assert on it:

    GET /api/v1/alerts                  everything received, newest first
    GET /api/v1/alerts?channel=payments what one route actually got
    GET /api/v1/routes                  a per-channel count — the routing proof

That makes routing testable. In L5.4 students break a service, watch the alert
fire in Prometheus, and then confirm it arrived on the payments channel and
NOT on the finance one. Without a sink, that last step is an act of faith.

In production this would be Slack, PagerDuty or Opsgenie. The routing tree
does not change — only the receiver URL does.
"""
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Path, Query, Request
from pydantic import BaseModel, Field

from axispay_common import create_app, get_settings
from axispay_common.logging import log_with

settings = get_settings()
router = APIRouter(prefix="/api/v1", tags=["alerts"])

# Bounded on purpose. A sink that grows without limit is a memory leak wearing
# a hat, and this pod has a 192Mi limit — it would be OOMKilled during the very
# lab it exists to support.
MAX_RETAINED = 500

_ALERTS: List[Dict[str, Any]] = []
_BY_CHANNEL: Dict[str, int] = defaultdict(int)
_BY_ALERTNAME: Dict[str, int] = defaultdict(int)


class AlertLabels(BaseModel):
    alertname: Optional[str] = None
    severity: Optional[str] = None
    team: Optional[str] = None
    namespace: Optional[str] = None
    pod: Optional[str] = None


class Alert(BaseModel):
    status: str = Field("firing", examples=["firing", "resolved"])
    labels: Dict[str, str] = Field(default_factory=dict)
    annotations: Dict[str, str] = Field(default_factory=dict)
    startsAt: Optional[str] = None
    endsAt: Optional[str] = None
    generatorURL: Optional[str] = None
    fingerprint: Optional[str] = None


class WebhookPayload(BaseModel):
    """The shape Alertmanager POSTs. Only the fields we use are declared.

    Extra fields are accepted and ignored — a webhook receiver that rejects a
    payload because Alertmanager added a field in a minor release is a
    receiver that stops working during an upgrade, which is exactly when you
    need it most.
    """
    version: Optional[str] = None
    groupKey: Optional[str] = None
    status: str = "firing"
    receiver: Optional[str] = None
    groupLabels: Dict[str, str] = Field(default_factory=dict)
    commonLabels: Dict[str, str] = Field(default_factory=dict)
    commonAnnotations: Dict[str, str] = Field(default_factory=dict)
    externalURL: Optional[str] = None
    alerts: List[Alert] = Field(default_factory=list)


@router.post("/alerts/{channel}", status_code=202,
             summary="Receive an Alertmanager webhook for one channel")
async def receive(request: Request,
                  body: WebhookPayload,
                  channel: str = Path(..., examples=["payments"])) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    received = 0
    for a in body.alerts:
        name = a.labels.get("alertname", "unknown")
        entry = {
            "received_at": now,
            "channel": channel,
            "receiver": body.receiver,
            "status": a.status or body.status,
            "alertname": name,
            "severity": a.labels.get("severity", "unknown"),
            "team": a.labels.get("team"),
            "namespace": a.labels.get("namespace"),
            "pod": a.labels.get("pod"),
            "summary": a.annotations.get("summary"),
            "runbook_url": a.annotations.get("runbook_url"),
            "starts_at": a.startsAt,
            "fingerprint": a.fingerprint,
        }
        _ALERTS.append(entry)
        _BY_CHANNEL[channel] += 1
        _BY_ALERTNAME[name] += 1
        received += 1

        # One log line per alert, at the level the severity deserves. This is
        # what `kubectl logs -f deploy/alert-sink` shows during the lab.
        level = "error" if entry["severity"] == "critical" else "warning"
        log_with(request.app.state.log, level, "alert received",
                 channel=channel, alertname=name, status=entry["status"],
                 severity=entry["severity"], team=entry["team"],
                 namespace=entry["namespace"], summary=entry["summary"])

    del _ALERTS[:-MAX_RETAINED]
    return {"accepted": received, "channel": channel, "retained": len(_ALERTS)}


@router.get("/alerts", summary="Alerts received, newest first")
async def list_alerts(
    channel: Optional[str] = Query(None, examples=["payments"]),
    alertname: Optional[str] = Query(None),
    severity: Optional[str] = Query(None, examples=["critical"]),
    status: Optional[str] = Query(None, examples=["firing"]),
    limit: int = Query(50, ge=1, le=500),
) -> Dict[str, Any]:
    rows = list(reversed(_ALERTS))
    if channel:
        rows = [r for r in rows if r["channel"] == channel]
    if alertname:
        rows = [r for r in rows if r["alertname"] == alertname]
    if severity:
        rows = [r for r in rows if r["severity"] == severity]
    if status:
        rows = [r for r in rows if r["status"] == status]
    return {"alerts": rows[:limit], "matched": len(rows), "total_received": len(_ALERTS)}


@router.get("/routes", summary="How many alerts each channel actually received")
async def routes() -> Dict[str, Any]:
    """The routing proof.

    If AxisPayReconciliationDidNotRun shows up under `payments` instead of
    `finance`, the route matchers are wrong — and this endpoint says so in one
    line instead of after twenty minutes of reading YAML.
    """
    return {
        "channels": dict(sorted(_BY_CHANNEL.items())),
        "alertnames": dict(sorted(_BY_ALERTNAME.items())),
        "total": sum(_BY_CHANNEL.values()),
    }


@router.delete("/alerts", status_code=200, summary="Clear the sink (lab reset)")
async def clear() -> Dict[str, Any]:
    n = len(_ALERTS)
    _ALERTS.clear()
    _BY_CHANNEL.clear()
    _BY_ALERTNAME.clear()
    return {"cleared": n}


app = create_app(
    service_name="alert-sink",
    description="Receives Alertmanager webhooks so alert routing can be tested "
                "instead of assumed. Training use only.",
    settings=settings,
    routers=[router],
)
