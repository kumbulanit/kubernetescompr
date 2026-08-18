# L4.1 · Service types

This lab is about how a Service gives pods a stable way to be reached.

In simple words: pods come and go, but a Service gives you a steady address.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open `manifests/01-service-types.yaml`.
2. Notice the different Service types in the file.
3. Think about who should reach them and from where.

Why this matters:
- pods are not reliable addresses
- Services make the app easier to reach
- different traffic needs different Service types

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```
This creates the Services.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get svc -A
```
This shows the Services and their types.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Think about the difference between internal traffic and traffic from outside the cluster.

Why this matters:
- internal traffic can use a simple internal Service
- external traffic may need a different Service type

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L4.1
```
