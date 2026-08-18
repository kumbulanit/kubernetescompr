# L5.6 · Logs and alerts

This lab is about turning logs and signals into alerts that people can act on.

In simple words: logs tell you what happened, and alerts tell you when you should care now.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open the files in `manifests/`.
2. Read the alert rules and routing config.
3. Notice that alerts need clear rules and a place to go.

Why this matters:
- a system can be noisy
- alerts help reduce that noise into something actionable
- a good alert saves time during incidents

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```
This adds the alerting configuration.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get prometheusrule -A
kubectl get alertmanagerconfig -A
```
This shows that the alerting objects were created.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Look at the alert rule and ask: what event should trigger it, and who should see it?

Why this matters:
- an alert is only useful if it is clear and actionable
- a bad alert becomes noise very quickly

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L5.6
```
