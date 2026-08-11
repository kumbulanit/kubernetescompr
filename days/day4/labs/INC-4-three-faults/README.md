# INC-4 · Three Faults, One Of Them Silent

| | |
|---|---|
| **Time** | 55 minutes |
| **Difficulty** | Hardest so far. One fault produces no errors anywhere. |
| **You need first** | Day 4 labs finished |
| **You will do** | Find three, prioritise, fix, prove, write up |
| **Check you are done** | `make validate-day4` passes again |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command. <kbd>Tab</kbd> completes filenames.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../../../GETTING-STARTED.md).
</details>

---

## Read this before you start

**Three faults.** Two are loud. **One produces no error in any log** — the only evidence is a business number that has moved.

That is the hardest failure mode there is, and it is the one this incident exists to teach. If you only find two, you will believe you are finished, and you will be wrong.

**There is also a temptation.** One of the fixes is fast, obvious, and destroys something you built on Thursday. Notice when you are about to take it.

Write up a one-page incident record.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This incident. |
| `manifests/` | Known-good files you will need |

---

## Step 0 — Inject

```bash
bash scripts/incidents/inject-INC-4.sh
```

Wait **three minutes**. The silent one takes time to become visible in the numbers.

---

## The ticket

```
────────────────────────────────────────────────────────────────────────
  AXISPAY OPERATIONS — INCIDENT TICKET
  Ref     OPS-2026-08-13-0644
  Raised  16:29 SAST          Severity  SEV-1
  Source  Merchant Support
────────────────────────────────────────────────────────────────────────

  Merchants cannot reach the API at all since 16:25 — connection
  errors and "page not found" from our integration endpoint.

  Separately, our own monitoring shows the approval rate has fallen
  to about 61% (normal is 94%). Nobody can explain that one; the
  payments that DO go through look fine.

  Two merchants are threatening to fail over to their backup
  provider.
────────────────────────────────────────────────────────────────────────
```

**"The payments that do go through look fine."** Sit with that sentence. Something is changing outcomes without producing errors.

---

## The method

| # | Question | Command |
|---|---|---|
| 1 | Is it **Ready**? | `kubectl get pods -A -l app.kubernetes.io/part-of=axispay` |
| 2 | What do the **events** say? | `kubectl get events -A --sort-by=.lastTimestamp \| tail -30` |
| 3 | What do the **logs** say? | `kubectl logs -n <ns> deploy/<name> --tail=30` |
| 4 | Is the **config** what you think? | `kubectl describe ingress -A` |
| 5 | Can it **reach** dependencies? | `kubectl get endpointslices -A` |
| 6 | What **changed**? | `kubectl get netpol,ingress,cm -A` |

**For the silent fault, steps 1 to 3 will tell you nothing.** You will need step 5, or the business metric.

---

## Your worksheet

```
Time started: ________

--- SURVEY (before fixing anything) ---
  Not Ready:            ____________________________________
  Reachable from outside?  ________________________________
  Approval rate now:    ______%  (normal 94%)

--- FAULT A (loud) ---
  Symptom / cause / impact: ________________________________

--- FAULT B (loud) ---
  Symptom / cause / impact: ________________________________

--- FAULT C (SILENT) ---
  How did I even detect it? ________________________________
  Cause: ___________________________________________________

--- ORDER, AND WHY ---
  ________________________________________________________

--- THE TEMPTATION ---
  Which fix was fast and wrong? ____________________________
  What did I do instead? ___________________________________
```

---

## If you are stuck after fifteen minutes

<details>
<summary><b>Nudge 1 — the two loud ones</b></summary>

```bash
curl -sk -o /dev/null -w '%{http_code}\n' https://api.axispay.local/api/v1/_info
kubectl describe ingress -n axispay-edge | grep -A5 'Rules'
```

And separately, something is wrong more broadly:

```bash
kubectl logs -n axispay-core deploy/payment-service --tail=20
kubectl get pods -n kube-system -l k8s-app=kube-dns
```

You have seen that second error message before — in L4.2 Step 5.
</details>

<details>
<summary><b>Nudge 2 — the silent one</b></summary>

Approval rate down, no errors. So payments are being **decided** differently, not failing.

Which service decides whether a payment is approved? Is it healthy?

```bash
kubectl get pods -n axispay-core -l app.kubernetes.io/name=fraud-service
kubectl logs -n axispay-core deploy/fraud-service --tail=20
```

Nothing wrong. So look at whether anyone can **reach** it:

```bash
kubectl get endpointslices -n axispay-core -l kubernetes.io/service-name=fraud-service
kubectl get netpol -n axispay-core
```
</details>

<details>
<summary><b>Nudge 3 — you found a new NetworkPolicy</b></summary>

```bash
kubectl get netpol -n axispay-core -o yaml | grep -B3 -A12 'change-cause'
```

Read its `podSelector` and its `from` block carefully. Ask: **which callers does this permit, and which does it silently exclude?**

Then ask why that produces *declines* rather than *errors*. The answer is in how `payment-service` handles a fraud check it cannot complete.
</details>

---

## What you should have found

<details>
<summary><b>Open only after you have all three written down</b></summary>

### Fault A — Ingress path narrowed

```bash
kubectl describe ingress axispay-api -n axispay-edge | grep -A6 Rules
```

```
Host                 Path              Backends
api.axispay.local    /api/v1/health    edge-gateway:http
```

Path changed to `/api/v1/health` **and** `pathType` changed to `Exact`. Every real API path now 404s.

**Fix:** `kubectl apply -f manifests/` — restores the Ingress.

### Fault B — CoreDNS broken

```bash
kubectl logs -n axispay-core deploy/payment-service --tail=10
```

```
Temporary failure in name resolution
```

```bash
kubectl get cm coredns -n kube-system -o jsonpath='{.data.Corefile}' | head -5
```

A typo — `kubernets` instead of `kubernetes` — so CoreDNS cannot answer for cluster names.

**Fix:** restore the Corefile and restart CoreDNS. `scripts/incidents/resolve-INC-4.sh` does it, or fix the ConfigMap by hand and `kubectl rollout restart deployment/coredns -n kube-system`.

### Fault C — the silent one

```bash
kubectl get netpol -n axispay-core
```

A new policy, `tighten-fraud-ingress`:

```yaml
spec:
  podSelector:
    matchLabels: { app.kubernetes.io/name: fraud-service }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector:
            matchLabels: { app.kubernetes.io/name: reporting-service }
```

**It permits `reporting-service` to reach `fraud-service` — and nothing else.** `payment-service` is now blocked.

**Why there are no errors.** `payment-service` is written to **fail open** on a fraud check it cannot complete: it applies a conservative default rather than erroring. So every payment gets a cautious risk decision, more get declined, and the platform reports itself perfectly healthy.

```bash
kubectl get endpointslices -n axispay-core -l kubernetes.io/service-name=fraud-service
kubectl run probe --rm -it --restart=Never --image=busybox:1.37 -n axispay-core \
  --overrides='{"metadata":{"labels":{"app.kubernetes.io/name":"payment-service"}}}' \
  -- timeout 5 nc -zv fraud-service 8080
```

Endpoints exist; the connection times out. **Ready pods, blocked traffic** — a combination nothing in `kubectl get pods` will ever show you.

### ⚠ The temptation

The fastest fix for C is:

```bash
kubectl delete netpol --all -n axispay-core        # DO NOT
```

It works instantly and **removes the entire zero-trust segmentation you built in L4.4** — the control that closed a PCI finding.

**The correct fix removes only the offending policy:**

```bash
kubectl delete netpol tighten-fraud-ingress -n axispay-core
python3 scripts/validate/simulate-netpol.py        # 46 assertions still hold
```

### Order

**B first** — DNS breaks everything, including your ability to diagnose the rest. **A second** — it is the total outage merchants can see. **C third** — real revenue loss, but the platform is serving.

Reasonable people might put A first, on the grounds that it is what the ticket is about. Be able to defend whichever you chose.
</details>

---

## Proving it

```bash
kubectl get pods -A -l app.kubernetes.io/part-of=axispay | grep -v '1/1' | grep -v NAME || echo "all Ready"

curl -sk -o /dev/null -w 'API %{http_code}\n' https://api.axispay.local/api/v1/_info

for i in $(seq 1 20); do
  curl -sk -o /dev/null -X POST https://api.axispay.local/api/v1/payments \
    -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H "Idempotency-Key: inc4-$i" \
    -H 'Content-Type: application/json' \
    -d '{"merchant_reference":"AXP-INC4","amount_minor":20000,"currency":"ZAR","card_token":"tok_visa_4242"}'
done

kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -t -c "
SELECT ROUND(100.0*SUM(CASE WHEN status IN ('captured','authorized') THEN 1 ELSE 0 END)/COUNT(*),1) AS approval_pct
  FROM payments WHERE merchant_reference = 'AXP-INC4';"

python3 scripts/validate/simulate-netpol.py
make validate-day4
```

**The approval-rate query is the one that proves fault C.** A green pod list does not.

**And `simulate-netpol.py` reporting 46 assertions proves you did not fix C by deleting your segmentation.**

---

## Debrief

**1. How did you detect the silent fault?** Only from the business metric, or from a connectivity test. No log, no event, no probe failure.

**2. Why did blocking fraud-service produce declines rather than errors?** The service fails open with a conservative default — a deliberate design choice that keeps payments flowing during a fraud outage, and the same choice that makes the failure invisible.

**3. Which fix were you tempted by, and what would it have cost?** `kubectl delete netpol --all` removes the control that closed a PCI finding. Two seconds to type, and a finding at the next assessment.

**4. What would have caught fault C before a merchant did?**
- an alert on approval rate falling below a threshold — a **business** metric, not an infrastructure one
- a policy test in CI that runs `simulate-netpol.py` on every change to `manifests/**/netpol/**` and rejects the change

That second one would have stopped the incident from being possible. You build the first on Friday.

---

## How this is scored

| Band | What it looks like |
|---|---|
| **4 — Exemplary** | All three found, silent one detected from a business metric, ordering defended, segmentation preserved, both preventive actions named |
| **3 — Proficient** | All three found and fixed correctly, verified |
| **2 — Developing** | Found two; or fixed C by deleting all policies |
| **1 — Beginning** | Needed significant guidance |

**Deleting all NetworkPolicies caps this at Developing**, regardless of how quickly you finished. That rule is stated before the incident, not after.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| Everything fails including `kubectl` | DNS still broken | Fix CoreDNS first — it blocks diagnosis |
| API still 404 after fixing the Ingress | Controller has not reloaded | Wait 10s; `kubectl describe ingress` |
| Approval rate still low | Fault C not fixed, or old payments in the average | Filter to the reference you just used |
| `simulate-netpol.py` fails | You deleted more than the one policy | `kubectl apply -f ../L4.4-networkpolicy/manifests/` |
| Cannot reproduce | Injection did not run | Re-run, wait 3 minutes |

Reset: `bash scripts/incidents/resolve-INC-4.sh`

---

## What you learned

- **A failure with no error anywhere**, detected only from a business number
- **"Fails open" as a design choice** — it keeps payments flowing and hides the fault
- **Ready pods with blocked traffic**, a combination `kubectl get pods` cannot show
- **The fast fix that destroys a control**, recognised before taking it
- **Proving a fix with a business query and a policy assertion**, not a pod status
- **A preventive action that makes the incident impossible**, not merely detectable

**Next:** Day 4 is done. Tomorrow the platform becomes operable — identity, packaging, and the ability to see what it is doing.

```bash
make validate-day4
```
