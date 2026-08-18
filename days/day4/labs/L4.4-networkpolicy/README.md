# L4.4 · NetworkPolicy

This lab is about deciding which pods are allowed to talk to each other.

In simple words: you are drawing a small security boundary around the platform.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open the files in `manifests/`.
2. Read the default deny and allow rules.
3. Notice that the policy is about allowed traffic, not just whether a pod exists.

Why this matters:
- you want to limit damage if something goes wrong
- a default-deny policy is a good starting point
- only the traffic you need should be allowed

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```
This applies the NetworkPolicies.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Test one request that should work and one that should be blocked.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Look at the rule that made the traffic behave that way.

Why this matters:
- a policy can stop traffic even when the service is running
- this is a common source of confusion for beginners

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L4.4
```
