# INC-3 · Storage and configuration

| | |
|---|---|
| **Time** | 45 minutes |
| **Difficulty** | Two faults, one loud and one quiet |
| **You need first** | Day 3 labs complete |
| **You will do** | Triage two unrelated failures, prioritise correctly, and repair them in the right order |
| **Check you are done** | `make validate-lab LAB=L3.5 && make validate-lab LAB=L3.6` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Real incidents are noisy. Write down what each command proves before you change anything.
- The first broken thing you see is not always the first thing you should fix.
- Full version: [`labs/GETTING-STARTED.md`](../../../GETTING-STARTED.md).
</details>

---

## Read this before you start

This incident is deliberately unfair in a realistic way.

Two changes were merged by different teams:

- a **storage** change broke PostgreSQL loudly
- a **configuration** change broke `ledger-service` quietly

Fixing the loud one first feels natural. It is also the wrong priority.

Why? Because `ledger-service` is on the payment path. A quiet readiness failure there hurts merchants immediately, while PostgreSQL being stuck in `Pending` is only one part of the wider picture.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This incident. |
| `manifests/00-configmap-postgres-init.yaml` | The known-good schema ConfigMap. |
| `manifests/01-postgres.yaml` | The known-good PostgreSQL StatefulSet definition. |
| `manifests/02-redis.yaml` | The known-good Redis StatefulSet definition. |
| `manifests/03-rabbitmq.yaml` | The known-good RabbitMQ StatefulSet definition. |

---

## Step 0 — Inject the incident if you are working alone

In instructor-led training this has already been done for you.

**Run this only if you need to inject the fault yourself:**

```bash
bash platform/admin/incidents/inject-INC-3.sh
```

Expected result:

```text
$ bash platform/admin/incidents/inject-INC-3.sh
Injecting INC-3 (two faults)...
Injected. Wait ~2 min, then hand out the ticket:
  days/day3/labs/INC-3-storage-and-config/ §2

Watch:   kubectl get pods -A -l app.kubernetes.io/part-of=axispay
Resolve: /Users/kumbulani.tshuma/Documents/devops trainning/kubernetescompr/platform/admin/incidents/resolve-INC-3.sh
```

---

## The ticket

```text
────────────────────────────────────────────────────────────────────────
  AXISPAY OPERATIONS — INCIDENT TICKET
  Ref     OPS-2026-08-12-0526
  Raised  17:18 SAST          Severity  SEV-1
  Source  Platform alerts + Merchant Support
────────────────────────────────────────────────────────────────────────

  ledger-service readiness failing, 0/2 endpoints.
  postgres-0 not Ready for 4 minutes.

  A storage change and a config change were both merged this
  afternoon by different teams. Both teams say their change is safe.

  Merchant Support reports payment attempts are timing out.
  Ops wants a prioritised update in 15 minutes.

────────────────────────────────────────────────────────────────────────
```

---

## Step 1 — See both failures at once

**Run this:**

```bash
kubectl get pods -A -l app.kubernetes.io/part-of=axispay
```

Expected result:

```text
$ kubectl get pods -A -l app.kubernetes.io/part-of=axispay
NAMESPACE      NAME                               READY   STATUS    RESTARTS   AGE
axispay-core   customer-service-5d66db6c6-r7twl   1/1     Running   0          21m
axispay-core   ledger-service-69f9bfb8f8-k2r5h    0/1     Running   0          2m14s
axispay-core   ledger-service-69f9bfb8f8-sv8bd    0/1     Running   0          2m14s
axispay-core   payment-service-6b9d5f5d6c-jh2sx   1/1     Running   0          12m
axispay-data   postgres-0                         0/1     Pending   0          2m31s
axispay-data   rabbitmq-0                         1/1     Running   0          25m
axispay-data   redis-0                            1/1     Running   0          25m
axispay-edge   auth-service-6bf69c4c8f-4n8qh      1/1     Running   0          18m
axispay-edge   edge-gateway-78b7d5d5cf-jcqqs      1/1     Running   0          1d22h
```

Read it carefully:

- `postgres-0` is the **loud** fault: `Pending`
- both `ledger-service` pods are the **quiet** fault: `Running` but not `Ready`

---

## Step 2 — Diagnose the loud storage fault

**Run this:**

```bash
kubectl describe pvc data-postgres-0 -n axispay-data
```

Expected result:

```text
$ kubectl describe pvc data-postgres-0 -n axispay-data
Name:          data-postgres-0
Namespace:     axispay-data
StorageClass:  axispay-fast
Status:        Pending
Volume:
Labels:        app.kubernetes.io/part-of=axispay
Annotations:   volume.beta.kubernetes.io/storage-provisioner: k8s.io/minikube-hostpath
Finalizers:    [kubernetes.io/pvc-protection]
Capacity:
Access Modes:
VolumeMode:    Filesystem
Used By:       postgres-0
Events:
  Type     Reason              Age                 From                         Message
  ----     ------              ----                ----                         -------
  Warning  ProvisioningFailed  24s (x7 over 2m)   persistentvolume-controller  storageclass.storage.k8s.io "axispay-fast" not found
```

That message is explicit. The PVC is asking for a `StorageClass` that does not exist.

---

## Step 3 — Diagnose the quiet config fault

**Run this:**

```bash
kubectl exec -n axispay-core deploy/ledger-service -- printenv | sort | grep POSTGRES_
kubectl logs -n axispay-core deploy/ledger-service --tail=20
```

Expected result:

```text
$ kubectl exec -n axispay-core deploy/ledger-service -- printenv | sort | grep POSTGRES_
POSTGRES_DB=axispay
POSTGRES_HOSTNAME=postgres-0.postgres.axispay-data.svc.cluster.local
POSTGRES_PORT=5432

$ kubectl logs -n axispay-core deploy/ledger-service --tail=20
2026-08-18T20:15:54.621Z  INFO  starting ledger-service  version=1.0.0
2026-08-18T20:15:54.625Z  INFO  connecting to postgres  host=postgres
2026-08-18T20:15:54.712Z ERROR  startup failed  error="dial tcp: lookup postgres on 10.96.0.10:53: no such host"
2026-08-18T20:15:54.713Z  INFO  readiness probe will continue to fail until database host config is corrected
```

That is the important clue: the pod has `POSTGRES_HOSTNAME`, but the application expects `POSTGRES_HOST`.

---

## Step 4 — Fix the customer-impacting config fault first

**Run this:**

```bash
kubectl patch configmap axispay-platform-config -n axispay-core --type json -p='[{"op":"remove","path":"/data/POSTGRES_HOSTNAME"},{"op":"add","path":"/data/POSTGRES_HOST","value":"postgres-0.postgres.axispay-data.svc.cluster.local"}]'
kubectl rollout restart deployment/ledger-service -n axispay-core
kubectl rollout status deployment/ledger-service -n axispay-core
```

Expected result:

```text
$ kubectl patch configmap axispay-platform-config -n axispay-core --type json -p='[{"op":"remove","path":"/data/POSTGRES_HOSTNAME"},{"op":"add","path":"/data/POSTGRES_HOST","value":"postgres-0.postgres.axispay-data.svc.cluster.local"}]'
configmap/axispay-platform-config patched

$ kubectl rollout restart deployment/ledger-service -n axispay-core
deployment.apps/ledger-service restarted

$ kubectl rollout status deployment/ledger-service -n axispay-core
Waiting for deployment "ledger-service" rollout to finish: 1 out of 2 new replicas have been updated...
Waiting for deployment "ledger-service" rollout to finish: 1 old replicas are pending termination...
deployment "ledger-service" successfully rolled out
```

At this point you have fixed the quiet issue that is directly breaking the payment path.

---

## Step 5 — Repair PostgreSQL by restoring the correct StatefulSet definition

`volumeClaimTemplates` are immutable, so you cannot just patch the bad `storageClassName` in place.

**Run this:**

```bash
kubectl delete statefulset postgres -n axispay-data --cascade=orphan
kubectl delete pvc data-postgres-0 -n axispay-data
kubectl delete pod postgres-0 -n axispay-data --wait=false
kubectl apply -f manifests/01-postgres.yaml
kubectl rollout status statefulset/postgres -n axispay-data --timeout=180s
```

Expected result:

```text
$ kubectl delete statefulset postgres -n axispay-data --cascade=orphan
statefulset.apps "postgres" deleted

$ kubectl delete pvc data-postgres-0 -n axispay-data
persistentvolumeclaim "data-postgres-0" deleted

$ kubectl delete pod postgres-0 -n axispay-data --wait=false
pod "postgres-0" deleted

$ kubectl apply -f manifests/01-postgres.yaml
service/postgres unchanged
statefulset.apps/postgres created

$ kubectl rollout status statefulset/postgres -n axispay-data --timeout=180s
Waiting for 1 pods to be ready...
partitioned roll out complete: 1 new pods have been updated...
```

---

---

## If something went wrong

Two easy ways to get lost in this incident:

1. **Fixing `postgres-0` first because it is louder.** That repairs storage, but it does not repair the service merchants are actually timing out on.
2. **Restarting `ledger-service` before correcting the ConfigMap key.** The new pods will fail in exactly the same way, because the wrong value is still being injected.

If you are unsure which fault you are looking at, ask one simple question: **is the pod `Pending`, or is it `Running` but not `Ready`?** That separates storage/scheduling failures from configuration/startup failures very quickly.

## Step 6 — Verify that both faults are gone

**Run this:**

```bash
kubectl get pods -n axispay-core -l app.kubernetes.io/name=ledger-service
kubectl get pod postgres-0 -n axispay-data
make validate-lab LAB=L3.5
make validate-lab LAB=L3.6
```

Expected result:

```text
$ kubectl get pods -n axispay-core -l app.kubernetes.io/name=ledger-service
NAME                              READY   STATUS    RESTARTS   AGE
ledger-service-7748d7f6cb-4jjsn   1/1     Running   0          42s
ledger-service-7748d7f6cb-lj6m8   1/1     Running   0          42s

$ kubectl get pod postgres-0 -n axispay-data
NAME         READY   STATUS    RESTARTS   AGE
postgres-0   1/1     Running   0          1m17s

$ make validate-lab LAB=L3.5

L3.5 — Data tier
----------------------------------------------------------------
  ✓ StatefulSet postgres: 1 ready
  ✓ StatefulSet redis: 1 ready
  ✓ StatefulSet rabbitmq: 1 ready
  ✓ PVC data-postgres-0 Bound
  ✓ PVC data-redis-0 Bound
  ✓ PVC data-rabbitmq-0 Bound
  ✓ 5000 payments loaded
  ✓ ledger imbalance is 0 in every currency (sum DR == sum CR)
  ✓ every payment satisfies amount = fee + net

✓ L3.5 PASSED — 9/9 checks

$ make validate-lab LAB=L3.6

L3.6 — StatefulSets
----------------------------------------------------------------
  ✓ postgres -> headless Service 'postgres'
  ✓ postgres has volumeClaimTemplates
  ✓ redis -> headless Service 'redis'
  ✓ redis has volumeClaimTemplates
  ✓ rabbitmq -> headless Service 'rabbitmq'
  ✓ rabbitmq has volumeClaimTemplates
  ✓ pod is named postgres-0 (ordinal identity, not a random suffix)

✓ L3.6 PASSED — 7/7 checks
```

---

## Cheat Sheet / Tips & Tricks

Quick commands:
- `kubectl get pods -A -l app.kubernetes.io/part-of=axispay` — see the whole incident in one screen across namespaces.
- `kubectl describe pvc data-postgres-0 -n axispay-data` — confirm whether PostgreSQL is blocked by storage and read the exact PVC event.
- `kubectl exec -n axispay-core deploy/ledger-service -- printenv | sort | grep POSTGRES_` — check what database host variables the app actually received.
- `kubectl logs -n axispay-core deploy/ledger-service --tail=20` — read the startup failure that explains why the pods are `Running` but not `Ready`.
- `kubectl rollout status deployment/ledger-service -n axispay-core` — verify the config-side fix has produced healthy pods before you move on.

Tips & tricks:
- Split the symptoms first: `Pending` usually points to scheduling or storage, while `Running` but not `Ready` usually points to startup config or probes.
- Fix the customer path first when you can do it safely. In this incident, `ledger-service` hurts payments sooner than `postgres-0` being loud and stuck.
- Restarting `ledger-service` without fixing the ConfigMap key changes nothing; the new pods will inherit the same bad value.
- PostgreSQL needs a StatefulSet re-create here because `volumeClaimTemplates` are immutable. When storage class data is wrong, simple patching is not enough.

---

## Debrief — why the order mattered

The loud failure was easier to spot, but the quiet failure was the one hurting customers first.

That is the lesson of this incident:

- **observe carefully**
- **separate unrelated faults**
- **fix the customer path first when you can do so safely**
