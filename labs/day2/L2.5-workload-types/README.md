# L2.5 · Not Everything Is a Deployment

| | |
|---|---|
| **Time** | 40 minutes |
| **Difficulty** | Four object types, one decision |
| **You need first** | [L2.4](../L2.4-autoscaling/) finished |
| **You will create** | 1 DaemonSet, 1 Job, 1 CronJob |
| **Check you are done** | `make validate-lab LAB=L2.5` |

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

Everything you have deployed so far is a Deployment: a long-running server, with interchangeable replicas. Plenty of real work is not shaped like that.

- A telemetry agent needs **one copy per node** — and one more automatically when a node is added.
- Reconciliation needs to **run once and finish**. Success means exiting cleanly, not staying up.
- Settlement needs to **run every night at 23:00** and never twice at once.

You will build all three, and see what goes wrong when the wrong shape is used.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get nodes` | Three nodes, all `Ready` |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/01-daemonset-node-agent.yaml` | One agent per node |
| `manifests/02-job-recon-worker.yaml` | Runs once, to completion |
| `manifests/03-cronjob-settlement.yaml` | Every night at 23:00 |

---

## Choosing the shape

| You need | Use | The tell |
|---|---|---|
| N interchangeable copies of a server | **Deployment** | "Three of these, and I do not care which" |
| Exactly one per node, including new nodes | **DaemonSet** | "One per machine" — no `replicas` field, and that is the point |
| Run to completion, once | **Job** | Success = **exit 0**, not staying up |
| Run to completion, on a schedule | **CronJob** | "Every night at 23:00" |
| Stable identity and stable storage per pod | **StatefulSet** | Tomorrow's lab |

**The most common mistake is modelling a DaemonSet as a Deployment with `replicas: 3`.** It works — until someone adds a fourth node, and then your telemetry has a hole in it that nobody notices.

---

## Step 1 — A DaemonSet

```bash
grep -A6 'kind: DaemonSet' manifests/01-daemonset-node-agent.yaml
kubectl apply -f manifests/01-daemonset-node-agent.yaml
kubectl get daemonset,pods -n axispay-ops -o wide
```

```
NAME                     DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE
daemonset.apps/node-agent   3      3         3       3            3

NAME                   READY   STATUS    NODE
pod/node-agent-4k2mx   1/1     Running   axispay
pod/node-agent-8vtkr   1/1     Running   axispay-m02
pod/node-agent-q7wpl   1/1     Running   axispay-m03
```

**One per node — and there is no  field anywhere in that manifest.** DESIRED is 3 because you have 3 nodes. Add a node and it becomes 4, with no change from you. That is the whole reason DaemonSets exist.

**Notice it also runs on the control-plane node.** That needs a *toleration*:

```bash
grep -A5 'tolerations:' manifests/01-daemonset-node-agent.yaml
```

Control-plane nodes carry a **taint** that repels ordinary pods. A toleration is a pod saying "that taint does not apply to me". Node telemetry with a hole in it is not telemetry — so this one tolerates it deliberately. You will meet taints properly on Day 4.

---

## Step 2 — A Job

```bash
kubectl apply -f manifests/02-job-recon-worker.yaml
kubectl get job,pods -n axispay-async -w
```

Watch until `COMPLETIONS` reads `1/1`, then <kbd>Ctrl</kbd>+<kbd>C</kbd>.

```
NAME                  COMPLETIONS   DURATION   AGE
job.batch/recon-worker   1/1        12s        30s

NAME                     READY   STATUS      RESTARTS   AGE
pod/recon-worker-x7k2m   0/1     Completed   0          30s
```

**`Completed`, not `Running`. `0/1` READY, and that is success.**

```bash
kubectl logs -n axispay-async job/recon-worker
```

**What that means.** For a Job, **success is the container exiting 0.** A Deployment would treat that exit as a crash and restart it forever. Which is why:

```bash
grep -E 'restartPolicy|backoffLimit' manifests/02-job-recon-worker.yaml
```

- `restartPolicy: Never` (or `OnFailure`) — `Always` is invalid for a Job, because "always restart" and "run once" are contradictory.
- `backoffLimit: 4` — retry the pod up to four times, then declare the Job failed. Enough to ride out a transient blip; few enough that a genuinely broken job fails fast instead of retrying forever.

**The completed pod is deliberately left behind** so you can read its logs. That is what `ttlSecondsAfterFinished` controls when you want automatic cleanup.

---

## Step 3 — A CronJob

```bash
kubectl apply -f manifests/03-cronjob-settlement.yaml
kubectl get cronjob -n axispay-async
```

```
NAME              SCHEDULE      TIMEZONE                SUSPEND   ACTIVE   LAST SCHEDULE
settlement-cron   0 23 * * *    Africa/Johannesburg     False     0        <none>
```

**Two fields worth understanding properly:**

```bash
grep -E 'schedule|timeZone|concurrencyPolicy|startingDeadline' manifests/03-cronjob-settlement.yaml
```

**`timeZone`** — without it the schedule is **UTC**, and twice a year daylight saving moves your settlement run an hour relative to the business day it is settling. That is a real accounting defect, not a cosmetic one.

**`concurrencyPolicy: Forbid`** — if last night's run is somehow still going, do **not** start a second. Two settlement runs against the same ledger produce double-counted journals, which is a regulatory finding. The alternatives are `Allow` (wrong here) and `Replace` (kill the running one — also wrong, it leaves partial work).

**You are not waiting until 23:00.** Trigger it by hand:

```bash
kubectl create job --from=cronjob/settlement-cron manual-run -n axispay-async
kubectl get job,pods -n axispay-async
kubectl logs -n axispay-async job/manual-run
```

> `kubectl create job --from=cronjob/...` is worth remembering. It is how you re-run a failed nightly batch at 08:00 without waiting or editing the schedule.

---

## Step 4 — Model it wrongly, on purpose

**Why we are doing this.** So the consequence is concrete rather than theoretical.

```bash
kubectl create deployment wrong-shape -n axispay-async --image=busybox:1.37 -- sh -c 'echo "batch done"; exit 0'
sleep 30
kubectl get pods -n axispay-async -l app=wrong-shape
```

```
NAME                          READY   STATUS             RESTARTS   AGE
wrong-shape-6d9f4b7c8-x2ktp   0/1     CrashLoopBackOff   4          30s
```

**It succeeded, and Kubernetes calls that a crash loop.** The Deployment controller's entire job is "keep this running", so a process that exits — even with exit code 0 — is a failure by definition.

**That is the lesson:** the object type encodes *what success means*. Choose it wrongly and Kubernetes will confidently do the wrong thing.

```bash
kubectl delete deployment wrong-shape -n axispay-async
```

---

## Did it work?

```bash
make validate-lab LAB=L2.5
```

---

## Clean up

```bash
kubectl delete job manual-run -n axispay-async --ignore-not-found
kubectl delete deployment wrong-shape -n axispay-async --ignore-not-found
```

Keep the DaemonSet, Job and CronJob.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| DaemonSet shows 2 of 3 | One node cannot run it — usually a taint | `kubectl describe daemonset node-agent -n axispay-ops` |
| Job stuck `0/1` | The container is failing | `kubectl logs job/<name> -n <ns>` |
| Job shows `BackoffLimitExceeded` | Failed more times than allowed | Read the logs, fix, delete the Job and re-apply |
| CronJob never fires | Not 23:00 yet | Use `kubectl create job --from=cronjob/...` |
| `unknown field "timeZone"` | Cluster older than v1.27 | Upgrade, or drop the field and accept UTC |
| Completed pods piling up | No TTL set | `ttlSecondsAfterFinished`, or delete by hand |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/02-workloads-scaling-and-releases/solutions.md).

**1.** Convert `recon-worker` to run **4 pods in parallel**, each handling a slice. Which two fields do you need, and what does `completionMode: Indexed` give you?

**2.** A settlement run must never be missed **and** never run twice. Design the guarantee. What does Kubernetes give you, what must the application provide, and where exactly is the gap?

**3.** Explain why a DaemonSet has no `replicas` field, and what the equivalent of "scaling" is for one.

---

## What you built

- **A DaemonSet** covering every node, including nodes that do not exist yet
- **A Job** where success means exiting cleanly
- **A CronJob** with a time zone and a concurrency policy, both for accounting reasons rather than technical ones
- **The wrong shape, deliberately** — a successful batch reported as a crash loop
- **The insight that the object type encodes what success means**

**Next:** [L2.6 — Zero-downtime release](../L2.6-zero-downtime-rollout/) — upgrade the platform under live traffic and prove nothing was dropped.
