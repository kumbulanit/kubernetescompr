# L3.5 · The Data Tier — Real Data, Real Constraints

| | |
|---|---|
| **Time** | 55 minutes |
| **Difficulty** | The platform stops being a demo |
| **You need first** | [L3.4](../L3.4-storageclass/) finished |
| **You will create** | PostgreSQL, Redis, RabbitMQ + 28,000 rows |
| **Check you are done** | `make validate-lab LAB=L3.5` |

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

Until now AxisPay has kept payments in memory. Restart a pod and the money vanishes — which is fine for learning and unacceptable for anything else.

You will deploy PostgreSQL, Redis and RabbitMQ, load a real schema and about **28,000 statements** of fictional data — 25 merchants, 5,000 payments, 14,865 ledger entries — and then query your own platform.

You will also meet the constraint that makes this a payments course rather than a to-do-list course: **every journal must balance to zero.** You will verify it in SQL, and you will verify it again on Friday under assessment.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get sc axispay-standard` | It exists |
| 3 | `df -h ~ \| tail -1` | At least 5 GB free |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | Namespace, PostgreSQL, Redis, RabbitMQ, and the schema ConfigMap |

---

## Step 1 — The data namespace and the schema

```bash
kubectl apply -f manifests/00-namespace-data.yaml
kubectl apply -f manifests/
kubectl get cm -n axispay-data
```

The schema arrives as a ConfigMap mounted into PostgreSQL's init directory. **The seed data does not** — it is 8 MB, and a ConfigMap caps at 1 MiB. You will pipe it in at Step 4. That size limit is a real constraint, and this is where you meet it.

---

## Step 2 — PostgreSQL

```bash
kubectl get statefulset,pods,pvc -n axispay-data
kubectl wait --for=condition=Ready pod/postgres-0 -n axispay-data --timeout=300s
```

**A StatefulSet, not a Deployment.** Why becomes clear in L3.6; for now, note the pod is called `postgres-0` and not `postgres-7d4f8b9c6-x2ktp`. **A stable name, not a random one.**

```bash
kubectl get pvc -n axispay-data
```

```
NAME               STATUS   VOLUME    CAPACITY   STORAGECLASS
data-postgres-0    Bound    pvc-...   4Gi        axispay-standard
```

You did not write that PVC. A StatefulSet's `volumeClaimTemplates` created it, named after the pod. That naming is what lets `postgres-0` find *its own* disk again after a restart.

---

## Step 3 — Confirm the schema landed

```bash
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -c '\dt'
```

Eleven tables. Look at the constraints on the important one:

```bash
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -c '\d payments' | head -25
```

```
Check constraints:
    "payments_balance" CHECK (amount_minor = fee_minor + net_minor)
```

**The database refuses to store a payment that does not add up.** Not the application — the database. If the code has a bug, the write fails rather than silently corrupting the ledger.

---

## Step 4 — Load the seed data

```bash
make seed
```

That pipes `data/seed/02-seed.sql` straight into `psql`. It takes 30–60 seconds.

```bash
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -t -c "
SELECT 'merchants      ' || COUNT(*) FROM merchants
UNION ALL SELECT 'payments       ' || COUNT(*) FROM payments
UNION ALL SELECT 'ledger_entries ' || COUNT(*) FROM ledger_entries
UNION ALL SELECT 'settlements    ' || COUNT(*) FROM settlements;"
```

```
 merchants      25
 payments       5000
 ledger_entries 14865
 settlements    340
```

**All fictional.** Generated deterministically, so everyone in the room has identical data and the answers to the queries below match.

---

## Step 5 — Query your own platform

```bash
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -c "
SELECT currency,
       COUNT(*)                                AS payments,
       SUM(amount_minor)/100.0                 AS gross,
       ROUND(100.0*SUM(CASE WHEN status IN ('captured','authorized') THEN 1 ELSE 0 END)
             / COUNT(*), 1)                    AS approval_rate_pct
  FROM payments GROUP BY currency ORDER BY gross DESC;"
```

**Note `SUM(amount_minor)/100.0`.** Money is stored as a whole number of cents and only divided for display. **Never a floating-point type.** `0.1 + 0.2` is not `0.3` in binary floating point, and in a ledger that difference compounds.

---

## Step 6 — The invariant that matters

**Double-entry bookkeeping:** every movement of money is recorded twice, once positive and once negative. Every journal must therefore sum to **exactly zero**.

```bash
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -c "
SELECT COALESCE(SUM(amount_minor),0) AS total_must_be_zero FROM ledger_entries;"
```

```
 total_must_be_zero
--------------------
                  0
```

**But a total of zero can hide two offsetting errors.** The real check is per journal:

```bash
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -c "
SELECT COUNT(*) AS unbalanced_journals FROM (
  SELECT journal_id FROM ledger_entries GROUP BY journal_id HAVING SUM(amount_minor) <> 0
) x;"
```

```
 unbalanced_journals
---------------------
                   0
```

**Zero unbalanced journals out of 4,955.** Remember both queries — they are how the capstone is scored on Friday, and the second is the one that actually proves anything.

---

## Step 7 — Redis and RabbitMQ

```bash
kubectl get pods -n axispay-data
kubectl exec -n axispay-data deploy/redis -- redis-cli ping
kubectl exec -n axispay-data deploy/rabbitmq -- rabbitmqctl list_queues name messages 2>/dev/null | head
```

Three data stores, three different jobs:

| Store | Used for | If it dies |
|---|---|---|
| **PostgreSQL** | Payments, ledger, merchants | The platform stops. Nothing is recoverable without it. |
| **Redis** | Fraud velocity counters | The service **degrades** — slower, less accurate, still working |
| **RabbitMQ** | Async events to settlement and audit | Events queue up; nothing is lost |

**That middle row is a design decision you will feel on Friday.** Redis is deliberately treated as *non-critical* in readiness checks, so a cache outage degrades the service instead of removing it from the load balancer.

---

## Step 8 — Prove persistence

```bash
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -t -c 'SELECT COUNT(*) FROM payments;'
kubectl delete pod postgres-0 -n axispay-data
kubectl wait --for=condition=Ready pod/postgres-0 -n axispay-data --timeout=300s
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -t -c 'SELECT COUNT(*) FROM payments;'
```

**Same count.** Same name, same volume, same data.

Compare with L3.3's ephemeral pod, where the file was simply gone.

---

## Step 9 — Point the platform at the database

```bash
kubectl apply -f manifests/
kubectl rollout status deployment/payment-service -n axispay-core --timeout=180s

kubectl port-forward -n axispay-edge svc/edge-gateway 8080:8080 &
sleep 3
curl -s -X POST http://localhost:8080/api/v1/payments \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H 'Idempotency-Key: l35-persisted' \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-L35-001","amount_minor":250000,"currency":"ZAR","card_token":"tok_visa_4242"}' \
  | jq '{payment_id, status}'
kill %1
```

**Now find it in the database:**

```bash
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -c "
SELECT payment_id, reference, amount_minor, status FROM payments
 WHERE merchant_reference = 'AXP-L35-001';"
```

**Your payment, in a real table, on a real disk.** It survives the pod, the node reboot, and everything else this week.

---

## Did it work?

```bash
make validate-lab LAB=L3.5
```

---

## Clean up

Nothing. The data tier stays for the rest of the course.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `postgres-0` stuck `Pending` | PVC unbound, or not enough disk | `kubectl describe pod postgres-0 -n axispay-data` |
| `make seed` fails part way | Schema not applied first | Re-run; the schema is idempotent |
| `password authentication failed` | Secret mismatch between namespaces | Compare both copies of `axispay-db-credentials` |
| Counts do not match this README | Seed run twice | `TRUNCATE` and re-seed, or accept the difference |
| `unbalanced_journals` is not 0 | A genuine data problem | Report it — the generator asserts this before writing |
| `postgres-0` `CrashLoopBackOff` | Volume permissions | `kubectl logs postgres-0 -n axispay-data`. Usually `fsGroup` — L3.7 |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/03-storage-and-configuration/solutions.md).

**1.** Write a query for the top three merchants by **net settled value** in ZAR over the last seven days, including their approval rate.

**2.** Scale `postgres` to 3 replicas. Watch what happens, then explain in a paragraph why you now have **three independent empty databases** rather than a cluster — and what a real PostgreSQL cluster on Kubernetes actually requires.

**3.** Prove the `payments_balance` constraint is real by trying to insert a row where `amount_minor <> fee_minor + net_minor`. Capture the exact error.

---

## What you built

- **A real data tier** — PostgreSQL, Redis, RabbitMQ, with 28,000 statements of fictional data
- **Money as integer minor units**, and the reason floating point is a defect
- **The double-entry invariant**, verified two ways — and the reason the per-journal check is the one that counts
- **Constraints enforced by the database**, not merely hoped for in code
- **A payment that survives its pod**, end to end

**Next:** [L3.6 — StatefulSets](../L3.6-statefulsets/) — why `postgres-0` has that name, and the storage trap waiting on a three-node cluster.
