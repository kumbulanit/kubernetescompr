#!/usr/bin/env python3
"""
Simulate Kubernetes RBAC evaluation against the AxisPay manifests.

    python3 scripts/validate/simulate-rbac.py

WHY THIS EXISTS
RBAC is purely ADDITIVE — there is no deny rule. A subject can do the union of
everything its bindings grant. That makes over-permission the default failure
mode, and it is silent: nothing warns you that your "read-only auditor" can
also read every Secret in the cluster.

`kubectl auth can-i` answers one question at a time against a live cluster.
This answers all of them against the manifests, before they are applied, and
asserts both directions:

    MUST_ALLOW   what each subject genuinely needs to do its job
    MUST_DENY    what it must NOT be able to do

Exit 0 = the grants are correct. Exit 1 = someone has too much or too little.
"""
import collections
import pathlib
import sys

import yaml

R = pathlib.Path(__file__).resolve().parents[2]
GRN, RED, YEL, BLD, RST = "\033[32m", "\033[31m", "\033[33m", "\033[1m", "\033[0m"

U = lambda n: ("User", n, None)
G = lambda n: ("Group", n, None)
SA = lambda n, ns: ("ServiceAccount", n, ns)

# (subject, verb, resource, namespace, apiGroup, label)
MUST_ALLOW = [
    (U("auditor@axis.example"), "list", "pods", "axispay-core", "", "auditor lists pods in core"),
    (U("auditor@axis.example"), "get", "deployments", "axispay-core", "apps", "auditor reads Deployments"),
    (U("auditor@axis.example"), "list", "networkpolicies", "axispay-core", "networking.k8s.io", "auditor reads NetworkPolicies"),
    (U("auditor@axis.example"), "get", "pods/log", "axispay-edge", "", "auditor reads logs in edge"),
    (G("axispay-platform-team"), "patch", "deployments", "axispay-core", "apps", "deployer patches a Deployment"),
    (G("axispay-platform-team"), "update", "deployments/scale", "axispay-core", "apps", "deployer scales"),
    (G("axispay-oncall"), "create", "pods/exec", "axispay-core", "", "on-call may exec"),
    (G("axispay-oncall"), "create", "pods/eviction", "axispay-core", "", "on-call may drain"),
    (SA("prometheus", "axispay-observability"), "list", "pods", "axispay-core", "", "prometheus discovers targets in core"),
    (SA("prometheus", "axispay-observability"), "list", "endpoints", "axispay-edge", "", "prometheus discovers endpoints"),
    (SA("prometheus", "axispay-observability"), "list", "nodes", None, "", "prometheus lists nodes (cluster-scoped)"),
    (SA("node-agent", "axispay-ops"), "list", "nodes", None, "", "node-agent lists nodes"),
]

MUST_DENY = [
    (U("auditor@axis.example"), "get", "secrets", "axispay-core", "", "auditor reads SECRETS"),
    (U("auditor@axis.example"), "list", "secrets", "axispay-data", "", "auditor lists secrets in the vault"),
    (U("auditor@axis.example"), "delete", "pods", "axispay-core", "", "auditor deletes a pod"),
    (U("auditor@axis.example"), "patch", "deployments", "axispay-core", "apps", "auditor modifies a Deployment"),
    (U("auditor@axis.example"), "list", "pods", "kube-system", "", "auditor reads kube-system"),
    (G("axispay-platform-team"), "get", "secrets", "axispay-core", "", "deployer reads secrets"),
    (G("axispay-platform-team"), "delete", "deployments", "axispay-core", "apps", "deployer DELETES a workload"),
    (G("axispay-platform-team"), "patch", "deployments", "axispay-edge", "apps", "deployer touches another namespace"),
    (G("axispay-platform-team"), "create", "rolebindings", "axispay-core", "rbac.authorization.k8s.io", "deployer edits RBAC"),
    (G("axispay-oncall"), "get", "secrets", "axispay-core", "", "on-call reads secrets directly"),
    (SA("node-agent", "axispay-ops"), "get", "secrets", "axispay-core", "", "node-agent reads secrets"),
    (SA("node-agent", "axispay-ops"), "list", "pods", "axispay-core", "", "node-agent lists pods"),
    (SA("prometheus", "axispay-observability"), "get", "secrets", "axispay-core", "", "prometheus reads secrets"),
    (SA("prometheus", "axispay-observability"), "delete", "pods", "axispay-core", "", "prometheus deletes a pod"),
]


def load():
    roles, croles, bindings, cbindings = {}, {}, [], []
    for f in sorted(R.glob("manifests/**/*.yaml")):
        for d in yaml.safe_load_all(f.read_text()):
            if not d:
                continue
            k = d["kind"]
            if k == "Role":
                roles[(d["metadata"]["namespace"], d["metadata"]["name"])] = d.get("rules") or []
            elif k == "ClusterRole":
                croles[d["metadata"]["name"]] = d.get("rules") or []
            elif k == "RoleBinding":
                bindings.append(d)
            elif k == "ClusterRoleBinding":
                cbindings.append(d)
    return roles, croles, bindings, cbindings


def rule_matches(rule, verb, resource, group):
    verbs = rule.get("verbs", [])
    if verb not in verbs and "*" not in verbs:
        return False
    groups = rule.get("apiGroups", [])
    if group not in groups and "*" not in groups:
        return False
    resources = rule.get("resources", [])
    if resource in resources or "*" in resources:
        return True
    # a grant on "pods" does NOT imply "pods/log" — subresources are separate
    return False


def subject_matches(s, subject):
    kind, name, ns = subject
    if s.get("kind") != kind or s.get("name") != name:
        return False
    if kind == "ServiceAccount":
        return s.get("namespace") == ns
    return True


def allowed(roles, croles, bindings, cbindings, subject, verb, resource, namespace, group):
    # ClusterRoleBindings grant everywhere
    for cb in cbindings:
        if not any(subject_matches(s, subject) for s in cb.get("subjects", [])):
            continue
        for rule in croles.get(cb["roleRef"]["name"], []):
            if rule_matches(rule, verb, resource, group):
                return True
    # RoleBindings grant only in their own namespace
    for b in bindings:
        if b["metadata"]["namespace"] != namespace:
            continue
        if not any(subject_matches(s, subject) for s in b.get("subjects", [])):
            continue
        ref = b["roleRef"]
        rules = (croles.get(ref["name"], []) if ref["kind"] == "ClusterRole"
                 else roles.get((namespace, ref["name"]), []))
        for rule in rules:
            if rule_matches(rule, verb, resource, group):
                return True
    return False


def main() -> int:
    roles, croles, bindings, cbindings = load()
    fails = []
    print(f"\n{BLD}RBAC simulation{RST}")
    print(f"  {len(roles)} Roles · {len(croles)} ClusterRoles · "
          f"{len(bindings)} RoleBindings · {len(cbindings)} ClusterRoleBindings\n")

    def run(cases, expect_allowed, heading):
        print(f"{BLD}{heading}{RST}")
        for subject, verb, resource, ns, group, label in cases:
            got = allowed(roles, croles, bindings, cbindings, subject, verb, resource, ns, group)
            ok = got == expect_allowed
            print(f"  {GRN + '✓' + RST if ok else RED + '✗' + RST} {label}")
            if not ok:
                fails.append(("OVER-PERMISSIONED: " if got else "UNDER-PERMISSIONED: ") + label)

    run(MUST_ALLOW, True, "MUST BE ALLOWED — what each subject needs to do its job")
    print()
    run(MUST_DENY, False, "MUST BE DENIED — the boundaries that matter")

    print(f"\n{BLD}Wildcards and dangerous grants{RST}")
    wild = [n for n, rules in croles.items()
            for r in rules if "*" in r.get("verbs", []) or "*" in r.get("resources", [])]
    ok = not wild
    print(f"  {GRN + '✓' + RST if ok else RED + '✗' + RST} no wildcard verbs or resources in AxisPay ClusterRoles"
          f"{'' if ok else '  ' + str(set(wild))}")
    if not ok:
        fails.append(f"wildcard grants in {set(wild)}")

    secret_readers = [n for n, rules in croles.items()
                      for r in rules if "secrets" in r.get("resources", [])]
    ok = not secret_readers
    print(f"  {GRN + '✓' + RST if ok else RED + '✗' + RST} no AxisPay ClusterRole grants access to secrets"
          f"{'' if ok else '  ' + str(set(secret_readers))}")
    if not ok:
        fails.append(f"secret access granted cluster-wide to {set(secret_readers)}")

    cb_names = [cb["roleRef"]["name"] for cb in cbindings]
    print(f"  {YEL}!{RST} {len(cbindings)} ClusterRoleBinding(s): {cb_names}")
    print(f"    {YEL}each grants in EVERY namespace, including ones not yet created —")
    print(f"    verify each is genuinely cluster-wide work.{RST}")

    print()
    if fails:
        print(f"{RED}{BLD}{len(fails)} RBAC fault(s){RST}")
        for f_ in fails:
            print(f"  - {f_}")
        return 1
    print(f"{GRN}{BLD}All {len(MUST_ALLOW) + len(MUST_DENY) + 2} RBAC assertions hold.{RST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
