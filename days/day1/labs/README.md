# Day 1 — Foundations and Core Objects

*“Deploy it.”* By 17:00 the AxisPay payment platform is running on your cluster and
taking payments.

**New here?** Read [Getting started](../../GETTING-STARTED.md) first — it installs
everything and creates your cluster.

| # | Practical | Time | What you will do |
|---|---|---|---|
| 1 | [L1.1 — Look around your cluster](./L1.1-cluster-recon/) | 35 min | Find out what you have. Nothing can break. |
| 2 | [L1.2 — Namespaces](./L1.2-namespaces/) | 30 min | Create your first objects, and find out what a namespace does *not* do |
| 3 | [L1.3 — Your first pod](./L1.3-first-pod/) | 40 min | Run real software, then delete it and see nothing bring it back |
| 4 | [L1.4 — Deployments](./L1.4-deployments/) | 50 min | Tell Kubernetes what you *want*. Watch it heal itself. |
| 5 | [L1.5 — Services](./L1.5-services/) | 40 min | A name that does not change in front of pods that do |
| 6 | [L1.6 — Assemble the platform](./L1.6-platform-assembly/) | 45 min | Rebuild it all yourself, with hints rather than commands |
| 7 | [INC-1 — Your first incident](./INC-1-imagepullbackoff/) | 35 min | Something breaks. Nobody tells you what. |

**Work them in order.** Each one assumes the last is finished.

## Checking your work

```bash
make validate-lab LAB=L1.3      # one practical
make validate-day1              # the whole day, before you go home
```

A practical is finished when the check passes — not when the commands have run.

## If you get stuck

Every practical has an **If something went wrong** table listing the failures we
actually see, what causes each, and the command that confirms it. Look there first.

The method you learn in L1.1 and use in INC-1 works on anything:

1. Is it **Ready** — not just Running? 2. What do the **events** say?
3. What do the **logs** say? 4. Is the **config** what you think?
5. Can it **reach** its dependencies? 6. What **changed**?

## When you finish

Worked answers to every challenge:
[`topics/01-foundations-and-core-objects/solutions.md`](../solutions.md)

The written material for the day, including the 16-point reference on every topic:
[`topics/01-foundations-and-core-objects/`](../)
