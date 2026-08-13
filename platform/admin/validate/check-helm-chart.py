#!/usr/bin/env python3
"""
Static validation of charts/axispay.

WHAT THIS IS AND IS NOT
-----------------------
`helm lint` and `helm template` are the authoritative checks and the labs run
them on the student's machine. This script exists so the repository can prove
its own chart is sound in CI, offline, with nothing installed but Python.

It renders every template with all five values files using the small Go
template engine in lib_gotemplate.py, parses the result as Kubernetes YAML,
and then asserts the platform rules the course teaches. If a rule is worth
one slide, it is worth one assertion here.

    python3 platform/admin/validate/check-helm-chart.py

Exit code 0 = every assertion holds.
"""

from __future__ import annotations

import os
import sys
import glob
import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_gotemplate import Renderer, deep_merge, TemplateError  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHART = os.path.join(ROOT, "charts", "axispay")
MANIFESTS = os.path.join(ROOT, "manifests")
REPO_ROOT = os.path.dirname(ROOT)  # ROOT is platform/; VERSIONS.env lives one level up

G, R, Y, B, D = "\033[32m", "\033[31m", "\033[33m", "\033[1m", "\033[0m"

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
# Render
# =============================================================================

def load_chart():
    return yaml.safe_load(open(os.path.join(CHART, "Chart.yaml")))


def render(values_file: str | None, release="axispay"):
    """Render every template. Returns (objects, notes_text)."""
    chart = load_chart()
    values = yaml.safe_load(open(os.path.join(CHART, "values.yaml")))
    if values_file:
        values = deep_merge(values, yaml.safe_load(open(os.path.join(CHART, values_file))))
    r = Renderer(
        values,
        {"Name": release, "Namespace": "axispay-core", "Service": "Helm",
         "IsInstall": True, "IsUpgrade": False, "Revision": 1},
        {"Name": chart["name"], "Version": chart["version"],
         "AppVersion": chart["appVersion"]},
    )
    r.load_defines(open(os.path.join(CHART, "templates", "_helpers.tpl")).read(),
                   "_helpers.tpl")
    objs = []
    for f in sorted(glob.glob(os.path.join(CHART, "templates", "*.yaml"))):
        out = r.render(open(f).read(), os.path.basename(f))
        for d in yaml.safe_load_all(out):
            if d:
                d["__src"] = os.path.basename(f)
                objs.append(d)
    notes = r.render(open(os.path.join(CHART, "templates", "NOTES.txt")).read(),
                     "NOTES.txt")
    return values, objs, notes


def by_kind(objs, kind):
    return [o for o in objs if o.get("kind") == kind]


def pod_spec(o):
    k = o["kind"]
    if k == "Deployment" or k == "DaemonSet" or k == "StatefulSet":
        return o["spec"]["template"]["spec"]
    if k == "CronJob":
        return o["spec"]["jobTemplate"]["spec"]["template"]["spec"]
    return None


# =============================================================================
# 1. Chart metadata
# =============================================================================

def check_metadata():
    section("1. Chart metadata")
    c = load_chart()
    check(c.get("apiVersion") == "v2", "Chart.yaml is apiVersion v2")
    check(bool(c.get("version")), "chart version is set", str(c.get("version")))
    check(bool(c.get("appVersion")), "appVersion is set — it becomes the version label")
    check(os.path.exists(os.path.join(CHART, ".helmignore")), ".helmignore exists")
    check(os.path.exists(os.path.join(CHART, "templates", "NOTES.txt")),
          "NOTES.txt exists — the operator gets instructions, not silence")
    for f in ("values.yaml", "values-dev.yaml", "values-staging.yaml",
              "values-prod.yaml", "values-slim.yaml"):
        check(os.path.exists(os.path.join(CHART, f)), f"{f} exists")


# =============================================================================
# 2. Every values file renders to valid YAML
# =============================================================================

def check_renders():
    section("2. Every values file renders")
    results = {}
    for vf in (None, "values-dev.yaml", "values-staging.yaml",
               "values-prod.yaml", "values-slim.yaml"):
        label = vf or "values.yaml (defaults)"
        try:
            values, objs, notes = render(vf)
            results[label] = (values, objs, notes)
            kinds = {}
            for o in objs:
                kinds[o["kind"]] = kinds.get(o["kind"], 0) + 1
            summary = " ".join(f"{k}={v}" for k, v in sorted(kinds.items()))
            check(len(objs) > 0, f"{label} renders {len(objs)} objects", summary)
        except (TemplateError, yaml.YAMLError) as e:
            check(False, f"{label} renders", str(e)[:400])
    return results


# =============================================================================
# 3. Override files may only override keys that exist
# =============================================================================

def flat_keys(d, prefix=""):
    out = set()
    for k, v in (d or {}).items():
        p = f"{prefix}.{k}" if prefix else k
        out.add(p)
        if isinstance(v, dict):
            out |= flat_keys(v, p)
    return out


def check_overrides():
    section("3. Environment files override only real keys")
    base = yaml.safe_load(open(os.path.join(CHART, "values.yaml")))
    base_keys = flat_keys(base)
    # per-service keys are declared on at least one service in the base
    svc_keys = set()
    for s in base["services"].values():
        svc_keys |= flat_keys(s)
    svc_keys |= {"enabled", "zone", "replicas", "resources", "pdb", "hpa",
                 "env", "secretEnv", "antiAffinity", "tag",
                 "resources.requests", "resources.limits",
                 "resources.requests.cpu", "resources.requests.memory",
                 "resources.limits.cpu", "resources.limits.memory",
                 "hpa.enabled", "hpa.minReplicas", "hpa.maxReplicas",
                 "hpa.targetCPU", "pdb.maxUnavailable"}
    for vf in ("values-dev.yaml", "values-staging.yaml",
               "values-prod.yaml", "values-slim.yaml"):
        ov = yaml.safe_load(open(os.path.join(CHART, vf)))
        unknown = []
        for k in flat_keys(ov):
            if k.startswith("services."):
                parts = k.split(".", 2)
                if parts[1] not in base["services"]:
                    unknown.append(k)
                elif len(parts) == 3 and parts[2] not in svc_keys:
                    unknown.append(k)
            elif k not in base_keys:
                unknown.append(k)
        check(not unknown, f"{vf} overrides only keys that exist",
              "unknown: " + ", ".join(sorted(unknown)[:8]))


# =============================================================================
# 4. Workload rules the course teaches
# =============================================================================

def check_workloads(objs, label):
    section(f"4. Workload rules — {label}")
    workloads = [o for o in objs
                 if o["kind"] in ("Deployment", "DaemonSet", "CronJob")]
    check(len(workloads) >= 13,
          f"{len(workloads)} workloads rendered (12 Deployments + DaemonSet + CronJob)")

    missing_probes, missing_res, root_fs, priv, no_sa, bad_live = [], [], [], [], [], []
    no_tmp, unpinned = [], []
    for w in workloads:
        ps = pod_spec(w)
        name = w["metadata"]["name"]
        for c in ps["containers"]:
            if w["kind"] != "CronJob":
                if not all(k in c for k in ("livenessProbe", "readinessProbe", "startupProbe")):
                    missing_probes.append(name)
                live = c.get("livenessProbe", {}).get("httpGet", {}).get("path")
                ready = c.get("readinessProbe", {}).get("httpGet", {}).get("path")
                if live == ready:
                    bad_live.append(name)
            if not c.get("resources", {}).get("requests") or not c.get("resources", {}).get("limits"):
                missing_res.append(name)
            sc = c.get("securityContext", {})
            if not sc.get("readOnlyRootFilesystem"):
                root_fs.append(name)
            if sc.get("allowPrivilegeEscalation") is not False:
                priv.append(name)
            if sc.get("capabilities", {}).get("drop") != ["ALL"]:
                priv.append(name)
            if c["image"].endswith(":latest") or ":" not in c["image"]:
                unpinned.append(c["image"])
            if any(m["mountPath"] == "/tmp" for m in c.get("volumeMounts", [])) is False:
                no_tmp.append(name)
        if not ps.get("serviceAccountName"):
            no_sa.append(name)
        pod_sc = ps.get("securityContext", {})
        if pod_sc.get("runAsNonRoot") is not True:
            priv.append(name + "(pod)")

    check(not missing_probes, "every long-running container has all three probes",
          ", ".join(sorted(set(missing_probes))))
    check(not bad_live,
          "liveness and readiness point at DIFFERENT endpoints",
          "same path on: " + ", ".join(sorted(set(bad_live))))
    check(not missing_res, "every container sets requests AND limits",
          ", ".join(sorted(set(missing_res))))
    check(not root_fs, "readOnlyRootFilesystem on every container",
          ", ".join(sorted(set(root_fs))))
    check(not no_tmp,
          "a writable /tmp is mounted wherever the root filesystem is read-only",
          ", ".join(sorted(set(no_tmp))))
    check(not priv, "no privilege escalation, all capabilities dropped, non-root",
          ", ".join(sorted(set(priv))))
    check(not no_sa, "every workload names its own ServiceAccount",
          ", ".join(sorted(set(no_sa))))
    check(not unpinned, "no floating image tags — you cannot roll back to :latest",
          ", ".join(sorted(set(unpinned))))
    return workloads


# =============================================================================
# 5. Selector immutability — the classic upgrade-breaking defect
# =============================================================================

VOLATILE = ("helm.sh/chart", "app.kubernetes.io/version", "axispay.io/environment")


def check_selectors(objs):
    section("5. Selector labels are immutable-safe")
    offenders = []
    for o in objs:
        sel = o.get("spec", {}).get("selector")
        if not isinstance(sel, dict):
            continue
        labels = sel.get("matchLabels", sel)
        for v in VOLATILE:
            if v in labels:
                offenders.append(f"{o['kind']}/{o['metadata']['name']} carries {v}")
    check(not offenders,
          "no selector contains a version or environment label",
          "; ".join(offenders[:5])
          + "  (a Deployment's .spec.selector cannot be changed after creation — "
            "putting a version in it makes every `helm upgrade` fail)")

    # every Service selector must match exactly one workload's pod labels
    unmatched = []
    workloads = [o for o in objs if o["kind"] in ("Deployment", "DaemonSet")]
    for svc in by_kind(objs, "Service"):
        sel = svc["spec"].get("selector") or {}
        ns = svc["metadata"]["namespace"]
        hits = 0
        for w in workloads:
            if w["metadata"]["namespace"] != ns:
                continue
            pl = w["spec"]["template"]["metadata"]["labels"]
            if all(pl.get(k) == v for k, v in sel.items()):
                hits += 1
        if hits != 1:
            unmatched.append(f"{svc['metadata']['name']} matches {hits} workloads")
    check(not unmatched,
          "every Service selector matches exactly one workload",
          "; ".join(unmatched))


# =============================================================================
# 6. Rollout, disruption and autoscaling arithmetic
# =============================================================================

def check_rollout(values, objs, label):
    section(f"6. Rollout / disruption / autoscaling — {label}")
    st = values["strategy"]
    check(not (st["maxUnavailable"] == 0 and st["maxSurge"] == 0),
          "maxUnavailable and maxSurge are not both zero",
          "a rollout with both at zero can never make progress")

    # PDBs must leave room for a drain
    bad = []
    for p in by_kind(objs, "PodDisruptionBudget"):
        name = p["metadata"]["name"]
        svc = values["services"].get(name, {})
        reps = svc.get("replicas", 1)
        mu = p["spec"].get("maxUnavailable")
        if mu is not None and mu >= reps:
            bad.append(f"{name}: maxUnavailable {mu} >= replicas {reps}")
    check(not bad, "no PDB is looser than the replica count it protects",
          "; ".join(bad))

    single = [p["metadata"]["name"] for p in by_kind(objs, "PodDisruptionBudget")
              if values["services"].get(p["metadata"]["name"], {}).get("replicas", 1) < 2]
    check(not single,
          "no PDB guards a single-replica workload",
          "; ".join(single) + "  (maxUnavailable 1 on 1 replica permits the drain but "
                              "offers no protection; minAvailable 1 would block it forever)")

    hpa_bad = []
    for h in by_kind(objs, "HorizontalPodAutoscaler"):
        n = h["metadata"]["name"]
        mn, mx = h["spec"]["minReplicas"], h["spec"]["maxReplicas"]
        if mx <= mn:
            hpa_bad.append(f"{n}: max {mx} <= min {mn}")
        base = values["services"][n].get("replicas", 1)
        if base > mx:
            hpa_bad.append(f"{n}: replicas {base} exceeds HPA max {mx}")
    check(not hpa_bad, "HPA bounds are coherent with the declared replica count",
          "; ".join(hpa_bad))

    # a Deployment with an HPA must not pin replicas, or upgrade fights the autoscaler
    pinned = []
    hpa_names = {h["metadata"]["name"] for h in by_kind(objs, "HorizontalPodAutoscaler")}
    for d in by_kind(objs, "Deployment"):
        if d["metadata"]["name"] in hpa_names and "replicas" in d["spec"]:
            pinned.append(d["metadata"]["name"])
    check(not pinned,
          "no HPA-managed Deployment hard-codes .spec.replicas",
          "; ".join(pinned) + "  (every `helm upgrade` would reset the replica count "
                              "and undo the autoscaler)")


# =============================================================================
# 7. Capacity — will it actually schedule on the classroom cluster?
# =============================================================================

def cpu_m(v):
    v = str(v)
    return int(v[:-1]) if v.endswith("m") else int(float(v) * 1000)


def mem_mi(v):
    v = str(v)
    for suf, mul in (("Gi", 1024), ("Mi", 1), ("G", 953), ("M", 1)):
        if v.endswith(suf):
            return int(float(v[:-len(suf)]) * mul)
    return int(int(v) / 1024 / 1024)


def check_capacity(values, objs, label, nodes, cpu_per_node, mem_per_node,
                   at_hpa_max=False):
    at = " at HPA maximum" if at_hpa_max else ""
    section(f"7. Capacity — {label}{at} on {nodes} × ({cpu_per_node}m / {mem_per_node}Mi)")
    tot_cpu = tot_mem = 0
    for o in objs:
        ps = pod_spec(o)
        if ps is None or o["kind"] == "CronJob":
            continue
        reps = o["spec"].get("replicas", 1) if o["kind"] == "Deployment" else nodes
        if o["kind"] == "Deployment":
            h = [x for x in by_kind(objs, "HorizontalPodAutoscaler")
                 if x["metadata"]["name"] == o["metadata"]["name"]]
            if h:
                reps = h[0]["spec"]["maxReplicas" if at_hpa_max else "minReplicas"]
        for c in ps["containers"]:
            tot_cpu += cpu_m(c["resources"]["requests"]["cpu"]) * reps
            tot_mem += mem_mi(c["resources"]["requests"]["memory"]) * reps

    # a node is never 100% available to workloads — kubelet, CNI, kube-proxy,
    # CoreDNS and the ingress controller all take a share
    avail_cpu = int(nodes * cpu_per_node * 0.75)
    avail_mem = int(nodes * mem_per_node * 0.70)
    check(tot_cpu <= avail_cpu,
          f"CPU requests {tot_cpu}m fit in {avail_cpu}m of schedulable capacity",
          f"over by {tot_cpu - avail_cpu}m — pods would sit Pending with 'Insufficient cpu'")
    check(tot_mem <= avail_mem,
          f"memory requests {tot_mem}Mi fit in {avail_mem}Mi of schedulable capacity",
          f"over by {tot_mem - avail_mem}Mi")


# =============================================================================
# 8. Wiring — the chart must be internally consistent
# =============================================================================

def check_wiring(values, objs):
    section("8. Internal wiring")
    svc_fqdns = {f"{s['metadata']['name']}.{s['metadata']['namespace']}.svc.cluster.local"
                 for s in by_kind(objs, "Service")}
    dangling = []
    for o in objs:
        ps = pod_spec(o)
        if ps is None:
            continue
        for c in ps["containers"]:
            for e in c.get("env", []):
                v = e.get("value", "")
                if isinstance(v, str) and v.startswith("http://"):
                    host = v[len("http://"):].split(":")[0].split("/")[0]
                    if host not in svc_fqdns:
                        dangling.append(f"{o['metadata']['name']}:{e['name']} -> {host}")
    check(not dangling,
          "every *_SERVICE_URL resolves to a Service this chart creates",
          "; ".join(dangling[:6]))

    # ServiceAccounts
    sa_names = {(s["metadata"]["namespace"], s["metadata"]["name"])
                for s in by_kind(objs, "ServiceAccount")}
    missing = []
    for o in objs:
        ps = pod_spec(o)
        if ps is None:
            continue
        key = (o["metadata"]["namespace"], ps["serviceAccountName"])
        if key not in sa_names:
            missing.append(f"{o['metadata']['name']} -> {key[1]} in {key[0]}")
    check(not missing, "every referenced ServiceAccount is created by the chart",
          "; ".join(missing))

    # namespaces
    declared = set(values["namespaces"].values())
    used = {o["metadata"]["namespace"] for o in objs if "namespace" in o["metadata"]}
    check(used <= declared, "every object lands in a declared namespace",
          f"stray: {sorted(used - declared)}")

    # secrets referenced must be the ones Day 3 creates
    referenced = set()
    for o in objs:
        ps = pod_spec(o)
        if ps is None:
            continue
        for c in ps["containers"]:
            for e in c.get("env", []):
                ref = e.get("valueFrom", {}).get("secretKeyRef")
                if ref:
                    referenced.add(ref["name"])
    known = set()
    for f in glob.glob(os.path.join(MANIFESTS, "**", "*.yaml"), recursive=True):
        try:
            for d in yaml.safe_load_all(open(f)):
                if d and d.get("kind") == "Secret":
                    known.add(d["metadata"]["name"])
        except yaml.YAMLError:
            pass
    check(referenced <= known or not known,
          "every secretKeyRef names a Secret the repository actually creates",
          f"referenced but never created: {sorted(referenced - known)}")


# =============================================================================
# 9. NetworkPolicy shape
# =============================================================================

def check_netpol(values, objs):
    section("9. NetworkPolicy shape")
    nps = by_kind(objs, "NetworkPolicy")
    workload_ns = {o["metadata"]["namespace"] for o in objs
                   if o["kind"] in ("Deployment", "DaemonSet", "CronJob")}
    # axispay-observability is a DOCUMENTED exception: a broad intra-namespace
    # allow instead of a default-deny, because a precise policy over
    # Prometheus + Grafana + Alertmanager + the operator is one nobody
    # maintains, and an unmaintained policy fails open anyway. The assertion
    # below is that the exception stays explicit and stays put — it must have
    # egress rules of its own, and no other namespace may adopt it.
    exempt = {values["namespaces"]["observability"]}
    for ns in sorted(workload_ns):
        here = [n for n in nps if n["metadata"]["namespace"] == ns]
        names = {n["metadata"]["name"] for n in here}
        if ns in exempt:
            check("allow-observability-egress" in names,
                  f"{ns}: exempt from default-deny, but has an explicit egress policy",
                  "the exception must be a written policy, not an absence of one")
        else:
            check("default-deny-all" in names, f"{ns}: has a default-deny policy",
                  "a pod is default-ALLOW until a policy selects it")
        ok = False
        for n in here:
            for e in n["spec"].get("egress", []):
                if any(p.get("port") == 53 for p in e.get("ports", [])):
                    ok = True
        check(ok, f"{ns}: DNS egress on port 53 is explicitly allowed",
              "a default-deny that forgets port 53 breaks every hostname in the "
              "namespace, and the symptom looks like a service outage")

    spread = {n["metadata"]["namespace"] for n in nps
              if n["metadata"]["name"].startswith("allow-observability")} - exempt
    check(not spread,
          "the observability exception has not spread to another namespace",
          f"found in: {sorted(spread)}")


# =============================================================================
# 10. NOTES.txt actually helps
# =============================================================================

def check_notes(notes, label):
    section(f"10. NOTES.txt — {label}")
    check("kubectl get pods" in notes, "NOTES tells the operator how to watch the rollout")
    check("endpointslice" in notes.lower() or "endpoints" in notes.lower(),
          "NOTES points at endpoints — the check that catches a label typo")
    check("Idempotent-Replay" in notes,
          "NOTES includes an end-to-end smoke test, not just 'deployed successfully'")
    check("helm rollback" in notes, "NOTES tells the operator how to get out again")


# =============================================================================
# 11. The chart matches the raw manifests
# =============================================================================

def check_parity(objs):
    section("11. Chart / raw-manifest parity")
    raw = set()
    for f in glob.glob(os.path.join(MANIFESTS, "**", "*.yaml"), recursive=True):
        try:
            for d in yaml.safe_load_all(open(f)):
                if d and d.get("kind") in ("Deployment", "DaemonSet", "CronJob"):
                    raw.add(d["metadata"]["name"])
        except yaml.YAMLError:
            pass
    chart_names = {o["metadata"]["name"] for o in objs
                   if o["kind"] in ("Deployment", "DaemonSet", "CronJob")}
    # loadgen and the data tier are deliberately outside the default install
    expected_absent = {"loadgen", "postgres", "redis", "rabbitmq"}
    missing = raw - chart_names - expected_absent
    check(not missing,
          "every workload in manifests/ is also packaged in the chart",
          f"missing from chart: {sorted(missing)}")
    extra = chart_names - raw
    check(not extra, "the chart introduces no workload the manifests never taught",
          f"only in chart: {sorted(extra)}")


# =============================================================================
# 12. The chart agrees with VERSIONS.env
# =============================================================================

def read_versions_env():
    env = {}
    path = os.path.join(REPO_ROOT, "VERSIONS.env")
    if not os.path.exists(path):
        return env
    # VERSIONS.env uses shell line-continuations for the long service list,
    # so join them before splitting on '='.
    text = open(path).read().replace("\\\n", " ")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.split("#")[0].strip().strip('"').strip("'")
    return env


def check_versions(values):
    section("12. Consistency with VERSIONS.env")
    env = read_versions_env()
    if not env:
        check(False, "VERSIONS.env is readable")
        return
    chart = load_chart()
    check(chart["appVersion"] == env.get("IMAGE_TAG"),
          f"Chart appVersion {chart['appVersion']} == IMAGE_TAG {env.get('IMAGE_TAG')}",
          "the chart and the build scripts must agree on what version they ship")
    check(values["global"]["image"]["tag"] == env.get("IMAGE_TAG"),
          "values.yaml image tag matches IMAGE_TAG")
    check(values["global"]["image"]["repository"] == env.get("IMAGE_NAMESPACE"),
          "image repository matches IMAGE_NAMESPACE")
    for zone, key in (("edge", "NS_EDGE"), ("core", "NS_CORE"), ("async", "NS_ASYNC"),
                      ("data", "NS_DATA"), ("ops", "NS_OPS"),
                      ("observability", "NS_OBS")):
        check(values["namespaces"][zone] == env.get(key),
              f"namespace {zone} == {key} ({env.get(key)})")
    check(str(values["global"]["defaultCurrency"]) == env.get("DEFAULT_CURRENCY"),
          "defaultCurrency matches DEFAULT_CURRENCY")
    check(float(values["observability"]["alerts"]["latencyP99Ms"])
          <= float(env.get("SLO_P99_LATENCY_MS", 1e9)),
          "the alert threshold is no looser than the published SLO",
          "an alert that fires later than the SLO breach is decoration")

    # every image the chart references must have a Dockerfile
    declared = set(env.get("AXISPAY_SERVICES", "").split())
    referenced = set(values["services"]) | set(values["daemonsets"])
    referenced |= {c.get("image", n) for n, c in values["cronjobs"].items()}
    missing = referenced - declared
    check(not missing, "every image the chart deploys is in the AXISPAY_SERVICES build list",
          f"never built: {sorted(missing)}")
    no_dockerfile = [s for s in referenced
                     if not os.path.exists(os.path.join(ROOT, "images", s, "Dockerfile"))]
    check(not no_dockerfile, "every referenced image has a Dockerfile",
          f"missing: {sorted(no_dockerfile)}")


# =============================================================================
def main():
    print(f"{B}AxisPay Helm chart — static validation{D}")
    print("helm is not required; `helm lint` remains the authoritative check.\n")

    check_metadata()
    results = check_renders()
    check_overrides()

    values, objs, notes = results["values.yaml (defaults)"]
    check_workloads(objs, "values.yaml")
    check_selectors(objs)
    check_rollout(values, objs, "values.yaml")
    check_wiring(values, objs)
    check_netpol(values, objs)
    check_notes(notes, "values.yaml")
    check_parity(objs)
    check_versions(values)

    # capacity on the two supported classroom profiles
    _, slim_objs, _ = results["values-slim.yaml"]
    slim_values = deep_merge(
        yaml.safe_load(open(os.path.join(CHART, "values.yaml"))),
        yaml.safe_load(open(os.path.join(CHART, "values-slim.yaml"))))
    check_capacity(values, objs, "default install", nodes=3,
                   cpu_per_node=2000, mem_per_node=4096)
    # The scaling lab drives both HPAs to their ceiling. If that does not fit,
    # the lab ends with Pending pods and the room loses twenty minutes.
    check_capacity(values, objs, "default install", nodes=3,
                   cpu_per_node=2000, mem_per_node=4096, at_hpa_max=True)
    check_capacity(slim_values, slim_objs, "values-slim.yaml", nodes=2,
                   cpu_per_node=2000, mem_per_node=3072)

    # production values get the workload rules too — they are the strictest
    prod_values, prod_objs, prod_notes = results["values-prod.yaml"]
    check_workloads(prod_objs, "values-prod.yaml")
    check_rollout(prod_values, prod_objs, "values-prod.yaml")
    check(prod_values["networkPolicy"]["enabled"] is True,
          "production enables NetworkPolicy")
    check(prod_values["podSecurity"]["enforce"] == "restricted",
          "production enforces the restricted Pod Security standard")
    check(prod_values["serviceAccount"]["automountToken"] is False,
          "production does not mount API tokens into workloads that never call the API")
    check(prod_values["loadgen"]["enabled"] is False,
          "production never runs the load generator against real merchants")
    check(prod_values["strategy"]["maxUnavailable"] == 0,
          "a production rollout never reduces capacity")

    print(f"\n{B}{'=' * 62}{D}")
    if FAILURES:
        print(f"{R}{len(FAILURES)} of {CHECKS} checks failed{D}")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print(f"{G}All {CHECKS} chart assertions hold.{D}")
    print("Next, on a real cluster:  helm lint charts/axispay && "
          "helm template axispay charts/axispay | kubectl apply --dry-run=server -f -")


if __name__ == "__main__":
    main()
