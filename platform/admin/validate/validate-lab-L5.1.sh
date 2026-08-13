#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L5.1"; LAB_DOC="days/day5/labs/L5.1-identity-and-pod-security/"

header "No workload uses the default ServiceAccount"
DEFAULTS="$(K get pods -A -l app.kubernetes.io/part-of=axispay \
  -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name} {.spec.serviceAccountName}{"\n"}{end}' 2>/dev/null \
  | awk '$2=="default"{print $1}')"
[[ -z "$DEFAULTS" ]] && pass "every AxisPay pod has its own ServiceAccount" \
  || fail "still on default: $(echo "$DEFAULTS" | tr '\n' ' ')" \
          "a named ServiceAccount per service" \
          "kubectl set serviceaccount deployment/<name> <sa> -n <ns>"

header "No token is mounted where it is not used"
MOUNTED=""
while read -r ns pod; do
  [[ -z "${pod:-}" ]] && continue
  [[ "$pod" == node-agent* ]] && continue
  K exec -n "$ns" "$pod" -- test -f /var/run/secrets/kubernetes.io/serviceaccount/token 2>/dev/null \
    && MOUNTED="$MOUNTED $ns/$pod"
done < <(K get pods -A -l app.kubernetes.io/part-of=axispay --field-selector=status.phase=Running \
         -o jsonpath='{range .items[*]}{.metadata.namespace}{" "}{.metadata.name}{"\n"}{end}' 2>/dev/null | head -20)
[[ -z "${MOUNTED// /}" ]] && pass "no API token mounted except node-agent" \
  || fail "token still mounted in:$MOUNTED" "automountServiceAccountToken: false" \
          "the setting applies to NEW pods — check the rollout finished"

header "node-agent keeps its token, because it uses it"
K get sa node-agent -n "${NS_OPS}" -o jsonpath='{.automountServiceAccountToken}' 2>/dev/null | grep -q 'true' \
  && pass "node-agent mounts a token (the one documented exception)" \
  || fail "node-agent has no token" "it lists Nodes and needs one" "kubectl get sa node-agent -n ${NS_OPS} -o yaml"

header "Pod Security Admission"
for ns in "${NS_EDGE}" "${NS_CORE}" "${NS_ASYNC}"; do
  ENF="$(K get ns "$ns" -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}' 2>/dev/null)"
  [[ "$ENF" == "restricted" ]] && pass "$ns enforces restricted" \
    || fail "$ns enforces '${ENF:-none}'" "restricted" "kubectl apply -f manifests/day5/security/01-pod-security.yaml"
done
OBS="$(K get ns "${NS_OBS}" -o jsonpath='{.metadata.labels.pod-security\.kubernetes\.io/enforce}' 2>/dev/null)"
[[ "$OBS" == "privileged" ]] && pass "${NS_OBS} is privileged (Alloy needs hostPath; baseline forbids it)" \
  || fail "${NS_OBS} enforces '${OBS:-none}'" "privileged" "baseline forbids hostPath — Alloy would never start"

header "A non-compliant pod is REJECTED, not merely reported"
OUT="$(K run psa-probe-$$ -n "${NS_CORE}" --image=busybox:1.37 --restart=Never \
  --overrides='{"spec":{"containers":[{"name":"x","image":"busybox:1.37","securityContext":{"privileged":true}}]}}' \
  -- sleep 5 2>&1 || true)"
K delete pod "psa-probe-$$" -n "${NS_CORE}" --ignore-not-found >/dev/null 2>&1
echo "$OUT" | grep -qi 'forbidden.*PodSecurity' \
  && pass "a privileged pod is refused at admission" \
  || fail "a privileged pod was ACCEPTED" "rejection by PodSecurity" "kubectl get ns ${NS_CORE} --show-labels"

summary
