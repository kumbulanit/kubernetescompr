# L5.3 · One Command Instead of a Hundred and Seven

| | |
|---|---|
| **Time** | 60 minutes |
| **Difficulty** | Includes a defect that only appears on the second release |
| **You need first** | [L5.2](../L5.2-rbac/) finished |
| **You will do** | Install the whole platform from one chart |
| **Check you are done** | `make validate-lab LAB=L5.3` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command. <kbd>Tab</kbd> completes filenames.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../../GETTING-STARTED.md).
</details>

---

## What you are going to do

You have applied 107 objects by hand over four days. You will replace all of it with one command — and then argue about whether that was a good idea, because templating has real costs and this lab is honest about them.

You will also deliberately introduce the most common Helm defect there is: one that installs fine, upgrades fine, and then fails months later in a way nobody connects to the change that caused it.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `helm version --short` | `v3.x` |
| 3 | `make validate-day4` | `DAY 4 CHECKPOINT PASSED` |

**If #2 fails:**

```bash
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |

The chart itself is [`charts/axispay/`](../../../charts/axispay/) — it is a shared artefact rather than a per-lab copy, and [`charts/README.md`](../../../charts/README.md) explains its design.

---

## Step 1 — Render before you install. Always.

```bash
helm template axispay ./charts/axispay | head -40
helm template axispay ./charts/axispay | grep '^kind:' | sort | uniq -c | sort -rn
```

```
     15 kind: NetworkPolicy      13 kind: Deployment
     15 kind: ServiceAccount     13 kind: Service
      5 kind: PodDisruptionBudget 4 kind: ServiceMonitor
      2 kind: HorizontalPodAutoscaler  2 kind: Ingress
      1 kind: PrometheusRule      1 kind: DaemonSet   1 kind: CronJob
```

**Installing a chart you have not rendered is applying YAML you have not read.** It costs three seconds.

---

## Step 2 — Lint, including the values files

```bash
helm lint ./charts/axispay
for v in charts/axispay/values*.yaml; do echo "--- $v"; helm lint ./charts/axispay -f "$v" || break; done
make helm-check
```

`make helm-check` runs 94 assertions with no cluster and no Helm binary. They are this week's platform rules turned into tests: three probes on every container, liveness and readiness on **different** endpoints, no version label inside a selector, every `*_SERVICE_URL` pointing at a Service the chart creates.

**`helm lint` checks syntax.** It has no opinion about whether your liveness probe points at the same endpoint as your readiness probe. That check had to be written.

---

## Step 3 — Read the data structure behind twelve Deployments

```bash
sed -n '/^services:/,/^# ---- ingress/p' charts/axispay/values.yaml | head -40
sed -n '1,45p' charts/axispay/templates/deployments.yaml
```

**One `range`, twelve Deployments.** Predict, before running anything:

1. How many Services will exist?
2. How many HorizontalPodAutoscalers?
3. Which Deployment will have **no** `replicas` field, and why?

```bash
helm template axispay ./charts/axispay | grep -A3 'kind: HorizontalPodAutoscaler' | grep 'name:'
helm template axispay ./charts/axispay | awk '/^kind: Deployment/,/^---/' | grep -c 'replicas:'
```

`payment-service` and `fraud-service` have no `replicas:` — their HPAs own that field. If the chart set it, every `helm upgrade` would reset the autoscaler's decision, potentially mid-spike.

---

## Step 4 — Install the whole platform

```bash
kubectl delete -R -f manifests/day1/ -f manifests/day2/ --ignore-not-found --wait=false
sleep 10

helm upgrade --install axispay ./charts/axispay --create-namespace --wait --timeout 10m
helm list -A
kubectl get pods -A -l app.kubernetes.io/part-of=axispay
```

```bash
helm get notes axispay
```

Read it. The NOTES output contains an actual smoke test, not "deployed successfully".

---

## Step 5 — Prove it end to end

```bash
curl -sk -X POST https://api.axispay.local/api/v1/payments \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H 'Idempotency-Key: l53-helm-001' \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-L53-001","amount_minor":125000,"currency":"ZAR","card_token":"tok_visa_4242"}' \
  | jq '{payment_id, status}'

curl -sk -i -X POST https://api.axispay.local/api/v1/payments \
  -H 'X-API-Key: axp_live_7Kq2mVx9RtLd' -H 'Idempotency-Key: l53-helm-001' \
  -H 'Content-Type: application/json' \
  -d '{"merchant_reference":"AXP-L53-001","amount_minor":125000,"currency":"ZAR","card_token":"tok_visa_4242"}' \
  2>/dev/null | grep -i 'HTTP/\|Idempotent-Replay'
```

`200` and `Idempotent-Replay: true`.

---

## Step 6 — What a release actually is

```bash
kubectl get secret -n default -l owner=helm
helm history axispay
```

**A release is a Secret containing a gzipped copy of the rendered manifests**, one per revision. Three consequences:

- `helm rollback` re-applies a **stored copy** — it does not re-render from git, so it works even after the chart source changes.
- Deleting those Secrets loses your release history permanently.
- **Helm is not a controller.** Nothing watches your chart. Between commands, Helm is not running at all.

---

## Step 7 — The defect that appears on release two

```bash
cp charts/axispay/templates/_helpers.tpl /tmp/_helpers.tpl.bak

cat >> charts/axispay/templates/_helpers.tpl <<'TPL'
{{- define "axispay.badSelector" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/version: {{ .root.Chart.AppVersion }}
{{- end -}}
TPL

sed -i.bak 's/include "axispay.selectorLabels" (dict "root" $ "name" $name) | nindent 6/include "axispay.badSelector" (dict "root" $ "name" $name) | nindent 6/' \
  charts/axispay/templates/deployments.yaml

helm upgrade axispay ./charts/axispay --wait --timeout 5m
```

**The first upgrade succeeds** — the selector changed, and Helm replaced the objects.

Now imagine bumping the app version. On a real cluster you get:

```
Error: UPGRADE FAILED: cannot patch "payment-service" with kind Deployment:
Deployment.apps "payment-service" is invalid: spec.selector: field is immutable
```

**This is the most common Helm chart defect.** Install works. Patch releases work, because the version has not changed. The **first minor bump** fails — often weeks later, often at 02:00 — and the only fix is deleting the Deployment in production.

**Note that `helm rollback` does not help.** The live object is fine; it is the *new render* that cannot be applied.

**Restore:**

```bash
mv /tmp/_helpers.tpl.bak charts/axispay/templates/_helpers.tpl
mv charts/axispay/templates/deployments.yaml.bak charts/axispay/templates/deployments.yaml
helm upgrade axispay ./charts/axispay --wait --timeout 5m
make helm-check
```

---

## Step 8 — Wedge a release, then get out

```bash
helm upgrade axispay ./charts/axispay --set global.image.tag=9.9.9-does-not-exist --wait --timeout 90s 2>&1 | tail -3
kubectl get pods -n axispay-core | grep -i 'ImagePull\|ErrImage'
helm history axispay
```

Stuck at `pending-upgrade` or `failed`, with half the pods old and half unable to pull.

```bash
helm rollback axispay --wait --timeout 5m
helm history axispay
```

**Now do it the way you should have:**

```bash
helm upgrade axispay ./charts/axispay --set global.image.tag=9.9.9-does-not-exist --atomic --timeout 90s 2>&1 | tail -3
helm history axispay
```

**With `--atomic`, Helm rolls back automatically** and the release never sits half-applied. There is no reason to omit it.

---

## Did it work?

```bash
make validate-lab LAB=L5.3
make helm-check
```

---

## Clean up

Leave the release installed — L5.4 upgrades it.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `cannot re-use a name that is still in use` | Objects exist from `kubectl apply` | Delete the raw manifests first |
| `field is immutable` | Selector labels changed | Step 7 — the fix is deleting the Deployment, so avoid the cause |
| Release stuck `pending-upgrade` | An upgrade was interrupted | `helm rollback` |
| `ImagePullBackOff` after install | Images not in the runtime | `eval $(minikube -p axispay docker-env)` then `make build` |
| `helm lint` passes but objects are wrong | Lint checks syntax, not semantics | `make helm-check` |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/05-security-packaging-and-operations/solutions.md).

**1.** Add `customer-service` as a **subchart** with its own values and a `condition:`. Then argue whether a subchart was the right structure, given it is one of twelve near-identical Deployments.

**2.** Write out three of the twelve Deployments explicitly instead of ranging. Which version would you rather review? Which would you rather debug at 02:00? They are not the same answer.

---

## What you built

- **The entire platform from one command**, in any of five configurations
- **94 assertions** proving the chart offline
- **The immutable-selector defect**, built deliberately and understood
- **A wedged release, and `--atomic`** as the thing that prevents it
- **An honest account of what templating costs**

**Next:** [L5.4 — Promotion](../L5.4-promotion/) — three environments that differ only in the ways you intended.
