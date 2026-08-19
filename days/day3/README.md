# Day 3 · Storage and configuration

| | |
|---|---|
| **Theme** | Give the platform memory, configuration, and safer runtime defaults |
| **Big idea** | Pods are disposable; config, secrets, data, and identity are not |
| **You need first** | Day 2 complete and the AxisPay platform running |
| **Labs today** | L3.1 → L3.7, then INC-3 |
| **End-of-day check** | `make validate-day3` |

---

## What Day 3 is really about

Up to now, Kubernetes has mostly been a place to run processes. Day 3 is the day it becomes a platform.

You will separate **settings from code**, move **sensitive values out of plain manifests**, give the data tier **persistent storage**, learn when a **StatefulSet** is the right controller, and harden workloads so they do not run with more privilege than they need.

A good Java analogy is this:

- the container image is your compiled application
- a ConfigMap is runtime configuration like `application.properties`
- a Secret is configuration that must not live in source control
- a PV/PVC is the database disk that must outlive the process
- a StatefulSet is for database-like members, not interchangeable web replicas

![PersistentVolume, PersistentVolumeClaim and StorageClass relationship](images/pvc-storageclass.png)

Diagram source: Kubernetes documentation/blog (CC BY 4.0), “Resizing Persistent Volumes using Kubernetes”.

---

## The learning path

1. **L3.1 ConfigMaps** — move shared settings into Kubernetes.
2. **L3.2 Secrets** — separate passwords and keys from normal config.
3. **L3.3 Persistent volumes** — create storage that survives pod replacement.
4. **L3.4 StorageClass** — understand how Kubernetes provisions storage on demand.
5. **L3.5 Data tier** — run PostgreSQL, Redis, and RabbitMQ with persistent disks.
6. **L3.6 StatefulSets** — understand stable pod identity, headless Services, and per-replica storage.
7. **L3.7 Security context** — run workloads as non-root with fewer privileges.
8. **INC-3** — diagnose two faults that look related but are not.

---

## What success looks like by the end of the day

- `axispay-platform-config` and the Day 3 Secrets exist in the correct namespaces.
- PostgreSQL, Redis, and RabbitMQ run as StatefulSets in `axispay-data`.
- the database contains **25 merchants, 400 customers, 5,000 payments, and 14,865 ledger entries**.
- `SELECT * FROM v_ledger_balance;` shows an imbalance of **0** in every currency.
- application pods run as UID `10001`, not root, with `CapEff=0000000000000000`.

---

## Cheat Sheet / Tips & Tricks

Quick commands:
- `kubectl get configmap,secret -A` — quickly see where Day 3 config and secret objects live.
- `kubectl get configmap axispay-platform-config -n axispay-core -o yaml` — inspect the shared app settings exactly as Kubernetes stores them.
- `kubectl get secret axispay-db-credentials -n axispay-data -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d` — decode one Secret value to prove base64 is not encryption.
- `kubectl get pv,pvc -A && kubectl get storageclass` — see manual volumes, claims, and storage classes in one quick pass.
- `kubectl describe pvc data-postgres-0 -n axispay-data` — read the PVC Events section when storage is `Pending` or slow.
- `kubectl get statefulset,pod,svc,pvc -n axispay-data` — view the full PostgreSQL/Redis/RabbitMQ stateful story together.
- `kubectl describe pod -n axispay-core -l app.kubernetes.io/name=payment-service` — inspect mounts, env, probes, and security context on one hardened app pod.
- `kubectl exec -n axispay-core deploy/payment-service -- id && kubectl exec -n axispay-core deploy/payment-service -- grep CapEff /proc/1/status` — prove the container is non-root with zero Linux capabilities.

Tips & tricks:
- Use `kubectl diff -f manifests/` before `kubectl apply -f manifests/` when you want a safe preview of YAML changes.
- Use `kubectl apply --dry-run=client -o yaml -f manifests/` to validate and print what Kubernetes will send without changing the cluster.
- Use `kubectl explain <kind>.<field>` such as `kubectl explain statefulset.spec.volumeClaimTemplates` when a YAML field name is unfamiliar.
- Add `-o yaml` when `get` output is too short and you need the real spec, not the summary table.
- `Running` is not enough for Day 3. Always check `READY`, probes, and `kubectl describe` output as well.
- ConfigMap and Secret values injected as environment variables are startup snapshots. Restart the Deployment or StatefulSet if the app only reads them at boot.
- Secret values are base64-encoded by default, not automatically encrypted at rest. Treat RBAC to `get secrets` as highly sensitive.
- A PVC stuck in `Pending` usually means one of three things: wrong `storageClassName`, no matching PV, or a normal `WaitForFirstConsumer` delay. The Events section tells you which.
- StatefulSet pods keep stable names like `postgres-0`; that identity is part of the design, not a cosmetic detail.
- When debugging Day 3, prefer `kubectl describe` before deleting or restarting anything. Events usually explain the failure faster than guesswork.

---

## The one command that checks the full Day 3 end-state

```bash
make validate-day3
```

Expected result:

```text
$ make validate-day3

Day 3 checkpoint
----------------------------------------------------------------
  ✓ configmap axispay-core/axispay-platform-config exists
  ✓ secret axispay-data/axispay-db-credentials exists
  ✓ StorageClass axispay-standard exists
  ✓ StatefulSet postgres: 1 ready
  ✓ StatefulSet redis: 1 ready
  ✓ StatefulSet rabbitmq: 1 ready
  ✓ ledger imbalance is 0 in every currency
  ✓ every hardened deployment runs as non-root

✓ Day 3 PASSED — platform storage, config, stateful workloads and hardening are all in place
```

If this command fails, do not guess. Go back to the matching lab, re-run the inspection commands there, and read the **events** or the **describe** output before changing anything.

---

## Rebuild everything from scratch (disaster recovery)

Use this when your cluster crashed, you are coming back to Day 3 after a break and something feels broken, or you want a clean **Day 1 + Day 2 + Day 3** platform again before continuing with storage, ConfigMaps, Secrets, StatefulSets, and the data tier.

Why not just re-apply an old lab manifest? Because Kubernetes tries to merge your old YAML with the live object already in the cluster. If that live state has drifted, the merge can fail with confusing errors such as:

```text
The Deployment "payment-service" is invalid:
* spec.template.spec.containers[0].env[0].valueFrom: Invalid value: "": may not be specified when `value` is not empty
```

Deleting the AxisPay namespaces first removes that drifted state, so Kubernetes creates fresh objects instead of trying to patch a broken mix of old and new configuration.

**Run this:**

```bash
make rebuild-day3
```

This is the important part: **you do not need to run three separate commands**. `make rebuild-day3` is one command that wipes the old Day 1–3 platform, then rebuilds **Day 1**, then **Day 2**, then **Day 3** in the correct dependency order. Even though you are on Day 3, this single command gives you a complete, working **Day 1 + Day 2 + Day 3** platform from absolutely nothing.

Expected result:

```text
$ make rebuild-day3
==> Deleting all AxisPay namespaces — this removes every workload, PVC and secret
namespace "axispay-edge" deleted
namespace "axispay-core" deleted
namespace "axispay-async" deleted
namespace "axispay-ops" deleted
namespace "axispay-data" deleted
Namespaces removed. Run 'make rebuild-day1' (or rebuild-day2 / day3 / day4 / day5) to recreate the platform.

namespace/axispay-edge created
namespace/axispay-core created
namespace/axispay-async created

==> Deploying Day 1
deployment.apps/edge-gateway created
deployment.apps/auth-service created
deployment.apps/merchant-service created
deployment.apps/payment-service created
service/edge-gateway created
service/auth-service created
service/merchant-service created
service/payment-service created
pod/payment-service-bare created

Cluster
----------------------------------------------------------------
  ✓ 1/1 nodes Ready

Namespaces
----------------------------------------------------------------
  ✓ axispay-edge
  ✓ axispay-core

Workloads for day 1
----------------------------------------------------------------
  ✓ Deployment axispay-edge/edge-gateway has 1/1 ready replica(s)
  ✓ Deployment axispay-edge/auth-service has 1/1 ready replica(s)
  ✓ Deployment axispay-core/payment-service has 1/1 ready replica(s)
  ✓ Deployment axispay-core/merchant-service has 1/1 ready replica(s)

Services have endpoints
----------------------------------------------------------------
  ✓ Service axispay-edge/edge-gateway has 1 endpoint(s)
  ✓ Service axispay-edge/auth-service has 1 endpoint(s)
  ✓ Service axispay-core/payment-service has 1 endpoint(s)
  ✓ Service axispay-core/merchant-service has 1 endpoint(s)

End-to-end — a payment still works
----------------------------------------------------------------
  ✓ edge-gateway reaches payment-service in-cluster

✓ DAY 1 CHECKPOINT PASSED — 12/12 checks

==> Deploying Day 2
namespace/axispay-ops created
resourcequota/axispay-core-quota created
limitrange/axispay-core-limits created
deployment.apps/edge-gateway configured
deployment.apps/auth-service configured
deployment.apps/merchant-service configured
deployment.apps/payment-service configured
deployment.apps/fraud-service created
deployment.apps/routing-service created
deployment.apps/loadgen created
service/fraud-service created
service/routing-service created
service/node-agent created
service/loadgen created
horizontalpodautoscaler.autoscaling/payment-service created
horizontalpodautoscaler.autoscaling/fraud-service created
daemonset.apps/node-agent created
job.batch/recon-worker created
cronjob.batch/settlement-cron created
deployment.apps/payment-service configured

Cluster
----------------------------------------------------------------
  ✓ 1/1 nodes Ready

Namespaces
----------------------------------------------------------------
  ✓ axispay-edge
  ✓ axispay-core
  ✓ axispay-ops
  ✓ axispay-async

Day 2 — resources, probes and autoscaling
----------------------------------------------------------------
  ✓ every container has a memory limit
  ✓ HorizontalPodAutoscaler present
  ✓ settlement-cron CronJob present

✓ DAY 2 CHECKPOINT PASSED — 21/21 checks

==> Deploying Day 3
namespace/axispay-data created
configmap/axispay-platform-config created
configmap/axispay-fraud-rules created
deployment.apps/customer-service created
service/customer-service created
deployment.apps/ledger-service created
service/ledger-service created
secret/axispay-db-credentials created
secret/axispay-db-credentials created
secret/axispay-jwt-signing created
secret/axispay-redis-credentials created
secret/axispay-rabbitmq-credentials created
configmap/axispay-security-baseline created
deployment.apps/edge-gateway configured
deployment.apps/auth-service configured
deployment.apps/merchant-service configured
deployment.apps/payment-service configured
deployment.apps/fraud-service configured
deployment.apps/routing-service configured
storageclass.storage.k8s.io/axispay-standard created
persistentvolume/axispay-ledger-archive created
persistentvolumeclaim/ledger-archive created
configmap/postgres-init created
service/postgres created
statefulset.apps/postgres created
service/redis created
statefulset.apps/redis created
service/rabbitmq created
statefulset.apps/rabbitmq created

Cluster
----------------------------------------------------------------
  ✓ 1/1 nodes Ready

Namespaces
----------------------------------------------------------------
  ✓ axispay-edge
  ✓ axispay-core
  ✓ axispay-ops
  ✓ axispay-async
  ✓ axispay-data

Day 3 — storage and configuration
----------------------------------------------------------------
  ✓ postgres StatefulSet present
  ✓ every PVC is Bound
  ✓ database seeded (5000 payments)

End-to-end — a payment still works
----------------------------------------------------------------
  ✓ edge-gateway reaches payment-service in-cluster

✓ DAY 3 CHECKPOINT PASSED — 29/29 checks
```

On a fresh rebuild, Day 3 usually pauses longest while the PVCs bind and PostgreSQL, Redis, and RabbitMQ become ready. That is normal.

If you are already further along in the course, use the matching higher rebuild target instead, for example `make rebuild-day5`.

**Warning:** this command is destructive. It deletes everything in the AxisPay namespaces, including current workloads, Secrets, PVCs, and any data stored in those volumes. Only run it when you are fine losing the current state.
