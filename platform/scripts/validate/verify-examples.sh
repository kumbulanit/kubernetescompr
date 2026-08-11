#!/usr/bin/env bash
# ==============================================================================
# Verify that every worked example in the labs and slides actually works.
#
# Runs the AxisPay services locally (no cluster needed) and executes the same
# sequences the labs teach, comparing the SHAPE of the output against the
# fixtures in data/fixtures/expected-output/.
#
# Run this after ANY change to service code, before shipping the course.
#
#   ./scripts/validate/verify-examples.sh
# ==============================================================================
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
# shellcheck disable=SC1091
source "$D/_lib.sh"
LAB_ID="worked examples"

export PYTHONPATH="$R/platform/images/_shared"
RUN="$(mktemp -d)"
PIDS=()
# Kill only the processes WE started. A blanket `pkill -f uvicorn` also matches
# (and kills) the shell running this script when it is invoked from a wrapper.
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; rm -rf "$RUN"; }
trap cleanup EXIT

launch() {
  ( cd "$R/platform/images/$1"
    POD_NAME="$1-verify-$$" NODE_NAME="verify" NAMESPACE="axispay" ENVIRONMENT="training" \
    AUTH_SERVICE_URL="http://127.0.0.1:9081" MERCHANT_SERVICE_URL="http://127.0.0.1:9082" \
    PAYMENT_SERVICE_URL="http://127.0.0.1:9083" FRAUD_SERVICE_URL="http://127.0.0.1:9084" \
    ROUTING_SERVICE_URL="http://127.0.0.1:9085" ENABLE_RISK_ROUTING="${3:-false}" \
    setsid nohup python3 -m uvicorn app.main:app --host 127.0.0.1 --port "$2" \
      --log-level warning > "$RUN/$1.log" 2>&1 < /dev/null &
    echo $! >> "$RUN/pids" )
}

header "Starting services locally"
launch auth-service 9081; launch merchant-service 9082
launch payment-service 9083 true; launch edge-gateway 9080
launch fraud-service 9084; launch routing-service 9085
sleep 9
mapfile -t PIDS < "$RUN/pids" 2>/dev/null || PIDS=()

python3 - "$RUN" <<'PY'
import json, sys, urllib.request, urllib.error
G="http://127.0.0.1:9080"
P=F=0
GRN="\033[32m✓\033[0m"; RED="\033[31m✗\033[0m"
BOLD="\033[1m\033[34m"; RST="\033[0m"
def chk(label, ok, note=""):
    # Coerce: callers often pass a truthy string (e.g. an acquirer code) rather
    # than a bool, and `P + "ACQ_VELA"` is a TypeError.
    ok = bool(ok)
    global P,F; P,F=P+ok,F+(not ok)
    mark = GRN if ok else RED
    extra = "  " + note if note else ""
    print(f"  {mark} {label}{extra}")
def call(m,u,b=None,h=None):
    d=json.dumps(b).encode() if b is not None else None
    r=urllib.request.Request(u,data=d,method=m); r.add_header("Content-Type","application/json")
    for k,v in (h or {}).items(): r.add_header(k,v)
    try:
        with urllib.request.urlopen(r,timeout=20) as x: return x.status,json.loads(x.read() or b"{}"),x.headers
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b"{}"),e.headers

print(f"\n{BOLD}L1.3 — /api/v1/_info and the three probes{RST}")
s,info,_=call("GET","http://127.0.0.1:9083/api/v1/_info")
chk("_info returns pod identity", all(k in info for k in ("service","version","pod_name","node_name")))
for path in ("healthz","readyz","startupz"):
    st,_,_=call("GET",f"http://127.0.0.1:9083/{path}")
    chk(f"/{path} -> {st}", st==200)

print(f"\n{BOLD}L1.6 — end-to-end payment{RST}")
s,tok,_=call("POST",f"{G}/api/v1/login",{"api_key":"ak_live_kalahari_7QK2XD9P4A"})
chk("login returns a bearer token", s==200 and "access_token" in tok)
T={"Authorization":"Bearer "+tok["access_token"]}
s,pay,_=call("POST",f"{G}/api/v1/charges",
  {"amount_minor":129900,"currency":"ZAR","card_token":"tok_a71ef4c2900bd5386ff1240e"},
  {**T,"Idempotency-Key":"verify-1"})
chk(f"charge accepted -> {s}", s==201, pay.get("payment_id",""))
chk("response carries risk_score and acquirer (v1.1.0)",
    pay.get("risk_score") is not None and pay.get("acquirer"))

print(f"\n{BOLD}L2.1 — fee arithmetic (integer minor units, no float){RST}")
g,f_,n=pay["amount_minor"],pay["fee_minor"],pay["net_minor"]
chk(f"variable fee = 180bps of {g} = {round(g*180/10000)}", f_-150==round(g*180/10000))
chk(f"fee + net == gross  ({f_} + {n} == {g})", f_+n==g)

print(f"\n{BOLD}L1.6 — idempotency{RST}")
s2,pay2,h2=call("POST",f"{G}/api/v1/charges",
  {"amount_minor":129900,"currency":"ZAR","card_token":"tok_a71ef4c2900bd5386ff1240e"},
  {**T,"Idempotency-Key":"verify-1"})
chk("replay returns the SAME payment_id", pay["payment_id"]==pay2["payment_id"])
chk(f"replay status 200 (not 201)", s2==200)
chk("Idempotent-Replay header present", h2.get("Idempotent-Replay")=="true")

print(f"\n{BOLD}L2.4 C1 — the in-memory velocity bug is observable{RST}")
scores=[]
for _ in range(12):
    _,d,_=call("POST","http://127.0.0.1:9084/api/v1/score",
      {"merchant_id":"MER_6TY3WQ8Z4P","card_token":"tok_3f6a91e0c48db275ae30165c",
       "amount_minor":1450000,"currency":"KES"})
    scores.append(d["score"])
chk(f"score escalates with velocity {scores[0]} -> {scores[-1]}", scores[-1]>scores[0])
_,v,_=call("GET","http://127.0.0.1:9084/api/v1/velocity/tok_3f6a91e0c48db275ae30165c")
chk("velocity endpoint reports counted_by_pod", "counted_by_pod" in v, v.get("counted_by_pod",""))

print(f"\n{BOLD}L2.6 — routing rules select acquirers by band and currency{RST}")
for amt,cur,exp in ((30000,"ZAR","ACQ_VELA"),(129900,"ZAR","ACQ_MERIDIAN"),
                    (900000,"ZAR","ACQ_ATLAS"),(50000,"NGN","ACQ_KOPANO"),
                    (50000,"USD","ACQ_NORTHSTAR")):
    _,r,_=call("POST","http://127.0.0.1:9085/api/v1/route",
      {"merchant_id":"MER_7QK2XD9P4A","card_token":"tok_a71ef4c2900bd5386ff1240e",
       "amount_minor":amt,"currency":cur,"payment_id":f"pay_v{amt}{cur}"})
    chk(f"{cur} {amt:>8} -> {r.get('acquirer')}", r.get("acquirer")==exp)

print(f"\n{BOLD}Error classification (4xx must not become 502){RST}")
for lbl,body,exp in (("unsupported currency",{"amount_minor":100,"currency":"XYZ","card_token":"tok_a71ef4c2900bd5386ff1240e"},422),
                     ("raw PAN rejected",{"amount_minor":100,"currency":"ZAR","card_token":"4111111111111111"},422),
                     ("negative amount",{"amount_minor":-5,"currency":"ZAR","card_token":"tok_a71ef4c2900bd5386ff1240e"},422)):
    st,_,_=call("POST",f"{G}/api/v1/charges",body,T)
    chk(f"{lbl} -> {st}", st==exp)

print(f"\n{'='*60}")
FAILC="\033[31m\033[1m"; OKC="\033[32m\033[1m"
if F:
    print(f"  {FAILC}{F} example(s) FAILED{RST} — {P} passed"); sys.exit(1)
print(f"  {OKC}All {P} worked examples verified{RST}")
PY
RC=$?

header "recon-worker Job (exit code is the Job's success signal)"
( cd "$R/platform/images/recon-worker"
  PAYMENT_SERVICE_URL=http://127.0.0.1:9083 POD_NAME=verify NODE_NAME=verify \
    python3 app/main.py >/dev/null 2>&1 )
if [[ $? -eq 0 ]]; then pass "recon-worker exits 0 (Job would be Complete)"
else fail "recon-worker exited non-zero" "exit 0" "python3 images/recon-worker/app/main.py"; fi

( cd "$R/platform/images/recon-worker"
  RECON_MODE=fail POD_NAME=verify python3 app/main.py >/dev/null 2>&1 )
if [[ $? -eq 1 ]]; then pass "RECON_MODE=fail exits 1 (drives backoffLimit)"
else fail "fail mode did not exit 1" "exit 1" ""; fi

exit $RC
