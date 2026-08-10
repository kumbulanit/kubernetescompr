# L1.1 · Look Around Your Cluster

| | |
|---|---|
| **Time** | 35 minutes |
| **Difficulty** | Your first lab — nothing is assumed |
| **You need first** | [Getting started](../../GETTING-STARTED.md) completed, and `make cluster` finished |
| **You will change** | Nothing. This lab only looks. |
| **Check you are done** | `make validate-lab LAB=L1.1` |

> **Nothing in this lab can break anything.** Every command here reads; none of them writes. Type freely.

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd> to open one.
- Copy and paste in the Ubuntu terminal is <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> and <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> **stops** whatever is running. Step 5 asks you to use it.
- <kbd>Tab</kbd> completes a half-typed filename. <kbd>↑</kbd> brings back the last command.
- The grey boxes below are commands. If a line starts with `$`, that is the prompt — **do not type it**.

The full version, including how to install everything, is in [`labs/GETTING-STARTED.md`](../../GETTING-STARTED.md).
</details>

---

## What you are going to do

You have a Kubernetes cluster running on your machine. Right now it is a black box.

In the next 35 minutes you will open it up: find out how many machines it has, what is running inside it, where the pieces live, and — the important part — **watch a command travel from your keyboard to the cluster and back**. By the end you will know that `kubectl` is not magic. It is a program that makes HTTPS requests, and everything else follows from that.

You will not create anything. You will not break anything. You are getting oriented.

---

## What you need before you start

Run each of these. If any gives a different answer, fix it before continuing.

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl version --client` | `Client Version: v1.36.2` |
| 3 | `kubectl get nodes` | Three lines, all saying `Ready` |

**If #1 fails** with `no such file or directory`, you have not cloned the course files yet — see [Getting started §5](../../GETTING-STARTED.md).

**If #3 says `connection refused`** or hangs, your cluster is not running:

```bash
minikube start -p axispay
```

Wait for it to finish, then try again.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |

No YAML this time — you are not creating anything yet. Every later lab has a `manifests/` folder sitting next to this file.

---

## Step 1 — Check your two versions match

**Why we are doing this.** `kubectl` runs on your laptop. The cluster runs somewhere else — in a container, on your same machine. They are separate programs that talk over the network, and **they each have their own version number**. If those drift too far apart, commands start failing in ways that make no sense.

**Run this:**

```bash
kubectl version
```

**What you should see:**

```
Client Version: v1.36.2
Kustomize Version: v5.5.0
Server Version: v1.36.2
```

**What that means.**

- **Client Version** — the `kubectl` program on your machine.
- **Server Version** — the Kubernetes API server running in your cluster.

These must be within **one minor version** of each other. The minor version is the middle number: in `v1.36.2`, the minor version is `36`. So a v1.35 client against a v1.36 server is fine; a v1.34 client is not supported and will misbehave in confusing ways.

> **If Server Version is missing** and you see `couldn't get current server API group list`, `kubectl` cannot reach your cluster. Run `minikube status -p axispay`. If it does not say `Running`, run `minikube start -p axispay`.

---

## Step 2 — Find out what your cluster is made of

**Why we are doing this.** A Kubernetes cluster is a group of machines that pretend to be one big computer. Those machines are called **nodes**. Before you put anything on a cluster you should know how many nodes it has and how big they are — because on Day 2 you will be deciding how much CPU and memory each service is allowed, and those numbers have to fit.

**Run this:**

```bash
kubectl get nodes -o wide
```

`-o wide` means "output wide" — show me the extra columns.

**What you should see:**

```
NAME          STATUS   ROLES           AGE   VERSION   INTERNAL-IP    OS-IMAGE
axispay       Ready    control-plane   12m   v1.36.2   192.168.49.2   Ubuntu 22.04.5 LTS
axispay-m02   Ready    <none>          11m   v1.36.2   192.168.49.3   Ubuntu 22.04.5 LTS
axispay-m03   Ready    <none>          10m   v1.36.2   192.168.49.4   Ubuntu 22.04.5 LTS
```

**What that means.**

| Column | What it tells you |
|---|---|
| `NAME` | What the node is called. Yours will match. |
| `STATUS` | `Ready` means it can accept work. Anything else means it cannot. |
| `ROLES` | `control-plane` is the node that runs Kubernetes itself. `<none>` means it is a plain worker — it just runs your applications. |
| `AGE` | How long since it joined. |
| `INTERNAL-IP` | Its address on the cluster's private network. |

So: **three machines, one in charge, two doing the work.**

**Now find out how big they are:**

```bash
kubectl describe node axispay-m02 | grep -A 6 "Allocatable:"
```

`describe` prints everything Kubernetes knows about one object. `grep -A 6` means "find this line and show the 6 lines after it", because the full output is about 80 lines and you only want this part.

**What you should see:**

```
Allocatable:
  cpu:                2
  ephemeral-storage:  17734596Ki
  hugepages-2Mi:      0
  memory:             3925424Ki
  pods:               110
```

**What that means.** This node can offer **2 CPUs and about 3.9 GB of memory** to your applications, and run at most 110 pods.

Note the word **Allocatable**, not Capacity. Capacity is what the machine physically has; allocatable is what is left after Kubernetes reserves some for itself. The scheduler only ever looks at allocatable — which is why a node with "4 GB" cannot actually run 4 GB of applications.

> **Write down your three nodes' allocatable CPU and memory.** You will use these numbers on Day 2.

---

## Step 3 — Find Kubernetes itself

**Why we are doing this.** Kubernetes is not one program — it is about five, and they run *inside the cluster they manage*. Seeing them makes the rest of the week much less mysterious.

**Run this:**

```bash
kubectl get pods -n kube-system
```

`-n kube-system` means "in the namespace called kube-system". A **namespace** is a folder for cluster objects; `kube-system` is where Kubernetes keeps its own machinery. You will create your own namespaces in the next lab.

**What you should see** (yours will differ slightly):

```
NAME                              READY   STATUS    RESTARTS   AGE
calico-node-8kqzn                 1/1     Running   0          12m
calico-node-p2wrx                 1/1     Running   0          11m
coredns-668d6bf9bc-mn4qt          1/1     Running   0          12m
etcd-axispay                      1/1     Running   0          12m
kube-apiserver-axispay            1/1     Running   0          12m
kube-controller-manager-axispay   1/1     Running   0          12m
kube-proxy-x9v2n                  1/1     Running   0          12m
kube-scheduler-axispay            1/1     Running   0          12m
```

**What that means.** These are the parts of Kubernetes. You will meet each properly during the week, but in one line each:

| Pod | What it does |
|---|---|
| `kube-apiserver` | **The front door.** Every command you type goes here. It is the only thing that talks to the database. |
| `etcd` | **The database.** Every object in your cluster is stored here. |
| `kube-scheduler` | Decides **which node** each new pod should run on. |
| `kube-controller-manager` | Runs the loops that make reality match what you asked for. |
| `coredns` | The cluster's phone book — turns names into addresses. |
| `kube-proxy` | Makes service addresses work on each node. |
| `calico-node` | The network. Gives every pod its own IP address. |

**The `READY` column reads `1/1`** — one container ready, out of one container that should be. That distinction matters more than it looks, and it is the subject of half of Day 2.

### A question worth sitting with

The API server creates everything in Kubernetes. But the API server is itself a pod. **So what created the API server?**

Find out:

```bash
minikube -p axispay ssh -- sudo ls -1 /etc/kubernetes/manifests/
```

`minikube ssh` logs you into the node itself and runs a command there.

```
etcd.yaml
kube-apiserver.yaml
kube-controller-manager.yaml
kube-scheduler.yaml
```

**There they are, as files on disk.** These are **static pods**: the agent on the node (the kubelet) watches that directory and runs whatever it finds, without asking the API server at all. That is the bootstrap answer — the node starts the API server from a file, and everything else can then go through the API server.

---

## Step 4 — Check the network plugin (do not skip this)

**Why we are doing this.** Kubernetes does not implement networking itself. It delegates it to a plugin, and this course uses one called **Calico**. On Thursday you will write security rules that block traffic between services — and **those rules only do anything if Calico is installed**. Without it they apply cleanly and enforce nothing, which is the worst possible outcome for a security exercise.

Checking now costs ten seconds. Finding out on Thursday costs a morning.

**Run this:**

```bash
kubectl get daemonset -n kube-system calico-node
```

**What you should see:**

```
NAME          DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   AGE
calico-node   3         3         3       3            3           12m
```

Three of three ready — one on each node.

> ### If this says `Error from server (NotFound)`
>
> Your cluster was built without Calico. **The network plugin cannot be changed on a running cluster.** You need to rebuild it:
>
> ```bash
> minikube delete -p axispay
> make cluster
> ```
>
> This takes about ten minutes. Do it now. If you are in a classroom, tell your instructor — it is worth checking whether everyone has the same problem.

---

## Step 5 — Watch the cluster react in real time

**Why we are doing this.** So far you have been taking still photographs. Kubernetes is a system that constantly reacts to change, and the fastest way to understand that is to watch it happen.

You need **two terminal windows** for this. Open a second one with <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd>.

**In terminal 1, start watching:**

```bash
kubectl get events -A --watch
```

`-A` means all namespaces. `--watch` means "do not exit — keep printing as things happen". The terminal will look like it has hung. It has not; it is waiting.

**In terminal 2, make something happen:**

```bash
kubectl create namespace recon-test
```

**Look at terminal 1.** New lines appeared the moment you pressed Enter.

**Now clean it up, still in terminal 2:**

```bash
kubectl delete namespace recon-test
```

More lines appear in terminal 1.

**Stop the watch in terminal 1** with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

**What that means.** Events are Kubernetes telling you what it decided and why. When something is not working, **events are the first place to look** — before logs, before anything else. They are step 2 of the six-step method you will use all week.

---

## Step 6 — See that `kubectl` is just a web client

**Why we are doing this.** This is the single most demystifying thing in the whole course.

**Run this:**

```bash
kubectl get nodes -v=6
```

`-v=6` means "verbosity level 6" — show me what you are doing under the hood.

**What you should see:**

```
I0810 09:14:02.113456   12345 loader.go:395] Config loaded from file:  /home/you/.kube/config
I0810 09:14:02.156789   12345 round_trippers.go:553] GET https://192.168.49.2:8443/api/v1/nodes?limit=500 200 OK in 31 milliseconds
NAME          STATUS   ROLES           AGE   VERSION
axispay       Ready    control-plane   14m   v1.36.2
...
```

**What that means.** Read that middle line again:

```
GET https://192.168.49.2:8443/api/v1/nodes  200 OK  in 31 milliseconds
```

That is an ordinary HTTPS request. **`kubectl` read a config file to find out where the cluster is, made one web request, and printed the answer.** There is no magic, no agent, no daemon on your machine. Everything you do this week is HTTPS calls to one address.

Two consequences worth carrying with you:

- Anything `kubectl` can do, any program can do. That is how the parts of Kubernetes talk to each other too.
- If a command fails, it failed as an HTTP request — and `-v=6` will show you the status code.

**Where did it get the address?**

```bash
cat ~/.kube/config
```

This file holds your clusters, your credentials, and which one you are currently pointed at. When someone says "it works on my machine", this file is usually why.

---

## Step 7 — Ask the cluster what it can do

**Why we are doing this.** Kubernetes has a lot of object types, and you cannot memorise them. You do not need to — the cluster will tell you.

**Run this:**

```bash
kubectl api-resources | head -20
```

**What you should see:**

```
NAME                     SHORTNAMES   APIVERSION      NAMESPACED   KIND
bindings                              v1              true         Binding
configmaps               cm           v1              true         ConfigMap
endpoints                ep           v1              true         Endpoints
events                   ev           v1              true         Event
namespaces               ns           v1              true         Namespace
nodes                    no           v1              false        Node
persistentvolumeclaims   pvc          v1              true         PersistentVolumeClaim
pods                     po           v1              true         Pod
services                 svc          v1              true         Service
...
```

**What that means.** Two columns are worth noticing now:

- **SHORTNAMES** — `kubectl get po` is the same as `kubectl get pods`. You will use `po`, `svc`, `ns` and `deploy` constantly.
- **NAMESPACED** — `true` means the object lives inside a namespace; `false` means it belongs to the whole cluster. Nodes are `false` because a machine is not inside a folder. This distinction matters a lot on Day 5 when you set up access control.

**How many types are there?**

```bash
kubectl api-resources | wc -l
```

Around 60 on a fresh cluster. You will use about fifteen.

### The command that will answer most of your questions this week

```bash
kubectl explain pod.spec.containers.resources
```

**What you should see:**

```
KIND:       Pod
VERSION:    v1

FIELD: resources <ResourceRequirements>

DESCRIPTION:
    Compute Resources required by this container. Cannot be updated. ...
```

**This is offline documentation for every field of every object**, built into `kubectl`. No internet needed. When you are staring at a YAML file wondering what a field does, `kubectl explain` is faster than searching the web and it is always right for *your* version.

Try one more, with `--recursive` to see everything underneath:

```bash
kubectl explain pod.spec.containers.livenessProbe --recursive
```

Do not try to understand it yet — you will meet probes on Day 2. The point is that it is there.

---

## Did it work?

```bash
make validate-lab LAB=L1.1
```

**What you should see:**

```
✓ L1.1 PASSED — 8/8 checks
```

This confirms your cluster has the right number of nodes, the right version, and Calico installed — the three things every later lab depends on.

---

## Clean up

Nothing to clean up. You only read.

If the `recon-test` namespace from Step 5 is somehow still there:

```bash
kubectl delete namespace recon-test --ignore-not-found
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `The connection to the server ... was refused` | The cluster is not running | `minikube start -p axispay` |
| `command not found: kubectl` | Not installed, or not on your PATH | [Getting started §4.2](../../GETTING-STARTED.md) |
| Only 1 node instead of 3 | Cluster built with the wrong settings | `minikube delete -p axispay && make cluster` |
| `calico-node` not found | No network plugin — Day 4 will silently fail | Rebuild the cluster. See Step 4. |
| A node says `NotReady` | It is still starting, or short of resources | Wait 60s and retry. If it persists: `kubectl describe node <name>` and read the `Conditions` section. |
| `minikube ssh` asks for a password | Wrong profile name | Include `-p axispay` |
| Terminal seems frozen after `--watch` | It is waiting, not frozen | <kbd>Ctrl</kbd>+<kbd>C</kbd> |

---

## Try this yourself

Answers are in [`solutions.md`](../../../topics/01-foundations-and-core-objects/solutions.md), but have a proper go first.

**1.** Without using `kubectl get nodes`, work out the **total** allocatable CPU and memory across your whole cluster. Then explain why allocatable is lower than capacity.

**2.** If `axispay-m03` lost power right now, which part of Kubernetes would notice first, how long would it take, and what would it do? There is a specific setting that controls the delay — find its name.

**3.** The API server is supposed to be the only component that talks to etcd. Prove it from your own cluster rather than taking it on faith.

### Bonus

```bash
kubectl get --raw /metrics | head -40
```

Every Kubernetes component publishes metrics at `/metrics` in plain text. This is the raw material that Day 5's entire monitoring stack is built on. Have a look — you are seeing Friday from Monday.

---

## What you built

Nothing yet — and that was the point. You now know:

- how many machines your cluster has and how much they can offer
- that Kubernetes itself runs as pods, and that static pods on disk solve the bootstrap problem
- that your network plugin is present, so Thursday's security labs will actually enforce something
- that events are the cluster narrating its decisions
- **that `kubectl` is a web client** — the fact that makes everything else make sense
- that `kubectl explain` will answer most of your questions without leaving the terminal

**Next:** [L1.2 — Namespaces](../L1.2-namespaces/) — where you create your first objects and give AxisPay somewhere to live.
