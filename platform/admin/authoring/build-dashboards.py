#!/usr/bin/env python3
"""
Generate the AxisPay Grafana dashboards as ConfigMaps.

    python3 platform/admin/authoring/build-dashboards.py

WHY GENERATED RATHER THAN HAND-WRITTEN
--------------------------------------
A Grafana dashboard is a 900-line JSON document embedded inside a YAML string
inside a ConfigMap. Hand-editing that is how you end up with a dashboard that
silently fails to load because of one trailing comma, and Grafana's sidecar
reports the failure only in its own logs. Generating it means the JSON is
valid by construction and every PromQL expression lives in one readable place.

It also makes the point the module is built around: a dashboard is DATA. The
"click around in the UI and export" workflow produces something nobody can
review, diff or roll back. This file can be reviewed in a pull request.

HOW GRAFANA FINDS THESE
-----------------------
kube-prometheus-stack runs a sidecar that watches for ConfigMaps carrying the
label `grafana_dashboard: "1"` and drops their contents into Grafana's
provisioning directory. No API call, no import button, no manual step. Delete
the ConfigMap and the dashboard disappears.
"""

import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "manifests", "day5", "observability",
                   "04-grafana-dashboards.yaml")

PROM = {"type": "prometheus", "uid": "${DS_PROMETHEUS}"}
LOKI = {"type": "loki", "uid": "${DS_LOKI}"}

_id = [0]


def nid():
    _id[0] += 1
    return _id[0]


def gp(x, y, w, h):
    return {"h": h, "w": w, "x": x, "y": y}


def target(expr, legend, ds=PROM, instant=False):
    return {
        "datasource": ds,
        "editorMode": "code",
        "expr": expr,
        "legendFormat": legend,
        "range": not instant,
        "instant": instant,
        "refId": chr(65 + (nid() % 26)),
    }


def stat(title, expr, unit, pos, thresholds, desc="", decimals=2, reverse=False):
    steps = [{"color": "green" if not reverse else "red", "value": None}]
    for colour, value in thresholds:
        steps.append({"color": colour, "value": value})
    return {
        "id": nid(),
        "type": "stat",
        "title": title,
        "description": desc,
        "datasource": PROM,
        "gridPos": pos,
        "targets": [target(expr, "", instant=True)],
        "options": {
            "colorMode": "background",
            "graphMode": "area",
            "textMode": "auto",
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
        },
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "decimals": decimals,
                "thresholds": {"mode": "absolute", "steps": steps},
                "mappings": [],
            },
            "overrides": [],
        },
    }


def ts(title, targets, unit, pos, desc="", stack=False, legend="bottom", maxv=None):
    fc = {
        "unit": unit,
        "custom": {
            "drawStyle": "line",
            "lineWidth": 2,
            "fillOpacity": 20 if stack else 8,
            "showPoints": "never",
            "stacking": {"mode": "normal" if stack else "none", "group": "A"},
            "axisLabel": "",
        },
        "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}]},
        "mappings": [],
    }
    if maxv is not None:
        fc["max"] = maxv
        fc["min"] = 0
    return {
        "id": nid(),
        "type": "timeseries",
        "title": title,
        "description": desc,
        "datasource": PROM,
        "gridPos": pos,
        "targets": targets,
        "options": {
            "legend": {"displayMode": "list", "placement": legend, "showLegend": True},
            "tooltip": {"mode": "multi", "sort": "desc"},
        },
        "fieldConfig": {"defaults": fc, "overrides": []},
    }


def row(title, y, collapsed=False):
    return {
        "id": nid(),
        "type": "row",
        "title": title,
        "collapsed": collapsed,
        "gridPos": gp(0, y, 24, 1),
        "panels": [],
    }


def table(title, expr, pos, desc=""):
    return {
        "id": nid(),
        "type": "table",
        "title": title,
        "description": desc,
        "datasource": PROM,
        "gridPos": pos,
        "targets": [dict(target(expr, "", instant=True), format="table")],
        "transformations": [{"id": "organize", "options": {}}],
        "fieldConfig": {"defaults": {"custom": {"align": "auto"}}, "overrides": []},
    }


def logs(title, expr, pos, desc=""):
    return {
        "id": nid(),
        "type": "logs",
        "title": title,
        "description": desc,
        "datasource": LOKI,
        "gridPos": pos,
        "targets": [{"datasource": LOKI, "expr": expr, "queryType": "range",
                     "refId": "A"}],
        "options": {
            "showTime": True,
            "sortOrder": "Descending",
            "wrapLogMessage": True,
            "prettifyLogMessage": True,
            "enableLogDetails": True,
        },
    }


# =============================================================================
# Dashboard 1 — the payment platform (the one on the wall)
# =============================================================================

def platform_dashboard():
    p = []
    y = 0

    p.append(row("Service level — what the merchant experiences", y)); y += 1

    # Success rate is computed from the BUSINESS metric, not from HTTP status.
    # A 409 fraud decline is a 4xx and a correct outcome; counting it as a
    # failure would make the platform look broken every time risk works.
    p.append(stat(
        "Payment success rate",
        'sum(rate(axispay_payments_total{status=~"captured|authorized"}[5m]))'
        ' / clamp_min(sum(rate(axispay_payments_total[5m])), 0.0001)',
        "percentunit", gp(0, y, 5, 5),
        [("orange", 0.9), ("green", 0.97)],
        desc="Captured or authorized, over all outcomes. Declines are a correct "
             "outcome, not an error — this panel deliberately does not treat "
             "them as failures.", reverse=True))

    p.append(stat(
        "p99 latency — payment API",
        'histogram_quantile(0.99, sum by (le) '
        '(rate(axispay_http_request_duration_seconds_bucket{service="payment-service"}[5m])))',
        "s", gp(5, y, 5, 5), [("orange", 0.25), ("red", 0.3)],
        desc="SLO is 300ms. The histogram buckets are placed around that "
             "threshold so the estimate is accurate exactly where it matters.",
        decimals=3))

    p.append(stat(
        "5xx rate — all services",
        'sum(rate(axispay_http_requests_total{status=~"5.."}[5m]))'
        ' / clamp_min(sum(rate(axispay_http_requests_total[5m])), 0.0001)',
        "percentunit", gp(10, y, 5, 5), [("orange", 0.002), ("red", 0.005)],
        desc="The error budget is 0.5%. Above the red line the SLO is burning.",
        decimals=4))

    p.append(stat(
        "Payments per minute",
        "sum(rate(axispay_payments_total[5m])) * 60",
        "short", gp(15, y, 4, 5), [("green", 0.1)],
        desc="Zero here with everything else green is the failure mode that "
             "infrastructure alerts cannot see.", decimals=1, reverse=True))

    p.append(stat(
        "Pods ready",
        'sum(kube_deployment_status_replicas_ready{namespace=~"axispay-.*"})',
        "short", gp(19, y, 5, 5), [("green", 1)],
        desc="Ready, not running. A Running pod failing readiness serves "
             "nothing.", decimals=0, reverse=True))
    y += 5

    p.append(row("Traffic and latency", y)); y += 1

    p.append(ts("Requests per second by service", [
        target('sum by (service) (rate(axispay_http_requests_total[5m]))',
               "{{service}}")],
        "reqps", gp(0, y, 12, 8),
        desc="Probe endpoints are excluded at the application, so this is real "
             "traffic — not the kubelet checking on you every five seconds."))

    p.append(ts("payment-service latency percentiles", [
        target('histogram_quantile(0.50, sum by (le) (rate('
               'axispay_http_request_duration_seconds_bucket{service="payment-service"}[5m])))', "p50"),
        target('histogram_quantile(0.95, sum by (le) (rate('
               'axispay_http_request_duration_seconds_bucket{service="payment-service"}[5m])))', "p95"),
        target('histogram_quantile(0.99, sum by (le) (rate('
               'axispay_http_request_duration_seconds_bucket{service="payment-service"}[5m])))', "p99")],
        "s", gp(12, y, 12, 8),
        desc="Watch the GAP between p50 and p99. A wide gap means a slow "
             "minority — usually one bad replica or one slow downstream — and "
             "the average will not show it."))
    y += 8

    p.append(ts("5xx per second by service", [
        target('sum by (service) (rate(axispay_http_requests_total{status=~"5.."}[5m]))',
               "{{service}}")],
        "reqps", gp(0, y, 8, 7),
        desc="Where the errors are BEING RETURNED, which is not always where "
             "they are being caused. Follow the correlation ID."))

    p.append(ts("Payments by outcome", [
        target('sum by (status) (rate(axispay_payments_total[5m])) * 60',
               "{{status}}")],
        "short", gp(8, y, 8, 7), stack=True,
        desc="captured / authorized / declined. A rising declined band with "
             "flat total volume is a risk-rule change, not an outage."))

    p.append(ts("Payments by currency", [
        target('sum by (currency) (rate(axispay_payments_total[15m])) * 60',
               "{{currency}}")],
        "short", gp(16, y, 8, 7), stack=True,
        desc="ZAR dominates by volume. A currency disappearing entirely is "
             "usually an acquirer routing change."))
    y += 7

    p.append(row("Workload health", y)); y += 1

    p.append(ts("CPU usage against requests and limits — payment-service", [
        target('sum(rate(container_cpu_usage_seconds_total{namespace="axispay-core",'
               'pod=~"payment-service-.*",container!=""}[5m]))', "usage"),
        target('sum(kube_pod_container_resource_requests{namespace="axispay-core",'
               'pod=~"payment-service-.*",resource="cpu"})', "requests (what the scheduler reserved)"),
        target('sum(kube_pod_container_resource_limits{namespace="axispay-core",'
               'pod=~"payment-service-.*",resource="cpu"})', "limits (where throttling starts)")],
        "short", gp(0, y, 12, 8),
        desc="Three different things. The scheduler only ever looks at "
             "requests; the kernel only ever enforces limits; usage is what "
             "actually happened. HPA utilisation is measured against REQUESTS."))

    p.append(ts("Memory working set against limit", [
        target('sum by (pod) (container_memory_working_set_bytes{namespace="axispay-core",'
               'container!=""})', "{{pod}}"),
        target('max(kube_pod_container_resource_limits{namespace="axispay-core",'
               'resource="memory"})', "limit")],
        "bytes", gp(12, y, 12, 8),
        desc="Memory has no throttle. Crossing the limit is an instant kill — "
             "exit 137 — not a slowdown. Watch the headroom, not the average."))
    y += 8

    p.append(ts("Ready replicas against desired", [
        target('sum by (deployment) (kube_deployment_status_replicas_ready'
               '{namespace=~"axispay-.*"})', "{{deployment}} ready"),
        target('sum by (deployment) (kube_deployment_spec_replicas'
               '{namespace=~"axispay-.*"})', "{{deployment}} desired")],
        "short", gp(0, y, 8, 7),
        desc="During a healthy rollout these track each other because "
             "maxUnavailable is 0. A persistent gap is a rollout that has "
             "stalled."))

    p.append(ts("Container restarts (15m)", [
        target('sum by (pod) (increase(kube_pod_container_status_restarts_total'
               '{namespace=~"axispay-.*"}[15m]))', "{{pod}}")],
        "short", gp(8, y, 8, 7),
        desc="Rate of restarts, not the lifetime counter. One restart last "
             "week is not an incident; three in fifteen minutes is."))

    p.append(ts("HPA replicas — current against maximum", [
        target('kube_horizontalpodautoscaler_status_current_replicas'
               '{namespace=~"axispay-.*"}', "{{horizontalpodautoscaler}} current"),
        target('kube_horizontalpodautoscaler_spec_max_replicas'
               '{namespace=~"axispay-.*"}', "{{horizontalpodautoscaler}} max")],
        "short", gp(16, y, 8, 7),
        desc="Current touching max means autoscaling has run out of room. "
             "Not yet an outage — which is exactly why it is worth watching."))
    y += 7

    p.append(row("Logs — errors across the platform", y)); y += 1

    p.append(logs("Errors, all AxisPay namespaces",
                  '{namespace=~"axispay-.*"} | json | level="error"',
                  gp(0, y, 24, 10),
                  desc="Structured JSON on stdout is what makes this query "
                       "possible. Paste a correlation_id into the query to "
                       "follow one payment across all seven services it "
                       "touched:  {namespace=~\"axispay-.*\"} | json | "
                       "correlation_id=\"...\""))
    y += 10

    return {
        "uid": "axispay-platform",
        "title": "AxisPay — Payment Platform",
        "description": "Golden signals, business outcomes and workload health "
                       "for the AxisPay payment platform. Fictional data; "
                       "training use only.",
        "tags": ["axispay", "payments", "slo"],
        "timezone": "browser",
        "schemaVersion": 39,
        "version": 1,
        "refresh": "30s",
        "editable": True,
        "graphTooltip": 1,
        "time": {"from": "now-1h", "to": "now"},
        "templating": {"list": [
            {"name": "DS_PROMETHEUS", "type": "datasource", "query": "prometheus",
             "current": {"text": "Prometheus", "value": "Prometheus"}, "hide": 0},
            {"name": "DS_LOKI", "type": "datasource", "query": "loki",
             "current": {"text": "Loki", "value": "Loki"}, "hide": 0},
            {"name": "namespace", "type": "query", "datasource": PROM,
             "query": "label_values(kube_namespace_created{namespace=~\"axispay-.*\"}, namespace)",
             "refresh": 1, "includeAll": True, "multi": True,
             "current": {"text": "All", "value": "$__all"}},
        ]},
        "annotations": {"list": [{
            "name": "Deployments",
            "datasource": PROM,
            "enable": True,
            "iconColor": "rgba(0, 211, 255, 1)",
            "expr": 'changes(kube_deployment_status_observed_generation'
                    '{namespace=~"axispay-.*"}[1m]) > 0',
            "titleFormat": "rollout: {{deployment}}",
        }]},
        "panels": p,
    }


# =============================================================================
# Dashboard 2 — the triage board used during incidents
# =============================================================================

def triage_dashboard():
    _id[0] = 500
    p = []
    y = 0

    p.append(row("Start here — what is not Ready", y)); y += 1

    p.append(table(
        "Pods not Ready",
        'kube_pod_status_ready{namespace=~"axispay-.*",condition="true"} == 0',
        gp(0, y, 12, 8),
        desc="The first question in the triage loop is always 'is it Ready', "
             "never 'is it Running'. This table answers it for the whole "
             "platform in one place."))

    p.append(table(
        "Services with zero ready endpoints",
        'kube_endpoint_address_available{namespace=~"axispay-.*"} == 0',
        gp(12, y, 12, 8),
        desc="An empty endpoint list means callers get connection refused. "
             "Two causes: every pod is unready, or the Service selector "
             "matches nothing. Check the labels before you check the pods."))
    y += 8

    p.append(ts("Restart reasons", [
        target('sum by (reason) (kube_pod_container_status_last_terminated_reason'
               '{namespace=~"axispay-.*"})', "{{reason}}")],
        "short", gp(0, y, 8, 7),
        desc="OOMKilled, Error, Completed. The reason narrows the search "
             "before you open a single log."))

    p.append(ts("Pending pods", [
        target('sum by (namespace) (kube_pod_status_phase'
               '{namespace=~"axispay-.*",phase="Pending"})', "{{namespace}}")],
        "short", gp(8, y, 8, 7),
        desc="Pending is a SCHEDULING problem, not an application one. "
             "Insufficient CPU, an unbound PVC, or a taint with no toleration."))

    p.append(ts("Image pull failures", [
        target('sum by (namespace) (kube_pod_container_status_waiting_reason'
               '{namespace=~"axispay-.*",reason=~"ImagePullBackOff|ErrImagePull"})',
               "{{namespace}}")],
        "short", gp(16, y, 8, 7),
        desc="On Minikube this is almost always a tag that was never built "
             "into the node's runtime, not a registry problem."))
    y += 7

    p.append(row("Recent errors and their context", y)); y += 1

    p.append(logs("payment path errors, newest first",
                  '{namespace=~"axispay-core|axispay-edge"} | json '
                  '| level=~"error|warning"',
                  gp(0, y, 24, 12),
                  desc="Every line carries correlation_id, service, pod and "
                       "duration_ms. Copy a correlation_id out of a failing "
                       "request and re-query on it to get the full path."))

    return {
        "uid": "axispay-triage",
        "title": "AxisPay — Incident Triage",
        "description": "The board to open when something is wrong. Ordered to "
                       "match the triage loop taught on Day 2.",
        "tags": ["axispay", "triage", "incident"],
        "timezone": "browser",
        "schemaVersion": 39,
        "version": 1,
        "refresh": "10s",
        "editable": True,
        "time": {"from": "now-30m", "to": "now"},
        "templating": {"list": [
            {"name": "DS_PROMETHEUS", "type": "datasource", "query": "prometheus",
             "current": {"text": "Prometheus", "value": "Prometheus"}, "hide": 0},
            {"name": "DS_LOKI", "type": "datasource", "query": "loki",
             "current": {"text": "Loki", "value": "Loki"}, "hide": 0},
        ]},
        "annotations": {"list": []},
        "panels": p,
    }


# =============================================================================

HEADER = """# ==============================================================================
# Grafana dashboards — GENERATED FILE, DO NOT EDIT BY HAND
# ==============================================================================
# Source:    platform/admin/authoring/build-dashboards.py
# Regenerate: make dashboards
#
# The Grafana sidecar shipped with kube-prometheus-stack watches for
# ConfigMaps labelled `grafana_dashboard: "1"` and provisions whatever JSON it
# finds inside them. There is no import step and no click path — delete the
# ConfigMap and the dashboard disappears with it.
#
# A dashboard is DATA. Keeping it in version control means it can be reviewed,
# diffed and rolled back like anything else; the "click around and export"
# workflow produces something nobody can review.
#
#   kubectl get configmap -n axispay-observability -l grafana_dashboard=1
#   kubectl -n axispay-observability port-forward svc/kube-prometheus-stack-grafana 3000:80
# ==============================================================================
"""


def configmap(name, filename, dashboard):
    body = json.dumps(dashboard, indent=2, sort_keys=False)
    indented = "\n".join("    " + ln for ln in body.split("\n"))
    return f"""---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {name}
  namespace: axispay-observability
  labels:
    grafana_dashboard: "1"
    app.kubernetes.io/part-of: axispay
    axispay.io/day-introduced: "5"
data:
  {filename}: |
{indented}
"""


def main():
    boards = [
        ("axispay-dashboard-platform", "axispay-platform.json", platform_dashboard()),
        ("axispay-dashboard-triage", "axispay-triage.json", triage_dashboard()),
    ]
    out = [HEADER]
    for name, fn, d in boards:
        json.dumps(d)  # fail loudly here rather than in Grafana's sidecar log
        out.append(configmap(name, fn, d))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as fh:
        fh.write("".join(out))

    for name, fn, d in boards:
        panels = [p for p in d["panels"] if p["type"] != "row"]
        rows = [p for p in d["panels"] if p["type"] == "row"]
        print(f"  {d['title']:36} {len(rows)} rows, {len(panels)} panels")
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
