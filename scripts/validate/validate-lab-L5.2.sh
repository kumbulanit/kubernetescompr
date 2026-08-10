#!/usr/bin/env bash
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
# shellcheck disable=SC1091
source "$R/VERSIONS.env"; source "$D/_lib.sh"
LAB_ID="L5.2"; LAB_DOC="labs/day5/L5.2-rbac/"

A="--as=auditor@axis.example"
DEP="--as=engineer@axis.example --as-group=axispay-platform-team"

can() {  # can <expect yes|no> <verb> <resource> <ns-or-empty> <as...> <label>
  local want="$1" verb="$2" res="$3" ns="$4" label="$5"; shift 5
  local out
  if [[ -n "$ns" ]]; then out="$(K auth can-i "$verb" "$res" -n "$ns" "$@" 2>/dev/null)"
  else out="$(K auth can-i "$verb" "$res" "$@" 2>/dev/null)"; fi
  [[ "$out" == "$want" ]] && pass "$label ($out)" \
    || fail "$label returned '$out', expected '$want'" "$want" \
            "kubectl auth can-i $verb $res ${ns:+-n $ns} $*"
}

header "The roles exist"
K get clusterrole axispay-auditor >/dev/null 2>&1 && pass "ClusterRole axispay-auditor" \
  || fail "ClusterRole axispay-auditor missing" "the auditor role" "kubectl apply -f manifests/day5/rbac/02-roles.yaml"
K get role axispay-deployer -n "${NS_CORE}" >/dev/null 2>&1 && pass "Role axispay-deployer in ${NS_CORE}" \
  || fail "Role axispay-deployer missing" "the deployer role" "kubectl apply -f manifests/day5/rbac/02-roles.yaml"

header "The auditor can do the job"
can yes list pods           "${NS_CORE}"  "auditor lists pods"          $A
can yes get  deployments    "${NS_CORE}"  "auditor reads deployments"   $A
can yes list events         "${NS_CORE}"  "auditor reads events"        $A
can yes get  pods/log       "${NS_CORE}"  "auditor reads pod logs"      $A
can yes list rolebindings   "${NS_CORE}"  "auditor audits RBAC itself"  $A

header "The restriction that matters"
can no get    secrets "${NS_CORE}"   "auditor CANNOT read secrets"          $A
can no list   secrets "${NS_DATA}"   "auditor CANNOT read data secrets"     $A
can no get    secrets "kube-system"   "auditor CANNOT read kube-system"      $A
can no create pods    "${NS_CORE}"   "auditor CANNOT create pods"           $A
can no delete pods    "${NS_CORE}"   "auditor CANNOT delete pods"           $A
can no create pods/exec "${NS_CORE}" "auditor CANNOT exec (= reading every secret)" $A

header "The deployer is scoped and cannot delete workloads"
can yes update deployments       "${NS_CORE}" "deployer updates deployments"  $DEP
can yes patch  deployments/scale "${NS_CORE}" "deployer scales"               $DEP
can no  delete deployments       "${NS_CORE}" "deployer CANNOT delete a workload" $DEP
can no  update deployments       "${NS_DATA}" "deployer CANNOT touch the data tier" $DEP
can no  update deployments       "kube-system"  "deployer CANNOT touch kube-system" $DEP

header "Workload identities are minimal"
can yes list nodes ""            "node-agent lists nodes" --as=system:serviceaccount:${NS_OPS}:node-agent
can no  list pods  "${NS_CORE}"  "node-agent CANNOT list pods" --as=system:serviceaccount:${NS_OPS}:node-agent
can no  get secrets "${NS_CORE}" "payment-service CANNOT read secrets" --as=system:serviceaccount:${NS_CORE}:payment-service

header "Offline analysis agrees"
python3 "$D/simulate-rbac.py" >/dev/null 2>&1 \
  && pass "simulate-rbac.py: all 28 assertions hold" \
  || fail "simulate-rbac.py reports failures" "all assertions holding" "python3 scripts/validate/simulate-rbac.py"

summary
