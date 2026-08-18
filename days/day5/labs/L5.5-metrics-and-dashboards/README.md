# L5.5 · Metrics and dashboards

This lab is about showing the health of the platform with metrics.

In simple words: metrics are numbers that tell you how the system is doing.

### What this concept means
Metrics are the numbers that tell you how the platform is doing. They can show CPU usage, request latency, error rates, or the number of successful operations. Dashboards turn those numbers into something humans can read quickly.

The reason this matters is simple: it is much easier to spot a problem when the platform exposes health signals clearly. A dashboard is not just decoration. It is a way to turn raw signals into operational awareness.

```mermaid
flowchart LR
  App[Application] --> Metrics[Metrics]
  Metrics --> Dashboard[Dashboard]
```


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

Expected result:
- The command finishes without errors.
- You should see messages such as `created` or `configured` for the resources.
- A follow-up `kubectl get` command should show the objects you created.
This adds the monitoring configuration.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get servicemonitor -A
```

Expected result:
- The output lists the resource names or details you expected to inspect.
- You should be able to see the object or the status you are checking.
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

Expected result:
- The validation command finishes successfully.
- You should see a passing message for the lab.
