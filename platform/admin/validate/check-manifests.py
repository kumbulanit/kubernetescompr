#!/usr/bin/env python3
"""
Static validation of every AxisPay manifest.

    python3 platform/admin/validate/check-manifests.py

Catches the wiring faults that `kubectl apply` accepts happily and that only
surface as a broken cluster:

  * a Service whose selector matches no workload  -> "no endpoints", silently
  * a cluster DNS name that resolves to nothing   -> a downstream call that
                                                      can never work
  * a Secret or ConfigMap referenced but absent   -> CreateContainerConfigError
  * a namespace used but never declared
  * an unpinned image tag

TWO STRUCTURAL FACTS THIS SCRIPT UNDERSTANDS, which a naive checker gets wrong:

  1. The SAME object is defined once per day as the course builds it up.
     manifests/day2/resources/01-deployment-edge-gateway.yaml supersedes
     manifests/day1/deployments/01-deployment-edge-gateway.yaml — it is not a
     duplicate, it is the next version. The LAST definition wins, as it would
     if you applied the directories in order.

  2. A Service may carry a different NAME from the workload it selects.
     payment-service-headless selects payment-service pods. Matching by name
     would report a false failure; matching by SELECTOR is correct.
"""
import collections
import pathlib
import re
import sys

import yaml

R = pathlib.Path(__file__).resolve().parents[2]
GRN, RED, YEL, BLD, RST = "\033[32m", "\033[31m", "\033[33m", "\033[1m", "\033[0m"
DAY_ORDER = {"day1": 1, "day2": 2, "day3": 3, "day4": 4, "day5": 5}


def day_of(path: pathlib.Path) -> int:
    for part in path.parts:
        if part in DAY_ORDER:
            return DAY_ORDER[part]
    return 0                       # 00-namespaces and anything shared


def main() -> int:
    docs = []
    for f in sorted(R.glob("manifests/**/*.yaml")):
        try:
            for d in yaml.safe_load_all(f.read_text()):
                if d:
                    docs.append((f.relative_to(R), d))
        except yaml.YAMLError as e:
            print(f"{RED}✗ {f.relative_to(R)}: {e}{RST}")
            return 1

    by = collections.defaultdict(list)
    for f, d in docs:
        by[d["kind"]].append((f, d))

    # Collapse each object to its LAST definition, in day order.
    latest = {}
    for f, d in sorted(docs, key=lambda fd: day_of(fd[0])):
        key = (d["kind"], d["metadata"].get("namespace"), d["metadata"]["name"])
        # A strategic-merge patch has no selector; it augments rather than replaces.
        if d["kind"] == "Deployment" and "selector" not in d.get("spec", {}):
            continue
        latest[key] = (f, d)

    failures = []
    def chk(label, ok, note=""):
        ok = bool(ok)
        print(f"  {GRN + 'ok  ' + RST if ok else RED + 'FAIL' + RST} {label}"
              f"{'  ' + note if note else ''}")
        if not ok:
            failures.append(label)

    print(f"\n{BLD}AxisPay manifest validation{RST}")
    print(f"  {len(docs)} documents in {len(set(f for f, _ in docs))} files; "
          f"{len(latest)} distinct objects after superseding\n")
    print("  " + "  ".join(f"{k}:{len(v)}" for k, v in sorted(by.items())) + "\n")

    workloads = [(f, d) for (k, _, _), (f, d) in latest.items()
                 if k in ("Deployment", "DaemonSet", "StatefulSet")]
    pod_labels = lambda d: d["spec"]["template"].get("metadata", {}).get("labels", {})

    print(f"{BLD}Service wiring — matched by SELECTOR, not by name{RST}")
    for (k, ns, nm), (f, s) in sorted(latest.items()):
        if k != "Service":
            continue
        if s["spec"].get("type") == "ExternalName":
            chk(f"{ns}/{nm}", True, f"ExternalName -> {s['spec']['externalName']}")
            continue
        sel = s["spec"].get("selector") or {}
        hits = [d["metadata"]["name"] for _, d in workloads
                if d["metadata"]["namespace"] == ns
                and all(pod_labels(d).get(kk) == vv for kk, vv in sel.items())]
        kind = "headless" if s["spec"].get("clusterIP") == "None" else s["spec"].get("type", "ClusterIP")
        chk(f"{ns}/{nm}", len(hits) == 1,
            f"{kind} -> {hits[0]}" if len(hits) == 1 else f"{kind} matches {hits}")

    print(f"\n{BLD}Cluster DNS references{RST}")
    svc_fqdn = {f"{nm}.{ns}.svc.cluster.local" for (k, ns, nm) in latest if k == "Service"}
    refs = {m.group(1) for _, d in docs
            for m in re.finditer(r"([a-z0-9-]+\.[a-z0-9-]+\.svc\.cluster\.local)", yaml.safe_dump(d))}
    pod_dns = {r for r in refs if re.match(r"^[a-z]+-\d+\.", r)}
    unresolved = (refs - pod_dns) - svc_fqdn
    chk(f"{len(refs - pod_dns)} Service names resolve", not unresolved, str(sorted(unresolved)))
    bad_pod = [r for r in pod_dns if ".".join(r.split(".")[1:]) not in svc_fqdn]
    chk(f"{len(pod_dns)} StatefulSet per-pod names resolve", not bad_pod, str(bad_pod))

    print(f"\n{BLD}References and hygiene{RST}")
    ns_declared = {nm for (k, _, nm) in latest if k == "Namespace"}
    ns_used = {ns for (_, ns, _) in latest if ns}
    chk("every namespace used is declared", ns_used <= ns_declared, str(sorted(ns_used - ns_declared)))

    secrets = {(ns, nm) for (k, ns, nm) in latest if k == "Secret"}
    cms = {(ns, nm) for (k, ns, nm) in latest if k == "ConfigMap"}
    missing = []
    for f, d in workloads:
        ns = d["metadata"]["namespace"]
        spec = d["spec"]["template"]["spec"]
        for c in spec.get("containers", []) + spec.get("initContainers", []):
            for ef in c.get("envFrom", []):
                if "secretRef" in ef and (ns, ef["secretRef"]["name"]) not in secrets:
                    missing.append(f"Secret {ns}/{ef['secretRef']['name']}")
                if "configMapRef" in ef and (ns, ef["configMapRef"]["name"]) not in cms:
                    missing.append(f"ConfigMap {ns}/{ef['configMapRef']['name']}")
            for e in c.get("env", []):
                vf = e.get("valueFrom", {})
                if "secretKeyRef" in vf and (ns, vf["secretKeyRef"]["name"]) not in secrets:
                    missing.append(f"Secret {ns}/{vf['secretKeyRef']['name']}")
        for v in spec.get("volumes", []):
            if "configMap" in v and (ns, v["configMap"]["name"]) not in cms:
                missing.append(f"ConfigMap {ns}/{v['configMap']['name']}")
            if "secret" in v and (ns, v["secret"]["secretName"]) not in secrets:
                missing.append(f"Secret {ns}/{v['secret']['secretName']}")
    chk("every referenced Secret/ConfigMap exists", not missing, str(sorted(set(missing))))

    images = {c["image"] for _, d in docs
              for c in (d.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
                        or d.get("spec", {}).get("containers", [])
                        or d.get("spec", {}).get("jobTemplate", {}).get("spec", {})
                          .get("template", {}).get("spec", {}).get("containers", []) or [])
              if "image" in c}
    unpinned = [i for i in images if ":latest" in i or ":" not in i]
    chk(f"{len(images)} images, all pinned", not unpinned, str(unpinned))

    print(f"\n{BLD}Workload health contract{RST}")
    for f, d in sorted(workloads, key=lambda fd: fd[1]["metadata"]["name"]):
        if day_of(f) < 2:
            continue                       # Day 1 deliberately has no probes yet
        c = d["spec"]["template"]["spec"]["containers"][0]
        live = (c.get("livenessProbe") or {}).get("httpGet", {}).get("path")
        ready = (c.get("readinessProbe") or {}).get("httpGet", {}).get("path")
        if live is None and ready is None:
            continue                       # exec-probed data tier, checked separately
        chk(f"{d['metadata']['name']}: liveness={live} readiness={ready}",
            live == "/healthz" and ready == "/readyz",
            "" if live == "/healthz" else "liveness must NOT check dependencies")

    print()
    if failures:
        print(f"{RED}{BLD}{len(failures)} manifest fault(s){RST}")
        for f_ in failures:
            print(f"  - {f_}")
        return 1
    print(f"{GRN}{BLD}All manifest checks pass.{RST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
