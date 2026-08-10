# Day 5 — Security, Packaging and Operations

*“Run it.”* Identity, RBAC you can prove, Helm, environment promotion, metrics, logs and alert routing — then the capstone.

**New here?** Read [Getting started](../GETTING-STARTED.md) first.

| Practical | Time |
|---|---|
| [L5.1 — Who Is This Pod?](L5.1-identity-and-pod-security/) | 30 minutes |
| [L5.2 — Least Privilege You Can Prove](L5.2-rbac/) | 50 minutes |
| [L5.3 — One Command Instead of a Hundred and Seven](L5.3-helm-packaging/) | 60 minutes |
| [L5.4 — Three Environments, One Artefact](L5.4-promotion/) | 30 minutes |
| [L5.5 — Golden Signals, and the One That Fires on Silence](L5.5-metrics-and-dashboards/) | 55 minutes |
| [L5.6 — From a Spike on a Graph to the Line That Caused It](L5.6-logs-and-alerts/) | 45 minutes |

**Work them in order.** Each one assumes the last is finished.

## Checking your work

```bash
make validate-lab LAB=L5.3      # one practical
make validate-day5              # the whole day, before you go home
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
[`topics/05-security-packaging-and-operations/solutions.md`](../../topics/05-security-packaging-and-operations/solutions.md)

The written material, including the 16-point reference on every subject:
[`topics/`](../../topics/)
