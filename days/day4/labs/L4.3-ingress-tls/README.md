# L4.3 · Ingress and TLS

This lab is about exposing an app to the outside world with a hostname and HTTPS.

In simple words: Ingress is the door, and TLS is the lock.

### What this concept means
Ingress is the entry point for HTTP and HTTPS traffic from outside the cluster. It is a routing rule that says, "for this host and this path, send traffic to that Service." The actual work is done by the ingress controller.

TLS protects the connection while it travels across the network. In this lab the hostname, path rule, backend Service, and TLS secret all have to line up for the request to succeed.

![Official Kubernetes Ingress routing diagram](../../images/ingress.svg)
Diagram source: Kubernetes documentation (CC BY 4.0).

Do this first:
What you should expect to see: you understand which hosts, paths, namespaces, and secrets the manifest uses.

1. Open `manifests/01-ingress.yaml`.
2. Notice these host names:
   - `api.axispay.local`
   - `portal.axispay.local`
3. Notice these backends:
   - `edge-gateway` in `axispay-edge`
   - `reporting-service` in `axispay-async`
4. Notice that the edge API uses the `axispay-tls` secret and the portal route expects `axispay-portal-tls` to already exist.

Why this matters:
- users need a stable host name, not a raw node IP
- host and path rules are part of the public contract of the platform
- TLS misconfiguration is just as real a failure as a broken backend

Then do this:
What you should expect to see: Kubernetes accepts the secret and both Ingress objects.

```bash
kubectl apply -f manifests/
```

Expected result:

```text
$ kubectl apply -f manifests/
secret/axispay-tls created
ingress.networking.k8s.io/axispay-api created
ingress.networking.k8s.io/axispay-portal created
```

This adds the routing rules. The ingress controller now has enough information to watch for `api.axispay.local` and `portal.axispay.local` traffic.

Then do this:
What you should expect to see: the controller has accepted the Ingress objects and published an address.

```bash
kubectl get ingress -A
```

Expected result:

```text
$ kubectl get ingress -A
NAMESPACE      NAME            CLASS   HOSTS                ADDRESS        PORTS     AGE
axispay-async  axispay-portal  nginx   portal.axispay.local 192.168.49.2   80, 443   17s
axispay-edge   axispay-api     nginx   api.axispay.local    192.168.49.2   80, 443   17s
```

If `ADDRESS` is still blank, the ingress controller has not finished programming the route yet.

Then do this:
What you should expect to see: `kubectl describe` shows the rule, path type, backend, endpoints, and TLS secret in one place.

```bash
kubectl describe ingress axispay-api -n axispay-edge
```

Expected result:

```text
$ kubectl describe ingress axispay-api -n axispay-edge
Name:             axispay-api
Namespace:        axispay-edge
Address:          192.168.49.2
Ingress Class:    nginx
Default backend:  <default>
TLS:
  axispay-tls terminates api.axispay.local
Rules:
  Host               Path  Backends
  ----               ----  --------
  api.axispay.local
                     /api/v1   edge-gateway:http (10.244.0.21:8080,10.244.2.14:8080)
Annotations:         <none>
Events:
  Type    Reason  Age   From                      Message
  ----    ------  ----  ----                      -------
  Normal  Sync    11s   nginx-ingress-controller  Scheduled for sync
```

This is your best troubleshooting screen for "the host exists but the request still fails."

Then do this:
What you should expect to see: the HTTPS request reaches the backend and returns the service information payload.

```bash
curl -sk https://api.axispay.local/api/v1/_info
```

Expected result:

```text
$ curl -sk https://api.axispay.local/api/v1/_info
{
  "service": "edge-gateway",
  "version": "1.0.0",
  "namespace": "axispay-edge",
  "pod": "edge-gateway-6f9cfb47b9-2s4pl",
  "node": "minikube",
  "routes": {
    "auth": "http://auth-service.axispay-edge.svc.cluster.local:8080",
    "payments": "http://payment-service.axispay-core.svc.cluster.local:8080",
    "merchants": "http://merchant-service.axispay-core.svc.cluster.local:8080"
  }
}
```

This proves that:
- DNS for `api.axispay.local` works on your machine
- the ingress controller accepted the rule
- the path matches
- the request reached the `edge-gateway` backend over HTTPS

Common failures or mistakes:

```text
$ kubectl get ingress -A
NAMESPACE      NAME            CLASS   HOSTS                ADDRESS   PORTS     AGE
axispay-async  axispay-portal  nginx   portal.axispay.local <none>    80, 443   8s
axispay-edge   axispay-api     nginx   api.axispay.local    <none>    80, 443   8s
```

Why it happens and how to fix it: the ingress controller has not assigned an address yet, or the ingress addon/controller is not running. Wait a few seconds, then verify `kubectl get pods -n ingress-nginx`.

```text
$ curl -sk https://api.axispay.local/
<html>
<head><title>404 Not Found</title></head>
<body>
<center><h1>404 Not Found</h1></center>
<hr><center>nginx</center>
</body>
</html>
```

Why it happens and how to fix it: the Ingress only routes the `/api/v1` path prefix. Use the correct path or adjust the rule deliberately.

Why this matters:
- Ingress is the first layer your external users hit
- a 404, 502, and 503 mean different things and point you to different layers
- TLS is not an optional extra in a payment platform; it is part of the public contract

## Cheat Sheet / Tips & Tricks

Quick commands:
- `kubectl get ingress -A` — confirm `axispay-api` and `axispay-portal` exist, have class `nginx`, and eventually get an `ADDRESS`.
- `kubectl describe ingress axispay-api -n axispay-edge` — inspect host, path, backend Service, endpoints, and TLS secret in one place.
- `kubectl get secret axispay-tls -n axispay-edge` — confirm the API Ingress has the TLS secret it expects.
- `curl -sk https://api.axispay.local/api/v1/_info` — test the real HTTPS route without failing on the training certificate.
- `openssl s_client -connect api.axispay.local:443 -servername api.axispay.local` — inspect which certificate the server is actually presenting.

Tips & tricks:
- An Ingress resource alone does nothing unless an ingress controller is running and watching the same `ingressClassName`.
- If `kubectl get ingress` shows no `ADDRESS`, wait a moment and then check the controller pods in `ingress-nginx`.
- A `404 Not Found` from nginx often means the host/path rule does not match, while a `503` often means the backend Service has no ready endpoints.
- TLS problems can be as simple as the wrong secret name or the right secret in the wrong namespace.

Check your work:
What you should expect to see: the validator confirms the controller, the Ingress objects, the path type, and the TLS secrets.

```bash
make validate-lab LAB=L4.3
```

Expected result:

```text
$ make validate-lab LAB=L4.3

L4.3 — Ingress and TLS
----------------------------------------------------------------
  ✓ ingress-nginx controller running
  ✓ ingress axispay-edge/axispay-api exists
  ✓ ingress axispay-async/axispay-portal exists
  ✓ pathType is Prefix (Exact would 404 everything but one URL)

TLS
----------------------------------------------------------------
  ✓ axispay-tls is a TLS secret
  ✓ axispay-portal-tls is a TLS secret
  ✓ Ingress references a TLS secret

✓ L4.3 PASSED — 7/7 checks
```
