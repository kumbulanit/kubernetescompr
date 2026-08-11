#!/usr/bin/env python3
"""
Validate every PromQL expression in the repository.

    pip install promql-parser        # optional but strongly recommended
    python3 scripts/validate/check-promql.py

WHY THIS EXISTS
---------------
A PromQL typo does not fail loudly. Prometheus accepts a rule file with a
misspelled metric name, the rule evaluates to an empty vector, and the alert
simply never fires. A dashboard panel with a bad query renders an empty graph
that looks exactly like "nothing is happening". Both failures are silent, and
both are discovered during the incident the alert was meant to catch.

So every expression in this repository is parsed and every metric name is
checked against the set of series that actually exist:

  - what the AxisPay services export (images/_shared/axispay_common/metrics.py)
  - what kube-state-metrics exports
  - what cAdvisor exports through the kubelet

Sources checked:
  manifests/day5/observability/02-prometheusrules.yaml   (raw rules)
  charts/axispay/templates/prometheusrule.yaml           (rendered from the chart)
  manifests/day5/observability/04-grafana-dashboards.yaml (every panel query)

It also asserts the chart and the raw rules declare the SAME alert names, so
the two cannot drift apart.
"""

from __future__ import annotations

import json
import os
import re
import sys
import glob

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
G, R, Y, B, D = "\033[32m", "\033[31m", "\033[33m", "\033[1m", "\033[0m"

try:
    import promql_parser
    HAVE_PARSER = True
except ImportError:
    HAVE_PARSER = False

FAILURES: list[str] = []
CHECKS = 0


def check(ok, label, detail=""):
    global CHECKS
    CHECKS += 1
    if ok:
        print(f"  {G}PASS{D}  {label}")
    else:
        print(f"  {R}FAIL{D}  {label}" + (f"\n          {detail}" if detail else ""))
        FAILURES.append(label)
    return bool(ok)


def section(t):
    print(f"\n{B}{t}{D}\n" + "-" * len(t))


# =============================================================================
# What series actually exist
# =============================================================================

def axispay_metrics() -> set[str]:
    """Read the metric names straight out of the application code."""
    src = open(os.path.join(ROOT, "images", "_shared", "axispay_common",
                            "metrics.py")).read()
    names = set(re.findall(r'(?:Counter|Gauge|Histogram)\(\s*\n?\s*"([a-z_]+)"', src))
    out = set(names)
    for n in names:
        # a Histogram creates three derived series; a Counter creates _total
        out |= {f"{n}_bucket", f"{n}_sum", f"{n}_count"}
    return out


KUBE_STATE = {
    "kube_endpoint_address_available",
    "kube_pod_container_status_restarts_total",
    "kube_pod_container_status_last_terminated_reason",
    "kube_pod_container_status_waiting_reason",
    "kube_pod_status_ready", "kube_pod_status_phase",
    "kube_pod_container_resource_requests", "kube_pod_container_resource_limits",
    "kube_horizontalpodautoscaler_status_current_replicas",
    "kube_horizontalpodautoscaler_spec_max_replicas",
    "kube_horizontalpodautoscaler_spec_min_replicas",
    "kube_cronjob_status_last_successful_time",
    "kube_cronjob_status_active",
    "kube_job_status_failed", "kube_job_status_succeeded",
    "kube_deployment_status_replicas_ready", "kube_deployment_spec_replicas",
    "kube_deployment_status_replicas_available",
    "kube_deployment_status_observed_generation",
    "kube_statefulset_status_replicas_ready",
    "kube_daemonset_status_number_ready",
    "kube_namespace_created",
    "kube_persistentvolumeclaim_status_phase",
    "kube_node_status_condition", "kube_node_status_allocatable",
}

CADVISOR = {
    "container_cpu_usage_seconds_total",
    "container_cpu_cfs_throttled_seconds_total",
    "container_memory_working_set_bytes",
    "container_memory_usage_bytes",
    "container_network_receive_bytes_total",
    "container_network_transmit_bytes_total",
    "container_fs_usage_bytes",
}

NODE_EXPORTER = {
    "node_cpu_seconds_total", "node_memory_MemAvailable_bytes",
    "node_filesystem_avail_bytes", "node_load1",
}

PROM_SELF = {"up", "scrape_duration_seconds", "prometheus_notifications_total"}

KEYWORDS = {
    "and", "or", "unless", "by", "without", "on", "ignoring",
    "group_left", "group_right", "offset", "bool", "le", "inf", "nan",
    "start", "end", "atan2",
}

FUNCTIONS = {
    "rate", "irate", "increase", "sum", "avg", "min", "max", "count", "stddev",
    "stdvar", "topk", "bottomk", "quantile", "histogram_quantile", "delta",
    "idelta", "deriv", "predict_linear", "abs", "ceil", "floor", "round",
    "clamp", "clamp_min", "clamp_max", "time", "timestamp", "vector", "scalar",
    "label_replace", "label_join", "absent", "absent_over_time", "changes",
    "resets", "sort", "sort_desc", "avg_over_time", "sum_over_time",
    "max_over_time", "min_over_time", "count_over_time", "quantile_over_time",
    "last_over_time", "present_over_time", "count_values", "group",
    "humanizePercentage", "humanizeDuration", "exp", "ln", "log2", "log10",
    "sqrt", "day_of_week", "hour", "sgn", "pi", "rad", "deg",
}


def metric_names(expr: str) -> set[str]:
    """Extract metric names, ignoring functions, keywords and label matchers."""
    s = expr
    s = re.sub(r'"(?:[^"\\]|\\.)*"', '""', s)          # string literals
    s = re.sub(r"'(?:[^'\\]|\\.)*'", "''", s)
    s = re.sub(r"\{[^{}]*\}", "", s)                    # label matchers
    s = re.sub(r"\b(?:by|without|on|ignoring|group_left|group_right)\s*\([^()]*\)",
               " ", s)                                  # grouping label lists
    s = re.sub(r"\[[^\]]*\]", "", s)                    # range selectors
    out = set()
    for m in re.finditer(r"\b([a-zA-Z_][a-zA-Z0-9_:]*)\b(\s*\()?", s):
        name, is_call = m.group(1), m.group(2)
        if is_call or name in KEYWORDS or name in FUNCTIONS:
            continue
        if re.fullmatch(r"\d+[smhdwy]", name):
            continue
        out.add(name)
    return out


# =============================================================================
# Collect expressions
# =============================================================================

def from_rules(path, label):
    exprs = []
    for d in yaml.safe_load_all(open(path)):
        if not d or d.get("kind") != "PrometheusRule":
            continue
        for grp in d["spec"]["groups"]:
            for rule in grp["rules"]:
                key = rule.get("alert") or rule.get("record")
                exprs.append((f"{label}:{key}", rule["expr"]))
    return exprs


def from_chart():
    from lib_gotemplate import Renderer
    ch = os.path.join(ROOT, "charts", "axispay")
    chart = yaml.safe_load(open(os.path.join(ch, "Chart.yaml")))
    values = yaml.safe_load(open(os.path.join(ch, "values.yaml")))
    r = Renderer(values,
                 {"Name": "axispay", "Namespace": "axispay-core", "Service": "Helm"},
                 {"Name": chart["name"], "Version": chart["version"],
                  "AppVersion": chart["appVersion"]})
    r.load_defines(open(os.path.join(ch, "templates", "_helpers.tpl")).read(),
                   "_helpers.tpl")
    out = r.render(open(os.path.join(ch, "templates", "prometheusrule.yaml")).read(),
                   "prometheusrule.yaml")
    exprs, names = [], []
    for d in yaml.safe_load_all(out):
        if not d:
            continue
        for grp in d["spec"]["groups"]:
            for rule in grp["rules"]:
                exprs.append((f"chart:{rule['alert']}", rule["expr"]))
                names.append(rule["alert"])
    return exprs, names


def from_dashboards(path):
    exprs = []
    for d in yaml.safe_load_all(open(path)):
        if not d or d.get("kind") != "ConfigMap":
            continue
        for fn, body in d["data"].items():
            board = json.loads(body)
            for p in board["panels"]:
                if p["type"] in ("row", "logs"):
                    continue
                for t in p.get("targets", []):
                    if "expr" in t:
                        exprs.append((f"{board['uid']}/{p['title']}", t["expr"]))
            for tv in board.get("templating", {}).get("list", []):
                q = tv.get("query")
                if isinstance(q, str) and q.startswith("label_values("):
                    inner = q[len("label_values("):].rsplit(",", 1)[0]
                    exprs.append((f"{board['uid']}/var:{tv['name']}", inner))
            for ann in board.get("annotations", {}).get("list", []):
                if ann.get("expr"):
                    exprs.append((f"{board['uid']}/annotation", ann["expr"]))
    return exprs


def logql_from_dashboards(path):
    out = []
    for d in yaml.safe_load_all(open(path)):
        if not d or d.get("kind") != "ConfigMap":
            continue
        for fn, body in d["data"].items():
            board = json.loads(body)
            for p in board["panels"]:
                if p["type"] == "logs":
                    for t in p.get("targets", []):
                        out.append((f"{board['uid']}/{p['title']}", t["expr"]))
    return out


# =============================================================================
def main():
    print(f"{B}AxisPay — PromQL validation{D}")
    known = axispay_metrics() | KUBE_STATE | CADVISOR | NODE_EXPORTER | PROM_SELF
    print(f"{len(known)} known series "
          f"({len(axispay_metrics())} from the application, "
          f"{len(KUBE_STATE)} kube-state-metrics, {len(CADVISOR)} cAdvisor)")
    if not HAVE_PARSER:
        print(f"{Y}promql-parser is not installed — syntax parsing skipped.{D}")
        print(f"{Y}  pip install promql-parser{D}")

    rules_path = os.path.join(ROOT, "manifests", "day5", "observability",
                              "02-prometheusrules.yaml")
    dash_path = os.path.join(ROOT, "manifests", "day5", "observability",
                             "04-grafana-dashboards.yaml")

    raw = from_rules(rules_path, "manifest")
    chart_exprs, chart_alerts = from_chart()
    dash = from_dashboards(dash_path)
    all_exprs = raw + chart_exprs + dash

    section(f"1. Syntax — {len(all_exprs)} expressions")
    if HAVE_PARSER:
        bad = []
        for label, e in all_exprs:
            try:
                promql_parser.parse(e)
            except Exception as exc:
                bad.append(f"{label}: {str(exc)[:160]}")
        check(not bad, f"all {len(all_exprs)} expressions parse as valid PromQL",
              "\n          ".join(bad[:6]))
    else:
        print(f"  {Y}SKIP{D}  syntax parsing (promql-parser not installed)")

    section("2. Metric names exist")
    unknown = {}
    for label, e in all_exprs:
        for m in metric_names(e) - known:
            unknown.setdefault(m, []).append(label)
    check(not unknown,
          "every metric referenced is one something actually exports",
          "; ".join(f"{m} (in {v[0]})" for m, v in list(unknown.items())[:6])
          + "  — a misspelled metric evaluates to an empty vector and the "
            "alert silently never fires")

    section("3. Alert hygiene")
    for path, label in ((rules_path, "manifest"),):
        alerts = []
        for d in yaml.safe_load_all(open(path)):
            if not d or d.get("kind") != "PrometheusRule":
                continue
            for grp in d["spec"]["groups"]:
                for rule in grp["rules"]:
                    if "alert" in rule:
                        alerts.append(rule)
        no_for = [a["alert"] for a in alerts if "for" not in a]
        check(not no_for, "every alert has a `for:` clause",
              ", ".join(no_for) + "  (without it, one slow scrape pages someone)")
        no_sev = [a["alert"] for a in alerts
                  if a.get("labels", {}).get("severity") not in ("critical", "warning", "info")]
        check(not no_sev, "every alert carries a severity label", ", ".join(no_sev))
        no_run = [a["alert"] for a in alerts
                  if not a.get("annotations", {}).get("runbook_url")]
        check(not no_run, "every alert links a runbook",
              ", ".join(no_run) + "  (an alert without a runbook is a page that "
                                  "starts with twenty minutes of reading)")
        no_sum = [a["alert"] for a in alerts
                  if not a.get("annotations", {}).get("summary")]
        check(not no_sum, "every alert has a summary", ", ".join(no_sum))

    section("4. Chart and raw rules agree")
    raw_alerts = []
    for d in yaml.safe_load_all(open(rules_path)):
        if d and d.get("kind") == "PrometheusRule":
            raw_alerts += [r["alert"] for g in d["spec"]["groups"] for r in g["rules"]]
    check(set(raw_alerts) == set(chart_alerts),
          f"the chart and manifests declare the same {len(raw_alerts)} alerts",
          f"only in manifest: {sorted(set(raw_alerts) - set(chart_alerts))}; "
          f"only in chart: {sorted(set(chart_alerts) - set(raw_alerts))}")

    section("5. Dashboards")
    logql = logql_from_dashboards(dash_path)
    check(len(dash) >= 25, f"{len(dash)} dashboard queries collected")
    check(len(logql) >= 2, f"{len(logql)} Loki log queries present",
          "a dashboard without logs sends people back to kubectl")
    bad_json = []
    for _, e in logql:
        if "| json" not in e:
            bad_json.append(e)
    check(not bad_json,
          "every Loki query parses the structured JSON the services emit",
          "; ".join(bad_json))
    # a panel querying a metric with no rule and no alert is fine; a panel with
    # a bare `container_` metric and no namespace filter is not — it would pull
    # in every workload on the cluster
    unscoped = [lbl for lbl, e in dash
                if re.search(r"\bcontainer_[a-z_]+\{(?![^}]*namespace)", e)]
    check(not unscoped,
          "no cAdvisor query is unscoped by namespace",
          "; ".join(unscoped) + "  (it would graph every workload on the cluster)")

    print(f"\n{B}{'=' * 62}{D}")
    if FAILURES:
        print(f"{R}{len(FAILURES)} of {CHECKS} checks failed{D}")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print(f"{G}All {CHECKS} PromQL assertions hold "
          f"({len(all_exprs)} expressions, {len(logql)} LogQL queries).{D}")


if __name__ == "__main__":
    main()
