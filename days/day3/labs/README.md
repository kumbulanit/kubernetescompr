# Day 3 labs

These labs are designed to be done **in order**. The later ones make much more sense once the earlier ones are real in your cluster.

| Lab | Main question | What you create or inspect |
|---|---|---|
| [L3.1](L3.1-configmaps/) | How do I change shared settings without rebuilding an image? | `ConfigMap` objects and env vars |
| [L3.2](L3.2-secrets/) | How do I keep passwords and keys out of normal YAML? | `Secret` objects and `secretKeyRef` |
| [L3.3](L3.3-persistent-volumes/) | Where does important data live when a pod dies? | a manual PV and PVC |
| [L3.4](L3.4-storageclass/) | How does Kubernetes provision storage automatically? | a `StorageClass` and PVC events |
| [L3.5](L3.5-data-tier/) | What does a real stateful platform backend look like? | PostgreSQL, Redis, RabbitMQ |
| [L3.6](L3.6-statefulsets/) | Why is a database not just another Deployment? | pod identity, headless DNS, stable PVCs |
| [L3.7](L3.7-security-context/) | How do I stop containers running with too much privilege? | pod and container `securityContext` |
| [INC-3](INC-3-storage-and-config/) | Can I separate two unrelated faults under pressure? | config + storage triage |

---

## How to work through a Day 3 lab

1. Read the short explanation at the top.
2. Look in the lab's `manifests/` folder before you apply anything.
3. Run the commands exactly as written.
4. Compare your output with the expected transcript, not just the last line.
5. If something is wrong, use `kubectl describe ...` before you restart or delete things.
6. Run the validator for that lab.

---

## What to pay attention to in the terminal

Day 3 is the first day where the details really matter.

- In `kubectl get pods`, read **READY** before **STATUS**.
- In `kubectl describe pvc`, read the **Events** section before assuming `Pending` is broken.
- In `kubectl describe pod`, look for `secretKeyRef`, `ConfigMap`, `Mounts`, `Security Context`, and probe failures.
- In PostgreSQL query output, trust the **constraint-backed invariant** more than application assumptions.

---

## Cheat Sheet / Tips & Tricks

Quick commands:
- `cd days/day3/labs/L3.1-configmaps` — jump straight into the next lab from the repo root; swap the folder name for any other Day 3 lab.
- `kubectl diff -f manifests/ ; kubectl apply -f manifests/` — preview and then apply a lab's YAML from inside that lab folder.
- `make validate-lab LAB=L3.5` — run the validator for one lab without waiting for the full day check.
- `kubectl get pods -A -l app.kubernetes.io/part-of=axispay -w` — watch the whole AxisPay platform while a rollout or incident fix is happening.
- `kubectl get pods,svc,pvc -n axispay-data` — the fastest shared view for most Day 3 stateful labs.

Tips & tricks:
- If you are staying in one namespace for a while, set it once with `kubectl config set-context --current --namespace=axispay-core` and switch back when needed.
- Simple aliases save time: `alias k=kubectl` and `alias kgp='kubectl get pods'` are enough for the whole day.
- When a lab creates or changes workloads, keep one terminal running `kubectl get pods -w -n <namespace>` so you can see rollouts live.
- If `apply` worked but the lab still fails, use `kubectl describe` on the pod, PVC, or StatefulSet before you restart anything.

---

## Useful checkpoint commands

```bash
make validate-lab LAB=L3.1
make validate-lab LAB=L3.5
make validate-lab LAB=L3.7
```

Expected result:

```text
$ make validate-lab LAB=L3.1

L3.1 — ConfigMaps
----------------------------------------------------------------
  ✓ configmap axispay-core/axispay-platform-config exists
  ✓ configmap axispay-core/axispay-fraud-rules exists
  ✓ payment-service has ConfigMap values in its environment

✓ L3.1 PASSED — 3/3 checks

$ make validate-lab LAB=L3.5

L3.5 — Data tier
----------------------------------------------------------------
  ✓ StatefulSet postgres: 1 ready
  ✓ StatefulSet redis: 1 ready
  ✓ StatefulSet rabbitmq: 1 ready
  ✓ 5000 payments loaded
  ✓ ledger imbalance is 0 in every currency (sum DR == sum CR)

✓ L3.5 PASSED — 8/8 checks

$ make validate-lab LAB=L3.7

L3.7 — securityContext hardening
----------------------------------------------------------------
  ✓ payment-service: non-root, read-only rootfs, drop ALL, no escalation
  ✓ runs as uid 10001 (not root)
  ✓ CapEff=0000000000000000 — zero capabilities

✓ L3.7 PASSED — 11/11 checks
```

If you reach INC-3 and one of these still fails, stop and repair the underlying lab first. Incident work is much harder on a shaky baseline.
