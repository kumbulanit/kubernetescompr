# L4.6 · PDB and drain

This lab is about protecting a workload while maintenance happens.

In simple words: you do not want to take too many pods away at once.

### What this concept means
A PodDisruptionBudget is a safety rule for maintenance. It says how many pods of a workload can be taken down at once so the application does not lose too much capacity during a drain or update.

This matters because maintenance is not just about moving nodes. It is about making sure the service remains available while the platform is being changed. The PDB is a small but practical guardrail for operations.

```mermaid
flowchart LR
  Maintenance[Maintenance] --> PDB[PodDisruptionBudget]
  PDB --> Pods[Pods]
```


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

Expected result:
- The command finishes without errors.
- You should see messages such as `created` or `configured` for the resources.
- A follow-up `kubectl get` command should show the objects you created.
This adds the disruption budget.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
```

Expected result:
- The drain starts or the node enters a draining state.
- The workload should stay available according to the disruption policy.
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

Expected result:
- The validation command finishes successfully.
- You should see a passing message for the lab.
