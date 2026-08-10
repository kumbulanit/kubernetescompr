# L1.4 · Deployments — Telling Kubernetes What You *Want*

| | |
|---|---|
| **Time** | 50 minutes |
| **Difficulty** | The most important idea in the course lives here |
| **You need first** | [L1.3](../L1.3-first-pod/) finished |
| **You will create** | 4 Deployments (8 pods) |
| **Check you are done** | `make validate-lab LAB=L1.4` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. Steps 4 and 6 need it.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`.
- Full version: [`labs/GETTING-STARTED.md`](../../GETTING-STARTED.md).
</details>

---

## What you are going to do

In L1.3 you created a pod, deleted it, and nothing brought it back.

Now you will create a **Deployment** instead. A Deployment does not create a pod — it holds a *statement of intent*: **"there should always be three of these"**. Something inside Kubernetes then checks that statement against reality, forever, and fixes any difference.

You are going to delete a pod again. This time it comes back in about two seconds, and you will watch it happen.

By the end of this lab you will have the whole AxisPay core running — four services, eight pods — and you will understand the loop that keeps them there. Everything else this week is that same loop applied to a different problem.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get ns axispay-core axispay-edge` | Both `Active` |
| 3 | `minikube -p axispay image ls \| grep -c axispay/` | `16` or more |

**If #3 is low:**

```bash
eval $(minikube -p axispay docker-env)
make build
```

**Also make sure L1.3's bare pod is gone**, so the counts in this lab match what you see:

```bash
kubectl delete pod payment-service-bare -n axispay-core --ignore-not-found
```

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/01-deployment-edge-gateway.yaml` | The public entry point. Lives in `axispay-edge`. |
| `manifests/02-deployment-auth-service.yaml` | Checks merchant API keys. `axispay-edge`. |
| `manifests/03-deployment-merchant-service.yaml` | Merchant accounts and pricing. `axispay-core`. |
| `manifests/04-deployment-payment-service.yaml` | Takes payments. `axispay-core`. 3 replicas. |

---

## The one idea this whole course is built on

Before the commands, sit with this for a minute — it pays back all week.

You do **not** tell Kubernetes to do things. You tell it **what you want to be true**, and a controller makes it true, continuously.

```
     YOU WRITE                CONTROLLER                  REALITY
   ┌────────────┐          ┌──────────────┐          ┌────────────┐
   │  spec:     │  reads   │   compare    │  reads   │  status:   │
   │ replicas:3 │ ───────► │ spec vs real │ ◄─────── │ ready: 2   │
   └────────────┘          └──────┬───────┘          └────────────┘
                                  │ different?
                                  ▼
                          create one more pod
                                  │
                                  └──────► forever, every few seconds
```

Three consequences, all of which you will see today:

- **Applying the same file twice is safe.** You already saw `unchanged` in L1.2.
- **Deleting a pod is not destruction, it is a difference.** The controller notices and closes the gap.
- **You can never "finish".** The loop never stops. That is why a cluster heals itself at 3am without anyone being awake.

Every controller in Kubernetes is this same loop with a different `spec`. Once you have it, Deployments, autoscalers, jobs and everything on Days 2 to 5 are variations of one thing.

---

## Step 1 — Read the file first

**Run this:**

```bash
cat manifests/04-deployment-payment-service.yaml
```

The structure is new, so here it is annotated. **Notice that a Deployment contains a whole Pod inside it.**

```yaml
apiVersion: apps/v1                      # ① not v1 — Deployments live in "apps"
kind: Deployment
metadata:
  name: payment-service
  namespace: axispay-core
spec:
  replicas: 3                            # ② THE INTENT
  selector:                              # ③ which pods are mine
    matchLabels:
      app.kubernetes.io/name: payment-service
      app.kubernetes.io/instance: axispay
  template:                              # ④ the pod to stamp out
    metadata:
      labels:                            # ⑤ MUST match ③
        app.kubernetes.io/name: payment-service
        app.kubernetes.io/instance: axispay
    spec:
      containers:
        - name: payment-service
          image: axispay/payment-service:1.0.0
          ports:
            - name: http
              containerPort: 8080
          env:
            - name: MERCHANT_SERVICE_URL
              value: "http://merchant-service.axispay-core.svc.cluster.local:8080"
```

| | What it means |
|---|---|
| ① | `apps/v1`, not `v1`. Pods, Services and Namespaces are in the original core API (`v1`); Deployments came later and live in the `apps` group. If you write `v1` here you get `no matches for kind "Deployment"`. |
| ② | **The intent.** "There should be three." Not "create three" — *there should be three*, now and always. |
| ③ | **The selector.** How the Deployment recognises its own pods: anything carrying these labels. |
| ④ | **The template.** A complete pod definition. Every pod this Deployment creates is stamped from it. |
| ⑤ | These labels **must** match the selector in ③. If they do not, the API server rejects the object — it would be a Deployment that could never find the pods it just created. |

### Two things worth knowing now, because they cost people real money later

**The selector cannot be changed after creation.** Ever. If you later add a label like `version: 2.0` to the selector, the update fails with `field is immutable` and the only way out is deleting the Deployment — in production, during a release. You will meet this properly on Day 5; for now, just note that ③ is permanent.

**There is no `status:` in this file.** You never write one. Kubernetes writes it, and it is where the truth lives. `spec` is your wish; `status` is the world.

---

## Step 2 — Predict before you apply

**Why we are doing this.** Predicting first is what turns running commands into understanding. Take thirty seconds.

Write down your answers:

1. How many pods will exist after you apply this file?
2. What will their names look like?
3. Will they be `1/1 READY`, and if not, why not?

**Now apply it:**

```bash
kubectl apply -f manifests/04-deployment-payment-service.yaml
```

```
deployment.apps/payment-service created
```

**And look:**

```bash
kubectl get pods -n axispay-core
```

**What you should see:**

```
NAME                              READY   STATUS    RESTARTS   AGE
payment-service-7d4f8b9c6-2xk4p   0/1     Running   0          8s
payment-service-7d4f8b9c6-h9mzt   0/1     Running   0          8s
payment-service-7d4f8b9c6-qw3nf   0/1     Running   0          8s
```

**Check your predictions.**

1. **Three pods.** You asked for three; you got three.
2. **`payment-service-7d4f8b9c6-2xk4p`** — your name, then a hash of the pod template, then five random characters. Your hash and suffixes will differ. The middle part changes whenever you change the template, which is how Kubernetes tells one version from another.
3. **`0/1`** — running but not ready, exactly as in L1.3, and for the same reason: `merchant-service` does not exist yet. Correct behaviour. It will fix itself in Step 8.

---

## Step 3 — Find the thing you did not create

**Why we are doing this.** There is an object in the middle that nobody talks about, and knowing it exists explains most of Day 2.

**Run this:**

```bash
kubectl get deploy,replicaset,pods -n axispay-core
```

**What you should see:**

```
NAME                              READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/payment-service   0/3     3            0           1m

NAME                                        DESIRED   CURRENT   READY   AGE
replicaset.apps/payment-service-7d4f8b9c6   3         3         0       1m

NAME                                  READY   STATUS    RESTARTS   AGE
pod/payment-service-7d4f8b9c6-2xk4p   0/1     Running   0          1m
pod/payment-service-7d4f8b9c6-h9mzt   0/1     Running   0          1m
pod/payment-service-7d4f8b9c6-qw3nf   0/1     Running   0          1m
```

**What that means.** You created one object and there are now three kinds:

```
   Deployment            "there should be 3, and here is how to update them"
        │  creates
        ▼
   ReplicaSet            "there should be 3 of exactly THIS pod template"
        │  creates
        ▼
   Pod  Pod  Pod
```

Why two layers? Because they do different jobs. The **ReplicaSet** only knows how to keep a count. The **Deployment** knows how to move from one ReplicaSet to another — which is how a rolling update works: it grows a new ReplicaSet while shrinking the old one. You will use that on Day 2.

**See the ownership written down:**

```bash
kubectl get pod -n axispay-core -o jsonpath='{.items[0].metadata.ownerReferences}' | jq .
```

```json
[{
  "apiVersion": "apps/v1",
  "kind": "ReplicaSet",
  "name": "payment-service-7d4f8b9c6",
  "controller": true
}]
```

Each pod carries a note saying who owns it. That is not documentation — it is how Kubernetes knows to delete the pods when you delete the Deployment.

---

## Step 4 — Break it and watch it heal

**This is the lab.** Everything else has been setting it up.

You need **two terminals**.

**Terminal 1 — watch:**

```bash
kubectl get pods -n axispay-core -w
```

**Terminal 2 — kill one:**

```bash
kubectl delete pod -n axispay-core -l app.kubernetes.io/name=payment-service --field-selector=status.phase=Running --wait=false | head -1
```

Or more simply, copy a pod name from terminal 1 and:

```bash
kubectl delete pod payment-service-7d4f8b9c6-2xk4p -n axispay-core
```

**Watch terminal 1:**

```
payment-service-7d4f8b9c6-2xk4p   1/1     Terminating         0     4m
payment-service-7d4f8b9c6-lk8vt   0/1     Pending             0     0s
payment-service-7d4f8b9c6-lk8vt   0/1     ContainerCreating   0     0s
payment-service-7d4f8b9c6-2xk4p   0/1     Terminating         0     4m
payment-service-7d4f8b9c6-lk8vt   0/1     Running             0     2s
```

**Look at the timing.** The replacement appeared *before the old one had finished dying*. The controller noticed the difference within milliseconds.

**Stop the watch** with <kbd>Ctrl</kbd>+<kbd>C</kbd>, then count:

```bash
kubectl get pods -n axispay-core
```

Three pods. One has a different name.

**What that means.** Nobody was watching. No alert fired. No human typed anything. **The loop noticed that reality (2) differed from intent (3) and closed the gap.**

This is why Kubernetes is worth the complexity, and you have just watched it happen.

> **Try it harder.** Delete all three at once and watch. You get three back. Delete them in a loop for a minute — you still end with three. The only way to reduce the count is to change the *intent*, which is the next step.

---

## Step 5 — Change the intent

**Why we are doing this.** Since the number is a statement rather than an action, changing the number is all it takes.

**Run this:**

```bash
kubectl scale deployment/payment-service -n axispay-core --replicas=5
kubectl get pods -n axispay-core
```

```
NAME                              READY   STATUS    RESTARTS   AGE
payment-service-7d4f8b9c6-2xk4p   0/1     Running   0          6m
payment-service-7d4f8b9c6-h9mzt   0/1     Running   0          6m
payment-service-7d4f8b9c6-lk8vt   0/1     Running   0          2m
payment-service-7d4f8b9c6-p7rmx   0/1     Running   0          3s
payment-service-7d4f8b9c6-v4nkd   0/1     Running   0          3s
```

**Now back down:**

```bash
kubectl scale deployment/payment-service -n axispay-core --replicas=3
```

> **A word of warning about `kubectl scale`.** It changes the live object, but not the file on disk. Your YAML still says `replicas: 3`. The next time anyone applies that file, your change vanishes. `kubectl scale` is for experiments and emergencies. For anything that should last, edit the file. On Day 5 you will see a tool that makes this drift visible.

---

## Step 6 — Deploy the other three services

**Why we are doing this.** One service is not a platform, and `payment-service` cannot become ready until `merchant-service` exists.

**Run this:**

```bash
kubectl apply -f manifests/
```

Pointing `-f` at a **folder** applies every file in it. This is why each lab keeps its YAML in one place.

```
deployment.apps/edge-gateway created
deployment.apps/auth-service created
deployment.apps/merchant-service created
deployment.apps/payment-service unchanged
```

Note `payment-service unchanged` — you already applied it, and applying it again did nothing. Safe to repeat, every time.

**Watch them come up:**

```bash
kubectl get pods -A -l app.kubernetes.io/part-of=axispay -w
```

`-A` means all namespaces, because these four live in two different ones.

**Wait for every pod to reach `1/1`** — it takes about thirty seconds — then <kbd>Ctrl</kbd>+<kbd>C</kbd>.

**What you should see:**

```
NAMESPACE       NAME                                READY   STATUS    RESTARTS   AGE
axispay-core    merchant-service-7fc9b5d64-8vtkr    1/1     Running   0          40s
axispay-core    merchant-service-7fc9b5d64-r2wkx    1/1     Running   0          40s
axispay-core    payment-service-7d4f8b9c6-h9mzt     1/1     Running   0          8m
axispay-core    payment-service-7d4f8b9c6-lk8vt     1/1     Running   0          4m
axispay-core    payment-service-7d4f8b9c6-p7rmx     1/1     Running   0          2m
axispay-edge    auth-service-6b8d94f7c-l9mzt        1/1     Running   0          40s
axispay-edge    auth-service-6b8d94f7c-tk3vp        1/1     Running   0          40s
axispay-edge    edge-gateway-5f9c8d7b6-hj2ql        1/1     Running   0          40s
axispay-edge    edge-gateway-5f9c8d7b6-vm4rd        1/1     Running   0          40s
```

### Look at `payment-service` — it is `1/1` now

**Nothing restarted it.** Its age is still 8 minutes.

What happened: `merchant-service` came up, `payment-service` re-checked its readiness, found its dependency present, and started reporting ready. It fixed itself the moment the world changed, without intervention.

**That is exactly what a readiness probe is for**, and it is the difference between "alive" and "able to work" from L1.3, playing out on its own.

---

## Step 7 — Prove the platform works end to end

**Terminal 1 — open a tunnel to the gateway:**

```bash
kubectl port-forward -n axispay-edge deploy/edge-gateway 8080:8080
```

> Note `deploy/edge-gateway` rather than a pod name. Kubernetes picks one of its pods for you — which is convenient, and also a hint of what a Service does properly in the next lab.

**Terminal 2 — take a payment:**

```bash
curl -s -X POST http://localhost:8080/api/v1/payments \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' \
  -H 'Idempotency-Key: l14-first-payment' \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-L14-001","amount_minor":125000,"currency":"ZAR","card_token":"tok_visa_4242"}' | jq .
```

| Part | What it is |
|---|---|
| `-X POST` | Send a POST request (creating something) rather than a GET |
| `-H '...'` | A header. The API key identifies the merchant. |
| `Idempotency-Key` | A safety net — see below |
| `-d '{...}'` | The request body: R1,250.00 in South African rand |
| `amount_minor` | **125000 means R1,250.00.** Money is always a whole number of cents. Never a decimal — floating point and money do not mix. |

**What you should see:**

```json
{
  "payment_id": "pay_01J8XQZ4K2M9N",
  "reference": "AXP-20260810-004471",
  "status": "captured",
  "amount_minor": 125000,
  "currency": "ZAR",
  "display_amount": "R 1,250.00",
  "card_brand": "visa",
  "card_last4": "4242"
}
```

**You just took a payment through a platform you built this morning.**

**Now send the exact same request again** — press <kbd>↑</kbd> and <kbd>Enter</kbd>.

You get the **same `payment_id`**. Not a second payment.

That is the `Idempotency-Key` doing its job: if a merchant's connection drops and they retry, they must not be charged twice. It is a small thing that matters enormously, and it is checked in Friday's assessment.

**Close the tunnel** with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

---

## Did it work?

```bash
make validate-lab LAB=L1.4
```

**What you should see:**

```
✓ L1.4 PASSED — 14/14 checks
```

---

## Clean up

Nothing. These four Deployments are the platform, and every lab from here builds on them.

If you want to reset to a known state:

```bash
kubectl delete -f manifests/ --ignore-not-found
kubectl apply -f manifests/
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `no matches for kind "Deployment" in version "v1"` | Wrong `apiVersion` | It must be `apps/v1` |
| `selector does not match template labels` | ③ and ⑤ in Step 1 disagree | They must be identical. Compare them carefully |
| Pods stuck `0/1` after Step 6 | A dependency is still missing | `kubectl get pods -A -l app.kubernetes.io/part-of=axispay` — is `merchant-service` `1/1`? |
| Pods stuck `Pending` | Not enough CPU or memory on any node | `kubectl describe pod <name> -n <ns>`, read the events. If your machine is small, scale down: `kubectl scale deploy/payment-service -n axispay-core --replicas=1` |
| `ImagePullBackOff` | Image not in the cluster's store | `eval $(minikube -p axispay docker-env)` then `make build` |
| Deleted pod does **not** come back | You deleted the Deployment, not a pod | `kubectl get deploy -n axispay-core`. Re-apply the manifest |
| `curl` returns `401 Unauthorized` | Wrong or missing API key | The header must be exactly `X-API-Key: axp_live_7Kq2mVx9RtLd` |
| `curl` returns `502` | The gateway cannot reach a service behind it | `kubectl logs -n axispay-edge deploy/edge-gateway --tail=30` |
| `curl: (7) Failed to connect` | The tunnel is not open | Check terminal 1 |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/01-foundations-and-core-objects/solutions.md).

**1.** Delete the **ReplicaSet** (not the Deployment, not a pod). Predict what happens before you do it, then do it and explain what you saw.

**2.** Change `replicas` to `2` in `manifests/04-deployment-payment-service.yaml`, apply it, and watch which pod Kubernetes chooses to remove. Is it the oldest, the newest, or something else? Find out what decides.

**3.** Two Deployments in the same namespace are given selectors that both match the same pods. What happens? Reason it through first, then try it in a scratch namespace — and be careful, because the answer is genuinely unpleasant.

### Bonus

```bash
kubectl rollout history deployment/payment-service -n axispay-core
```

There is only one revision so far. On Day 2 you will change the image and watch a second appear — and roll back to this one. The Deployment has been keeping that history since the moment you created it.

---

## What you built

- **Four Deployments, eight pods** — the AxisPay core, running
- **The reconciliation loop, seen rather than described**: you deleted a pod and watched intent beat reality
- **The ownership chain** Deployment → ReplicaSet → Pod, and why the middle layer exists
- **A working payment API**, including the idempotency guarantee that stops a retry taking money twice
- **The knowledge that `kubectl scale` does not change your files** — the first hint of configuration drift

**Next:** [L1.5 — Services](../L1.5-services/) — because pods get new IP addresses every time they restart, and nothing can find them yet.
