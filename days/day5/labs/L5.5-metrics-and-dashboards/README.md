# L5.5 · Metrics and dashboards

This lab is about showing the health of the platform with metrics.

In simple words: metrics are numbers that tell you how the system is doing.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open `manifests/01-servicemonitors.yaml`.
2. Open `manifests/02-prometheusrules.yaml`.
3. Notice that these objects tell the monitoring system what to collect.

Why this matters:
- operators need a way to see system health
- dashboards make that easier
- metrics help you spot problems before users report them

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```
This adds the monitoring configuration.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get servicemonitor -A
```
This shows that the monitoring objects exist.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Look at the metrics and dashboards and ask what the numbers mean.

Why this matters:
- metrics are the raw signal behind dashboards and alerts
- a dashboard is easier to use when the data is collected cleanly

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L5.5
```
