# L4.3 · Ingress and TLS

This lab is about exposing an app to the outside world with a hostname and HTTPS.

In simple words: Ingress is the door, and TLS is the lock.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open `manifests/01-ingress.yaml`.
2. Notice the host names, routing rules, and TLS secret.
3. Think about how traffic reaches the app from outside the cluster.

Why this matters:
- users and merchants need a stable way to reach the app
- Ingress decides where the traffic goes
- TLS protects the connection while it travels

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```
This creates the routing rules and TLS secret.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get ingress -A
```
This shows whether the Ingress objects were accepted and have an address.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
curl -sk https://api.axispay.local/api/v1/_info
```
This checks the route and the TLS connection.

Why this matters:
- an Ingress rule does not work by itself
- the ingress controller must apply it
- traffic needs both a route and a working backend service

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L4.3
```
