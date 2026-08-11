# L1.5 · Services — A Name That Does Not Change

| | |
|---|---|
| **Time** | 40 minutes |
| **Difficulty** | One new idea, applied four times |
| **You need first** | [L1.4](../L1.4-deployments/) finished — 8 pods running |
| **You will create** | 4 Services |
| **Check you are done** | `make validate-lab LAB=L1.5` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`.
- Full version: [`labs/GETTING-STARTED.md`](../../../GETTING-STARTED.md).
</details>

---

## What you are going to do

Your pods work. But they have a problem you are about to see for yourself: **every pod gets a new IP address when it restarts.** In L1.4 you deleted a pod and a replacement appeared — with a different address. Anything that had written down the old one is now pointing at nothing.

You will create **Services**. A Service is a name and an address that never change, sitting in front of a group of pods that constantly do.

The surprising part is *how* a Service finds its pods. There is no list, no registration, no configuration linking them. It searches by **label** — the same labels you have been writing since L1.2. You will prove this by breaking one on purpose.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get pods -A -l app.kubernetes.io/part-of=axispay` | 8 pods, all `1/1 Running` |

If pods are missing, go back and finish [L1.4](../L1.4-deployments/).

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/01-service-edge-gateway.yaml` | Front door for the platform. |
| `manifests/02-service-auth-service.yaml` | |
| `manifests/03-service-merchant-service.yaml` | |
| `manifests/04-service-payment-service.yaml` | The one you will read in detail. |

---

## Step 1 — See the problem for yourself

**Why we are doing this.** The reason Services exist is easiest to believe when you have watched the problem happen.

**Run this** to note the current addresses:

```bash
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service -o wide
```

```
NAME                              READY   STATUS    IP            NODE
payment-service-7d4f8b9c6-h9mzt   1/1     Running   10.244.1.7    axispay-m02
payment-service-7d4f8b9c6-lk8vt   1/1     Running   10.244.2.4    axispay-m03
payment-service-7d4f8b9c6-p7rmx   1/1     Running   10.244.1.8    axispay-m02
```

**Write down one of those IPs.** Then delete that pod:

```bash
kubectl delete pod payment-service-7d4f8b9c6-h9mzt -n axispay-core
```

Use your own pod name — yours will differ.

**Wait a few seconds, then look again:**

```bash
kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service -o wide
```

```
NAME                              READY   STATUS    IP            NODE
payment-service-7d4f8b9c6-lk8vt   1/1     Running   10.244.2.4    axispay-m03
payment-service-7d4f8b9c6-p7rmx   1/1     Running   10.244.1.8    axispay-m02
payment-service-7d4f8b9c6-w8xkz   1/1     Running   10.244.1.9    axispay-m02
```

**The IP you wrote down is gone.** A new pod arrived with a different address.

**What that means.** Pod IPs are temporary. They change on every restart, every rescheduling, every rollout. **You can never hard-code one.** And with three pods you would have to know all three, and keep the list current, forever.

That is the problem a Service solves.

---

## Step 2 — Read the Service manifest

**Run this:**

```bash
cat manifests/04-service-payment-service.yaml
```

```yaml
apiVersion: v1
kind: Service
metadata:
  name: payment-service                        # ① becomes the DNS name
  namespace: axispay-core
spec:
  type: ClusterIP                              # ② reachable inside the cluster only
  selector:                                    # ③ HOW IT FINDS PODS
    app.kubernetes.io/name: payment-service
    app.kubernetes.io/instance: axispay
  ports:
    - name: http
      port: 8080                               # ④ the Service's port
      targetPort: http                         # ⑤ the pod's port, BY NAME
      protocol: TCP
```

| | What it means |
|---|---|
| ① | The name. This becomes a real DNS name inside the cluster: `payment-service.axispay-core.svc.cluster.local`. Other services use it in URLs and never think about IPs again. |
| ② | `ClusterIP` — a stable virtual address reachable from inside the cluster. There are four other types; you meet them all on Day 4. |
| ③ | **The selector — the whole trick.** "My pods are any pods carrying these labels." Not a list of names. Not a registration step. A live search. |
| ④ | The port the Service listens on. |
| ⑤ | Which port on the pod to forward to — referenced **by name** (`http`), not by number. The pod manifest in L1.3 named its port `http`. Using the name means you can change the number in one place without touching the Service. |

### The selector is worth pausing on

Look at ③, then look back at the labels in [`../L1.4-deployments/manifests/04-deployment-payment-service.yaml`](../L1.4-deployments/manifests/04-deployment-payment-service.yaml).

They match. **That match is the only connection between the Service and the pods.** Nothing registers, nothing is configured, no file lists the members. Kubernetes continuously searches for pods carrying those labels, and whatever it finds *is* the Service's membership — right now.

Which means: a new pod is a member the moment it becomes ready. A deleted pod stops being one the moment it stops being ready. No updates, no restarts, nothing to maintain.

It also means a typo in a label is a Service that points at nothing — and looks completely healthy. Step 6.

---

## Step 3 — Create the Services

**Run this:**

```bash
kubectl apply -f manifests/
```

```
service/edge-gateway created
service/auth-service created
service/merchant-service created
service/payment-service created
```

**Look at them:**

```bash
kubectl get svc -A -l app.kubernetes.io/part-of=axispay
```

```
NAMESPACE      NAME               TYPE        CLUSTER-IP      PORT(S)    AGE
axispay-core   merchant-service   ClusterIP   10.96.142.11    8080/TCP   20s
axispay-core   payment-service    ClusterIP   10.96.201.47    8080/TCP   20s
axispay-edge   auth-service       ClusterIP   10.96.88.203    8080/TCP   20s
axispay-edge   edge-gateway       ClusterIP   10.96.170.9     8080/TCP   20s
```

**What that means.** Each Service has a `CLUSTER-IP`. **That address never changes for the life of the Service** — no matter how many times the pods behind it are replaced.

> It is a *virtual* address. Nothing is actually listening on it. There is no proxy process in the middle. Each node's kernel has forwarding rules that rewrite traffic for that address to a real pod. You will take those rules apart on Day 4; for now, know that a Service adds no extra hop and cannot itself fall over.

---

## Step 4 — Look at what the selector found

**Why we are doing this.** This is the single most useful diagnostic command in Kubernetes, and almost nobody knows it.

**Run this:**

```bash
kubectl get endpointslices -n axispay-core -l kubernetes.io/service-name=payment-service
```

**What you should see:**

```
NAME                       ADDRESSTYPE   PORTS   ENDPOINTS                          AGE
payment-service-x7k2m      IPv4          8080    10.244.2.4,10.244.1.8,10.244.1.9   1m
```

**Three IPs — exactly the three pods currently running.**

**What that means.** An EndpointSlice is the *answer* to the selector's search: the current list of pod addresses behind this Service. Kubernetes rebuilds it continuously.

> **Learn this command. It is the one that tells you the truth.**
>
> When a service cannot reach another service, the first question is not "is the pod up" — it is **"does the Service have any endpoints?"**
>
> - **Endpoints listed** → the Service found its pods. The problem is elsewhere.
> - **Empty** → either every pod is unready, or the selector matches nothing.
>
> That single check splits the problem in half in two seconds, and you will use it in every incident this week.

**Prove it tracks reality**, by deleting a pod and looking again:

```bash
kubectl delete pod -n axispay-core -l app.kubernetes.io/name=payment-service --field-selector=status.phase=Running 2>/dev/null | head -1
sleep 5
kubectl get endpointslices -n axispay-core -l kubernetes.io/service-name=payment-service
```

The list has changed. Nobody updated it — it is recalculated as reality changes.

---

## Step 5 — Use the name, from another pod

**Why we are doing this.** Time to see the payoff: one name, three pods, automatic spreading.

**Run this** — it starts a small throwaway pod and calls the service by name, ten times:

```bash
kubectl run curltest --rm -it --restart=Never \
  --image=curlimages/curl:8.11.1 -n axispay-core -- \
  sh -c 'for i in 1 2 3 4 5 6 7 8 9 10; do
           curl -s http://payment-service:8080/api/v1/_info | grep -o "\"pod\":\"[^\"]*\"";
         done'
```

**What you should see:**

```
"pod":"payment-service-7d4f8b9c6-lk8vt"
"pod":"payment-service-7d4f8b9c6-w8xkz"
"pod":"payment-service-7d4f8b9c6-lk8vt"
"pod":"payment-service-7d4f8b9c6-p7rmx"
"pod":"payment-service-7d4f8b9c6-w8xkz"
...
pod "curltest" deleted
```

**Different pod names.** The requests were spread across all three.

**What that means.** Two things happened, both invisible:

1. `payment-service` — a bare name, no namespace, no domain — was resolved to the Service's address. It worked because the calling pod is in the same namespace.
2. Each connection was sent to a different pod, chosen by the kernel's forwarding rules.

**No load balancer was configured. No pool was defined.** A Service is a load balancer, and you got it by writing eight lines of YAML.

### The four ways to write the name

```bash
kubectl run dnstest --rm -it --restart=Never --image=busybox:1.37 -n axispay-edge \
  -- nslookup payment-service.axispay-core.svc.cluster.local
```

```
Name:      payment-service.axispay-core.svc.cluster.local
Address 1: 10.96.201.47 payment-service.axispay-core.svc.cluster.local
```

| You write | It works from | Use it when |
|---|---|---|
| `payment-service` | the same namespace | Quick, and inside one namespace |
| `payment-service.axispay-core` | anywhere in the cluster | Crossing namespaces |
| `payment-service.axispay-core.svc` | anywhere | Rarely — it is just less typing than the full form |
| `payment-service.axispay-core.svc.cluster.local` | anywhere | **In configuration.** Unambiguous, and it is what the AxisPay manifests use |

The short form is convenient; the long form is the one to put in a config file, because it cannot be misread depending on where the caller happens to live. Day 4 explains what the extra parts cost.

---

## Step 6 — Break one on purpose

**Why we are doing this.** You are about to make the most common Service mistake there is, on purpose, in a safe place — so that when it happens for real you recognise it in ten seconds instead of an hour.

**Run this** — it creates a Service whose selector matches nothing:

```bash
kubectl create service clusterip broken-service \
  --tcp=8080:8080 -n axispay-core --dry-run=client -o yaml \
  | sed 's/app: broken-service/app.kubernetes.io\/name: payment-servce/' \
  | kubectl apply -f -
```

Look carefully: `payment-servce`. A missing `i`. That is the whole bug.

**Now look at it:**

```bash
kubectl get svc broken-service -n axispay-core
```

```
NAME             TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
broken-service   ClusterIP   10.96.44.180   <none>        8080/TCP   10s
```

**It looks perfectly healthy.** It has an address. There is no warning, no error, no red text. `kubectl describe` will not complain either.

**Now ask the question that matters:**

```bash
kubectl get endpointslices -n axispay-core -l kubernetes.io/service-name=broken-service
```

```
NAME                    ADDRESSTYPE   PORTS     ENDPOINTS   AGE
broken-service-9k2mx    IPv4          <unset>   <unset>     30s
```

**Empty.** No addresses.

**And what a caller experiences:**

```bash
kubectl run brokentest --rm -it --restart=Never \
  --image=curlimages/curl:8.11.1 -n axispay-core \
  -- curl -s --max-time 5 http://broken-service:8080/healthz
```

```
command terminated with exit code 7
```

Connection refused. The name resolved fine; there was simply nothing behind it.

**What that means — and this is the lesson:**

- `kubectl get svc` shows a healthy Service. **It does not check the selector matches anything.**
- The application sees "connection refused" and its author will reasonably suspect the *other* service is down.
- **`kubectl get endpointslices` is the only command that reveals it**, and it takes two seconds.

Write this on your cheat sheet. You will need it on Day 4 and again in Friday's assessment.

**Clean up the broken one:**

```bash
kubectl delete svc broken-service -n axispay-core
```

---

## Step 7 — Prove the platform is wired together

Now that all four Services exist, the services can find each other by name — which is what `edge-gateway` needs to route a payment.

**Terminal 1:**

```bash
kubectl port-forward -n axispay-edge svc/edge-gateway 8080:8080
```

Note `svc/edge-gateway` — you are forwarding to the **Service** now, not to a pod. It will pick a healthy pod for you and keep working if that pod is replaced.

**Terminal 2:**

```bash
curl -s -X POST http://localhost:8080/api/v1/payments \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' \
  -H 'Idempotency-Key: l15-service-test' \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-L15-001","amount_minor":89900,"currency":"ZAR","card_token":"tok_visa_4242"}' \
  | jq '{payment_id, status, display_amount}'
```

```json
{
  "payment_id": "pay_01J8XR2M7P4Q1",
  "status": "captured",
  "display_amount": "R 899.00"
}
```

**What that means.** That request travelled: your laptop → the gateway Service → a gateway pod → the auth Service → an auth pod → the payment Service → a payment pod → the merchant Service → a merchant pod → and back.

**Every hop used a name, not an address.** Every one of those pods could be replaced right now and it would still work.

**Close the tunnel** with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

---

## Did it work?

```bash
make validate-lab LAB=L1.5
```

```
✓ L1.5 PASSED — 12/12 checks
```

---

## Clean up

Keep the Services — the whole week depends on them.

Remove any strays from this lab:

```bash
kubectl delete svc broken-service -n axispay-core --ignore-not-found
kubectl delete pod curltest dnstest brokentest -n axispay-core --ignore-not-found
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| Service exists, endpoints empty | The selector matches no ready pods | Compare the Service's selector with the pod's labels, character by character. See Step 6. |
| `curl` gives `exit code 7` | Connection refused — nothing behind the name | `kubectl get endpointslices -n <ns>` first, always |
| `curl` gives `exit code 6` | DNS could not resolve the name | Check spelling and namespace. `kubectl get pods -n kube-system -l k8s-app=kube-dns` |
| `curl` gives `exit code 28` | Timed out — reached something that never answered | Usually a wrong `targetPort`. Compare it with the pod's `containerPort` |
| Every request hits the same pod | Only one pod is ready | `kubectl get pods -n axispay-core` and check the READY column |
| `kubectl run` says `already exists` | A previous throwaway pod did not clean up | `kubectl delete pod <name> -n <ns>` |
| Endpoints appear then vanish | Pods are failing readiness intermittently | `kubectl describe pod <name>` and read the events |

---

## Try this yourself

Answers in [`solutions.md`](../../solutions.md).

**1.** Using only `kubectl`, work out which pods are behind `merchant-service` **without** running `kubectl get pods`.

**2.** Create a Service whose selector matches nothing. Does `kubectl apply` fail? Does `kubectl get svc` look healthy? What is the only command that reveals the problem? Write the answer on your cheat sheet — this is Step 6 from memory, and it is worth being able to do it cold.

**3.** Scale `payment-service` to 6, then to 1, watching EndpointSlices the whole time. How quickly do endpoints track the replica count? What removes an endpoint *before* the pod actually dies? (You will build that mechanism on Tuesday.)

### Bonus

```bash
minikube -p axispay ssh -- sudo iptables-save | grep payment-service | head -20
```

Those are the kernel rules that make the Service address work — written by `kube-proxy` on every node, updated every time the endpoints change.

There is no proxy process in the path. **A Service is not a server; it is a set of rules.** That is why it cannot crash, and why it adds no latency. You will take this apart properly on Day 4.

---

## What you built

- **Four Services** — stable names in front of pods that come and go
- **Proof that pod IPs change** and why nothing can hard-code one
- **Label selectors as a live search**, not a registration step
- **`kubectl get endpointslices`** — the command that tells you the truth about a Service
- **A broken Service you built deliberately**, so you will recognise the shape of that failure later
- **A payment flowing through four services**, every hop by name

**Next:** [L1.6 — Assemble the platform](../L1.6-platform-assembly/) — less hand-holding, and the first time you are asked to work it out yourself.
