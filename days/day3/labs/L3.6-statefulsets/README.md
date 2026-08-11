# L3.6 · StatefulSets — When Pods Are Not Interchangeable

| | |
|---|---|
| **Time** | 45 minutes |
| **Difficulty** | Includes a trap that catches real platforms |
| **You need first** | [L3.5](../L3.5-data-tier/) finished |
| **You will do** | Build it wrong, then understand the right one |
| **Check you are done** | `make validate-lab LAB=L3.6` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command. <kbd>Tab</kbd> completes filenames.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../../../GETTING-STARTED.md).
</details>

---

## What you are going to do

A Deployment's pods are interchangeable — that is the whole idea. For a database they are not: `postgres-0` has *the* data, and a replacement with a different name and an empty disk is not a substitute.

You will deploy a database as a Deployment first, watch precisely how it fails, and then look at the StatefulSet you already have and understand each of the three guarantees it gives.

Then you will meet the **node-local storage trap** — the reason a database on a three-node laptop cluster behaves differently from one in a cloud.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get pods -n axispay-data` | `postgres-0` `1/1 Running` |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |

The StatefulSet manifests live with the data tier in [L3.5](../L3.5-data-tier/manifests/) — this lab examines what you already deployed rather than adding more.

---

## The three guarantees

```
  1. STABLE NAME       postgres-0, always. Not a random suffix.
  2. STABLE STORAGE    postgres-0 always re-attaches to ITS volume.
  3. ORDERING          0 before 1 before 2, on creation and scaling.
                       Reverse order on deletion.
```

A Deployment gives you none of the three, on purpose.

---

## Step 1 — Build it wrong, on purpose

```bash
cat <<'YAML' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wrongdb
  namespace: axispay-data
spec:
  replicas: 2
  selector:
    matchLabels: { app: wrongdb }
  template:
    metadata:
      labels: { app: wrongdb }
    spec:
      containers:
        - name: db
          image: postgres:17-alpine
          env:
            - { name: POSTGRES_PASSWORD, value: demo }
            - { name: PGDATA, value: /var/lib/postgresql/data/pgdata }
          volumeMounts:
            - { name: data, mountPath: /var/lib/postgresql/data }
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: wrongdb-shared
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: wrongdb-shared
  namespace: axispay-data
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: axispay-standard
  resources: { requests: { storage: 256Mi } }
YAML
sleep 30
kubectl get pods -n axispay-data -l app=wrongdb -o wide
```

**Look at what you get.** Depending on scheduling, either:

- both pods land on the same node and **fight over the same data directory** — PostgreSQL detects the lock and one crashes; or
- they land on different nodes and one is stuck `ContainerCreating` forever, because `ReadWriteOnce` means **one node**.

```bash
kubectl describe pod -n axispay-data -l app=wrongdb | grep -A5 'Events' | tail -8
kubectl logs -n axispay-data -l app=wrongdb --tail=10 2>/dev/null | head -12
```

**Three separate problems, all from one wrong object type:**

1. **Random names.** Nothing can address a specific instance.
2. **One shared volume.** Two databases, one data directory — corruption or a crash.
3. **No ordering.** Both start at once, and a replica cannot wait for its primary.

```bash
kubectl delete deployment wrongdb -n axispay-data
kubectl delete pvc wrongdb-shared -n axispay-data
```

---

## Step 2 — Now look at the right one

```bash
kubectl get statefulset postgres -n axispay-data -o yaml | grep -A12 'volumeClaimTemplates'
```

```yaml
volumeClaimTemplates:              # ① a TEMPLATE, not a claim
  - metadata:
      name: data
    spec:
      accessModes: [ReadWriteOnce]
      storageClassName: axispay-standard
      resources: { requests: { storage: 4Gi } }
serviceName: postgres-headless     # ② required
podManagementPolicy: OrderedReady  # ③
```

| | What it means |
|---|---|
| ① | **One PVC per pod**, created automatically and named `data-postgres-0`. Not one shared claim. |
| ② | A headless Service, so each pod gets its own DNS name. Required — a StatefulSet will not work without it. |
| ③ | Start `0`, wait until ready, then `1`. Delete in reverse. |

---

## Step 3 — Stable network identity

```bash
kubectl get svc -n axispay-data | grep headless
kubectl run dnstest --rm -it --restart=Never --image=busybox:1.37 -n axispay-data \
  -- nslookup postgres-0.postgres-headless.axispay-data.svc.cluster.local
```

**`postgres-0` has its own resolvable name.** With a Deployment you could only address the group; here you can address the individual — which is exactly what "connect to the primary" requires.

---

## Step 4 — Stable storage, proved

```bash
kubectl get pvc -n axispay-data
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -t -c 'SELECT COUNT(*) FROM payments;'
kubectl delete pod postgres-0 -n axispay-data
kubectl wait --for=condition=Ready pod/postgres-0 -n axispay-data --timeout=300s
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -t -c 'SELECT COUNT(*) FROM payments;'
```

Same name, same PVC, same rows. **The claim is named after the pod, which is how the pod finds its own disk.**

**Now delete the whole StatefulSet:**

```bash
kubectl delete statefulset postgres -n axispay-data
kubectl get pvc -n axispay-data
```

**The PVC survives.** Deliberately: deleting a workload and deleting its data are different decisions with very different consequences, and Kubernetes refuses to infer the second from the first.

```bash
kubectl apply -f ../L3.5-data-tier/manifests/
kubectl wait --for=condition=Ready pod/postgres-0 -n axispay-data --timeout=300s
kubectl exec -n axispay-data postgres-0 -- psql -U axispay_app -d axispay -t -c 'SELECT COUNT(*) FROM payments;'
```

**Data intact.** It re-bound to the same claim by name.

---

## Step 5 — The node-local storage trap

**Why we are doing this.** This behaves differently on a laptop from a cloud, and knowing which is which prevents a bad conclusion.

```bash
kubectl get pod postgres-0 -n axispay-data -o jsonpath='{.spec.nodeName}'; echo
kubectl get pv -o custom-columns='NAME:.metadata.name,NODE:.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0]' | grep -v '<none>'
```

**The volume is on one specific node**, because Minikube's provisioner writes to that node's disk.

**Which means: if that node dies, `postgres-0` cannot start anywhere else.** It is not a Kubernetes flaw — it is what local storage is. On a cloud with network-attached storage the volume detaches and re-attaches elsewhere, and the pod moves freely.

**What this course does not do,** stated plainly: real PostgreSQL high availability needs streaming replication, leader election, automated failover, a connection router that follows the leader, and backups with point-in-time recovery. That is an **operator** — CloudNativePG, Zalando, Crunchy — and the reason everyone uses one is that the list above is a product, not a configuration.

A StatefulSet gives you **identity and storage**. It does not give you a cluster.

---

## Step 6 — Init containers: wait, then migrate

```bash
kubectl get statefulset postgres -n axispay-data -o jsonpath='{.spec.template.spec.initContainers[*].name}'; echo
```

An **init container** runs to completion before the main containers start, and they run in order. Two uses here:

1. **Wait for a dependency.** Without it a service starts, fails to connect, crashes, restarts — a loop that looks like a bug in your app and is really a startup-order problem.
2. **Run a migration.** Exactly once, before the app that needs the new schema.

The capstone's migration Job is the full version of this, with an advisory lock so that concurrent runs serialise rather than race.

---

## Did it work?

```bash
make validate-lab LAB=L3.6
```

---

## Clean up

```bash
kubectl delete deployment wrongdb -n axispay-data --ignore-not-found
kubectl delete pvc wrongdb-shared -n axispay-data --ignore-not-found
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `postgres-0` stuck `ContainerCreating` | Volume attached elsewhere, or node gone | `kubectl describe pod postgres-0 -n axispay-data` |
| PVC `Pending` after re-creating the StatefulSet | Name mismatch | It must be `data-postgres-0` exactly |
| Two pods, one crashing | Two databases, one directory | That is Step 1 — the point |
| `postgres-1` never starts | Ordering: `0` is not ready | Fix `postgres-0` first |
| Data gone after re-creation | The PVC was deleted too | PVCs survive the StatefulSet — but not `kubectl delete pvc` |

---

## Try this yourself

Answers in [`solutions.md`](../../solutions.md).

**1.** Scale `postgres` to 3 replicas. Watch the ordering. Then explain why you have **three empty independent databases** rather than a cluster, and list what a real one requires.

**2.** Delete the whole StatefulSet. What happens to the PVCs, and why did Kubernetes choose that default? Bring it back and confirm the data.

**3.** Add a **second** init container running a schema migration, ordered after `wait-for-postgres`. Make it idempotent so it is safe on every pod start.

---

## What you built

- **A database deployed wrongly**, and three distinct failures from one wrong object type
- **The three guarantees** — stable name, stable storage, ordering — each demonstrated
- **PVCs surviving their StatefulSet**, and why that default is right
- **The node-local storage trap**, and what changes in a cloud
- **An honest account of what a StatefulSet does not give you**

**Next:** [L3.7 — Security context](../L3.7-security-context/) — stop running as root.
