# L3.4 · StorageClasses — Stop Creating Volumes By Hand

| | |
|---|---|
| **Time** | 35 minutes |
| **Difficulty** | One field does the interesting work |
| **You need first** | [L3.3](../L3.3-persistent-volumes/) finished |
| **You will create** | 2 StorageClasses |
| **Check you are done** | `make validate-lab LAB=L3.4` |

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

In L3.3 you created a PersistentVolume by hand. That does not scale — nobody wants to hand-craft a volume every time a team deploys something.

A **StorageClass** lets you ask for storage and have it created for you. You will use one, then deliberately misconfigure a single field and produce a pod that can never be scheduled — because that field is the difference between storage that works and storage that quietly corners you.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get sc` | At least `standard` |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | AxisPay's StorageClasses and a demo claim |

---

## Step 1 — What exists already

```bash
kubectl get storageclass
```

```
NAME                 PROVISIONER                RECLAIMPOLICY   VOLUMEBINDINGMODE
standard (default)   k8s.io/minikube-hostpath   Delete          Immediate
```

**`(default)`** means a PVC that names no class gets this one. **`Delete`** means its volumes are destroyed with the claim. Fine for scratch; wrong for a ledger.

---

## Step 2 — Read AxisPay's own

```bash
cat manifests/*storageclass*.yaml
```

```yaml
kind: StorageClass
metadata:
  name: axispay-standard
provisioner: k8s.io/minikube-hostpath   # ① who creates the volume
reclaimPolicy: Retain                   # ② inherited by every volume it makes
volumeBindingMode: WaitForFirstConsumer # ③ THE IMPORTANT ONE
allowVolumeExpansion: true              # ④
```

| | What it means |
|---|---|
| ① | The driver that actually provisions storage. On a cloud this is EBS, Persistent Disk, or a CSI driver. |
| ② | Every PV created from this class inherits `Retain`. Set the policy once, here, rather than on every volume. |
| ③ | **Wait until a pod needs it before deciding where it lives.** Step 4 shows what happens without this. |
| ④ | PVCs can be grown later. Shrinking is not supported by any driver. |

```bash
kubectl apply -f manifests/
kubectl get sc
```

---

## Step 3 — Provision with no PV in sight

```bash
kubectl apply -f manifests/
kubectl get pvc -n axispay-core
kubectl get pv | grep -i pvc
```

**You never wrote a PersistentVolume.** The provisioner created one when the claim was made, with the class's settings baked in.

```bash
kubectl get pv -o custom-columns='NAME:.metadata.name,POLICY:.spec.persistentVolumeReclaimPolicy,CLASS:.spec.storageClassName' | grep axispay
```

`Retain`, inherited from ②.

---

## Step 4 — `WaitForFirstConsumer`, and the failure it prevents

**Why we are doing this.** This is the one field worth understanding properly, and the only way is to break it.

```bash
kubectl get sc axispay-standard -o yaml | sed 's/^  name: axispay-standard/  name: axispay-immediate/; s/WaitForFirstConsumer/Immediate/' \
  | grep -v 'uid:\|resourceVersion:\|creationTimestamp:\|selfLink:' | kubectl apply -f -

cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: immediate-demo
  namespace: axispay-core
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: axispay-immediate
  resources:
    requests:
      storage: 128Mi
YAML

sleep 8
kubectl get pvc immediate-demo -n axispay-core
kubectl get pv -o custom-columns='NAME:.metadata.name,NODE:.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0]' | grep -v '<none>'
```

**The volume is already bound, and pinned to one specific node** — chosen before any pod existed.

**Now ask for a pod somewhere else:**

```bash
NODE=$(kubectl get nodes -o jsonpath='{.items[2].metadata.name}')
kubectl run pinned -n axispay-core --image=busybox:1.37 --restart=Never \
  --overrides="{\"spec\":{\"nodeName\":\"$NODE\",\"containers\":[{\"name\":\"x\",\"image\":\"busybox:1.37\",\"command\":[\"sleep\",\"300\"],\"volumeMounts\":[{\"name\":\"d\",\"mountPath\":\"/data\"}]}],\"volumes\":[{\"name\":\"d\",\"persistentVolumeClaim\":{\"claimName\":\"immediate-demo\"}}]}}"
sleep 10
kubectl describe pod pinned -n axispay-core | tail -6
```

```
Warning  FailedScheduling  ...  0/3 nodes are available:
1 node(s) had volume node affinity conflict, 2 node(s) didn't match Pod's node affinity.
```

**`volume node affinity conflict`.** The volume is on node A, the pod must be on node B, and neither can move. The pod stays `Pending` forever.

**`WaitForFirstConsumer` inverts the order:** schedule the pod first, then provision the volume wherever it landed. The conflict becomes impossible.

```bash
kubectl delete pod pinned -n axispay-core --ignore-not-found
kubectl delete pvc immediate-demo -n axispay-core --ignore-not-found
kubectl delete sc axispay-immediate --ignore-not-found
```

> **Learn that error message.** It is common, the wording gives no hint about the cause, and now you know it means "someone used `Immediate` on node-local storage".

---

## Step 5 — Expansion

```bash
kubectl get sc axispay-standard -o jsonpath='{.allowVolumeExpansion}'; echo
```

To grow a volume you edit the **PVC** — never the PV:

```bash
kubectl patch pvc <name> -n <ns> -p '{"spec":{"resources":{"requests":{"storage":"2Gi"}}}}'
```

During the resize the PVC shows `FileSystemResizePending`, and on some drivers the pod must restart for the filesystem to grow. **Shrinking is not supported by anything.** Size generously; you can always grow.

---

## Step 6 — Which class for which workload

| Workload | Class | Policy | Why |
|---|---|---|---|
| PostgreSQL — the ledger | `axispay-standard` | `Retain` | Losing it is unrecoverable |
| Redis — a cache | `standard` | `Delete` | Rebuilt from source data in seconds |
| Prometheus — 6h of metrics | `standard` | `Delete` | Operational data, not records |

**The rule:** `Retain` for anything you would be sorry to lose; `Delete` for anything you would regenerate. `Retain` everywhere leaves orphaned volumes accumulating until somebody deletes them by hand — a worse process than automating it.

---

## Did it work?

```bash
make validate-lab LAB=L3.4
```

---

## Clean up

```bash
kubectl delete sc axispay-immediate --ignore-not-found
kubectl delete pvc immediate-demo -n axispay-core --ignore-not-found
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| PVC `Pending` with `WaitForFirstConsumer` | Correct — no pod uses it yet | Create the pod |
| `volume node affinity conflict` | `Immediate` binding on node-local storage | See Step 4. Use `WaitForFirstConsumer` |
| `no persistent volumes available` | No PV matches and no provisioner | Check the class name is spelled right |
| Expansion does nothing | `allowVolumeExpansion: false`, or driver limitation | Check the class; some drivers need a pod restart |
| Two default classes | Both marked default | Only one may be; unmark one |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/03-storage-and-configuration/solutions.md).

**1.** Reproduce the `volume node affinity conflict` from Step 4 from memory, and capture the exact error.

**2.** Expand a PVC from 512Mi to 1Gi without recreating it. Which field, and what does `status.conditions` show while it happens?

**3.** Both AxisPay classes use `Retain`. Name a workload here where `Delete` would be the better choice, and justify it.

---

## What you built

- **Storage provisioned on demand**, with no hand-written PVs
- **Policy set once on the class** and inherited by every volume
- **`volume node affinity conflict` produced deliberately**, so the message means something next time
- **A clear rule** for `Retain` versus `Delete`

**Next:** [L3.5 — The data tier](../L3.5-data-tier/) — PostgreSQL, Redis and RabbitMQ, with real data in them.
