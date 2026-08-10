# L4.2 · DNS — The Thing You Have Been Trusting All Week

| | |
|---|---|
| **Time** | 30 minutes |
| **Difficulty** | One config file explains three days of behaviour |
| **You need first** | [L4.1](../L4.1-service-types/) finished |
| **You will change** | Nothing permanently — you break DNS and put it back |
| **Check you are done** | `make validate-lab LAB=L4.2` |

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

Every service call you have made this week started with a DNS lookup, and you have never looked at one.

You will open `/etc/resolv.conf` inside a pod, find out why `payment-service` resolves at all, measure what the default settings cost in round trips, and then **scale CoreDNS to zero** so you know exactly what a DNS failure looks like.

That last part matters more than it sounds: in L4.4 you will apply a policy that blocks DNS, and the symptom will be identical. Recognising it there is worth twenty minutes of confusion.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get pods -n kube-system -l k8s-app=kube-dns` | CoreDNS `Running` |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |

No manifests — this lab inspects and breaks rather than creating.

---

## Step 1 — Look at resolv.conf

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $POD -- cat /etc/resolv.conf
```

```
nameserver 10.96.0.10
search axispay-core.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

| Line | What it means |
|---|---|
| `nameserver` | The ClusterIP of the CoreDNS Service. Kubernetes wrote this in. |
| `search` | Suffixes tried, **in order**, for a name that is not fully qualified. This is why bare `payment-service` works from inside `axispay-core`. |
| `options ndots:5` | If a name has **fewer than 5 dots**, try the search domains first. See Step 3. |

---

## Step 2 — The four forms of a name

```bash
kubectl exec -n axispay-core $POD -- sh -c '
for n in payment-service \
         payment-service.axispay-core \
         payment-service.axispay-core.svc \
         payment-service.axispay-core.svc.cluster.local; do
  echo "--- $n"
  nslookup "$n" 2>/dev/null | grep -A1 "^Name" | head -2
done'
```

All four resolve to the same address.

**Use the full form in configuration files.** It is unambiguous regardless of where the caller lives, and it is what every AxisPay manifest uses. The short form is for typing at a prompt.

---

## Step 3 — What `ndots:5` costs

`payment-service.axispay-core.svc.cluster.local` has **four** dots. Four is fewer than five, so it is **not** treated as absolute — every search domain is tried first, and only then the name itself.

```bash
kubectl exec -n axispay-core $POD -- sh -c '
time (for i in $(seq 1 50); do nslookup payment-service.axispay-core.svc >/dev/null 2>&1; done)
echo "--- now with a trailing dot (absolute) ---"
time (for i in $(seq 1 50); do nslookup payment-service.axispay-core.svc. >/dev/null 2>&1; done)'
```

**The trailing dot is faster** — one lookup instead of several.

**Why the default is 5 anyway:** it makes short names work, which is what most people expect. The cost is a few milliseconds per lookup — invisible at 10 requests/second and material at 10,000.

> **Setting `ndots: 1` platform-wide** makes short names stop resolving entirely. Every URL must then be fully qualified. That is a defensible choice, and it has to be all-or-nothing.

---

## Step 4 — Where CoreDNS keeps its configuration

```bash
kubectl get configmap coredns -n kube-system -o jsonpath='{.data.Corefile}'
```

```
.:53 {
    errors
    health
    kubernetes cluster.local in-addr.arpa ip6.arpa { ... }
    forward . /etc/resolv.conf
    cache 30
}
```

| Line | What it does |
|---|---|
| `kubernetes cluster.local` | Answers for cluster names by watching the Kubernetes API |
| `forward .` | Anything else goes to the node's own resolver — this is how a pod reaches the internet |
| `cache 30` | Answers cached for 30 seconds. **Remember this** — it explains the delay in L4.4 |

---

## Step 5 — Break it, and learn the shape

**This is the point of the lab.**

```bash
kubectl scale deployment coredns -n kube-system --replicas=0
sleep 10
kubectl exec -n axispay-core $POD -- python3 -c "
import urllib.request
try:
    urllib.request.urlopen('http://merchant-service.axispay-core.svc.cluster.local:8080/healthz',timeout=5)
    print('still working (cached)')
except Exception as e:
    print(type(e).__name__, e)
"
```

```
URLError <urlopen error [Errno -3] Temporary failure in name resolution>
```

**Learn that message.**

- It is a **name resolution** failure, not a connection failure.
- Not "connection refused" — nothing was ever attempted, because there was no address to attempt.
- Every service in the cluster fails at once, which makes it look like a total outage.

**Note also that it may work for the first 30 seconds** — that is the `cache 30`. Failures after a DNS change are *delayed*, not immediate, which makes the cause harder to spot.

**Put it back:**

```bash
kubectl scale deployment coredns -n kube-system --replicas=2
kubectl rollout status deployment/coredns -n kube-system
```

---

## Step 6 — Write down your prediction for L4.4

**Do this now**, before the next lab.

In L4.4 you will apply a default-deny network policy and forget to allow DNS. Write down, in your own words, the exact error you expect the application to log.

Then check yourself on Thursday afternoon. Most people are surprised by how much time this saves them.

---

## Did it work?

```bash
make validate-lab LAB=L4.2
```

---

## Clean up

```bash
kubectl scale deployment coredns -n kube-system --replicas=2
```

Make sure CoreDNS is back before you continue.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| Everything broken after Step 5 | CoreDNS still at 0 | `kubectl scale deployment coredns -n kube-system --replicas=2` |
| `nslookup: command not found` | Minimal image | Use a `busybox:1.37` pod instead |
| Names resolve but connections fail | DNS is fine; something else is not | `kubectl get endpointslices -n <ns>` |
| `time` gives no output | Shell builtin difference | Run the loop and time it by eye |
| Still failing after CoreDNS returns | Cached negative answer | Wait 30 seconds |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/04-networking-and-exposure/solutions.md).

**1.** Measure the difference between resolving `payment-service.axispay-core.svc` and the same name with a trailing dot, 100 times. Quantify the cost of `ndots:5` in milliseconds.

**2.** A service resolves fine but connections time out. Name three causes and the command that distinguishes each.

**3.** Predict, before L4.4: you apply a default-deny egress policy and forget DNS. What **exact** error appears in the application logs? Write it down and check yourself later.

---

## What you built

- **`/etc/resolv.conf` understood**, and why bare names work
- **The cost of `ndots:5`**, measured rather than assumed
- **The CoreDNS Corefile**, including the 30-second cache
- **A DNS outage produced deliberately**, and its exact error message
- **A written prediction** for the failure you will cause on purpose in L4.4

**Next:** [L4.3 — Ingress and TLS](../L4.3-ingress-tls/) — let a merchant reach you over HTTPS.
