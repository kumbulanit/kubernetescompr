#!/usr/bin/env python3
"""
Simulate Kubernetes NetworkPolicy evaluation against the AxisPay manifests.

    python3 platform/admin/validate/simulate-netpol.py

WHY THIS EXISTS
A NetworkPolicy that is too permissive fails silently — everything works, and
nothing tells you the control is not doing its job. A policy that is too strict
fails loudly but often only under load, or only for one rarely-used call path.

Neither is caught by `kubectl apply`, and neither is caught by a manifest
linter. This script evaluates every policy the way Kubernetes does — egress at
the source AND ingress at the destination must both permit a flow — and checks
it against two lists:

    MUST_ALLOW   every call the platform actually makes
    MUST_BLOCK   the controls that matter, especially DMZ -> data tier

Run it after ANY change under manifests/**/netpol or manifests/day5/observability/.
Exit 0 = the policy set is correct. Exit 1 = it is not.
"""
import collections
import pathlib
import sys

import yaml

R = pathlib.Path(__file__).resolve().parents[2]
L = lambda n: {"app.kubernetes.io/name": n, "app.kubernetes.io/instance": "axispay"}

# Every call the platform genuinely makes.
MUST_ALLOW = [
    ("ingress-nginx", "ingress-controller", "axispay-edge", "edge-gateway", 8080, "Ingress -> gateway"),
    ("axispay-edge", "edge-gateway", "axispay-edge", "auth-service", 8080, "gateway -> auth"),
    ("axispay-edge", "edge-gateway", "axispay-core", "payment-service", 8080, "gateway -> payment"),
    ("axispay-edge", "edge-gateway", "axispay-core", "merchant-service", 8080, "gateway -> merchant"),
    ("axispay-core", "payment-service", "axispay-core", "merchant-service", 8080, "payment -> merchant"),
    ("axispay-core", "payment-service", "axispay-core", "fraud-service", 8080, "payment -> fraud"),
    ("axispay-core", "payment-service", "axispay-core", "routing-service", 8080, "payment -> routing"),
    ("axispay-core", "payment-service", "axispay-core", "ledger-service", 8080, "payment -> ledger"),
    ("axispay-core", "payment-service", "axispay-core", "customer-service", 8080, "payment -> customer"),
    ("axispay-core", "payment-service", "axispay-data", "postgres", 5432, "payment -> postgres"),
    ("axispay-core", "fraud-service", "axispay-data", "redis", 6379, "fraud -> redis"),
    ("axispay-core", "payment-service", "axispay-data", "rabbitmq", 5672, "payment -> rabbitmq"),
    ("axispay-async", "settlement-service", "axispay-core", "payment-service", 8080, "settlement -> payment"),
    ("axispay-async", "reporting-service", "axispay-core", "payment-service", 8080, "reporting -> payment"),
    ("axispay-async", "notification-service", "axispay-core", "merchant-service", 8080, "notification -> merchant"),
    ("axispay-async", "audit-service", "axispay-data", "postgres", 5432, "audit -> postgres"),
    ("axispay-observability", "prometheus", "axispay-core", "payment-service", 8080, "prometheus scrapes core"),
    ("axispay-observability", "prometheus", "axispay-edge", "edge-gateway", 8080, "prometheus scrapes edge"),
    ("axispay-observability", "prometheus", "axispay-async", "audit-service", 8080, "prometheus scrapes async"),
    ("axispay-observability", "prometheus", "axispay-ops", "node-agent", 8080, "prometheus scrapes ops"),
    ("axispay-observability", "alertmanager", "axispay-observability", "alert-sink", 8080, "alertmanager -> alert sink"),
    ("axispay-observability", "prometheus", "axispay-observability", "alert-sink", 8080, "prometheus scrapes the sink"),
]

# The controls. If any of these becomes allowed, the segmentation argument fails.
MUST_BLOCK = [
    ("axispay-edge", "edge-gateway", "axispay-data", "postgres", 5432, "gateway -> postgres  [PCI: DMZ into the vault]"),
    ("axispay-edge", "edge-gateway", "axispay-data", "redis", 6379, "gateway -> redis"),
    ("axispay-edge", "auth-service", "axispay-data", "postgres", 5432, "auth -> postgres"),
    ("axispay-edge", "edge-gateway", "axispay-core", "fraud-service", 8080, "gateway -> fraud  [only payment may]"),
    ("axispay-edge", "edge-gateway", "axispay-core", "ledger-service", 8080, "gateway -> ledger"),
    ("axispay-async", "reporting-service", "axispay-core", "ledger-service", 8080, "reporting -> ledger"),
    ("axispay-core", "fraud-service", "axispay-core", "ledger-service", 8080, "fraud -> ledger  [lateral movement]"),
    ("axispay-async", "audit-service", "axispay-edge", "auth-service", 8080, "async -> auth"),
    # Day 5 additions
    ("axispay-observability", "prometheus", "axispay-data", "postgres", 5432, "prometheus -> postgres  [scraping is not a database session]"),
    ("axispay-edge", "edge-gateway", "axispay-ops", "node-agent", 8080, "gateway -> node-agent  [ops is not a service tier]"),
    ("axispay-async", "audit-service", "axispay-ops", "node-agent", 8080, "async -> node-agent"),
    ("axispay-ops", "node-agent", "axispay-core", "payment-service", 8080, "node-agent -> payment  [telemetry does not call the platform]"),
]

GRN, RED, YEL, BLD, RST = "\033[32m", "\033[31m", "\033[33m", "\033[1m", "\033[0m"


def load():
    pols, ns_labels = [], {}
    for f in sorted(R.glob("manifests/**/*.yaml")):
        for d in yaml.safe_load_all(f.read_text()):
            if not d:
                continue
            if d["kind"] == "NetworkPolicy":
                pols.append(d)
            elif d["kind"] == "Namespace":
                ns_labels[d["metadata"]["name"]] = d["metadata"].get("labels", {})
    # namespaces we reference but do not own
    for n in ("kube-system", "ingress-nginx", "axispay-observability"):
        ns_labels.setdefault(n, {"kubernetes.io/metadata.name": n})
    return pols, ns_labels


def sel_matches(sel, labels):
    if not sel:
        return True
    for k, v in (sel.get("matchLabels") or {}).items():
        if labels.get(k) != v:
            return False
    for e in sel.get("matchExpressions") or []:
        val = labels.get(e["key"])
        if e["operator"] == "In" and val not in e["values"]:
            return False
        if e["operator"] == "NotIn" and val in e["values"]:
            return False
        if e["operator"] == "Exists" and val is None:
            return False
    return True


def allowed(pols, ns_labels, src_ns, src, dst_ns, dst, port, proto="TCP"):
    """Egress at the source AND ingress at the destination must both permit."""
    def side(direction, ns, labels, peer_ns, peer_labels):
        selecting = [
            p for p in pols
            if p["metadata"]["namespace"] == ns
            and direction.capitalize() in p["spec"].get("policyTypes", [])
            and sel_matches(p["spec"].get("podSelector"), labels)
        ]
        if not selecting:
            return True                      # unselected pods are unrestricted
        for p in selecting:
            for rule in p["spec"].get(direction) or []:
                ports = rule.get("ports")
                if ports is not None and not any(
                    pp.get("port") == port and pp.get("protocol", "TCP") == proto for pp in ports
                ):
                    continue
                peers = rule.get("to" if direction == "egress" else "from")
                if peers is None:
                    return True
                for peer in peers:
                    nsel, psel = peer.get("namespaceSelector"), peer.get("podSelector")
                    ns_ok = (peer_ns == ns) if nsel is None else sel_matches(nsel, ns_labels.get(peer_ns, {}))
                    pod_ok = sel_matches(psel, peer_labels) if psel is not None else True
                    if ns_ok and pod_ok:
                        return True
        return False

    return (side("egress", src_ns, src, dst_ns, dst)
            and side("ingress", dst_ns, dst, src_ns, src))


def main() -> int:
    pols, ns_labels = load()
    fails = []
    print(f"\n{BLD}NetworkPolicy simulation — {len(pols)} policies, "
          f"{len({p['metadata']['namespace'] for p in pols})} namespaces{RST}\n")

    print(f"{BLD}MUST BE ALLOWED{RST}")
    for sn, sp, dn, dp, port, label in MUST_ALLOW:
        ok = allowed(pols, ns_labels, sn, L(sp), dn, L(dp), port)
        print(f"  {GRN + '✓' + RST if ok else RED + '✗' + RST} {label}")
        if not ok:
            fails.append(f"BLOCKED but should be allowed: {label}")

    print(f"\n{BLD}MUST BE BLOCKED{RST}")
    for sn, sp, dn, dp, port, label in MUST_BLOCK:
        ok = not allowed(pols, ns_labels, sn, L(sp), dn, L(dp), port)
        print(f"  {GRN + '✓' + RST if ok else RED + '✗' + RST} {label}")
        if not ok:
            fails.append(f"ALLOWED but must be blocked: {label}")

    print(f"\n{BLD}DNS egress — the rule everyone forgets{RST}")
    for ns in ("axispay-edge", "axispay-core", "axispay-data", "axispay-async"):
        for proto in ("UDP", "TCP"):
            ok = allowed(pols, ns_labels, ns, L("any"), "kube-system",
                         {"k8s-app": "kube-dns"}, 53, proto)
            print(f"  {GRN + '✓' + RST if ok else RED + '✗' + RST} {ns} -> CoreDNS {proto.lower()}/53")
            if not ok:
                fails.append(f"DNS {proto} blocked from {ns} — every service call will fail")

    print(f"\n{BLD}Default deny present{RST}")
    for ns in ("axispay-edge", "axispay-core", "axispay-data", "axispay-async"):
        dd = [p for p in pols
              if p["metadata"]["namespace"] == ns
              and p["spec"].get("podSelector") == {}
              and set(p["spec"].get("policyTypes", [])) == {"Ingress", "Egress"}
              and not p["spec"].get("ingress") and not p["spec"].get("egress")]
        ok = len(dd) == 1
        print(f"  {GRN + '✓' + RST if ok else RED + '✗' + RST} {ns}")
        if not ok:
            fails.append(f"{ns} has no true default-deny policy")

    total = len(MUST_ALLOW) + len(MUST_BLOCK) + 8 + 4
    print()
    if fails:
        print(f"{RED}{BLD}{len(fails)} POLICY FAULT(S){RST}")
        for f in fails:
            print(f"  - {f}")
        return 1
    print(f"{GRN}{BLD}All {total} policy assertions hold.{RST}")
    print(f"{YEL}Reminder: this simulates the policy LOGIC. It cannot verify that your")
    print(f"CNI enforces policy at all — check `kubectl get ds -n kube-system calico-node`.{RST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
