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
