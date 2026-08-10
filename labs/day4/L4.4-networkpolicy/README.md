# L4.4 · Zero Trust — And Everything Breaks In The Middle

| | |
|---|---|
| **Time** | 50 minutes |
| **Difficulty** | The most important lab of the day |
| **You need first** | [L4.3](../L4.3-ingress-tls/) finished |
| **You will create** | 22 NetworkPolicies |
| **Check you are done** | `make validate-lab LAB=L4.4` |

> **Everything stops working in the middle of this lab, on purpose.** When it does, do not skip ahead — work out why. You predicted the error message in L4.2 Step 6.

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

Right now any pod in your cluster can reach any other pod. You will prove it by connecting to the payments database from the DMZ, which in a PCI assessment is a finding that puts the DMZ inside the cardholder data environment.

Then you will apply **default-deny** to the payment namespaces, watch the entire platform stop, **work out the cause yourself**, and allow-list the calls the platform genuinely makes.

At the end you will run the same command you started with and get a timeout instead of a connection.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get daemonset -n kube-system calico-node` | `3   3   3` |

> ### If #2 returns `NotFound`, stop.
>
> Without Calico every policy here applies cleanly and **enforces nothing** — which is the worst possible outcome in a security lab, because everything appears to work. The network plugin cannot be changed on a running cluster:
>
> ```bash
> minikube delete -p axispay && make cluster
> ```
>
> Tell your instructor. It is worth checking whether the whole room is affected.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | 14 policy files, applied in a deliberate order |

---

## The three properties that decide everything

```
  1. DEFAULT-ALLOW    A pod is unrestricted until SOME policy selects it.
                      "We have NetworkPolicies" and "we have segmentation"
                      are different claims.

  2. ADDITIVE         Policies only ever ADD permission. There is no deny
                      rule. You deny by selecting a pod and permitting
                      nothing.

  3. BOTH DIRECTIONS  Egress at the source AND ingress at the destination
                      must both allow a flow. Either one blocks it.
```

---

## Step 1 — Prove the finding

```bash
kubectl exec -n axispay-edge deploy/edge-gateway -- python3 -c "
import socket
try:
    socket.create_connection(('postgres.axispay-data.svc.cluster.local',5432),timeout=5)
    print('CONNECTED to PostgreSQL from the DMZ  <- this is the finding')
except Exception as e:
    print('BLOCKED:', type(e).__name__)
"
```

```
CONNECTED to PostgreSQL from the DMZ  <- this is the finding
```

**What that means.** `edge-gateway` is internet-facing. It has no business reaching the payments database, and it has never tried to — but it *can*.

In a PCI assessment that single fact puts the DMZ **inside the cardholder data environment**. Every control that applies to the CDE now applies to the gateway, to everyone who can deploy it, and to its logs. The audit gets larger, longer and more expensive.

**Remember this command.** You will run it again at the end.

---

## Step 2 — Default-deny, and watch everything break

```bash
kubectl apply -f manifests/01-default-deny.yaml
```

```yaml
spec:
  podSelector: {}                    # ① EVERY pod in this namespace
  policyTypes: [Ingress, Egress]     # ② both directions
                                     # ③ and NO rules at all
```

**Those three lines are the entire policy.** Selecting every pod and permitting nothing is how you express "deny" in a system that has no deny rule.

**Now watch it land:**

```bash
sleep 20
kubectl get pods -A -l app.kubernetes.io/part-of=axispay | head
curl -sk -o /dev/null -w '%{http_code}\n' https://api.axispay.local/api/v1/_info
```

**Everything is failing.** Pods going unready, payments returning errors.

---

## Step 3 — Work out why, before reading on

**Do not skip this.** Look at the logs and diagnose it yourself:

```bash
kubectl logs -n axispay-core deploy/payment-service --tail=10
```

You will see something like:

```
httpx.ConnectError: [Errno -3] Temporary failure in name resolution
```

**Three questions to answer before continuing:**

1. Is that a *connection* failure or a *name resolution* failure?
2. Where does a DNS lookup actually go?
3. Which namespace is that in — and is it one you just applied a policy to?

<details>
<summary><b>The answer</b></summary>

It is a **name resolution** failure. Every service call begins with a DNS lookup to CoreDNS, which lives in `kube-system`.

That lookup is **egress traffic**, and your default-deny policy blocked all egress — including port 53.

So nothing can resolve any name, and the symptom looks like a DNS outage rather than a policy change. **You saw this exact error in L4.2 Step 5, and predicted it in Step 6.**

This is the most common NetworkPolicy mistake there is, and it produces a symptom that points at the wrong component entirely.
</details>

---

## Step 4 — Allow DNS

```bash
kubectl apply -f manifests/02-allow-dns.yaml
```

```yaml
egress:
  - to:
      - namespaceSelector:
          matchLabels: { kubernetes.io/metadata.name: kube-system }
        podSelector:
          matchLabels: { k8s-app: kube-dns }
    ports:
      - { protocol: UDP, port: 53 }
      - { protocol: TCP, port: 53 }   # <- TCP too. Large answers use it.
```

```bash
sleep 20
kubectl logs -n axispay-core deploy/payment-service --tail=5
```

The errors change: no longer "name resolution", now connection timeouts. **Progress** — names resolve, connections are still blocked. Exactly as expected, because you have permitted nothing else yet.

---

## Step 5 — Allow-list the real call paths

```bash
kubectl apply -f manifests/
sleep 25
kubectl get pods -A -l app.kubernetes.io/part-of=artifact 2>/dev/null
kubectl get pods -A -l app.kubernetes.io/part-of=axispay | grep -v '1/1' | grep -v NAME || echo "all Ready"
```

Read one of them:

```bash
cat manifests/03-core-ingress.yaml | head -30
```

Each policy names **one flow**: this source, this destination, this port. Nothing wildcarded, nothing "just in case".

**Confirm payments work:**

```bash
curl -sk -X POST https://api.axispay.local/api/v1/payments \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H 'Idempotency-Key: l44-restored' \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-L44-001","amount_minor":60000,"currency":"ZAR","card_token":"tok_visa_4242"}' \
  | jq '{payment_id, status}'
```

---

## Step 6 — Prove the finding is closed

**The same command from Step 1:**

```bash
kubectl exec -n axispay-edge deploy/edge-gateway -- python3 -c "
import socket
try:
    socket.create_connection(('postgres.axispay-data.svc.cluster.local',5432),timeout=5)
    print('CONNECTED  <- the finding is still open')
except Exception as e:
    print('BLOCKED — the DMZ can no longer reach the vault:', type(e).__name__)
"
```

```
BLOCKED — the DMZ can no longer reach the vault: TimeoutError
```

**Opening the day with `CONNECTED` and closing it with `BLOCKED`, using the same command, is the cleanest demonstration in the course.**

### Why a timeout and not "connection refused"

The packet is **dropped** by the CNI. No RST comes back, so the client waits for its own timeout.

A *refusal* would mean the packet reached a host that actively declined it — which would mean the policy was not enforcing. **The failure mode is itself part of the evidence**, and a QSA who knows that will ask.

---

## Step 7 — Test the whole matrix

```bash
python3 scripts/validate/simulate-netpol.py
```

```
All 46 policy assertions hold.
  19 calls the platform makes: ALLOWED
  8 controls enforced: BLOCKED
```

**That script is the evidence.** Reading YAML proves nothing about enforcement; asserting the intended matrix does.

**Test one by hand too**, because the simulator is only as good as its assertions:

```bash
kubectl run probe --rm -it --restart=Never --image=busybox:1.37 -n axispay-async \
  -- timeout 5 nc -zv postgres.axispay-data.svc.cluster.local 5432
```

Async → data is allowed (settlement writes there). Try edge → data and it will not be.

---

## Did it work?

```bash
make validate-lab LAB=L4.4
```

---

## Clean up

Nothing — segmentation stays for the rest of the course, and Friday's capstone tries to talk you into removing it.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| Policies applied but nothing is blocked | **No Calico** | See "What you need before you start". Everything here is theatre without it |
| Name resolution failures | DNS egress not allowed | `kubectl apply -f manifests/02-allow-dns.yaml` |
| Some services work, others do not | A flow is missing from the allow-list | Compare the failing call with `manifests/03-*` and `04-*` |
| Everything broken after applying all files | Applied out of order | `kubectl apply -f manifests/` again — it converges |
| Ingress returns 503 | The controller cannot reach the gateway | `manifests/07-allow-ingress-controller.yaml` |
| Simulator disagrees with reality | The simulator models logic, not enforcement | Trust the live test; check Calico is healthy |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/04-networking-and-exposure/solutions.md).

**1.** Write the **smallest** policy set that lets `reporting-service` read PostgreSQL and nothing else. Prove nothing else got through.

**2.** Could a compromised `payment-service` reach the internet? Test it, and explain what you find — and what single line in `01-default-deny.yaml` decides the answer.

**3.** A QSA asks: *"Demonstrate that your DMZ cannot reach cardholder data."* Write the exact commands and say what output constitutes proof. Two paragraphs.

---

## What you built

- **22 NetworkPolicies** enforcing zero trust across four namespaces
- **The finding opened and closed with the same command**
- **The DNS failure derived rather than told** — the mistake everyone makes, met safely
- **46 assertions** proving the matrix, not the YAML
- **Why a timeout rather than a refusal is itself evidence**

**Next:** [L4.5 — Placement](../L4.5-placement/) — because right now all three payment replicas could be on one node.
