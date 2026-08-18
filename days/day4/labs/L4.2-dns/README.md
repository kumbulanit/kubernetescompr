# L4.2 · DNS

This lab is about making services reach each other by name.

In simple words: instead of remembering IP addresses, you use names.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Make sure the Services from the earlier lab are available.
2. Open a shell inside the cluster if needed.
3. Think about the name pattern for a Service.

Why this matters:
- names are easier to manage than IPs
- DNS is how services discover each other
- a small DNS issue can break a whole path

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl run dns-check --rm -it --image=busybox:1.36 --restart=Never -- nslookup <service-name>.<namespace>.svc.cluster.local
```
This test checks whether the Service name can be resolved.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Look at the result.
- If the name resolves, DNS is working.
- If it does not, check the Service name and the namespace.

Why this matters:
- DNS is one of the quiet features that makes Kubernetes feel easy
- it is also one of the first things to break when something is wrong

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L4.2
```
