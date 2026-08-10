# L3.3 · Persistent Volumes — Data That Outlives the Pod

| | |
|---|---|
| **Time** | 40 minutes |
| **Difficulty** | Two objects, one binding, one common misreading |
| **You need first** | [L3.2](../L3.2-secrets/) finished |
| **You will create** | 1 PersistentVolume, 1 PersistentVolumeClaim |
| **Check you are done** | `make validate-lab LAB=L3.3` |

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

Every byte your pods have written so far has died with them. For a stateless API that is correct. For a ledger it is unacceptable.

You will watch data disappear, then create a **PersistentVolume** (the storage) and a **PersistentVolumeClaim** (the request for it), attach the claim to a pod, and prove the data survives the pod being deleted.

You will also meet `ReadWriteOnce`, which almost everybody reads wrongly the first time.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get nodes` | Three nodes, `Ready` |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | The PV, the PVC, and a pod that uses them |

---

## Step 1 — Watch data die

```bash
kubectl run ephemeral -n axispay-core --image=busybox:1.37 --restart=Never \
  -- sh -c 'echo "ledger entry 001" > /data/ledger.txt; sleep 3600'
sleep 8
kubectl exec ephemeral -n axispay-core -- cat /data/ledger.txt
kubectl delete pod ephemeral -n axispay-core
kubectl run ephemeral -n axispay-core --image=busybox:1.37 --restart=Never -- sleep 3600
sleep 8
kubectl exec ephemeral -n axispay-core -- cat /data/ledger.txt
```

```
ledger entry 001
...
cat: can't open '/data/ledger.txt': No such file or directory
```

**Gone.** A container's filesystem is part of the container. Delete the pod, delete the data.

```bash
kubectl delete pod ephemeral -n axispay-core
```

---

## Step 2 — Read the PV and the PVC

**Two objects, because two different people own them:**

```
  PersistentVolume (PV)       "Here is 2Gi of storage."      -- the platform team
  PersistentVolumeClaim (PVC) "I need 1Gi that I can write." -- the application team
                              Kubernetes matches them.
```

A pod references a **claim**, never a volume. That indirection is what lets the same manifest run against a laptop's local disk and a cloud SSD.

```bash
cat manifests/*pv*.yaml
```

```yaml
kind: PersistentVolume
spec:
  capacity:
    storage: 2Gi
  accessModes:
    - ReadWriteOnce                    # ① read this carefully
  persistentVolumeReclaimPolicy: Retain # ②
  storageClassName: axispay-local
  local:
    path: /mnt/axispay/ledger-archive
```

| | What it means |
|---|---|
| ① | **`ReadWriteOnce` means one NODE, not one pod.** Two pods on the *same* node can share it. Two pods on different nodes cannot. The mode that genuinely guarantees a single writer is `ReadWriteOncePod`. |
| ② | When the claim is deleted, **keep the data**. See Step 6. |

---

## Step 3 — Create them, and watch the binding

```bash
kubectl apply -f manifests/
kubectl get pv,pvc -n axispay-core
```

```
NAME                        CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS      CLAIM
persistentvolume/ledger-archive-pv   2Gi   RWO         Retain           Available

NAME                                  STATUS    VOLUME   CAPACITY   AGE
persistentvolumeclaim/ledger-archive  Pending                       5s
```

**`Available` and `Pending`.** They have not matched yet — because this StorageClass waits for a pod. That is `volumeBindingMode: WaitForFirstConsumer`, and L3.4 explains why it matters.

---

## Step 4 — Bind it by using it

```bash
kubectl apply -f manifests/
kubectl get pods -n axispay-core -l app=ledger-archiver
sleep 10
kubectl get pv,pvc -n axispay-core
```

```
persistentvolume/ledger-archive-pv    2Gi   RWO   Retain   Bound   axispay-core/ledger-archive
persistentvolumeclaim/ledger-archive  Bound  ledger-archive-pv   2Gi
```

**Both `Bound`.** The claim found its volume the moment a pod needed it.

**Write something:**

```bash
APOD=$(kubectl get pod -n axispay-core -l app=ledger-archiver -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $APOD -- sh -c 'echo "journal 2026-08-12 balanced" >> /archive/journal.log'
kubectl exec -n axispay-core $APOD -- cat /archive/journal.log
```

---

## Step 5 — Prove it survives

```bash
kubectl delete pod $APOD -n axispay-core
sleep 20
NEWPOD=$(kubectl get pod -n axispay-core -l app=ledger-archiver -o jsonpath='{.items[0].metadata.name}')
echo "old: $APOD    new: $NEWPOD"
kubectl exec -n axispay-core $NEWPOD -- cat /archive/journal.log
```

```
journal 2026-08-12 balanced
```

**A different pod, the same data.** That is the whole point.

**Where does it actually live?**

```bash
kubectl get pv ledger-archive-pv -o jsonpath='{.spec.local.path}'; echo
kubectl get pod $NEWPOD -n axispay-core -o jsonpath='{.spec.nodeName}'; echo
minikube -p axispay ssh -n $(kubectl get pod $NEWPOD -n axispay-core -o jsonpath='{.spec.nodeName}') \
  -- sudo cat /mnt/axispay/ledger-archive/journal.log 2>/dev/null || echo "(try the node above)"
```

**A real file on a real disk on one specific node.** Which is exactly why the replacement pod had to land on the same node — and why local storage constrains scheduling. L3.6 makes that trap explicit.

---

## Step 6 — Reclaim policy, and why it is `Retain`

```bash
kubectl delete pod -n axispay-core -l app=ledger-archiver
kubectl delete pvc ledger-archive -n axispay-core
kubectl get pv
```

```
NAME                 CAPACITY   RECLAIM POLICY   STATUS     CLAIM
ledger-archive-pv    2Gi        Retain           Released   axispay-core/ledger-archive
```

**`Released`, not `Available` — and the data is untouched.**

| Policy | On PVC deletion |
|---|---|
| `Retain` | Keep everything. The PV goes `Released` and will not rebind until a human clears it. |
| `Delete` | Delete the volume and the data. |
| `Recycle` | Deprecated. Ignore it. |

**`Retain` exists so that `kubectl delete pvc` typed in the wrong terminal is recoverable.** For a ledger that is not optional.

**Recovering it:**

```bash
kubectl patch pv ledger-archive-pv -p '{"spec":{"claimRef":null}}'
kubectl get pv
```

`Available` again. It would not rebind before because it still held a reference to the deleted claim.

```bash
kubectl apply -f manifests/
```

---

## Did it work?

```bash
make validate-lab LAB=L3.3
```

---

## Clean up

Leave the PV and PVC — L3.5 builds the real data tier on these ideas.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| PVC stuck `Pending` forever | No PV matches, or no pod is using it yet | `kubectl describe pvc <name>` — the reason is in the events |
| `volume node affinity conflict` | The volume is on one node, the pod required another | Local storage pins the pod. See L3.4 |
| PV `Released`, will not rebind | Stale `claimRef` | `kubectl patch pv <name> -p '{"spec":{"claimRef":null}}'` |
| Data missing after a pod move | It landed on a different node | That is local storage. Real clusters use network storage |
| `permission denied` writing | The container is non-root and the volume is root-owned | `fsGroup` — L3.7 |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/03-storage-and-configuration/solutions.md).

**1.** Create a PVC requesting **5Gi** against the 2Gi PV. Does `kubectl apply` fail? Where does the real error appear, and what exactly does it say?

**2.** Explain why `ReadWriteOnce` allows two pods to share a volume in some situations and not others. Then find the access mode that genuinely guarantees a single writer.

**3.** You accidentally `kubectl delete pvc ledger-archive`. Walk through exactly what happens to the PV and the data under `Retain`, and the steps to bind a new PVC to the same data.

---

## What you built

- **Data surviving a pod deletion**, watched rather than assumed
- **The PV/PVC split**, and why a pod references a claim
- **`ReadWriteOnce` correctly understood** — one node, not one pod
- **`Retain`, and the recovery from `Released`** — the reason a delete typo is survivable
- **The knowledge that local storage pins a pod to a node**, which becomes a trap in L3.6

**Next:** [L3.4 — StorageClasses](../L3.4-storageclass/) — so you stop creating PVs by hand.
