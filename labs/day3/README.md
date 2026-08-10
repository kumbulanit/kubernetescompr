# Day 3 — Storage and Configuration

*“Give it memory.”* ConfigMaps, Secrets, volumes, StorageClasses, a real database, and containers that no longer run as root.

**New here?** Read [Getting started](../GETTING-STARTED.md) first.

| Practical | Time |
|---|---|
| [L3.1 — ConfigMaps — Configuration Without Rebuilding](L3.1-configmaps/) | 35 minutes |
| [L3.2 — Secrets — Base64 Is Not Encryption](L3.2-secrets/) | 35 minutes |
| [L3.3 — Persistent Volumes — Data That Outlives the Pod](L3.3-persistent-volumes/) | 40 minutes |
| [L3.4 — StorageClasses — Stop Creating Volumes By Hand](L3.4-storageclass/) | 35 minutes |
| [L3.5 — The Data Tier — Real Data, Real Constraints](L3.5-data-tier/) | 55 minutes |
| [L3.6 — StatefulSets — When Pods Are Not Interchangeable](L3.6-statefulsets/) | 45 minutes |
| [L3.7 — Security Context — Stop Running As Root](L3.7-security-context/) | 40 minutes |
| [INC-3 — Two Faults At Once](INC-3-storage-and-config/) | 60 minutes |

**Work them in order.** Each one assumes the last is finished.

## Checking your work

```bash
make validate-lab LAB=L3.3      # one practical
make validate-day3              # the whole day, before you go home
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
[`topics/03-storage-and-configuration/solutions.md`](../../topics/03-storage-and-configuration/solutions.md)

The written material, including the 16-point reference on every subject:
[`topics/`](../../topics/)
