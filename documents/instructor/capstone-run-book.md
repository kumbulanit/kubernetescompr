# Capstone Run-Book — Instructor Only

**Do not distribute.** Contains the incident causes.

---

## Before the session

### The day before (or at the end of Day 4)

```bash
make observability                 # ~1.5 GB of images. NEVER during the window.
make validate-day5
```

Confirm on **every** machine:

- [ ] `helm list -A` shows `axispay` deployed at 1.1.0
- [ ] Grafana loads and both dashboards are present
- [ ] `kubectl -n axispay-observability logs deploy/alert-sink --tail=5` responds
- [ ] `python3 scripts/validate/simulate-netpol.py` reports 46 assertions
- [ ] the 2.0.0 images are built into the Minikube runtime

```bash
eval $(minikube -p axispay docker-env)
IMAGE_TAG=2.0.0 make build          # do this the night before, not at 09:00
minikube -p axispay image ls | grep ':2.0.0' | wc -l    # expect 16
```

> **The single most common way this session fails is images.** A student who cannot pull 2.0.0 spends the whole window on `ImagePullBackOff` and learns nothing the exercise was designed to teach.

### Set the frame — two minutes, before anyone touches a keyboard

Say this out loud:

> "You are being assessed on method, not speed. A student who works systematically and does not finish scores higher than one who guesses correctly. That is not encouragement — it is how the rubric is written."

Repeat that you will answer questions about **tools** and not about **causes**.

---

## Timing

Total 110 minutes. Keep to it; the pressure is part of the assessment.

| Clock | Phase | You |
|---|---|---|
| 00:00 | 1 · Pre-flight | Hand out the brief. Say nothing else. Watch who records a baseline. |
| 00:15 | 2 · Upgrade | Circulate. Note who runs `helm template` first. Note who watches Grafana during. |
| 00:40 | 3 · Incidents | **Inject INC-5.** Hand out the ticket 3 minutes later. |
| 00:52 | | **Inject INC-6.** Ticket after 2 minutes. |
| 01:04 | | **Inject INC-7.** Ticket immediately — it is SEV-1. |
| 01:20 | 4 · Recovery | Announce 20 minutes to full recovery and validation. |
| 01:40 | 5 · Presentation | 5 minutes each, timed. Then debrief. |

Injection commands — run these from your own machine against each student cluster, ideally without being seen:

```bash
bash scripts/incidents/inject-INC-5.sh     # redis scaled to 0
bash scripts/incidents/inject-INC-6.sh     # data-tier NetworkPolicy narrowed
bash scripts/incidents/inject-INC-7.sh     # TLS certificate expired
```

Escape hatches, if a student is genuinely stuck and losing the rest of the exercise:

```bash
bash scripts/incidents/resolve-INC-5.sh
bash scripts/incidents/resolve-INC-6.sh    # restores the CORRECT policy, does not delete it
bash scripts/incidents/resolve-INC-7.sh
```

> Use an escape hatch only after the student has spent at least ten minutes and you have given two tool-level hints. Resolving early removes the assessment.

---

## The three incidents

### INC-5 · Redis scaled to zero — injected 00:40

| | |
|---|---|
| **Fault** | `kubectl scale statefulset/redis --replicas=0 -n axispay-data` |
| **Presents as** | approval rate down ~30%, p99 latency climbing, checkout slow but not failing |
| **Root cause** | `fraud-service` loses its cache and falls back to the slow path |

**What makes it hard:** nothing crashes. Every pod stays Ready, because `fraud-service` registers Redis as a **non-critical** dependency in its readiness registry — deliberately, so a cache outage degrades rather than removes the service. `kubectl get pods` is entirely green while merchants are being declined.

**What to watch for:** how long before the student stops looking at pods and looks at a business metric. The exemplary path is: notice on the *Payments by outcome* or *p99* panel → observe every pod is Ready → reason that the failure is in a dependency, not a workload → find Redis at 0.

**Hints, in escalating order:**
1. "What is your evidence that the pods are the problem?"
2. "Which dashboard panel told you first?"
3. "What does fraud-service depend on that is not a pod it owns?"

**Fix:** `kubectl scale statefulset/redis --replicas=1 -n axispay-data`

**Debrief question:** *"Every pod was Ready. Was that a bug in the readiness probe?"* — No. It is correct behaviour, and it is the design decision from Day 2: a cache outage should degrade the service, not remove it from the load balancer. The gap was an **alert**, not a probe.

---

### INC-6 · Data-tier NetworkPolicy narrowed — injected 00:52

| | |
|---|---|
| **Fault** | `allow-core-and-async-to-data` replaced with a version that admits only `axispay-core` |
| **Presents as** | settlement produces no file; audit events back up in RabbitMQ; payments look fine |
| **Root cause** | `axispay-async` can no longer reach PostgreSQL |

**The change-cause annotation is deliberately plausible:** `"CR-2026-0819 restrict data tier ingress to the payment path"`. This is what a real over-tightening looks like in a change record, and `kubectl describe` will show it.

### ⚠ THE TRAP

**The fastest fix is `kubectl delete networkpolicy allow-core-and-async-to-data -n axispay-data`.** It restores service in two seconds and it is wrong: it removes the cardholder-data segmentation the student built on Thursday, to satisfy a control this brief calls contractual.

If a student does this:

- Let them. Do not warn them.
- Mark it on the rubric (§3, mandatory annotation).
- §5 Security posture scores **0**.
- In the debrief, ask exactly one question: **"You are in a PCI audit next week. Talk me through this change."**
- Write down their answer verbatim.

> This is the most valuable moment in the whole course. In a regulated environment the fastest fix and the correct fix are frequently different, and knowing the difference is the job. A warning beforehand would teach nothing; the question afterwards teaches it permanently.

A student who deletes the policy, catches themselves, and restores it properly should score **Proficient** — and be told explicitly why that recovery mattered.

**Correct fix:** `kubectl apply -f manifests/day4/netpol/05-data-tier.yaml`

**Hints:**
1. "What is the queue depth doing?"
2. "Which namespace is the failing writer in?"
3. "What changed in the data namespace? Try `kubectl get netpol -n axispay-data -o yaml | grep change-cause`."

---

### INC-7 · Expired TLS certificate — injected 01:04

| | |
|---|---|
| **Fault** | the `axispay-tls` Secret replaced with a certificate that expired yesterday |
| **Presents as** | merchant integrations fail the TLS handshake; every dashboard green |
| **Root cause** | certificate lifecycle — nobody was watching the expiry date |

**What makes it instructive:** the failure is entirely outside the cluster's own view of itself. Every pod is Ready, every in-cluster call works, every panel is green. The cluster is genuinely healthy and the product is genuinely down.

**Watch for `curl -k`.** A student who verifies the fix with `-k` has verified nothing — `-k` is precisely what disables the check that is failing. Mark this; it is the difference between Proficient and Exemplary.

**Correct diagnosis:**

```bash
openssl s_client -connect $(minikube ip -p axispay):443 -servername api.axispay.local 2>/dev/null \
  | openssl x509 -noout -dates -subject
```

**Fix:** regenerate and rotate the Secret (`scripts/setup/06-generate-tls.sh`), then restart the ingress controller so it reloads.

**Debrief question:** *"What alert would have told you a month ago?"* — a certificate-expiry alert. It does not exist in this platform. That is a legitimate answer to the "two preventive actions" requirement in Phase 5, and the best students find it on their own.

---

## Scoring while you watch

Score as you observe. Reconstructing at the end favours the students who finished over the students who reasoned well.

**The three moments that tell you the most:**

1. **Phase 1.** Did they record a baseline before changing anything? An engineer who upgrades first and looks second cannot distinguish a fault they caused from one that was already there.
2. **The first command of each incident.** More informative than the fix. `kubectl get pods -A` is a reasonable start. `kubectl delete` is not.
3. **Whether validation was run unprompted.** A fix without verification does not count, and this is the habit that transfers.

---

## Debrief — 15 minutes, whole class

Run it in this order. Resist starting with the answers.

1. **"What was your first command in INC-5, and why?"** — go round the room. The variety is the lesson.
2. **"What did you rule out, and what ruled it out?"** — elicits method rather than outcome.
3. **"Which incident did you detect before the ticket arrived?"** — connects Day 5 back to the whole week.
4. **The trap.** Ask whoever deleted the policy to talk the room through it. Be warm about it; they are doing the class a service. Then ask what the correct fix was and why it took longer.
5. **"What alert would have caught this first?"** — for each of the three. This is the question that turns a lab into an engineer, and it produces the best answers of the entire week.

Close with the ledger:

```bash
kubectl -n axispay-data exec postgres-0 -- \
  psql -U axispay_app -d axispay -t -c 'SELECT SUM(amount_minor) FROM ledger_entries;'
```

Zero. Through an upgrade, three incidents and 110 minutes under pressure, the money still balances. That is the note to end the week on.

---

## Reset between cohorts

```bash
bash scripts/incidents/resolve-INC-5.sh
bash scripts/incidents/resolve-INC-6.sh
bash scripts/incidents/resolve-INC-7.sh
helm rollback axispay --wait                          # back to 1.1.0
kubectl delete job settlement-migration-2-0-0 -n axispay-data --ignore-not-found
make validate-day5
```

The migration itself is idempotent and does not need reverting — every statement is `IF NOT EXISTS`, which is exactly the property that makes a migration safe to retry at 02:00.
