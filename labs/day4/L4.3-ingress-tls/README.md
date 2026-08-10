# L4.3 · Ingress and TLS — A Merchant Can Reach You

| | |
|---|---|
| **Time** | 45 minutes |
| **Difficulty** | One object that does nothing on its own |
| **You need first** | [L4.2](../L4.2-dns/) finished |
| **You will create** | 2 Ingresses, 2 TLS Secrets |
| **Check you are done** | `make validate-lab LAB=L4.3` |

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

`kubectl port-forward` is not a product. No merchant can integrate with it.

You will give AxisPay two real hostnames over HTTPS, and learn the thing that catches everybody: **an Ingress object does nothing by itself.** It is a routing rule that sits inert until a *controller* claims it — and an Ingress with an empty `ADDRESS` column is almost always exactly that.

Then you will produce a `404`, a `502` and a `503` deliberately, because they mean three completely different things and the difference is worth ten minutes now and an hour later.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get pods -n ingress-nginx` | A controller pod `Running` |
| 3 | `minikube ip -p axispay` | An IP address |

**If #2 is empty:**

```bash
minikube addons enable ingress -p axispay
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/component=controller -n ingress-nginx --timeout=180s
```

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | The two Ingress objects |

---

## Step 1 — Two objects, and only one of them does anything

```
  Ingress             A ROUTING RULE. Inert data. Does nothing.
  Ingress controller  A POD that reads every Ingress and configures
                      itself (nginx here) to actually route traffic.
```

```bash
kubectl get pods -n ingress-nginx -o wide
kubectl get ingressclass
```

```
NAME    CONTROLLER             AGE
nginx   k8s.io/ingress-nginx   40m
```

**The `ingressClassName` on your Ingress must match that name**, or no controller claims it and nothing happens — silently.

---

## Step 2 — Certificates

```bash
bash scripts/setup/06-generate-tls.sh
kubectl get secret -n axispay-edge | grep tls
```

```
axispay-tls          kubernetes.io/tls   2   10s
axispay-portal-tls   kubernetes.io/tls   2   10s
```

**Type `kubernetes.io/tls`, not `Opaque`.** That type requires exactly two keys, `tls.crt` and `tls.key`, and Kubernetes validates them — so a malformed certificate fails at creation rather than at the first handshake.

```bash
kubectl get secret axispay-tls -n axispay-edge -o jsonpath='{.data.tls\.crt}' \
  | base64 -d | openssl x509 -noout -subject -dates
```

**Self-signed**, which is why browsers and `curl` will complain. In production this is a real certificate from a real authority, usually issued automatically by cert-manager. The Kubernetes side is identical either way.

---

## Step 3 — Read the Ingress

```bash
cat manifests/*ingress*.yaml | head -40
```

```yaml
spec:
  ingressClassName: nginx            # ① which controller
  tls:
    - hosts: [api.axispay.local]
      secretName: axispay-tls        # ② TLS terminates HERE
  rules:
    - host: api.axispay.local        # ③ routed by hostname
      http:
        paths:
          - path: /api/v1
            pathType: Prefix          # ④ read this carefully
            backend:
              service:
                name: edge-gateway
                port:
                  name: http          # ⑤ by NAME
```

| | What it means |
|---|---|
| ① | Must match an `ingressclass`. Wrong value = nothing happens, no error. |
| ② | **TLS is terminated at the Ingress.** Traffic inside the cluster is plain HTTP from here on — which is why Day 4's network policies matter, and why a mesh exists for those who want mTLS internally. |
| ③ | One IP can serve many hostnames. The controller routes by the `Host` header. |
| ④ | **`Prefix` matches `/api/v1` and everything under it. `Exact` matches only `/api/v1` itself** — and nothing else, which is a very common accidental outage. |
| ⑤ | Referencing the port by name means the number can change without editing this file. |

---

## Step 4 — Apply, and make the names resolve locally

```bash
kubectl apply -f manifests/
kubectl get ingress -A
```

```
NAMESPACE      NAME             CLASS   HOSTS                 ADDRESS        PORTS
axispay-edge   axispay-api      nginx   api.axispay.local     192.168.49.2   80, 443
axispay-edge   axispay-portal   nginx   portal.axispay.local  192.168.49.2   80, 443
```

**`ADDRESS` is populated — that means a controller claimed it.** An empty `ADDRESS` is the single most common Ingress problem, and it means no controller matched your `ingressClassName`.

```bash
MIP=$(minikube ip -p axispay)
echo "$MIP  api.axispay.local portal.axispay.local grafana.axispay.local" | sudo tee -a /etc/hosts
getent hosts api.axispay.local
```

> This edits `/etc/hosts` on **your machine**, so your laptop resolves those names to your cluster. It has nothing to do with cluster DNS.

---

## Step 5 — A payment over HTTPS

```bash
curl -sk -X POST https://api.axispay.local/api/v1/payments \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' \
  -H 'Idempotency-Key: l43-tls-001' \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-L43-001","amount_minor":175000,"currency":"ZAR","card_token":"tok_visa_4242"}' \
  | jq '{payment_id, status, display_amount}'
```

**No port-forward.** A merchant with the right API key could integrate with this today.

`-k` skips certificate verification, which is needed because the certificate is self-signed. **Note that you did that** — in Friday's incident, using `-k` to verify a TLS fix is the mistake being tested for.

**See the redirect the controller adds:**

```bash
curl -sI http://api.axispay.local/api/v1/_info | head -3
```

```
HTTP/1.1 308 Permanent Redirect
Location: https://api.axispay.local/api/v1/_info
```

That is `nginx.ingress.kubernetes.io/ssl-redirect: "true"`. Plain HTTP is never served.

---

## Step 6 — 404, 502 and 503 are three different problems

**Why we are doing this.** They look similar and mean entirely different things. Produce each.

### 404 — routing

```bash
curl -sk -o /dev/null -w '%{http_code}\n' https://api.axispay.local/wrong-path
```

**The controller received it and no rule matched.** A path problem, or `pathType: Exact` when you meant `Prefix`. **The request never reached your service.**

### 503 — no ready endpoints

```bash
kubectl scale deploy/edge-gateway -n axispay-edge --replicas=0
sleep 10
curl -sk -o /dev/null -w '%{http_code}\n' https://api.axispay.local/api/v1/_info
kubectl scale deploy/edge-gateway -n axispay-edge --replicas=2
kubectl rollout status deploy/edge-gateway -n axispay-edge
```

**The rule matched, and there was nothing behind it.** Zero ready endpoints.

### 502 — reached something, and it went wrong

```bash
kubectl patch ingress axispay-api -n axispay-edge --type=json \
  -p='[{"op":"replace","path":"/spec/rules/0/http/paths/0/backend/service/port/name","value":"http"}]' 2>/dev/null
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller --tail=20 | grep -i 'upstream' | head -3
```

**The summary worth memorising:**

| Code | Meaning | Where to look first |
|---|---|---|
| **404** | No rule matched | `kubectl describe ingress` — paths and `pathType` |
| **502** | Reached a backend; it failed or spoke nonsense | Wrong port; check `kubectl get endpointslices` |
| **503** | No ready endpoints at all | `kubectl get pods` — the READY column |

---

## Step 7 — Rate limiting at the edge

```bash
grep -A3 'limit-rps' manifests/*ingress*.yaml
for i in $(seq 1 25); do
  curl -sk -o /dev/null -w '%{http_code} ' https://api.axispay.local/api/v1/_info
done; echo
```

Some `503`s appear once you exceed the limit.

**Edge rate limiting protects the platform** and works per client IP — it cannot tell one merchant from another behind a shared NAT. **Per-merchant limiting** needs the API key, which only the application sees. You need both, and they defend different things.

---

## Did it work?

```bash
make validate-lab LAB=L4.3
```

---

## Clean up

Leave everything. The rest of the week uses these hostnames.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `ADDRESS` empty | No controller claimed it | Check `ingressClassName` matches `kubectl get ingressclass` |
| `curl: (6) Could not resolve host` | `/etc/hosts` not updated | Re-run the `tee` command in Step 4 |
| `curl: (7) Failed to connect` | Controller not running | `kubectl get pods -n ingress-nginx` |
| `certificate has expired` | Regenerate | `bash scripts/setup/06-generate-tls.sh` |
| 404 on a path that should work | `pathType: Exact` | Change to `Prefix` |
| 502 on everything | Wrong backend port | Compare with the Service's port name |
| Works on http, not https | Missing TLS secret | `kubectl describe ingress <name>` |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/04-networking-and-exposure/solutions.md).

**1.** Add a third host, `admin.axispay.local`, routing `/api/v1/settlements` to `settlement-service` in `axispay-async`, with its own certificate. Prove it works and does not collide with the other two.

**2.** Produce a `502` and a `503` on purpose and capture the controller log line for each.

**3.** Read about **Gateway API** and write three sentences on what it fixes about Ingress. *(Annotations, role separation, and protocols beyond HTTP.)*

---

## What you built

- **Two hostnames over HTTPS**, reachable without port-forward
- **The Ingress/controller split**, and what an empty `ADDRESS` means
- **404, 502 and 503 produced deliberately**, and the layer each belongs to
- **`Prefix` versus `Exact`**, before it causes an outage
- **Rate limiting at the edge**, and what it cannot do

**Next:** [L4.4 — NetworkPolicy](../L4.4-networkpolicy/). The most important lab of the day, and the one where everything breaks in the middle on purpose.
