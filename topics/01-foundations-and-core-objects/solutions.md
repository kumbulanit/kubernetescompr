# Day 1 — Solutions

> **Read the lab first.** Adults learn faster with the answer available and the discipline not to open it. Use this to check yourself, or when you are genuinely stuck after ten minutes.

## L1.1 Cluster reconnaissance

```bash
kubectl version
kubectl get nodes -o wide
kubectl get pods -n kube-system -o wide
minikube -p axispay ssh -- sudo ls -1 /etc/kubernetes/manifests/
kubectl get pods -n kube-system -l k8s-app=calico-node -o wide
kubectl get --raw /metrics | grep apiserver_request_total | head
```

**C1 — allocatable vs capacity**
```bash
kubectl get nodes -o json | python3 -c "
import json,sys
d=json.load(sys.stdin)
for n in d['items']:
    s=n['status']; nm=n['metadata']['name']
    print(nm, 'capacity', s['capacity']['cpu'], s['capacity']['memory'],
              '| allocatable', s['allocatable']['cpu'], s['allocatable']['memory'])"
```
The difference is **reserved** — `--kube-reserved` for the kubelet and container runtime, `--system-reserved` for the OS, plus an eviction threshold held back so the node can evict pods before it hits true OOM. The scheduler only ever considers *allocatable*.

**C2 — node failure detection**
`node-monitor-grace-period` (default 40s) is how long before the node-lifecycle controller marks it `NotReady`. Pods then carry a `node.kubernetes.io/unreachable:NoExecute` toleration with `tolerationSeconds: 300`, so eviction begins about five minutes later. Total: roughly 5m40s before pods are rescheduled.

**C3 — only the API server talks to etcd**
```bash
minikube -p axispay ssh -- sudo grep -l "etcd-servers" /etc/kubernetes/manifests/*
```
Only `kube-apiserver.yaml` contains `--etcd-servers`. No other component has an etcd address, credentials or client certificate.

---

## L1.2 Namespaces

```bash
kubectl apply -f manifests/00-namespaces/
kubectl get ns -l app.kubernetes.io/part-of=axispay --show-labels
kubectl config set-context --current --namespace=axispay-core
```

**C1 — `axispay-data`**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: axispay-data
  labels:
    app.kubernetes.io/part-of: axispay
    axispay.io/zone: data
    axispay.io/pci-scope: "true"
    axispay.io/day-introduced: "1"
    kubernetes.io/metadata.name: axispay-data
```

**C2 — read-only contractor on one namespace**
A `Role` (namespaced) granting `get`/`list`/`watch`, plus a `RoleBinding` in `axispay-edge`. Neither is cluster-scoped — which is the point. Using a `ClusterRoleBinding` here would grant read across **every** namespace including ones that do not exist yet. You build this on Day 5 (L5.2).

**C3 — why `axispay-edge` is `pci-scope: false`**
Because it **transmits** cardholder data but does not **store or process** it — and in this platform it only ever handles a token (`tok_…`), never a card number. Tokenisation is the boundary that keeps the DMZ out of the CDE, and it is a real audit argument rather than a labelling convenience.

---

## L1.3 First Pod

```bash
kubectl apply -f manifests/day1/pods/01-pod-payment-service.yaml
kubectl describe pod payment-service-bare -n axispay-core
kubectl logs payment-service-bare -n axispay-core
kubectl exec -it payment-service-bare -n axispay-core -- sh -c 'whoami; env | grep POD_'
kubectl port-forward -n axispay-core pod/payment-service-bare 8083:8080
kubectl delete pod payment-service-bare -n axispay-core   # nothing comes back. That is the lesson.
```

**C1 — two containers sharing a volume**
```yaml
apiVersion: v1
kind: Pod
metadata: { name: shared-demo, namespace: axispay-core }
spec:
  volumes:
    - name: scratch
      emptyDir: {}
  containers:
    - name: writer
      image: busybox:1.37
      command: ["sh","-c","while true; do date >> /data/ts.log; sleep 1; done"]
      volumeMounts: [{ name: scratch, mountPath: /data }]
    - name: reader
      image: busybox:1.37
      command: ["sh","-c","sleep 3; tail -f /data/ts.log"]
      volumeMounts: [{ name: scratch, mountPath: /data }]
```
`kubectl logs shared-demo -c reader` shows lines the *writer* produced. They also share `localhost` and one IP.

**C2 — change `environment` without editing the manifest**
```bash
kubectl set env pod/payment-service-bare ENVIRONMENT=demo -n axispay-core
```
This actually fails on a bare Pod — most of `spec` is immutable once created; only a few fields (such as `image`) can be changed. That failure *is* the answer: **you cannot meaningfully mutate a running Pod.** In production you change the controller's template and let it roll out a replacement. Accept any answer that reaches "you replace the pod, you do not edit it".

**C3 — the pause container**
```bash
minikube -p axispay ssh -n axispay-m02 -- sudo crictl ps -a | head
minikube -p axispay ssh -n axispay-m02 -- sudo crictl pods
```
It holds the network and IPC namespaces so application containers can join them and restart independently without the Pod losing its IP.

---

## L1.4 Deployments

```bash
kubectl apply -f manifests/day1/deployments/04-deployment-payment-service.yaml
kubectl rollout status deployment/payment-service -n axispay-core

RS=$(kubectl get rs -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl get rs "$RS" -n axispay-core -o jsonpath='{.metadata.ownerReferences[0].kind}/{.metadata.ownerReferences[0].name}{"\n"}'
POD=$(kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl get pod "$POD" -n axispay-core -o jsonpath='{.metadata.ownerReferences[0].kind}{"\n"}'   # -> ReplicaSet
```

**C1 — deleting two pods at once**
Recovery is **parallel, not serial** — the ReplicaSet controller reconciles to the full desired count in one pass and creates both replacements together. Total time is roughly the same as deleting one (bounded by image start, not by count). Evidence: the `SuccessfulCreate` events share a timestamp.

**C2 — relabelling a pod**
```bash
kubectl label pod $POD -n axispay-core app.kubernetes.io/name=orphaned --overwrite
kubectl get pods -n axispay-core --show-labels
```
The pod leaves **both** the Service (endpoint controller drops it) **and** its ReplicaSet (selector no longer matches). The ReplicaSet observes 2 of 3 and creates a replacement. You now have **4 pods and 3 endpoints**.

The orphan is owned by nothing — its `ownerReferences` still names the ReplicaSet, but the ReplicaSet no longer selects it, so garbage collection will not remove it on Deployment deletion either. It must be deleted by hand. **This is exactly how mystery pods accumulate in real clusters.**

**C3 — the ReplicaSet hash**
`pod-template-hash` is derived from `spec.template` only. Changing `spec.replicas` does **not** change it (no new ReplicaSet); changing the image, env, labels or resources does. That is precisely why a rolling update creates a new ReplicaSet and a scale does not.

**Bonus A — revision history**
```bash
kubectl set env deployment/payment-service LOG_LEVEL=debug -n axispay-core
kubectl rollout history deployment/payment-service -n axispay-core
kubectl get rs -n axispay-core -l app.kubernetes.io/name=payment-service
```
Two revisions, two ReplicaSets. The old one is retained at **0 replicas** — which is what makes `kubectl rollout undo` near-instant.

**Bonus B — garbage collection**
Deleting the Deployment cascades: `ownerReferences` let the garbage collector remove the ReplicaSet, then the Pods. With `--cascade=orphan`, the ReplicaSet and Pods survive and are owned by nothing.

---

## L1.5 Services

```bash
kubectl apply -f manifests/day1/services/
kubectl get endpointslice -n axispay-core -l kubernetes.io/service-name=payment-service
```

**C1 — which pods are behind a Service, without `kubectl get pods`**
```bash
kubectl get endpointslice -n axispay-core \
  -l kubernetes.io/service-name=merchant-service \
  -o jsonpath='{range .items[*].endpoints[*]}{.targetRef.name}{"\t"}{.addresses[0]}{"\n"}{end}'
```

**C2 — a Service that matches nothing**
`kubectl apply` **succeeds**. `kubectl get svc` shows a perfectly healthy Service with a ClusterIP. The only command that reveals the problem:
```bash
kubectl get endpointslice -n <ns> -l kubernetes.io/service-name=<svc>
```
Put this on your cheat sheet. It is Thursday's INC-4.

**C3 — endpoints tracking replicas**
Endpoints track within a second or two. What removes an endpoint *before* the pod dies is the **readiness probe going false** (plus a `preStop` hook that deliberately fails readiness first). You build that tomorrow in L2.3 and L2.6 — it is the mechanism behind zero-downtime deployment.

---

## L1.6 Platform assembly

```bash
kubectl apply -R -f manifests/day1/
kubectl get endpointslice -A -l app.kubernetes.io/part-of=axispay

kubectl run merchant-sim -n axispay-edge --rm -it --restart=Never \
  --image=curlimages/curl:8.11.1 -- sh
```
Inside:
```sh
TOKEN=$(curl -s -X POST http://edge-gateway:8080/api/v1/login \
  -H 'Content-Type: application/json' \
  -d '{"api_key":"ak_live_kalahari_7QK2XD9P4A"}' \
  | tr ',' '\n' | grep access_token | cut -d: -f2 | tr -d '" ')

curl -s -X POST http://edge-gateway:8080/api/v1/charges \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: my-first-payment' \
  -d '{"amount_minor":129900,"currency":"ZAR","card_token":"tok_a71ef4c2900bd5386ff1240e"}'
```

**Task 5 — idempotency**
Same `payment_id`. First call `201`, replay `200` with `Idempotent-Replay: true`.
Non-negotiable in payments because a client that times out and retries must not charge the customer twice — and it has no way to tell the difference unless the server guarantees it.

**Task 6 — cross-service trace**
```bash
for ns in axispay-edge axispay-core; do
  for d in $(kubectl get deploy -n $ns -o name); do
    echo "--- $ns/$d ---"; kubectl logs -n $ns $d --tail=200 | grep my-first-trace
  done
done
```
All four services carry the same `correlation_id`. On Day 5 you do this in Loki, across sixteen services, from a Grafana panel.

**C1 — `customer-service` from scratch**
Copy `03-deployment-merchant-service.yaml` and `03-service-merchant-service.yaml`, change every occurrence of the name, keep `component: core`, keep the standard label set, set `replicas: 2`. The image already exists (`axispay/customer-service:1.0.0` builds from `images/customer-service/`).

**C2 — break the downstream URL**
```bash
kubectl set env deployment/payment-service -n axispay-core \
  MERCHANT_SERVICE_URL=http://merchant-service.does-not-exist.svc.cluster.local:8080
```
The pod **stays Running** and does **not** restart. `/healthz` returns **200** (the process is fine). `/readyz` returns **503** (it cannot serve). The pod is removed from the Service's endpoints, so it stops receiving traffic — but it is not killed, because killing it would not help.

**That difference is the entire liveness/readiness distinction**, and you have now derived it a day before it is formally taught.

**C3 — total captured volume**
```sh
curl -s http://payment-service.axispay-core:8080/api/v1/payments-stats
```

**Bonus — `platform-status` with `merchant-service` at zero**
```bash
kubectl scale deployment/merchant-service -n axispay-core --replicas=0
```
`merchant-service` reports `UNREACHABLE`, but the gateway **stays Ready** — because it is registered as a **non-critical** dependency in `images/_shared/axispay_common/readiness.py`. The gateway can still serve charges (payment-service talks to merchant-service itself); only `/account` degrades.

That is graceful degradation expressed in code, and it is a deliberate design decision rather than an oversight.
```bash
kubectl scale deployment/merchant-service -n axispay-core --replicas=2   # restore
```
