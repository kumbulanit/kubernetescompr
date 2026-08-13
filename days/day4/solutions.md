# Day 4 — Solutions

> Read the lab first. Use this to check yourself, or when genuinely stuck after ten minutes.

---

## L4.1 Service types

**C1 — Selector, readiness or target port, in three commands.**

```bash
# 1. Does the Service have endpoints at all?  -> if empty, it is the SELECTOR
kubectl get endpointslices -n <ns> -l kubernetes.io/service-name=<svc>

# 2. Endpoints exist but are not ready?       -> it is READINESS
kubectl get pods -n <ns> -l <selector>        # look at the READY column

# 3. Endpoints ready but the call fails?      -> it is the TARGET PORT
kubectl get svc <svc> -n <ns> -o jsonpath='{.spec.ports[0].targetPort}'; echo
kubectl get pod <pod> -n <ns> -o jsonpath='{.spec.containers[0].ports}'
```

The order matters: each step eliminates one cause, and step 1 is the one that most often ends the investigation immediately.

**C2 — NodePort in production.** Discouraged because: the port range (30000–32767) is arbitrary and must be documented somewhere out of band; every node listens, so your firewall surface is the whole cluster; there is no TLS termination, no path routing and no health-aware load balancing; and the client must know node addresses, which change. It is **correct** when you are running on bare metal with an external load balancer you manage yourself, pointing it at a known NodePort — which is exactly what MetalLB and most on-premises ingress setups do underneath.

**C3 — Headless versus ClusterIP for the same pods.** Use **ClusterIP** when you want *any* healthy pod and want kube-proxy to spread the load — the normal case. Use **headless** when you need to address a *specific* pod (`postgres-0`) or when the client does its own load balancing and wants the full address list, which is what most gRPC clients do. Pick wrongly and: a gRPC client on a ClusterIP opens one long-lived connection to one pod and never rebalances; a REST client on a headless Service gets whichever address DNS returned first and hammers one pod.

**Bonus — `externalTrafficPolicy: Local`.** Only nodes actually running a pod answer; the rest refuse. You gain the **client source IP** (no SNAT) and one fewer network hop. You lose even spreading — traffic is now distributed by however your external load balancer weights nodes, not by pod count.

---

## L4.2 DNS

**C1 — The cost of `ndots:5`.** `payment-service.axispay-core.svc` has three dots, fewer than 5, so it is tried against every search domain first: `...svc.axispay-core.svc.cluster.local`, `...svc.svc.cluster.local`, `...svc.cluster.local` — that last one succeeds. Three lookups. With a trailing dot (`...svc.cluster.local.`) it is absolute: **one** lookup. Measured over 100 iterations the difference is typically 2–4 ms per resolution, which is invisible per request and material at 10,000 rps.

**C2 — Resolves but times out. Three causes, one command each.**

| Cause | Command |
|---|---|
| No ready endpoints behind the Service | `kubectl get endpointslices -n <ns>` |
| NetworkPolicy blocking the flow | `kubectl get netpol -n <ns>` and test with a probe pod |
| The application is not listening on the target port | `kubectl exec <pod> -- netstat -tlnp` (or `ss -tlnp`) |

**C3 — Predicting the default-deny error.** The application logs a **name resolution** failure, not a connection refusal:

```
httpx.ConnectError: [Errno -3] Temporary failure in name resolution
```

Writing this down before L4.4 is the point of the exercise: when everything breaks in the next lab, you recognise the shape rather than debugging it from scratch.

**Bonus — `ndots: 1` platform-wide.** Short names stop resolving. `curl http://payment-service` from inside `axispay-core` fails, because with `ndots: 1` a single-label name is treated as absolute and never gets the search domains appended. Every service URL in your platform would need to be fully qualified. That is a defensible choice — and it must be all-or-nothing, because a half-migrated platform breaks unpredictably.

---

## L4.3 Ingress and TLS

**C1 — A third host.** A separate Ingress object (not a third rule) with its own `tls` block and its own Secret, so it can be revoked independently. It does not collide because the controller keys on `host` + `path`, and the hosts differ. Prove it with `curl --resolve` against all three.

**C2 — 502 versus 503.**

- **503**: no *ready* endpoints. Produce it with `kubectl scale deploy/edge-gateway --replicas=0`. The controller logs `no active endpoints`.
- **502**: endpoints exist and the connection fails or returns garbage. Produce it by pointing the Ingress backend at a port nothing listens on. The controller logs `connect() failed (111: Connection refused) while connecting to upstream`.

The distinction: 503 is "nothing to send it to", 502 is "sent it and it went wrong". Different layers, different first command.

**C3 — Gateway API in three sentences.** It replaces the annotation sprawl that made Ingress non-portable — rate limits, timeouts and rewrites become typed fields rather than controller-specific strings. It separates roles: a cluster operator owns `GatewayClass` and `Gateway`, while an application team owns `HTTPRoute` in its own namespace, so route changes no longer need cluster-wide permissions. And it handles protocols beyond HTTP — TCP, UDP, gRPC and TLS passthrough — as first-class kinds rather than annotations.

**Bonus — edge rate limiting versus per-merchant.** `limit-rps: 2` returns **503** (nginx's default for a limit; configurable to 429). Edge limiting protects the *platform* and is per client IP — it cannot distinguish one merchant from another behind a NAT. Per-merchant limiting in the gateway protects *fairness between merchants* and needs the API key, which only the application sees. You need both, and they defend different things.

---

## L4.4 NetworkPolicy

**C1 — Minimum viable policy for `reporting-service` → PostgreSQL.** Two objects, because both ends must permit the flow:

```yaml
# egress at the source
spec:
  podSelector: { matchLabels: { app.kubernetes.io/name: reporting-service } }
  policyTypes: [Egress]
  egress:
    - to: [{ namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: axispay-data } },
             podSelector: { matchLabels: { app.kubernetes.io/name: postgres } } }]
      ports: [{ protocol: TCP, port: 5432 }]
---
# ingress at the destination — plus the DNS egress it already has
```

Prove "nothing else got through" with the probe from step 7 against Redis, RabbitMQ and `ledger-service`: all three must fail.

**C2 — Could a compromised `payment-service` reach the internet?** Test it:

```bash
kubectl exec -n axispay-core deploy/payment-service -- \
  python3 -c "import socket; socket.create_connection(('1.1.1.1',443),timeout=5); print('OUT')"
```

It **fails**, and the reason is worth understanding: `default-deny-all` sets `policyTypes: [Ingress, Egress]`, and once egress is restricted only the explicitly allowed destinations are reachable. External addresses are not among them. Had the default-deny listed only `Ingress`, egress would have remained wide open — and a compromised payment service could exfiltrate to anywhere. That single line is the difference.

**C3 — The QSA answer.** Two paragraphs, and the commands are the evidence:

```bash
# 1. The control, demonstrated from inside the DMZ
kubectl exec -n axispay-edge deploy/edge-gateway -- python3 -c \
  "import socket; socket.create_connection(('postgres.axispay-data.svc.cluster.local',5432),timeout=5)"
# expected: TimeoutError  <- a TIMEOUT, not a refusal

# 2. The policy set, and proof it is enforced rather than merely present
kubectl get netpol -A
kubectl get ds -n kube-system calico-node        # the CNI that enforces it
python3 platform/admin/validate/simulate-netpol.py      # 46 assertions
```

Why a **timeout** and not a connection refused: the packet is dropped by the CNI, so no RST comes back and the client waits for its own timeout. A refusal would mean the packet reached a host that actively declined it — which would mean the policy was not enforcing. The failure mode is itself part of the evidence.

**Bonus — deleting `allow-dns-egress`.** The first payment does not fail immediately. Existing connections are reused, and DNS results are cached by the resolver for their TTL (30s in CoreDNS by default). The failure arrives when a cached entry expires and a new lookup is attempted — typically 30–60 seconds later, and then all at once. That delay is why "we changed the policy and nothing broke" is not evidence of anything for at least two minutes.

---

## L4.5 Placement

**C1 — Only on `axispay.io/tier=payments`, still one per node.** Two fields, and they are different mechanisms:

```yaml
affinity:
  nodeAffinity:                       # WHICH nodes are eligible
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - { key: axispay.io/tier, operator: In, values: [payments] }
  podAntiAffinity:                    # HOW they spread across the eligible ones
    requiredDuringSchedulingIgnoredDuringExecution:
      - topologyKey: kubernetes.io/hostname
        labelSelector: { matchLabels: { app.kubernetes.io/name: payment-service } }
```

Node affinity filters the candidate set; pod anti-affinity spreads within it. Together they mean: replicas ≤ number of labelled nodes, or the surplus stays `Pending`.

**C2 — `preferred` for fraud, `required` for payment.** `payment-service` is on the money path: a node loss must not take out more than one replica, so the constraint is hard. `fraud-service` has an HPA reaching 6 replicas on a 3-node cluster — a `required` constraint would leave three pods `Pending` forever at peak, which converts a scaling event into an outage. You would switch `fraud-service` to `required` if the cluster grew past its HPA maximum, and switch `payment-service` to `preferred` never — on a 2-node cluster you would reduce its replicas instead.

**C3 — One replica per zone, across three zones.**

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector: { matchLabels: { app.kubernetes.io/name: payment-service } }
```

When a zone fails: existing pods there are lost, and the constraint now cannot be satisfied for their replacements — `maxSkew: 1` with two surviving zones means the third replica has nowhere to go and stays `Pending`. That is `DoNotSchedule` doing what you asked. If you would rather have the capacity than the spread during an outage, use `ScheduleAnyway` — and accept that recovery leaves you unbalanced until something reschedules.

**Bonus — co-locating fraud with payment.** Measure before you believe it. Same-node traffic saves one network hop, typically 0.2–0.5 ms — against a fraud call that takes 40 ms. The coupling costs you: a node loss now removes both services' replicas together, and the anti-affinity you just spent the lab configuring is partly undone. Almost never worth it.

---

## L4.6 PDB and drain

**C1 — Zero errors while draining under load. Four objects.**

1. **PodDisruptionBudget** — stops the drain evicting more than one replica at a time.
2. **Readiness probe** — keeps traffic off the replacement until it can serve.
3. **`preStop` hook + `terminationGracePeriodSeconds`** — lets endpoint removal propagate to every node before the process starts shutting down.
4. **Pod anti-affinity** — ensured the replicas were on different nodes in the first place, so draining one node never had more than one to take.

Miss any one and you drop requests. Most people name the PDB and stop.

**C2 — A PDB for `minReplicas: 2, maxReplicas: 10`.**

```yaml
spec:
  maxUnavailable: 1
```

Not a percentage: `maxUnavailable: 25%` means 1 pod at 2 replicas but 2 pods at 10, which silently loosens the guarantee exactly when there is most traffic. Not `minAvailable: 2` either — at the HPA minimum of 2 replicas that permits **zero** disruption and blocks every drain forever. `maxUnavailable: 1` is correct at every point in the range: it always permits maintenance and never drops below one serving replica.

**C3 — A drain hanging for twenty minutes. Three commands.**

```bash
kubectl get pdb -A                                  # which budget is blocking
kubectl get pods -o wide --field-selector spec.nodeName=<node>
kubectl describe pod <the-pending-replacement>      # why it is not becoming Ready
```

Two most likely causes: the replacement cannot be **scheduled** (insufficient capacity on the remaining nodes, or an anti-affinity rule that cannot be satisfied with one node gone), or it is scheduled and **not becoming Ready** (slow startup, a failing dependency). Both mean the PDB is correctly refusing to let the last healthy replica go.

**Bonus — `maxUnavailable: 0` on a PDB.** The drain **never completes**. Zero pods may be unavailable, so no eviction is ever permitted, and `kubectl drain` retries until you interrupt it. It reads like maximum safety and is a production hazard: node maintenance becomes impossible, and the person under pressure reaches for `--force`, which deletes the pod anyway with none of the protections. A budget that can never be satisfied provides no protection — it only removes the safe path.
