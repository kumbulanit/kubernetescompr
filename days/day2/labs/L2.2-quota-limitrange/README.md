# L2.2 · Quota and LimitRange — Governance Nobody Can Opt Out Of

| | |
|---|---|
| **Time** | 35 minutes |
| **Difficulty** | Two objects, one budget |
| **You need first** | [L2.1](../L2.1-resources/) finished |
| **You will create** | 1 ResourceQuota, 1 LimitRange |
| **Check you are done** | `make validate-lab LAB=L2.2` |

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

In L2.1 you set resources on six Deployments. Nothing forced you to. The seventh service someone adds next month will have none, and it will be `BestEffort`, and it will be the first thing killed when a node runs short.

You are going to put a **budget** on the namespace (ResourceQuota) and **defaults with guard rails** on individual containers (LimitRange). Together they mean nobody can deploy something unbounded, even by accident.

You will get rejected on purpose twice, so you know what the rejection looks like.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get pods -n axispay-core` | Pods `1/1 Running` with resources set |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/00-governance-axispay-core.yaml` | **The ResourceQuota and LimitRange.** Read this one properly. |
| `manifests/0*-deployment-*.yaml` | The six services from L2.1, so you can re-apply if needed |

---

## The two objects, and the difference

```
  ResourceQuota          A budget for the WHOLE NAMESPACE.
                         "Everything in here adds up to at most 6 CPU."
                         Rejects the object that would push you over.

  LimitRange             Rules for an INDIVIDUAL CONTAINER.
                         "If you did not say, here is a default."
                         "No single container may ask for more than 1 CPU."
```

One caps the total; the other governs each item. You need both — a quota alone lets one greedy container consume the entire budget.

---

## Step 1 — Read the budget before you apply it

```bash
cat manifests/00-governance-axispay-core.yaml
```

The ResourceQuota part:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: axispay-core-quota
  namespace: axispay-core
spec:
  hard:
    requests.cpu: "9"                 # ① total reserved CPU
    requests.memory: 5Gi
    limits.cpu: "18"                  # ② total ceiling — deliberately higher
    limits.memory: 10Gi
    pods: "40"                        # ③ object counts too
    services: "15"
```

| | What it means |
|---|---|
| ① | The sum of every container's `requests.cpu` in this namespace may not exceed 9 CPUs. |
| ② | The sum of `limits` may reach 18 — **twice the requests**. That is deliberate; see Step 6. |
| ③ | You can cap object counts as well as compute. Useful against runaway automation. |

The LimitRange part:

```yaml
apiVersion: v1
kind: LimitRange
spec:
  limits:
    - type: Container
      default:                        # ④ used if you set no limits
        cpu: 300m
        memory: 256Mi
      defaultRequest:                 # ⑤ used if you set no requests
        cpu: 50m
        memory: 64Mi
      max:                            # ⑥ nobody may ask for more than this
        cpu: "2"
        memory: 2Gi
      maxLimitRequestRatio:           # ⑦ the anti-lying rule
        cpu: 10
```

| | What it means |
|---|---|
| ④⑤ | A container with no resources block gets these. **It can no longer be `BestEffort`.** |
| ⑥ | An upper bound per container, so one workload cannot swallow the namespace budget. |
| ⑦ | Limit may be at most 10× the request. This stops `requests: 10m, limits: 2000m` — a workload that tells the scheduler it is tiny and then behaves enormously. |

---

## Step 2 — Apply it and read the budget

```bash
kubectl apply -f manifests/00-governance-axispay-core.yaml
kubectl describe resourcequota axispay-core-quota -n axispay-core
```

**What you should see:**

```
Name:            axispay-core-quota
Namespace:       axispay-core
Resource         Used   Hard
--------         ----   ----
limits.cpu       3600m  18
limits.memory    2304Mi 10Gi
pods             8      40
requests.cpu     650m   9
requests.memory  832Mi  5Gi
```

**`Used` versus `Hard`** — your current consumption against the budget. This one command answers "how much room is left", which is the question you will actually be asked.

---

## Step 3 — Get rejected, on purpose

**Why we are doing this.** So you recognise a quota rejection. It is not a crash and not a scheduling failure — it is a refusal at the front door, and the message is unusual.

```bash
kubectl create deployment greedy -n axispay-core --image=busybox:1.37 --replicas=1 -- sleep 3600
kubectl set resources deployment/greedy -n axispay-core --requests=cpu=8,memory=4Gi --limits=cpu=16,memory=8Gi
sleep 5
kubectl get deploy greedy -n axispay-core
kubectl describe deployment greedy -n axispay-core | tail -12
```

**What you should see:**

```
NAME     READY   UP-TO-DATE   AVAILABLE   AGE
greedy   0/1     0            0           20s
```

And in the description:

```
Warning  FailedCreate  ...  Error creating: pods "greedy-..." is forbidden:
exceeded quota: axispay-core-quota, requested: requests.cpu=8, used: requests.cpu=650m, limited: requests.cpu=9
```

**Read what happened carefully — this catches people out.**

The **Deployment was created**. Only the **pod** was refused. So `kubectl get deploy` shows an object that exists and is simply never becoming available, and the reason is not on the Deployment itself — it is in the events of the ReplicaSet underneath.

That is why `kubectl describe deployment` is where you look, not `kubectl get`.

```bash
kubectl delete deployment greedy -n axispay-core
```

---

## Step 4 — Watch the LimitRange fill in the blanks

```bash
kubectl run nolimits -n axispay-core --image=busybox:1.37 --restart=Never -- sleep 300
sleep 3
kubectl get pod nolimits -n axispay-core -o jsonpath='{.spec.containers[0].resources}' | jq .
kubectl get pod nolimits -n axispay-core -o jsonpath='{.status.qosClass}'; echo
```

```json
{
  "limits":   { "cpu": "300m", "memory": "256Mi" },
  "requests": { "cpu": "50m",  "memory": "64Mi" }
}
```
```
Burstable
```

**You did not write any of that.** The LimitRange added it at admission time — before the object was stored.

**This is the point of a LimitRange:** it makes `BestEffort` impossible in this namespace. Nobody can accidentally deploy something the scheduler cannot reason about.

```bash
kubectl delete pod nolimits -n axispay-core
```

---

## Step 5 — Hit the guard rails

```bash
kubectl run toobig -n axispay-core --image=busybox:1.37 --restart=Never \
  --overrides='{"spec":{"containers":[{"name":"x","image":"busybox:1.37","resources":{"requests":{"cpu":"3"},"limits":{"cpu":"4"}}}]}}' -- sleep 60
```

```
Error from server (Forbidden): pods "toobig" is forbidden:
maximum cpu usage per Container is 2, but limit is 4
```

**Rejected immediately**, at the API server, before anything was created. Compare with Step 3, where the object existed and only the pod failed later. **LimitRange rejects the object; ResourceQuota rejects the pod.** Different failure, different place to look.

Now the ratio rule:

```bash
kubectl run liar -n axispay-core --image=busybox:1.37 --restart=Never \
  --overrides='{"spec":{"containers":[{"name":"x","image":"busybox:1.37","resources":{"requests":{"cpu":"10m"},"limits":{"cpu":"1500m"}}}]}}' -- sleep 60
```

```
Error from server (Forbidden): cpu max limit to request ratio per Container is 10, but provided ratio is 150.000000
```

**That is the rule earning its place.** A pod requesting 10m schedules almost anywhere — it looks tiny. Then it bursts to 1.5 CPU and degrades every neighbour on that node. The ratio stops workloads lying to the scheduler about their size.

---

## Step 6 — Prove autoscaling still fits

**Why we are doing this.** Tomorrow's autoscaler will create more pods. If the quota cannot accommodate them, the HPA stalls mid-spike with `FailedCreate` — which is a genuinely nasty failure, because it happens exactly when you need capacity.

**Do the arithmetic:**

```bash
kubectl describe resourcequota axispay-core-quota -n axispay-core | grep -E 'requests.cpu|limits.cpu'
```

At the HPA maximum, `payment-service` reaches 8 replicas and `fraud-service` 6. Sum the **requests** of every service at those counts and check it against the 9-CPU budget.

**Requests must fit. Limits may safely exceed the total.** Nine CPUs of requests is a real reservation the scheduler must honour. Eighteen CPUs of limits is a ceiling nobody reaches simultaneously — the same principle as a bank not holding cash for every account at once.

---

## Did it work?

```bash
make validate-lab LAB=L2.2
```

---

## Clean up

```bash
kubectl delete deployment greedy -n axispay-core --ignore-not-found
kubectl delete pod nolimits toobig liar -n axispay-core --ignore-not-found
```

Keep the quota and LimitRange.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| Existing pods suddenly `Pending` | The new quota is smaller than current usage | Quota does not evict, but it blocks new pods. Raise it, or scale something down |
| `must specify limits.cpu` on every new pod | A quota on `limits.cpu` with no LimitRange default | Apply the LimitRange too — they are designed as a pair |
| Deployment exists but no pods, no obvious error | Quota rejection | `kubectl describe deployment <name>` — the event is on the ReplicaSet |
| `exceeded quota` when you have room | Someone else used it | `kubectl describe resourcequota -n <ns>` shows `Used` |
| LimitRange not applying defaults | It applies at creation only | Existing pods are unaffected. Roll the workload |

---

## Try this yourself

Answers in [`solutions.md`](../../solutions.md).

**1.** Size a ResourceQuota for `axispay-async`, which on Day 4 will hold settlement, notification, audit and reporting at 2 replicas each. Show your arithmetic and leave room for one HPA.

**2.** A quota exists but no LimitRange. A developer applies a Deployment with no `resources` block. Predict exactly what happens and **where** the error appears. Then test it in a scratch namespace.

**3.** Explain why `requests` must fit real capacity but `limits` may safely be oversubscribed. Use your own numbers from Step 6.

---

## What you built

- **A namespace budget** that cannot be exceeded, and one command that reports how much is left
- **Defaults that make `BestEffort` impossible** in this namespace
- **Two different rejections, seen**: LimitRange refuses the object, ResourceQuota refuses the pod
- **The `maxLimitRequestRatio` rule**, and why lying to the scheduler is worth preventing
- **Headroom checked against tomorrow's autoscaler**, before it becomes an incident

**Next:** [L2.3 — Health probes](../L2.3-probes/) — the most consequential 30 lines of YAML in the course.
