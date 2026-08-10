# INC-2 · The Service That Keeps Dying

| | |
|---|---|
| **Time** | 60 minutes |
| **Difficulty** | Harder than INC-1. Two things look wrong; only one is. |
| **You need first** | Day 2 labs finished |
| **You will do** | Find it, fix it, prove it — and write it up |
| **Check you are done** | `make validate-day2` passes again |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command. <kbd>Tab</kbd> completes filenames.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../../GETTING-STARTED.md).
</details>

---

## Read this before you start

Something is broken. **You will not be told what.**

This one is harder than yesterday's. There is a symptom that looks like the problem and is not, and if you fix that one you will make things worse. Slow down.

**You are scored on method, not speed.** Following the six steps and not finishing beats guessing correctly.

**From this incident onward you also write it up.** A one-page blameless record — the template is at the end. It is graded on method, not on how quickly you finished.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This incident. |
| `manifests/01-deployment-payment-service-v1.1.0.yaml` | The known-good file. You will need it eventually. |

---

## Step 0 — Inject the fault

Instructor-led? Already done. Working alone:

```bash
bash scripts/incidents/inject-INC-2.sh
```

**Wait three minutes** before you start — the symptom needs time to develop, and watching it develop is part of the exercise.

---

## The ticket

```
────────────────────────────────────────────────────────────────────────
  AXISPAY OPERATIONS — INCIDENT TICKET
  Ref     OPS-2026-08-11-0388
  Raised  16:31 SAST          Severity  SEV-1
  Source  Merchant Support (3 merchants)
────────────────────────────────────────────────────────────────────────

  Intermittent payment failures since about 16:24. Merchants report
  roughly one in three attempts failing, then succeeding on retry.

  MER_7QK2XD9P4A says their checkout "works if you try twice".

  The platform dashboard shows the service as UP.

  Ops needs an update in 15 minutes.
────────────────────────────────────────────────────────────────────────
```

**Note the two clues in there.** "One in three" and "works if you try twice" both point at *some* pods being healthy and others not — which is a different shape of problem from "everything is down".

---

## The method

| # | Question | Command |
|---|---|---|
| **1** | Is it **Ready**? | `kubectl get pods -A -l app.kubernetes.io/part-of=axispay` |
| **2** | What do the **events** say? | `kubectl describe pod <name> -n <ns>` |
| **3** | What do the **logs** say? | `kubectl logs <name> -n <ns> --previous` |
| **4** | Is the **config** what you think? | `kubectl get deploy <name> -n <ns> -o yaml` |
| **5** | Can it **reach** its dependencies? | `kubectl get endpointslices -n <ns>` |
| **6** | What **changed**? | `kubectl rollout history deployment/<name> -n <ns>` |

**For this incident, step 2 has a specific place to look that most people miss.** It is not in the events list.

---

## Your worksheet

```
Time started: ________

STEP 1 — What is not Ready?
  Workload: ______________  STATUS: ______________
  RESTARTS column: ______   (is it climbing? check twice, 30s apart)

STEP 2 — describe
  Events say: ______________________________________________
  LAST STATE says:  Reason ____________  Exit Code ________
       ^^^ this is the one people miss

STEP 3 — logs
  Plain `kubectl logs` shows: ______________________________
  `kubectl logs --previous` shows: _________________________
  Why are they different? __________________________________

STEP 4 — config
  The field that changed: __________________________________
  Was: ____________   Is now: ____________

STEP 6 — what changed
  __________________________________________________________

THE RED HERRING — what looked wrong but was not?
  __________________________________________________________

ROOT CAUSE (a cause, not a symptom):
  __________________________________________________________

MY FIX, and why this one:
  __________________________________________________________

HOW I PROVED IT:
  __________________________________________________________
```

---

## If you are stuck after fifteen minutes

<details>
<summary><b>Nudge 1 — narrowing it down</b></summary>

"One in three failing" means some pods are fine. Compare the pods with each other rather than looking at any one in isolation.

`kubectl get pods -n axispay-core` — look hard at the **RESTARTS** column. Run it again thirty seconds later. Is any number changing?
</details>

<details>
<summary><b>Nudge 2 — a restarting pod</b></summary>

A pod that restarts is a pod whose container **exited**. Something ended it.

`kubectl describe pod <name> -n axispay-core` — but do not stop at the events this time. Look for the **`Last State`** block inside the container section. That describes the container that *died*, and it names the reason.
</details>

<details>
<summary><b>Nudge 3 — you found `Last State`</b></summary>

Two fields there: `Reason` and `Exit Code`.

You saw that exact pair in L2.1 Step 6 when you filled a container's memory on purpose.

Now: what in the pod spec controls that? Compare it with the file in this folder.
</details>

<details>
<summary><b>Nudge 4 — the red herring</b></summary>

You may also have noticed the HPA sitting at maximum replicas, or a `FailedCreate` on the quota.

**That is a consequence, not a cause.** Work out the direction of causation before you touch it — and specifically, ask what raising the quota would achieve.
</details>

---

## What you should have found

<details>
<summary><b>The full walkthrough — open only after you have a root cause written down</b></summary>

### Step 1 — Ready?

```bash
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service
```

```
NAME                              READY   STATUS             RESTARTS      AGE
payment-service-8c7d4f9b2-2xk4p   0/1     CrashLoopBackOff   5 (30s ago)   6m
payment-service-8c7d4f9b2-h9mzt   1/1     Running            3 (2m ago)    6m
payment-service-8c7d4f9b2-qw3nf   0/1     CrashLoopBackOff   5 (18s ago)   6m
```

**Restart counts are climbing, and they differ between pods.** That is your "one in three" — the pods that happen to be up at that moment serve, the others do not.

### Step 2 — describe, and the part people miss

```bash
kubectl describe pod payment-service-8c7d4f9b2-2xk4p -n axispay-core
```

The events are unhelpful — just `BackOff` repeating. **The answer is higher up, in the container block:**

```
    State:          Waiting
      Reason:       CrashLoopBackOff
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
      Started:      Tue, 11 Aug 2026 16:29:41 +0200
      Finished:     Tue, 11 Aug 2026 16:29:58 +0200
```

**`OOMKilled`. Exit code `137`.** You produced exactly this deliberately in L2.1 Step 6.

Note it lived **17 seconds**. Long enough to start, serve a few requests, and be killed.

### Step 3 — why the logs seem empty

```bash
kubectl logs payment-service-8c7d4f9b2-2xk4p -n axispay-core
```

Almost nothing — this is the *new* container, which has just started.

```bash
kubectl logs payment-service-8c7d4f9b2-2xk4p -n axispay-core --previous
```

```json
{"level":"info","msg":"starting","version":"1.1.0"}
{"level":"info","msg":"ready to serve","port":8080}
{"level":"info","msg":"payment created","payment_id":"pay_01J8..."}
```

**Normal, then nothing.** No error, no stack trace, no shutdown message. The process was killed by the kernel without being told.

**That absence is the signature of an OOM kill.** An application that crashes writes something; one that is killed does not get the chance.

### Step 4 — the config

```bash
kubectl get deploy payment-service -n axispay-core \
  -o jsonpath='{.spec.template.spec.containers[0].resources}' | jq .
```

```json
{
  "limits":   { "cpu": "500m", "memory": "48Mi" },
  "requests": { "cpu": "100m", "memory": "96Mi" }
}
```

**48Mi.** And in this folder's known-good file it is `256Mi`.

Two things are wrong, and the second is worth noticing: the **limit (48Mi) is lower than the request (96Mi)**, which is nonsense — you cannot reserve more than you are allowed to use.

### Step 6 — what changed

```bash
kubectl rollout history deployment/payment-service -n axispay-core
kubectl rollout history deployment/payment-service -n axispay-core --revision=3
```

```
REVISION  CHANGE-CAUSE
2         upgrade to v1.1.0
3         reduce memory footprint for cost optimisation
```

A plausible-sounding change, applied without measuring what the service actually uses. In L2.1 you measured it at about 61Mi at rest.

### The red herring

You may also have seen:

```bash
kubectl get hpa -n axispay-core
```

```
NAME              TARGETS     MINPODS   MAXPODS   REPLICAS
payment-service   180%/70%    3         8         8
```

Pinned at 8 replicas, possibly with quota rejections in the events.

**This is a consequence, not a cause.** With a third of the pods dead at any moment, the survivors carry all the traffic, their CPU goes up, and the HPA does the only thing it can. Raising the quota or the HPA maximum would give you *more* pods that die every seventeen seconds — more churn, more load on dependencies, no improvement.

**Fix the memory limit and the HPA settles on its own.** Chasing the symptom first is the trap here.

### Root cause

> The `payment-service` memory limit was reduced to 48Mi, below the service's actual working set of about 60Mi, so the kernel OOM-kills each container roughly seventeen seconds after it starts.
</details>

---

## The fix

<details>
<summary><b>Open once you have written down a root cause</b></summary>

```bash
kubectl apply -f manifests/01-deployment-payment-service-v1.1.0.yaml
kubectl rollout status deployment/payment-service -n axispay-core --timeout=180s
```

Or `kubectl rollout undo`, which takes you back to revision 2.

**Prefer applying the file.** With three revisions in play, "one back" is ambiguous; the file is not.

### What NOT to do

- **Do not just raise the limit until it stops dying.** That is a fix by trial. Set it from the measurement you took in L2.1, with a margin — and be able to say where the number came from.
- **Do not raise the quota or the HPA maximum.** Both are downstream of the real problem.
- **Do not `kubectl edit`.** The cluster then matches no file, and the next `apply` silently undoes your fix.
</details>

---

## Proving it

**1. No more restarts.** Check twice, thirty seconds apart:

```bash
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service
sleep 30
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service
```

All `1/1`, and the RESTARTS number **not moving**. A pod that is currently up is not the same as a pod that has stopped dying.

**2. The limit is a number you can defend:**

```bash
kubectl get deploy payment-service -n axispay-core \
  -o jsonpath='{.spec.template.spec.containers[0].resources.limits.memory}'; echo
kubectl top pods -n axispay-core -l app.kubernetes.io/name=payment-service
```

Actual usage should be comfortably under the limit.

**3. The HPA has come back down** — proving your causation was right:

```bash
kubectl get hpa payment-service -n axispay-core
```

**4. Payments succeed:**

```bash
kubectl port-forward -n axispay-edge svc/edge-gateway 8080:8080 &
sleep 3
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w '%{http_code} ' -X POST http://localhost:8080/api/v1/payments \
    -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H "Idempotency-Key: inc2-verify-$i" \
    -H 'Content-Type: application/json' \
    -d '{"merchant_reference":"AXP-INC2","amount_minor":30000,"currency":"ZAR","card_token":"tok_visa_4242"}'
done; echo; kill %1
```

Five `201`s. The merchant said one in three failed — five in a row is the evidence that it does not any more.

**5.** `make validate-day2`

---

## Write it up

One page. Not marked on writing quality; marked on method.

```markdown
# Incident record — OPS-2026-08-11-0388

## Summary
One sentence a non-engineer would understand.

## Timeline
16:24  first merchant failure (from the ticket)
16:31  ticket raised
16:__  I started
16:__  identified OOMKilled in Last State
16:__  fix applied
16:__  verified

## Impact
How many payments, over how long, and roughly what value.
  sum of failures ≈ requests × failure rate × duration

## Root cause
A CAUSE, not a symptom. One sentence.

## What made it harder to find
Be honest. The HPA at max looked like a capacity problem.

## Two preventive actions
1. An alert that would have caught this. Name it precisely.
2. A control that would have stopped the change being applied.

## What went well
Say something true. Blameless means blameless.
```

**On impact:** at roughly 5 requests/second over 20 minutes with a third failing, that is around 2,000 failed payments. Practise expressing impact in payments and rands, not pods — that is the language of the people who will read it.

---

## Debrief

**1. What was your first command?**
`kubectl get pods` should show you climbing restart counts within seconds.

**2. Why did `kubectl logs` look normal?**
It was the new container. `--previous` shows the one that died. And its logs stop mid-sentence with no error — which is itself the signature.

**3. What made this harder than INC-1?**
The HPA at maximum looks like a capacity problem and invites you to fix the wrong thing.

**4. Why would raising the quota have made it worse?**
More pods, all dying every seventeen seconds. More churn, more dependency load, no improvement.

**5. What would have caught this before a merchant did?**
- an alert on `OOMKilled` in the last-terminated reason — cheapest and most direct
- an alert on restart count increasing over 15 minutes
- a policy rejecting any Deployment where `limits.memory < requests.memory`, which was true here and is always a mistake

**None of those exist in your platform yet.** You build the first two on Friday.

---

## How this is scored

| Band | What it looks like |
|---|---|
| **4 — Exemplary** | Correct root cause, red herring identified and explained, fix verified four ways, incident record names a specific alert |
| **3 — Proficient** | Systematic triage, correct root cause, verified fix, record written |
| **2 — Developing** | Reached the fix by guessing, or fixed the HPA/quota first |
| **1 — Beginning** | Needed significant guidance |

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| Pods still restarting after the fix | Rollout not finished | `kubectl rollout status ...` |
| `CrashLoopBackOff` with a different reason | Something else too | `describe` again — read `Last State` |
| HPA still at max | It scales down slowly, on purpose | Five-minute stabilisation window. Wait |
| `FailedCreate` quota errors | HPA still asking for pods | Resolves once the HPA comes down |
| Cannot reproduce | Injection did not run | `bash scripts/incidents/inject-INC-2.sh`, wait 3 min |

Reset: `bash scripts/incidents/resolve-INC-2.sh`

---

## What you learned

- **`Last State` in `kubectl describe`** — where the reason a container died is recorded, and it is not in the events
- **`OOMKilled` and exit 137** recognised in the wild, having produced it deliberately in L2.1
- **Why `--previous` matters**, and why logs stopping mid-sentence is itself a clue
- **A red herring identified** — and why fixing it first would have made things worse
- **Impact expressed in payments**, which is what the incident record needs
- **The alert that does not exist yet**, which is Friday's work

**Next:** Day 2 is finished. Tomorrow the platform gets a memory — configuration, secrets, databases and storage.

```bash
make validate-day2
```
