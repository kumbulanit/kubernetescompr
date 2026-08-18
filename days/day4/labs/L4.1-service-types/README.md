# L4.1 · Service types

This lab is about how a Service gives pods a stable way to be reached.

In simple words: pods come and go, but a Service gives you a steady address.

### What this concept means
A Service gives pods a stable address even when the pods themselves are replaced. In Kubernetes, pods are not fixed endpoints, so a Service acts as a stable front door for a group of pods.

Different Service types exist because traffic comes from different places. Internal traffic can use a ClusterIP Service, while traffic from outside the cluster may need NodePort or LoadBalancer. The Service type is mainly about how the traffic reaches the cluster.

```mermaid
flowchart LR
  Client[Client] --> Service[Service]
  Service --> Pods[Pods]
```


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

Expected result:
- The command finishes without errors.
- You should see messages such as `created` or `configured` for the resources.
- A follow-up `kubectl get` command should show the objects you created.
This creates the Services.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get svc -A
```

Expected result:
- The output lists the resource names or details you expected to inspect.
- You should be able to see the object or the status you are checking.
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

Expected result:
- The validation command finishes successfully.
- You should see a passing message for the lab.
