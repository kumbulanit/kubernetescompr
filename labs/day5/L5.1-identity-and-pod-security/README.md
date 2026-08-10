# L5.1 · Who Is This Pod?

| | |
|---|---|
| **Time** | 30 minutes |
| **Difficulty** | Uncomfortable in the first five minutes |
| **You need first** | Day 4 finished — `make validate-day4` passes |
| **You will create** | 6 ServiceAccounts, Pod Security labels on 6 namespaces |
| **Check you are done** | `make validate-lab LAB=L5.1` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command. <kbd>Tab</kbd> completes filenames.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../../GETTING-STARTED.md).
</details>

---

## What you are going to do

Every pod you have deployed this week has been carrying a Kubernetes API credential it never asked for and does not use.

You will read one out of a running pod, **use it against the API server**, and then take it away from everything that does not need it. Then you will turn on **Pod Security Admission** and watch a non-compliant pod be refused before it exists.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `make validate-day4` | `DAY 4 CHECKPOINT PASSED` |
| 3 | `kubectl version --short \| grep Server` | v1.25 or later |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | ServiceAccounts and the Pod Security namespace labels |

---

## Two controls, often confused

| | Question it answers | Enforced by |
|---|---|---|
| **ServiceAccount** | *Who is this pod?* | Authentication |
| **Pod Security Admission** | *Is this pod allowed to exist in this shape?* | Admission control |

A pod can have a perfect ServiceAccount and still run as root with a hostPath. You need both.

---

## Step 1 — Find the credential you never asked for

```bash
kubectl get pods -n axispay-core -o custom-columns='POD:.metadata.name,SA:.spec.serviceAccountName' | head
```

Every pod says `default`.

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $POD -- ls -la /var/run/secrets/kubernetes.io/serviceaccount/
kubectl exec -n axispay-core $POD -- head -c 60 /var/run/secrets/kubernetes.io/serviceaccount/token; echo
```

**That is a signed JWT.** Anything that can run a command in this container can read it.

---

## Step 2 — Prove it is live

```bash
kubectl exec -n axispay-core $POD -- sh -c '
  TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
  wget -qO- --no-check-certificate --header "Authorization: Bearer $TOKEN" \
    https://kubernetes.default.svc/api/v1/namespaces/axispay-core/pods 2>&1 | head -c 300'
```

You get **`403 Forbidden`**.

**Sit with that for a moment.** `403` means the credential was **accepted** and then denied by authorisation. The API server authenticated it. A `401` would have meant no valid credential at all.

**So it is a real identity**, and only today's RBAC configuration stands between it and your cluster. The common objection — "but `default` has no permissions" — is a statement about configuration, not a control. Grant `default` something next quarter for convenience, and this becomes an incident retroactively.

---

## Step 3 — Give every service its own identity

```bash
kubectl apply -f manifests/
grep -A2 'automountServiceAccountToken' manifests/*serviceaccounts*.yaml | head
```

Every ServiceAccount sets `automountServiceAccountToken: false` **except `node-agent`**, which genuinely lists Nodes. One exception, with the reason written next to it.

```bash
kubectl set serviceaccount deployment/payment-service payment-service -n axispay-core
kubectl set serviceaccount deployment/edge-gateway edge-gateway -n axispay-edge
kubectl set serviceaccount deployment/auth-service auth-service -n axispay-edge
for d in merchant-service fraud-service routing-service ledger-service customer-service; do
  kubectl set serviceaccount deployment/$d axispay-core-workload -n axispay-core
done
for d in settlement-service notification-service audit-service reporting-service; do
  kubectl set serviceaccount deployment/$d axispay-async-workload -n axispay-async
done
kubectl rollout status deployment/payment-service -n axispay-core --timeout=120s
```

---

## Step 4 — Confirm the token is gone

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $POD -- ls /var/run/secrets/kubernetes.io/serviceaccount/ 2>&1 | head -1
```

```
ls: /var/run/secrets/kubernetes.io/serviceaccount/: No such file or directory
```

**Nothing to steal.**

**And payments still work** — because nothing in AxisPay ever called the Kubernetes API. The token was pure liability: it granted nothing the application used, and everything an attacker would want.

```bash
curl -sk -o /dev/null -w '%{http_code}\n' -X POST https://api.axispay.local/api/v1/payments \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H 'Idempotency-Key: l51-check' \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-L51","amount_minor":45000,"currency":"ZAR","card_token":"tok_visa_4242"}'
```

---

## Step 5 — Turn on Pod Security Admission

```bash
kubectl apply -f manifests/
kubectl get ns -L pod-security.kubernetes.io/enforce
```

| Namespace | enforce | Why |
|---|---|---|
| `axispay-edge`, `-core`, `-async` | `restricted` | Application code. Needs no exception. |
| `axispay-data` | `baseline` | Database images need `fsGroup` semantics restricted rejects |
| `axispay-ops` | `baseline` | `node-agent` reads host `/proc` |
| `axispay-observability` | `privileged` | The log collector needs hostPath — and **baseline forbids hostPath**, so `baseline` here would silently stop logging |

That last row is worth reading twice. `baseline` sounds like the mild option; for a log collector it is fatal.

---

## Step 6 — Watch a bad pod be refused

```bash
kubectl run pci-violation -n axispay-core \
  --image=busybox:1.37 --restart=Never \
  --overrides='{"spec":{"containers":[{"name":"x","image":"busybox:1.37","securityContext":{"privileged":true,"runAsUser":0}}]}}' \
  -- sleep 3600
```

```
Error from server (Forbidden): pods "pci-violation" is forbidden:
violates PodSecurity "restricted:latest": privileged (container "x" must not set
securityContext.privileged=true), allowPrivilegeEscalation != false,
unrestricted capabilities, runAsNonRoot != true, seccompProfile
```

**Five violations, reported at once, and the pod was never created.**

**This is admission control, not scanning.** No object, no CrashLoopBackOff, no cleanup, no window in which it ran. Compare with a policy engine that reports violations after the fact.

---

## Step 7 — `warn` versus `enforce`

`axispay-data` enforces `baseline` but warns at `restricted`:

```bash
kubectl run legacy-tool -n axispay-data --image=busybox:1.37 --restart=Never \
  --overrides='{"spec":{"containers":[{"name":"x","image":"busybox:1.37","securityContext":{"runAsUser":0}}]}}' -- sleep 30
```

```
Warning: would violate PodSecurity "restricted:latest": runAsNonRoot != true ...
pod/legacy-tool created
```

**Created, with a warning printed to you.**

**That is the migration path in one command.** Set `enforce` to what you can meet today and `warn`+`audit` to where you intend to be. The warnings size the work. Skipping this step is how teams break production while trying to become compliant — and because **PSA evaluates on create and update, never continuously**, existing pods keep running and the failure arrives weeks later at the next rollout.

```bash
kubectl delete pod legacy-tool -n axispay-data --ignore-not-found
```

---

## Did it work?

```bash
make validate-lab LAB=L5.1
```

---

## Clean up

Nothing — this is the Day 5 end state.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| Token still mounted | Old pods | `kubectl rollout status` — new pods only |
| Existing pods rejected after Step 5 | PSA evaluates on create/update | They keep running; the next rollout fails. Fix the pod spec, not the namespace |
| `axispay-data` pods will not start | `restricted` applied there | Postgres needs `baseline` |
| Log collector Pending or rejected | observability set to `baseline` | Baseline forbids hostPath. It must be `privileged` |
| `error: unable to find api field` | Older kubectl | Use `kubectl patch` on `spec.template.spec.serviceAccountName` |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/05-security-packaging-and-operations/solutions.md).

**1.** `node-agent` keeps its token. Prove it needs it, and prove it can do nothing else with it.

**2.** The `restricted` standard has five requirements. Predict which ones Monday's `payment-service` already met, and which were added later. Then check.

---

## What you built

- **Every workload with its own identity**, carrying no credential it does not use
- **A stolen token used against the API**, and the meaning of `403`
- **Pod Security Admission enforcing at the door** — five violations, no object created
- **`warn` as a migration tool**, and the reason a big-bang tightening fails weeks later
- **Three documented exceptions**, each with its reason attached

**Next:** [L5.2 — RBAC](../L5.2-rbac/) — turning identity into authorisation you can prove.
