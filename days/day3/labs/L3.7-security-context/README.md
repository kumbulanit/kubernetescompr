# L3.7 · Security context

This lab is about making a container safer by changing how it runs.

In simple words: do not run a container as root if it does not need to.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open `manifests/01-securitycontext.yaml`.
2. Open `manifests/02-hardened-deployments.yaml`.
3. Notice the settings that make the container more locked down.

Why this matters:
- a container running as root has more power
- a read-only file system makes changes harder
- small security changes can reduce risk

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```
This applies the safer settings to the workload.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl describe pod -n axispay-core <pod-name>
```
This shows the security values that were applied to the pod.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Think about how the container behaves differently now.

Why this matters:
- hardening is a basic safety step
- it is better to start with safe defaults than to fix things later

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L3.7
```
