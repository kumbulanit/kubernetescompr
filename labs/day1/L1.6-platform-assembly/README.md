# L1.6 · Assemble The Platform — On Your Own

| | |
|---|---|
| **Time** | 45 minutes |
| **Difficulty** | First lab where you work it out yourself |
| **You need first** | [L1.5](../L1.5-services/) finished |
| **You will create** | Nothing new — you will rebuild it all from scratch |
| **Check you are done** | `make validate-lab LAB=L1.6` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`.
- Full version: [`labs/GETTING-STARTED.md`](../../GETTING-STARTED.md).
</details>

---

## This lab is different

The previous four labs gave you every command. This one gives you **tasks**, and asks you to work out the commands.

That is not a punishment. It is the only way to find out whether you have learned anything, and it is far better to discover a gap here — on a Monday, with everything reversible — than on Friday under assessment.

**You are allowed to look things up.** Your notes, `kubectl explain`, the earlier labs, `--help` on any command. What you should not do is copy commands without knowing what they do.

Every task has:

- **the task** — what needs to be true when you are done
- **how you will know** — the check that proves it
- **a hint** — hidden until you open it. Try for five minutes first.

If you are properly stuck for more than ten minutes on one task, open the hint. Being stuck is useful; staying stuck is not.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get nodes` | Three nodes, all `Ready` |

That is all. The first task deletes everything else anyway.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | Everything from L1.2, L1.4 and L1.5 in one folder: 1 namespaces file, 4 Deployments, 4 Services. |

---

## The scenario

> It is 08:40 on a Monday. The AxisPay platform team has a new cluster and no platform on it. Payments start at 09:00.
>
> You have the manifests. Nobody is going to talk you through it.

---

## Task 1 — Start from nothing

**The task.** Delete every AxisPay object you have created so far. Namespaces, Deployments, Services — all of it. Confirm the cluster is clean.

**How you will know.**

```bash
kubectl get all -A -l app.kubernetes.io/part-of=axispay
```

Should return `No resources found`.

<details>
<summary><b>Hint</b></summary>

Deleting a namespace deletes everything inside it. That is three commands, or one if you use a label selector on namespaces.

Namespaces take twenty to thirty seconds to finish deleting. `kubectl get ns -w` lets you watch. Wait for them to disappear entirely before Task 2 — a namespace in `Terminating` will reject new objects.

Note that `kubectl get all` is misleadingly named: it returns a fixed short list of kinds, not everything. It is fine for this check, but do not trust it as a complete inventory. That is worth remembering for later in the week.
</details>

---

## Task 2 — Rebuild it in one command

**The task.** Recreate the entire platform — namespaces, Deployments and Services — using as few commands as you can. Everything in `manifests/` is what you need.

**How you will know.**

```bash
kubectl get pods -A -l app.kubernetes.io/part-of=axispay
```

Eight pods, all eventually `1/1 Running`.

<details>
<summary><b>Hint</b></summary>

`kubectl apply -f <folder>` applies every file in a folder.

**Order matters here, and Kubernetes will tell you so.** If you apply everything at once, the namespace file and the Deployments go in together, and some Deployments may be rejected because their namespace does not exist yet.

Two ways to handle it:
- Apply the namespaces first, then the rest.
- Or just run the same `apply` command twice. The first pass creates the namespaces and fails on some Deployments; the second pass succeeds because the namespaces now exist. This works because `apply` is safe to repeat — which is the property you saw in L1.2.

The second approach feels like cheating. It is not: "apply until it converges" is how real deployment tooling behaves.
</details>

---

## Task 3 — Wait for it properly

**The task.** Without using `sleep`, and without watching the screen, make your terminal block until all four Deployments are fully ready.

**How you will know.** Your command returns on its own, and immediately afterwards every pod is `1/1`.

<details>
<summary><b>Hint</b></summary>

`kubectl wait` is the command. Look at:

```bash
kubectl wait --help
```

You want `--for=condition=Available` on the Deployments, with a `--timeout`. You can select multiple objects with `-l` or by naming them.

Remember they are in two namespaces, so you need either two commands or `-A`.

**Why this matters more than it looks.** `sleep 30` is a guess: too short and your next command fails intermittently, too long and you waste time. `kubectl wait` returns the moment the condition is true. Every script you write for the rest of the week should use it.
</details>

---

## Task 4 — Prove it works, end to end

**The task.** Take a payment through `edge-gateway`. Then take the *same* payment again and show it was not charged twice.

**How you will know.** The first call returns `201` with a `payment_id`. The second returns the *same* `payment_id`.

<details>
<summary><b>Hint</b></summary>

You need a tunnel first — `kubectl port-forward` on the Service, in a second terminal.

The request is in [L1.4 Step 7](../L1.4-deployments/) and [L1.5 Step 7](../L1.5-services/). The header that makes the second call safe is `Idempotency-Key` — send the same value both times.

Add `-i` to `curl` to see the status code as well as the body.
</details>

---

## Task 5 — Find out where everything landed

**The task.** Produce a single table showing every AxisPay pod, which node it is on, and its IP address. Then answer: **are the three `payment-service` pods spread across different nodes, or did some land together?**

**How you will know.** You can state, from your own output, how many nodes the payment pods occupy.

<details>
<summary><b>Hint</b></summary>

`-o wide` gives you node and IP. `-A` covers both namespaces. `-l` filters to AxisPay.

For a cleaner table, `-o custom-columns` lets you choose exactly which fields to show:

```bash
kubectl get pods -A -l app.kubernetes.io/part-of=axispay \
  -o custom-columns='NS:.metadata.namespace,POD:.metadata.name,NODE:.spec.nodeName,IP:.status.podIP'
```

**The answer will probably surprise you.** Nothing has told the scheduler to spread them out. If two payment pods are on the same node, losing that node takes out two thirds of your payment capacity. You will fix this deliberately on Thursday — for now, just notice that nobody arranged it.
</details>

---

## Task 6 — Break it, then fix it by reasoning

**The task.** Scale `merchant-service` to zero replicas. Then, **before** you look:

1. Predict what happens to `payment-service` — does it crash, restart, or stay running?
2. Predict what `/healthz` will say, and what `/readyz` will say.
3. Predict what the EndpointSlice for `payment-service` will contain.

Then check all three. Then put it back.

**How you will know.** Your three predictions were right — or you can explain why they were not.

<details>
<summary><b>Hint</b></summary>

```bash
kubectl scale deploy/merchant-service -n axispay-core --replicas=0
```

Give it thirty seconds, then look at the payment pods' READY column, and at:

```bash
kubectl get endpointslices -n axispay-core -l kubernetes.io/service-name=payment-service
```

Use `port-forward` and `curl` to check `/healthz` and `/readyz` on a payment pod.

**The answers, once you have tried:** the pods stay `Running` and do not restart — nothing is wrong with the process. `/healthz` says ok; `/readyz` says not ready. And the endpoints list **empties**, because Kubernetes only lists *ready* pods.

That last one is the important one. The service removed itself from rotation the moment it could not do its job, without anyone deciding to. Restore with `--replicas=2` and watch it all come back.
</details>

---

## Task 7 — Write your own runbook

**The task.** Write a file called `my-runbook.md` in this folder containing the exact commands to:

1. deploy the platform from nothing
2. confirm it is healthy
3. take a test payment
4. tear it all down

Write it so that **someone who has not done this course could follow it**. That constraint is the whole exercise.

**How you will know.** Hand it to the person next to you. If they can run it without asking you a question, it works.

<details>
<summary><b>Hint</b></summary>

Things that separate a runbook from a list of commands:

- Say what each command is for, in one line, before it.
- Say what success looks like — the expected output.
- Say what to do when it is not that.
- No placeholders like `<your-namespace>` unless you say how to find the value.

Keep it under one page. A runbook nobody reads at 03:00 is not a runbook.

This file is yours; it is not marked. But you will be given a real incident in twenty minutes, and the people who wrote a good one find it useful sooner than they expect.
</details>

---

## Did it work?

```bash
make validate-lab LAB=L1.6
```

```
✓ L1.6 PASSED — 16/16 checks
```

This checks the full Day 1 end state: three namespaces with correct labels, four Deployments at the right replica counts, four Services with endpoints, and a payment that succeeds end to end.

**Also run the day checkpoint**, which is what tomorrow assumes:

```bash
make validate-day1
```

---

## Clean up

Nothing. This is the Day 1 end state and Day 2 starts from here.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `namespaces "axispay-core" not found` | Applied Deployments before namespaces | Apply the namespace file first, or run `apply` twice |
| Namespace stuck `Terminating` | Something inside is still deleting | Wait 30s. Then `kubectl get all -n <ns>` to see what remains |
| Pods `Pending` after rebuild | Node still releasing the old pods' resources | Wait 60s. If it persists: `kubectl describe pod <name>` and read the events |
| `payment-service` never becomes ready | `merchant-service` is not ready | `kubectl get pods -n axispay-core` — check that one first |
| `kubectl wait` times out | The condition was never met | Drop the wait and look with `kubectl get pods -w` to see where it is stuck |
| `curl` gives `502` | The gateway cannot reach something | `kubectl logs -n axispay-edge deploy/edge-gateway --tail=30` |
| Second payment returns a *different* id | The `Idempotency-Key` differed | It must be byte-identical on both calls |
| Everything looks right, validator fails | Read what it says — it names the missing artefact and the command to check it | The validators are written to tell you exactly what is wrong |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/01-foundations-and-core-objects/solutions.md).

**1.** `customer-service` is part of AxisPay but has no manifest yet. Write its Deployment and Service **from scratch**, following the conventions in the existing files. It goes in `axispay-core`, 2 replicas, with the standard label set. The image is `axispay/customer-service:1.0.0` on port 8080.

**2.** Point `payment-service`'s `MERCHANT_SERVICE_URL` at a namespace that does not exist. Predict first: does the pod crash, restart, or stay running? What does `/readyz` say, and `/healthz`? Why are those two answers different?

**3.** Query the platform for the total captured volume by currency across every payment you have made today. One endpoint gives it to you — find it. (`kubectl port-forward` to `reporting-service`… except that does not exist yet. Work out which of the four services can answer it.)

### Bonus

Time yourself doing Tasks 1 and 2 again from memory, with the README closed.

Under three minutes means you have the core loop. That is genuinely the skill: not knowing every flag, but being able to get a platform up and confirm it is healthy without looking anything up.

---

## What you built

- **The entire Day 1 platform, from nothing, by yourself** — three namespaces, four Deployments, four Services, eight pods
- **`kubectl wait`**, which replaces every `sleep` you would otherwise have written
- **The knowledge that nobody arranged your pod placement**, which is Thursday's problem, spotted on Monday
- **Proof that an unready service removes itself from rotation** — no human decision involved
- **A runbook in your own words**, which you are about to need

**Next:** [INC-1 — Your first incident](../INC-1-imagepullbackoff/). Something is about to break, and nobody will tell you what.
