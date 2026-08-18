# L3.4 · StorageClass

| | |
|---|---|
| **Time** | 30 minutes |
| **Difficulty** | The YAML is small; the behaviour is the real lesson |
| **You need first** | L3.3 complete |
| **You will do** | Inspect `axispay-standard`, understand `WaitForFirstConsumer`, and learn how to read PVC events |
| **Check you are done** | `make validate-lab LAB=L3.4` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- A `StorageClass` is a template for future volumes, not a volume by itself.
- The important field today is `volumeBindingMode: WaitForFirstConsumer`.
- Full version: [`labs/GETTING-STARTED.md`](../../../GETTING-STARTED.md).
</details>

---

## What you are going to do

The `StorageClass` in this lab is called `axispay-standard`.

It uses the Minikube hostpath provisioner and deliberately waits until a pod actually needs storage before deciding where the volume should live. That is what `WaitForFirstConsumer` means.

In plain English:

- **Immediate** = create the disk first, hope the scheduler later agrees
- **WaitForFirstConsumer** = let the scheduler choose a node first, then create storage in the right place

That behaviour prevents a very common failure: a pod is scheduled on one node, but the volume was created for a different node.

![PersistentVolume, PersistentVolumeClaim and StorageClass relationship](../../images/pvc-storageclass.png)

Diagram source: Kubernetes documentation/blog (CC BY 4.0), “Resizing Persistent Volumes using Kubernetes”.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/01-storageclass.yaml` | The Day 3 `StorageClass`. |
| `manifests/02-pv-ledger-archive.yaml` | Re-used here so you can compare manual and dynamic storage ideas side by side. |

---

## Step 1 — Apply the manifests again and notice what changed

Because you already created these resources in L3.3, applying them again should be safe and mostly idempotent.

**Run this:**

```bash
kubectl apply -f manifests/
```

Expected result:

```text
$ kubectl apply -f manifests/
storageclass.storage.k8s.io/axispay-standard unchanged
persistentvolume/axispay-ledger-archive unchanged
persistentvolumeclaim/ledger-archive unchanged
```

`unchanged` is healthy. It means your desired state already matches the cluster.

---

## Step 2 — Inspect the `StorageClass`

**Run this:**

```bash
kubectl get storageclass axispay-standard
kubectl describe storageclass axispay-standard
```

Expected result:

```text
$ kubectl get storageclass axispay-standard
NAME               PROVISIONER                RECLAIMPOLICY   VOLUMEBINDINGMODE      ALLOWVOLUMEEXPANSION   AGE
axispay-standard   k8s.io/minikube-hostpath   Retain          WaitForFirstConsumer   true                   16m

$ kubectl describe storageclass axispay-standard
Name:                  axispay-standard
IsDefaultClass:        No
Annotations:           <none>
Provisioner:           k8s.io/minikube-hostpath
Parameters:            <none>
AllowVolumeExpansion:  True
MountOptions:          <none>
ReclaimPolicy:         Retain
VolumeBindingMode:     WaitForFirstConsumer
Events:                <none>
```

These four fields are the big ones for this course:

- provisioner
- reclaim policy
- binding mode
- volume expansion support

---

## Step 3 — Learn the PVC event you will need later today

You will use this exact inspection pattern in L3.5 and INC-3.

**Run this after your first stateful workload creates a claim:**

```bash
kubectl describe pvc data-postgres-0 -n axispay-data
```

Expected result when everything is normal but the pod has not started yet:

```text
$ kubectl describe pvc data-postgres-0 -n axispay-data
Name:          data-postgres-0
Namespace:     axispay-data
StorageClass:  axispay-standard
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
  Type    Reason                Age   From                         Message
  ----    ------                ----  ----                         -------
  Normal  WaitForFirstConsumer  5s    persistentvolume-controller  waiting for first consumer to be created before binding
```

That message is **not a fault**. It means the storage system is waiting for the scheduler to choose the node.

### Compare that with a real failure

```text
$ kubectl describe pvc data-postgres-0 -n axispay-data
Name:          data-postgres-0
Namespace:     axispay-data
StorageClass:  axispay-fast
Status:        Pending
Events:
  Type     Reason              Age                From                         Message
  ----     ------              ----               ----                         -------
  Warning  ProvisioningFailed  7s (x4 over 28s)  persistentvolume-controller  storageclass.storage.k8s.io "axispay-fast" not found
```

Why: the claim is asking for a `StorageClass` that does not exist.

Fix: correct the `storageClassName` and re-create the claim or workload.

---

---

## If something went wrong

If you only remember one storage debugging rule from this lab, make it this one:

- `Pending` by itself is not enough information
- the **Events** section in `kubectl describe pvc ...` tells you whether the wait is normal or broken

When you later see `waiting for first consumer to be created before binding`, that is healthy `WaitForFirstConsumer` behaviour. When you see `storageclass.storage.k8s.io "..." not found`, that is a real fault.

## Cheat Sheet / Tips & Tricks

Quick commands:
- `kubectl get storageclass axispay-standard` — confirm the shared Day 3 storage template exists.
- `kubectl describe storageclass axispay-standard` — inspect `provisioner`, `reclaimPolicy`, `allowVolumeExpansion`, and `volumeBindingMode`.
- `kubectl get storageclass axispay-standard -o yaml` — see the full spec when the summary table is too short.
- `kubectl describe pvc data-postgres-0 -n axispay-data` — read the exact PVC event that explains a wait or failure.
- `kubectl get pvc -n axispay-data` — watch when dynamic claims move from `Pending` to `Bound`.

Tips & tricks:
- A `StorageClass` is a template for future volumes, not a disk by itself.
- `WaitForFirstConsumer` is usually healthy. It means Kubernetes is waiting for a pod to be scheduled before creating storage.
- If you see `ProvisioningFailed` with `storageclass.storage.k8s.io "..." not found`, the `storageClassName` is wrong, not the cluster.
- Dynamically created PVs only appear after a workload creates a PVC and a pod actually needs it.

---

## Check your work

**Run this:**

```bash
make validate-lab LAB=L3.4
```

Expected result:

```text
$ make validate-lab LAB=L3.4

L3.4 — StorageClass and dynamic provisioning
----------------------------------------------------------------
  ✓ StorageClass axispay-standard exists
  ✓ reclaimPolicy = Retain
  ✓ volumeBindingMode = WaitForFirstConsumer

Dynamically provisioned volumes exist
----------------------------------------------------------------
  ✓ 3 PV(s) provisioned by axispay-standard

✓ L3.4 PASSED — 4/4 checks
```

If the last check fails before you have completed L3.5, that is expected. The `StorageClass` exists first; the dynamically provisioned PVs appear when PostgreSQL, Redis, and RabbitMQ claim storage.
