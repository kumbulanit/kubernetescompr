# L1.2 · Namespaces — Giving AxisPay Somewhere To Live

| | |
|---|---|
| **Time** | 30 minutes |
| **Difficulty** | Your first objects. Still gentle. |
| **You need first** | [L1.1](../L1.1-cluster-recon/) finished |
| **You will create** | 3 namespaces |
| **Check you are done** | `make validate-lab LAB=L1.2` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>Tab</kbd> completes filenames. <kbd>↑</kbd> repeats the last command.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../../GETTING-STARTED.md).
</details>

---

## What you are going to do

Right now your cluster has nowhere to put AxisPay. Everything you create would land in a namespace called `default`, mixed in with everything else.

You are going to create **three namespaces** — think of them as three rooms in a building — and label them. The labelling is the part that matters. On Thursday you will write firewall rules that say "nothing in this room may talk to that room", and those rules find the rooms **by their labels**. On Friday, access control uses the same labels again.

So this is a small lab that decides whether two later days work.

You will also find out something that surprises most people: **namespaces separate names, not networks.** Two rooms, no wall between them — the wall comes on Thursday.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get nodes` | Three nodes, all `Ready` |

If either fails, go back to [L1.1](../L1.1-cluster-recon/).

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/01-namespaces.yaml` | The three namespaces you are about to create. You will read it before applying it. |

---

## Step 1 — See what is there already

**Why we are doing this.** Before you add anything, know what exists. This is a habit worth forming: it is the difference between "I created that" and "I think I created that".

**Run this:**

```bash
kubectl get namespaces
```

You can shorten `namespaces` to `ns`. Both work.

**What you should see:**

```
NAME              STATUS   AGE
default           Active   20m
kube-node-lease   Active   20m
kube-public       Active   20m
kube-system       Active   20m
```

**What that means.** Four namespaces, all created by Kubernetes itself:

| Namespace | What it is for |
|---|---|
| `default` | Where your objects go if you do not say otherwise. **Do not use it for real work** — it has no labels, no policy, and no meaning. |
| `kube-system` | Kubernetes' own machinery. You looked in here in L1.1. |
| `kube-public` | Readable by anyone, even unauthenticated. Almost always empty. |
| `kube-node-lease` | Internal bookkeeping — how nodes report they are alive. |

None of yours yet. Let's fix that.

---

## Step 2 — Read the file before you apply it

**Why we are doing this.** You are about to tell your cluster to create things. **Read what you are about to apply.** This is not a lecture about carefulness — it is the fastest way to learn what the fields mean, and it takes twenty seconds.

**Run this:**

```bash
cat manifests/01-namespaces.yaml
```

You will see three blocks separated by `---`. Here is the first one, explained line by line:

```yaml
apiVersion: v1                                    # ①
kind: Namespace                                   # ②
metadata:                                         # ③
  name: axispay-edge                              # ④
  labels:                                         # ⑤
    app.kubernetes.io/part-of: axispay
    axispay.io/zone: edge
    axispay.io/pci-scope: "false"
    axispay.io/day-introduced: "1"
    kubernetes.io/metadata.name: axispay-edge
  annotations:                                    # ⑥
    axispay.io/description: >-
      DMZ. The only namespace permitted to receive traffic from outside the
      cluster. Must never reach the data tier directly.
```

| | Field | What it means |
|---|---|---|
| ① | `apiVersion` | Which version of the Kubernetes API this object belongs to. `v1` is the original core API — Pods, Services and Namespaces all live there. Newer object types have longer values like `apps/v1`. |
| ② | `kind` | What sort of object this is. |
| ③ | `metadata` | Information *about* the object: its name, its labels. |
| ④ | `name` | What it is called. Must be lowercase, and unique among namespaces. |
| ⑤ | `labels` | **Key/value tags you can search on.** This is the important one — see below. |
| ⑥ | `annotations` | Also key/value, but *not* searchable. For notes, descriptions, tool configuration. |

**Almost every Kubernetes object has these same four top-level fields** — `apiVersion`, `kind`, `metadata` and usually `spec`. Once you have seen it once, every new object type is less strange.

### Why labels matter more than they look

A label is not a comment. It is how other objects **find** this one.

- On **Thursday**, a network rule will say *"allow traffic from any namespace labelled `zone: edge`"*. It never mentions the namespace by name — it matches the label.
- On **Friday**, access control will grant permissions to namespaces by label.
- The `pci-scope` label marks which namespaces hold card data. That single tag decides which security controls apply to what.

Get the labels wrong on Monday and Thursday quietly fails. That is why they are here on day one.

> **A note on the quotes.** `pci-scope: "false"` has quotes; `zone: edge` does not. In YAML, an unquoted `false` is a **boolean**, but Kubernetes label values must be **strings**. Without the quotes, this file is rejected. This will catch you at least once this week — remember it.

---

## Step 3 — Create them

**Run this:**

```bash
kubectl apply -f manifests/01-namespaces.yaml
```

`apply -f <file>` means "read this file and make the cluster match it".

**What you should see:**

```
namespace/axispay-edge created
namespace/axispay-core created
namespace/axispay-async created
```

**What that means.** Three namespaces now exist. The word `created` tells you they were new.

**Now run exactly the same command again:**

```bash
kubectl apply -f manifests/01-namespaces.yaml
```

```
namespace/axispay-edge unchanged
namespace/axispay-core unchanged
namespace/axispay-async unchanged
```

**`unchanged`.** Nothing broke, nothing was duplicated, no error.

**This is the single most important idea in Kubernetes and you have just seen it.** You do not give Kubernetes instructions ("create this"); you give it a **description of what you want**, and it works out what to do. Applying the same file twice is safe. Applying it a hundred times is safe. This property is called being *declarative*, and everything this week depends on it.

**Confirm:**

```bash
kubectl get ns --show-labels
```

`--show-labels` adds a column with all the labels — useful for checking they landed.

**What you should see:**

```
NAME            STATUS   AGE   LABELS
axispay-async   Active   30s   app.kubernetes.io/part-of=axispay,axispay.io/zone=async,...
axispay-core    Active   30s   app.kubernetes.io/part-of=axispay,axispay.io/zone=core,...
axispay-edge    Active   30s   app.kubernetes.io/part-of=axispay,axispay.io/zone=edge,...
default         Active   21m   kubernetes.io/metadata.name=default
...
```

**Now search by label**, which is the whole reason they exist:

```bash
kubectl get ns -l axispay.io/pci-scope=true
```

```
NAME           STATUS   AGE
axispay-core   Active   45s
```

One namespace holds cardholder data. That query is the beginning of an audit answer.

---

## Step 4 — Namespaced or not?

**Why we are doing this.** Some objects live inside a namespace; others belong to the whole cluster. Mixing them up produces confusing errors, and on Day 5 it is the difference between granting someone access to one room and granting them access to the building.

**Run this:**

```bash
kubectl api-resources --namespaced=true | head -8
```

```
NAME         SHORTNAMES   APIVERSION   NAMESPACED   KIND
configmaps   cm           v1           true         ConfigMap
endpoints    ep           v1           true         Endpoints
events       ev           v1           true         Event
pods         po           v1           true         Pod
services     svc          v1           true         Service
```

**And now the other kind:**

```bash
kubectl api-resources --namespaced=false | head -8
```

```
NAME               SHORTNAMES   APIVERSION   NAMESPACED   KIND
namespaces         ns           v1           false        Namespace
nodes              no           v1           false        Node
persistentvolumes  pv           v1           false        PersistentVolume
storageclasses     sc           storage.k8s.io/v1  false  StorageClass
```

**What that means.** Pods and Services live *in* a namespace. Nodes and Namespaces do not — a physical machine is not inside a folder, and a folder is not inside itself.

**See it fail on purpose:**

```bash
kubectl get nodes -n axispay-core
```

You still get all three nodes. The `-n` was silently ignored, because nodes are not namespaced. Kubernetes does not warn you — it just does nothing with the flag. Knowing which objects are namespaced saves you from puzzling over that.

---

## Step 5 — Stop typing `-n axispay-core` every time

**Why we are doing this.** You are about to type `-n axispay-core` about two hundred times this week. You can set a default instead.

**Run this:**

```bash
kubectl config set-context --current --namespace=axispay-core
```

**What you should see:**

```
Context "axispay" modified.
```

**Check it took:**

```bash
kubectl config view --minify | grep namespace
```

```
    namespace: axispay-core
```

**What that means.** `kubectl get pods` now means `kubectl get pods -n axispay-core`. Your "current folder", as far as kubectl is concerned.

> **This is also a classic way to confuse yourself.** When something is missing and you are certain you created it, check which namespace you are pointed at before you check anything else. The labs still write `-n <namespace>` explicitly so that they work no matter what your default is.

**To go back to `default` later:**

```bash
kubectl config set-context --current --namespace=default
```

---

## Step 6 — Find out what a namespace does *not* do

**Why we are doing this.** Nearly everyone assumes a namespace is a security boundary. It is not, and believing otherwise is how flat, wide-open clusters get built. Let's prove it.

**Run this:** it starts a small throwaway pod in one namespace and tries to reach across to another.

```bash
kubectl run probe --rm -it --restart=Never \
  --image=busybox:1.37 -n axispay-edge \
  -- nslookup kubernetes.default.svc.cluster.local
```

Breaking that down, since it is the first long command you have met:

| Part | What it does |
|---|---|
| `kubectl run probe` | Create a pod called `probe` |
| `--rm` | Delete it automatically when it finishes |
| `-it` | Interactive — connect my terminal to it |
| `--restart=Never` | Run once; do not keep restarting it |
| `--image=busybox:1.37` | Use this tiny Linux image |
| `-n axispay-edge` | Put it in the edge namespace |
| `-- nslookup ...` | Everything after `--` is the command to run inside |

**What you should see:**

```
Server:    10.96.0.10
Address 1: 10.96.0.10 kube-dns.kube-system.svc.cluster.local

Name:      kubernetes.default.svc.cluster.local
Address 1: 10.96.0.1 kubernetes.default.svc.cluster.local
pod "probe" deleted
```

**What that means.** A pod in `axispay-edge` just looked up — and could have connected to — something in a completely different namespace. **No wall.**

So what *is* a namespace?

| A namespace **does** | A namespace **does not** |
|---|---|
| Keep names unique — you can have a `payment-service` in each | Block network traffic between namespaces |
| Give you a scope for quotas and limits (Day 2) | Stop anyone reading objects in another namespace |
| Give access control something to attach to (Day 5) | Isolate anything by itself |
| Give network rules something to select on (Day 4) | |

**A namespace is a name for a boundary. It is not the boundary.** You build the actual boundary on Thursday with NetworkPolicy and on Friday with RBAC — and both of them will find these namespaces **by the labels you just applied**.

---

## Did it work?

```bash
make validate-lab LAB=L1.2
```

**What you should see:**

```
✓ L1.2 PASSED — 11/11 checks
```

It checks the three namespaces exist and carry the right labels — because the labels are what Thursday and Friday depend on.

---

## Clean up

Nothing to clean up — these namespaces stay for the rest of the week.

If the `probe` pod from Step 6 somehow survived:

```bash
kubectl delete pod probe -n axispay-edge --ignore-not-found
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `error: the path "manifests/01-namespaces.yaml" does not exist` | You are in the wrong folder | `cd ~/kubernetes/labs/day1/L1.2-namespaces` then retry, or use the full path from the repo root |
| `error validating data: unknown field "labels"` | Indentation. `labels` must sit under `metadata` | YAML cares about spaces. Compare with the file as shipped |
| `Invalid value: "false": must be a string` | Missing quotes on a boolean-looking label | `pci-scope: "false"` — with quotes |
| Namespace stuck `Terminating` | Something inside it will not delete | `kubectl get all -n <name>`. It usually clears in under a minute |
| `kubectl get pods` shows nothing after Step 5 | You are pointed at an empty namespace | That is correct — nothing is deployed yet. It arrives in L1.3 |
| `nslookup` says `can't resolve` | Cluster DNS is unhappy | `kubectl get pods -n kube-system -l k8s-app=kube-dns` — CoreDNS should be `Running` |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/01-foundations-and-core-objects/solutions.md).

**1.** Create a fourth namespace, `axispay-data`, **without looking at the supplied YAML**. It must carry `zone=data`, `pci-scope=true`, `day-introduced=1` and the standard `part-of` label. The validator checks for it.

**2.** You are asked to give a contractor read-only access to `axispay-edge` and nothing else. Which kinds of object would you need to create, and would any of them be cluster-scoped rather than namespaced? Write your answer down — you will build it on Day 5 and can check yourself then.

**3.** `axispay-edge` is labelled `pci-scope: "false"` even though every card payment passes through it. Explain why, in two sentences. It hinges on one word, and it is a real audit argument.

### Bonus

```bash
kubectl get namespace axispay-core -o yaml
```

Compare what comes back with the file you applied. Kubernetes has added fields you never wrote — `uid`, `resourceVersion`, `creationTimestamp`, and a `status` block.

**You wrote `spec` — what you want. Kubernetes wrote `status` — what is actually true.** Every object works this way, and the whole system is the machinery that drives the second towards the first. You will meet this idea properly in the next lab.

---

## What you built

- **Three namespaces** — `axispay-edge`, `axispay-core`, `axispay-async` — labelled so that Thursday's network rules and Friday's access control can find them
- **The habit of reading a manifest before applying it**
- **Proof that `apply` is safe to repeat** — the declarative model, seen rather than described
- **The knowledge that namespaces do not isolate anything on their own** — which is why the rest of the week exists

**Next:** [L1.3 — Your first pod](../L1.3-first-pod/) — and why you must never run one in production.
