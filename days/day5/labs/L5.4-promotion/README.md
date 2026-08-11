# L5.4 · Three Environments, One Artefact

| | |
|---|---|
| **Time** | 30 minutes |
| **Difficulty** | Short, and the argument matters more than the commands |
| **You need first** | [L5.3](../L5.3-helm-packaging/) finished |
| **You will do** | Diff environments as data, and reconcile real drift |
| **Check you are done** | `make validate-lab LAB=L5.4` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command. <kbd>Tab</kbd> completes filenames.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../../../GETTING-STARTED.md).
</details>

---

## What you are going to do

The question this lab answers is not "how do I make three environments". It is **"how do I know what the difference between them is"** — because the answer in most organisations is "nobody does", and that is where a four-hour investigation comes from.

You will diff environments without touching a cluster, create drift by hand, watch it be detected, and reconcile it.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `helm list -A \| grep axispay` | A deployed release |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |

The values files are [`charts/axispay/values*.yaml`](../../../../platform/charts/axispay/).

---

## The scenario

> A payment that works in staging fails in production. Both were "deployed from the same chart".
>
> Four hours later: staging has `maxUnavailable: 1` and production has `0`, set during an incident eight months ago and never restored.
>
> Nobody was careless. There was simply no artefact stating the intended difference, so there was nothing to check drift against.

---

## Step 1 — Diff without touching a cluster

```bash
diff <(helm template axispay ./charts/axispay -f charts/axispay/values-staging.yaml) \
     <(helm template axispay ./charts/axispay -f charts/axispay/values-prod.yaml) | head -40
```

Now the summary a change board would actually want:

```bash
for v in values-dev values-staging values-prod values-slim; do
  n=$(helm template axispay ./charts/axispay -f charts/axispay/$v.yaml | grep -c '^kind:')
  r=$(helm template axispay ./charts/axispay -f charts/axispay/$v.yaml \
      | awk '/^kind: Deployment/{d=1} d && /^  replicas:/{s+=$2; d=0} END{print s}')
  printf '%-16s %3s objects  %3s replicas\n' "$v" "$n" "$r"
done
```

---

## Step 2 — Read the reasoning, not just the numbers

```bash
head -40 charts/axispay/values-dev.yaml
```

| Setting | dev | prod | Why the difference is legitimate |
|---|---|---|---|
| `replicas` | 1 | 3–6 | Nobody depends on dev availability |
| `podDisruptionBudget` | off | on | A PDB on 1 replica blocks every drain |
| `logLevel` | debug | info | Debug logs would emit request bodies in prod |
| `ingress` | off | on | Port-forward is faster in dev |
| `maxUnavailable` | 1 | 0 | With one replica, surge alone cannot progress |

---

## Step 3 — The thing that is never relaxed

```bash
grep -A4 'networkPolicy' charts/axispay/values-dev.yaml
```

`enabled: true` in dev, in staging, in production.

> **A policy you only enable in production is a policy you first test in production.**
>
> Every NetworkPolicy bug — a forgotten DNS rule, a selector that matches nothing — shows up as an application failure that looks like something else entirely. You want to meet those in dev, on a Tuesday, with one replica and no merchants.

The same argument applies to `podSecurity.enforce` and `serviceAccount.automountToken`. **Security settings are structure, not size.**

---

## Step 4 — Promote a change properly

```bash
helm upgrade --install axispay ./charts/axispay -f charts/axispay/values-dev.yaml \
  --set services.fraud-service.hpa.targetCPU=50 \
  --dry-run=server | grep -A12 'kind: HorizontalPodAutoscaler'
```

`--dry-run=server` sends the objects to the API server for validation without persisting them — so it catches admission failures (Pod Security, quota, webhooks) that `helm template` alone cannot.

> **`--set` is for experiments, never for state.** A change that lives only in someone's shell history is drift by construction. If it is worth keeping, it goes in the values file and through review.

---

## Step 5 — Prove staging matches production in shape

```bash
diff <(helm template axispay ./charts/axispay -f charts/axispay/values-staging.yaml \
       | grep '^kind:' | sort | uniq -c | awk '{print $2, $3}') \
     <(helm template axispay ./charts/axispay -f charts/axispay/values-prod.yaml \
       | grep '^kind:' | sort | uniq -c | awk '{print $2, $3}') \
  && echo "SAME SHAPE — only numbers differ"
```

**That ten-line check in CI would have prevented the four-hour investigation in the scenario.**

---

## Step 6 — Create drift, detect it, reconcile it

```bash
helm plugin install https://github.com/databus23/helm-diff 2>/dev/null || true
helm diff upgrade axispay ./charts/axispay -f charts/axispay/values.yaml | head -20
```

Empty means the cluster matches the chart. **Now create drift the way it really happens:**

```bash
kubectl scale deployment/merchant-service -n axispay-core --replicas=5
helm diff upgrade axispay ./charts/axispay -f charts/axispay/values.yaml | grep -A3 merchant
```

```bash
helm upgrade axispay ./charts/axispay -f charts/axispay/values.yaml --wait
kubectl get deploy merchant-service -n axispay-core
```

**The chart won.** That is the point of declarative deployment — and it is why `kubectl scale` on a Helm-managed workload is a temporary act.

**Note what did *not* get reset:** `payment-service`, because its Deployment has no `replicas` field at all. The HPA owns it. Had the chart pinned it, every upgrade would have stamped on the autoscaler mid-spike.

---

## Step 7 — The production values you should read but not install

```bash
grep -B2 -A6 'maxReplicas: 20' charts/axispay/values-prod.yaml
```

`values-prod.yaml` fits a three-node cluster **at rest** — about 3380m of requests against roughly 4500m schedulable. **Its autoscaler ceiling does not:** `payment-service` at `maxReplicas: 20` requests 4000m on its own.

Render it and read it. Run the labs on `values.yaml`.

---

## Did it work?

```bash
make validate-lab LAB=L5.4
```

---

## Clean up

```bash
helm upgrade axispay ./charts/axispay --wait
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `values-prod` leaves pods Pending | Sized for a real cluster | Render it; do not install it |
| `helm diff` not found | Plugin missing | `helm plugin install https://github.com/databus23/helm-diff` |
| Diff shows changes you did not make | A controller owns the field | HPA replicas, and Kubernetes' own defaults |
| `--dry-run=server` fails, `client` passes | An admission controller rejects it | That is the point — read the rejection |
| Scaling by hand keeps reverting | The chart is the source of truth | Change the values file |

---

## Try this yourself

Answers in [`solutions.md`](../../solutions.md).

**1.** Write `values-dr.yaml` for a disaster-recovery region at 30% of production, with no Ingress and **full** alerting. Justify every difference from production.

**2.** Build the CI check that fails a merge if staging and production render a different set of object kinds.

---

## What you built

- **Three environments diffed as data**, with no cluster involved
- **The rule that security settings never vary by environment**, and why
- **Drift created, detected and reconciled**
- **The one field the chart deliberately refuses to own**

**Next:** [L5.5 — Metrics](../L5.5-metrics-and-dashboards/) — turn the SLO from an opinion into a query.
