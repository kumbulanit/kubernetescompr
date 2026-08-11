# INC-3 · Two Faults At Once

| | |
|---|---|
| **Time** | 60 minutes |
| **Difficulty** | Two independent faults. Prioritising is part of the exercise. |
| **You need first** | Day 3 labs finished |
| **You will do** | Find both, fix both, write it up |
| **Check you are done** | `make validate-day3` passes again |

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

**There is more than one thing wrong.** That is the new difficulty: real incidents rarely arrive one at a time, and deciding *which to fix first* is itself a skill.

Fix them in the order that restores the most customer value soonest. Be ready to defend your ordering.

**Write up a one-page incident record** — same as INC-2. It is graded on method.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This incident. |
| `manifests/` | The known-good Day 3 files. You will need some of them. |

---

## Step 0 — Inject

```bash
bash scripts/incidents/inject-INC-3.sh
```

Wait three minutes.

---

## The ticket

```
────────────────────────────────────────────────────────────────────────
  AXISPAY OPERATIONS — INCIDENT TICKET
  Ref     OPS-2026-08-12-0512
  Raised  16:22 SAST          Severity  SEV-1
  Source  Merchant Support + Finance Ops
────────────────────────────────────────────────────────────────────────

  Two separate reports in ten minutes:

  1. Merchants: payments failing since ~16:15. Not intermittent —
     nothing is going through at all.

  2. Finance Ops: the ledger service dashboard has been showing
     "no data" since this morning. They assumed it was a reporting
     glitch and did not raise it.

  Nothing has been deployed today.
────────────────────────────────────────────────────────────────────────
```

**Read report 2 again.** "Since this morning", and nobody raised it. That is a real pattern — the quiet failure that has been running for hours before anyone notices, and it is often the older of the two problems.

---

## The method

| # | Question | Command |
|---|---|---|
| 1 | Is it **Ready**? | `kubectl get pods -A -l app.kubernetes.io/part-of=axispay` |
| 2 | What do the **events** say? | `kubectl describe pod <name> -n <ns>` |
| 3 | What do the **logs** say? | `kubectl logs <name> -n <ns> --previous` |
| 4 | Is the **config** what you think? | `kubectl exec <pod> -- printenv \| sort` |
| 5 | Can it **reach** dependencies? | `kubectl get endpointslices -n <ns>` |
| 6 | What **changed**? | `kubectl get events -A --sort-by=.lastTimestamp \| tail -30` |

**Step 4 is the productive one for one of these two faults.** Step 1 finds the other immediately.

---

## Your worksheet

```
Time started: ________

--- SURVEY: what is broken? (do this BEFORE fixing anything) ---
  Not-Ready workloads: ______________________________________
  Pending pods:        ______________________________________
  Anything Ready but wrong: _________________________________

--- FAULT A ---
  Symptom: __________________________________________________
  Root cause: _______________________________________________
  Customer impact: __________________________________________

--- FAULT B ---
  Symptom: __________________________________________________
  Root cause: _______________________________________________
  Customer impact: __________________________________________

--- ORDER, AND WHY ---
  I fixed ______ first because ______________________________

--- PROOF ---
  A: ________________________________________________________
  B: ________________________________________________________
```

---

## If you are stuck after fifteen minutes

<details>
<summary><b>Nudge 1 — survey first</b></summary>

Before fixing anything, list everything that is wrong:

```bash
kubectl get pods -A -l app.kubernetes.io/part-of=axispay
kubectl get pods -n axispay-data
kubectl get pvc -A
```

Two different symptoms should be visible. One is a pod that will not start; the other is a pod that starts and is not `1/1`.
</details>

<details>
<summary><b>Nudge 2 — the one that will not start</b></summary>

A `Pending` pod is a **scheduling** problem, not an application one.

`kubectl describe pod <name> -n <ns>` and read the events. Then look at what it is waiting for:

```bash
kubectl get pvc -n axispay-data
kubectl describe pvc <name> -n axispay-data
```

`Pending` on a PVC means nothing satisfies the claim. Compare what it asks for with what exists:

```bash
kubectl get storageclass
```
</details>

<details>
<summary><b>Nudge 3 — the one that starts but is not ready</b></summary>

Not-ready with no crash means a readiness check is failing. Ask the pod itself:

```bash
kubectl exec -n axispay-core deploy/ledger-service -- \
  python3 -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8080/readyz').read().decode())"
```

Then check the configuration it is actually running with, not the file you think it has:

```bash
kubectl exec -n axispay-core deploy/ledger-service -- printenv | sort
kubectl get cm -n axispay-core
```

Compare the key names in the ConfigMap with the variable names the pod expects.
</details>

---

## What you should have found

<details>
<summary><b>Open only after you have both root causes written down</b></summary>

### Fault A — PostgreSQL will not schedule

```bash
kubectl get pods -n axispay-data
```

```
NAME         READY   STATUS    RESTARTS   AGE
postgres-0   0/1     Pending   0          8m
```

```bash
kubectl describe pod postgres-0 -n axispay-data | tail -6
```

```
Warning  FailedScheduling  ...  0/3 nodes are available: pod has unbound immediate PersistentVolumeClaims
```

```bash
kubectl get pvc -n axispay-data
kubectl describe pvc data-postgres-0 -n axispay-data | tail -6
```

```
Warning  ProvisioningFailed  ...  storageclass.storage.k8s.io "axispay-ssd-fast" not found
```

**Root cause A:** the StatefulSet was changed to request a StorageClass that does not exist, so the claim can never be satisfied and the pod can never be scheduled.

```bash
kubectl get storageclass
```

`axispay-standard` exists; `axispay-ssd-fast` does not.

### Fault B — ledger-service is not ready

```bash
kubectl get pods -n axispay-core -l app.kubernetes.io/name=ledger-service
```

```
NAME                              READY   STATUS    RESTARTS   AGE
ledger-service-6f8d94c7b-x2ktp    0/1     Running   0          3h
```

**Three hours.** That is Finance Ops' "since this morning" — the older fault, and nobody raised it.

```bash
kubectl exec -n axispay-core deploy/ledger-service -- \
  python3 -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8080/readyz').read().decode())" 2>/dev/null
```

```json
{"ready": false, "checks": {"database": "DB_HOST not configured"}}
```

```bash
kubectl exec -n axispay-core deploy/ledger-service -- printenv | grep -i 'DB_\|DATABASE'
kubectl get cm axispay-platform-config -n axispay-core -o jsonpath='{.data}' | jq 'keys'
```

The ConfigMap has `DB_HOSTNAME`; the application reads `DB_HOST`. **A key was renamed.**

**Root cause B:** a ConfigMap key was renamed from `DB_HOST` to `DB_HOSTNAME`, so the variable the application reads is absent and its readiness check fails.

**Why it did not crash:** the service is correctly written. A missing dependency makes it *unready*, not dead — which is exactly the behaviour you built in L2.3, working as designed. It also means nothing restarted, nothing alerted, and it sat there for three hours.

### Which to fix first?

**Fault A.** Reasoning:

- A blocks **all payments** — a total outage of the revenue path.
- B blocks the ledger — which is serious for reconciliation, and has already been broken for three hours without anyone dying.
- A is also *upstream*: with the database down, ledger-service would not work even with the right config.

Fix A, verify payments, then fix B.

**A student who fixes B first has not made an error of fact** — but should be able to say why they chose it, and "I saw it first" is not a reason.
</details>

---

## The fix

<details>
<summary><b>Open once you have both root causes</b></summary>

### A — the StorageClass

```bash
kubectl apply -f manifests/
kubectl get statefulset postgres -n axispay-data -o jsonpath='{.spec.volumeClaimTemplates[0].spec.storageClassName}'; echo
```

**`volumeClaimTemplates` is immutable**, so re-applying may be rejected. If so:

```bash
kubectl delete statefulset postgres -n axispay-data --cascade=orphan   # keeps the pods and PVCs
kubectl delete pvc data-postgres-0 -n axispay-data                     # only if it was never bound
kubectl apply -f manifests/
kubectl wait --for=condition=Ready pod/postgres-0 -n axispay-data --timeout=300s
```

> `--cascade=orphan` deletes the controller and leaves what it managed. **Check first whether the PVC ever bound** — if it did, deleting it deletes your data, and the correct move is to fix the template and leave the claim alone.

### B — the ConfigMap key

```bash
kubectl apply -f manifests/
kubectl get cm axispay-platform-config -n axispay-core -o jsonpath='{.data}' | jq 'keys'
kubectl rollout restart deployment/ledger-service -n axispay-core
kubectl rollout status deployment/ledger-service -n axispay-core
```

**Why the restart is required:** the value is consumed as an environment variable, and env vars are set once at container start. Fixing the ConfigMap alone changes nothing for a running pod — exactly what you proved in L3.1 Step 4.
</details>

---

## Proving it

```bash
kubectl get pods -A -l app.kubernetes.io/part-of=axispay | grep -v '1/1' | grep -v NAME || echo "everything Ready"
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -t -c 'SELECT COUNT(*) FROM payments;'

kubectl port-forward -n axispay-edge svc/edge-gateway 8080:8080 &
sleep 3
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8080/api/v1/payments \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H 'Idempotency-Key: inc3-verify' \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-INC3","amount_minor":40000,"currency":"ZAR","card_token":"tok_visa_4242"}'
kill %1

kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -t -c \
  'SELECT COALESCE(SUM(amount_minor),0) FROM ledger_entries;'
make validate-day3
```

**That last query — the ledger summing to zero — is the one that proves fault B is really fixed**, not merely that a pod went green.

---

## Debrief

**1. Which did you fix first, and why?** Customer impact, and upstream-first. Both matter; be able to say which drove you.

**2. Why was fault B invisible for three hours?** It never crashed and never alerted. Correct probe design meant it degraded quietly — which is right, and is exactly why you need *alerting* as well as probes.

**3. Why did fixing the ConfigMap alone not work?** Environment variables are a snapshot. L3.1, Step 4.

**4. What would have caught each of these before a merchant did?**
- A: an alert on any pod `Pending` for more than five minutes; or admission validation that the StorageClass exists.
- B: an alert on a Deployment with ready replicas below desired for more than ten minutes. **This is the one that matters** — it would have caught B at 09:00 instead of 16:22.

---

## How this is scored

| Band | What it looks like |
|---|---|
| **4 — Exemplary** | Both root causes, surveyed before fixing, ordering justified by customer impact, both verified, and the specific alert named for each |
| **3 — Proficient** | Both root causes, both fixed, both verified |
| **2 — Developing** | Found one and stopped, or fixed by trial |
| **1 — Beginning** | Needed significant guidance |

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `volumeClaimTemplates` rejected as immutable | Expected | `--cascade=orphan`, then re-apply. Check the PVC first |
| PVC still `Pending` after the fix | Old PVC still asks for the missing class | Delete it **only if it never bound** |
| ledger-service still not ready | Not restarted | Env vars need a new pod |
| Payments still fail | Database not ready yet | `kubectl get pods -n axispay-data` |
| Ledger sum is not 0 | Something wrote badly during the outage | Report it — this is exactly what the check is for |

Reset: `bash scripts/incidents/resolve-INC-3.sh`

---

## What you learned

- **Survey before fixing** — you cannot prioritise what you have not listed
- **Prioritising by customer impact and upstream-first**, and defending the order
- **A quiet failure that ran for three hours** — correct probe behaviour, missing alerting
- **Why fixing a ConfigMap does not fix a running pod**, seen in an incident rather than a lab
- **`--cascade=orphan`**, and the question to ask before using it
- **Proving a data fix with a data query**, not a pod status

**Next:** Day 3 is done. Tomorrow you let the world in — and then keep it out of the vault.

```bash
make validate-day3
```
