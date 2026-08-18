# L4.6 · PDB and drain

This lab is about protecting a workload while maintenance happens.

In simple words: you do not want to take too many pods away at once.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open `manifests/01-pdb.yaml`.
2. Notice the disruption budget values.
3. Think about how many pods can safely leave at once.

Why this matters:
- maintenance can cause temporary downtime
- a PodDisruptionBudget helps prevent too much disruption at once
- this is important for user-facing services

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```
This adds the disruption budget.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
```
This simulates node maintenance.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Watch what happens to the workload.

Why this matters:
- the budget helps keep the app available during maintenance
- it is a practical safety net for operations

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L4.6
```
