# L4.1 · The Five Service Types

| | |
|---|---|
| **Time** | 35 minutes |
| **Difficulty** | Confirmation of things you have relied on for three days |
| **You need first** | Day 3 finished — `make validate-day3` passes |
| **You will create** | 3 extra Services, then remove two |
| **Check you are done** | `make validate-lab LAB=L4.1` |

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

You have used `ClusterIP` since Monday without examining it. Today you open it up: the four rules Kubernetes demands of any network plugin, all five Service types, and the kernel rules that make a Service address work.

The thing worth carrying away: **a Service is not a server.** Nothing is listening on that IP. There is no process in the path. It is a set of forwarding rules, which is why it cannot crash and adds no latency.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `make validate-day3` | `DAY 3 CHECKPOINT PASSED` |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | The extra Service types you will experiment with |

---

## The four rules

Kubernetes does not implement networking. It **requires** four properties of whatever plugin you install:

```
  1. Every pod gets its own IP.
     Not a port on a shared host IP. Which is why two pods can both
     listen on 8080 with no conflict.

  2. Pods reach all pods without NAT.
     Across nodes. The destination sees the source's real IP.

  3. Nodes reach all pods without NAT.
     This is what lets the kubelet run your probes.

  4. The IP a pod sees itself as is the IP others see.
     No split horizon. A pod can put its own address in a message.
```

**Prove rule 1 and 2 yourself:**

```bash
kubectl get pods -A -l app.kubernetes.io/part-of=axispay -o wide | awk '{print $1, $2, $7, $8}' | head
```

Every pod has a distinct IP, and pods on different nodes are on the same flat network.

```bash
SRC=$(kubectl get pod -n axispay-edge -l app.kubernetes.io/name=edge-gateway -o jsonpath='{.items[0].metadata.name}')
DSTIP=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].status.podIP}')
kubectl exec -n axispay-edge $SRC -- python3 -c "
import urllib.request;print(urllib.request.urlopen('http://$DSTIP:8080/healthz',timeout=5).status)"
```

`200` — across namespaces and across nodes, no gateway, no NAT.

---

## Step 1 — The five types

| Type | What it gives you | Reachable from |
|---|---|---|
| `ClusterIP` | A stable virtual IP | Inside the cluster only |
| `NodePort` | The same, plus a port on **every** node | Outside, if you can reach a node |
| `LoadBalancer` | The same, plus a cloud load balancer | The internet |
| `ExternalName` | A DNS CNAME. **No proxying at all** | Wherever the target is |
| **headless** (`clusterIP: None`) | No virtual IP — DNS returns pod IPs | Inside; for addressing individuals |

```bash
kubectl apply -f manifests/
kubectl get svc -A -l app.kubernetes.io/part-of=axispay
```

---

## Step 2 — NodePort

```bash
kubectl get svc edge-gateway-nodeport -n axispay-edge
```

```
NAME                    TYPE       CLUSTER-IP     PORT(S)          AGE
edge-gateway-nodeport   NodePort   10.96.170.9    8080:30080/TCP   20s
```

**`8080:30080`** — cluster port 8080, node port 30080. **Every node listens on 30080**, including nodes running none of the pods.

```bash
MIP=$(minikube ip -p axispay)
curl -s http://$MIP:30080/api/v1/_info | jq '{service, pod}'
```

**Why it is discouraged in production:** the port range (30000–32767) is arbitrary and has to be documented out of band; every node listens, so your firewall surface is the whole cluster; there is no TLS, no path routing, and no health-aware load balancing; and clients must know node addresses, which change.

**When it is right:** bare metal with an external load balancer you manage yourself, pointed at a known NodePort. That is what MetalLB and most on-premises setups do underneath.

---

## Step 3 — LoadBalancer, and why it says `<pending>`

```bash
kubectl get svc -n axispay-edge | grep LoadBalancer || echo "(none yet)"
kubectl expose deployment edge-gateway -n axispay-edge --type=LoadBalancer --port=8080 --name=lb-demo
sleep 5
kubectl get svc lb-demo -n axispay-edge
```

```
NAME      TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)
lb-demo   LoadBalancer   10.96.44.21    <pending>     8080:31234/TCP
```

**`<pending>` forever.** A LoadBalancer Service asks the *cloud provider* to create a real load balancer. There is no cloud provider here, so nobody answers.

That is not a bug — it is the correct behaviour, and it is what you will see on any cluster without a cloud controller or something like MetalLB. Notice it still got a NodePort: LoadBalancer is a superset.

```bash
kubectl delete svc lb-demo -n axispay-edge
```

---

## Step 4 — Headless

```bash
kubectl get svc payment-service-headless -n axispay-core
```

```
NAME                       TYPE        CLUSTER-IP   PORT(S)
payment-service-headless   ClusterIP   None         8080/TCP
```

**`CLUSTER-IP: None`.** DNS returns the pod addresses directly instead of one virtual IP:

```bash
kubectl run dnstest --rm -it --restart=Never --image=busybox:1.37 -n axispay-core \
  -- nslookup payment-service-headless
```

Three addresses, not one.

**When to use which:**

- **ClusterIP** when you want *any* healthy pod and want kube-proxy to spread load. The normal case.
- **Headless** when you must address a *specific* pod (`postgres-0`), or when the client does its own load balancing — which most gRPC clients do.

**Pick wrongly and:** a gRPC client on a ClusterIP opens one long-lived connection to one pod and never rebalances; a REST client on a headless Service takes whichever address DNS returned first and hammers one pod.

---

## Step 5 — ExternalName

```bash
kubectl get svc acquirer-gateway -n axispay-core -o yaml | grep -A3 'spec:'
```

```yaml
spec:
  type: ExternalName
  externalName: acquirer.example.com
```

**No selector, no endpoints, no proxying.** DNS returns a CNAME and the pod connects directly.

Its value is **indirection**: your code says `acquirer-gateway`, and switching acquirer means editing one Service instead of every config file.

---

## Step 6 — There is no proxy in the path

```bash
minikube -p axispay ssh -- sudo iptables-save 2>/dev/null | grep -c KUBE-SVC || echo "(IPVS mode)"
minikube -p axispay ssh -- sudo iptables-save 2>/dev/null | grep payment-service | head -8
```

Rules with statistical matching — `--probability 0.33333` and so on — which is how load balancing actually happens.

**Written by `kube-proxy` on every node, updated whenever endpoints change.** kube-proxy is not in the data path; it writes the rules the kernel uses.

**Which is why a Service cannot crash and adds no latency.** It is not a component; it is configuration.

---

## Did it work?

```bash
make validate-lab LAB=L4.1
```

---

## Clean up

```bash
kubectl delete svc lb-demo -n axispay-edge --ignore-not-found
```

Keep the rest.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `EXTERNAL-IP` `<pending>` forever | No cloud provider | Expected. Use NodePort or `minikube tunnel` |
| NodePort unreachable | Wrong IP, or a firewall | `minikube ip -p axispay` |
| Headless returns one address | It is not actually headless | `clusterIP: None` must be set |
| `nslookup` fails | CoreDNS trouble | `kubectl get pods -n kube-system -l k8s-app=kube-dns` |
| `iptables-save` empty | Cluster is in IPVS mode | `minikube ssh -- sudo ipvsadm -Ln \| head` |

---

## Try this yourself

Answers in [`solutions.md`](../../solutions.md).

**1.** A Service has an IP but requests fail. Using only `kubectl`, determine in under three minutes whether the cause is the selector, readiness, or the target port. Write the three commands in order.

**2.** Explain why NodePort is discouraged in production, then name a situation where it is the correct choice.

**3.** `payment-service-headless` and `payment-service` select the same pods. Explain when a client should use each, and what breaks if it picks wrongly.

---

## What you built

- **The four networking rules**, proved from your own cluster
- **All five Service types**, including the two that proxy nothing
- **`<pending>` understood** as correct behaviour rather than a fault
- **The iptables rules behind a Service**, and the fact that no proxy is in the path

**Next:** [L4.2 — DNS](../L4.2-dns/) — which you have relied on for three days without opening.
