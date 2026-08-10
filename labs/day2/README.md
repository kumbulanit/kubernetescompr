# Day 2 — Workloads, Scaling and Releases

*“Keep it up.”* Resource limits, health checks, autoscaling, the right workload type, and a release that drops nothing.

**New here?** Read [Getting started](../GETTING-STARTED.md) first.

| Practical | Time |
|---|---|
| [L2.1 — Requests and Limits — Telling the Scheduler the Truth](L2.1-resources/) | 45 minutes |
| [L2.2 — Quota and LimitRange — Governance Nobody Can Opt Out Of](L2.2-quota-limitrange/) | 35 minutes |
| [L2.3 — Health Probes — Thirty Lines That Decide Everything](L2.3-probes/) | 55 minutes |
| [L2.4 — Autoscaling — More Pods, Automatically](L2.4-autoscaling/) | 40 minutes |
| [L2.5 — Not Everything Is a Deployment](L2.5-workload-types/) | 40 minutes |
| [L2.6 — Release Under Live Traffic, and Drop Nothing](L2.6-zero-downtime-rollout/) | 55 minutes |
| [INC-2 — The Service That Keeps Dying](INC-2-oomkill-crashloop/) | 60 minutes |

**Work them in order.** Each one assumes the last is finished.

## Checking your work

```bash
make validate-lab LAB=L2.3      # one practical
make validate-day2              # the whole day, before you go home
```

A practical is finished when the check passes — not when the commands have run.

## If you get stuck

Every practical has an **If something went wrong** table listing the failures we
actually see, what causes each, and the command that confirms it. Look there first.

The method, which works on anything: 1. Is it **Ready**? 2. What do the **events**
say? 3. What do the **logs** say? 4. Is the **config** what you think? 5. Can it
**reach** its dependencies? 6. What **changed**?

## When you finish

Worked answers to every challenge:
[`topics/02-workloads-scaling-and-releases/solutions.md`](../../topics/02-workloads-scaling-and-releases/solutions.md)

The written material, including the 16-point reference on every subject:
[`topics/`](../../topics/)
