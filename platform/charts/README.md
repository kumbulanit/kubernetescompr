# charts/axispay

The whole AxisPay platform as one Helm chart: twelve Deployments, a DaemonSet,
a CronJob, their Services, ServiceAccounts, PodDisruptionBudgets, HPAs,
NetworkPolicies, Ingresses and the Prometheus rules — 69 objects on the
default values, 76 on production values.

Days 1–4 apply raw manifests on purpose. You cannot debug a templating layer
over an object model you have not met yet. Day 5 replaces `kubectl apply -f`
with `helm upgrade --install`, and the interesting part of the module is
what that swap buys and what it costs.

---

## Install

```bash
# the classroom platform
helm upgrade --install axispay ./charts/axispay --create-namespace --wait

# any other environment
helm upgrade --install axispay ./charts/axispay \
  -f charts/axispay/values-staging.yaml --wait --timeout 10m
```

Through the Makefile:

```bash
make helm-check                       # offline validation, no helm binary needed
make helm-lint                        # helm lint against every values file
make helm-template                    # render without installing
make helm-install                     # install with values.yaml
make helm-install HELM_VALUES=charts/axispay/values-slim.yaml
make helm-upgrade                     # the capstone: --set global.image.tag=2.0.0 --atomic
make helm-rollback                    # back one revision
```

---

## The five values files

| File | Pods | CPU requests | Purpose |
|---|---:|---:|---|
| `values.yaml` | 26 | 1670m | Classroom default. Profile A (3 nodes). |
| `values-dev.yaml` | 12 | 760m | One replica each, no Ingress, no operator CRs. |
| `values-staging.yaml` | 22 | 1420m | Production's *shape*, smaller numbers. |
| `values-prod.yaml` | 41 | 3380m | What the platform team considers non-negotiable. |
| `values-slim.yaml` | 9 | 275m | Profile B rescue when laptops run out of CPU. |

Read them in that order. Each one is a set of arguments about trade-offs, and
the comments say what is being traded and why — the reasoning is the teaching
material, not the numbers.

Two things worth knowing before you install `values-prod.yaml` on Minikube: it
*does* fit a Profile A cluster at rest (3380m against roughly 4500m
schedulable), but its autoscaler ceiling does not — `payment-service` at
`maxReplicas: 20` requests 4000m on its own. Render it and read it; run the
labs on `values.yaml`.

`values-slim.yaml` turns off `reporting-service`, `notification-service` and
the settlement CronJob. The payment path stays complete, so every core lab
still runs, but the reporting and fan-out demos do not. That is stated at the
top of the file so nobody discovers it mid-lab.

---

## Why one template renders twelve Deployments

`templates/deployments.yaml` ranges over `.Values.services` instead of there
being twelve near-identical files.

**What that buys.** "Every service has all three probes" and "every container
drops all capabilities" become true *by construction*. A reviewer checks one
file. Adding a thirteenth service is nine lines of YAML in `values.yaml`, and
it arrives with the full security posture already applied.

**What it costs.** `helm template` becomes the only way to see what actually
gets applied. Indirection is real and it is not free.

It is the right trade when the workloads are genuinely similar and the wrong
one when they are not — which is why the data tier is *not* templated this
way. Postgres, Redis and RabbitMQ differ from each other in ways that a shared
template would have to paper over with conditionals, and a template with six
`if` branches is harder to read than three explicit files.

---

## The named templates, and the one that matters most

`_helpers.tpl` defines twelve templates. Eleven of them are convenience.
`axispay.selectorLabels` is load-bearing:

```gotemplate
{{- define "axispay.selectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end -}}
```

That set is small and immutable on purpose. A Deployment's `.spec.selector`
cannot be changed after creation. Put `helm.sh/chart` or
`app.kubernetes.io/version` in it and the *next* `helm upgrade` that bumps a
version fails with `field is immutable`, and the only fix is deleting the
Deployment in production. `axispay.labels` carries the volatile labels;
`axispay.selectorLabels` carries identity only.

`check-helm-chart.py` asserts this. It is the single most common Helm chart
defect and it does not show up until the second release.

---

## Validation without a Helm binary

`helm lint` and `helm template` are the authoritative checks and the labs run
them on your cluster. But the repository also validates its own chart offline:

```bash
python3 platform/admin/validate/check-helm-chart.py
```

91 assertions across twelve areas — every values file renders to parseable
Kubernetes YAML; override files may only override keys that exist; every
container has three probes with liveness and readiness on *different*
endpoints; no selector carries a version label; no HPA-managed Deployment
pins `.spec.replicas`; every `*_SERVICE_URL` resolves to a Service the chart
creates; every namespace has a default-deny NetworkPolicy *and* an explicit
DNS egress allow; the workload set matches `manifests/`; versions agree with
`VERSIONS.env`; and the whole thing fits the classroom cluster both at rest
and with both autoscalers at their ceiling.

It runs on `platform/admin/validate/lib_gotemplate.py`, a ~450-line Go template
subset written for this repository. It is not Helm and does not pretend to be:
every construct it does not understand raises rather than being skipped, so it
cannot report success on a chart it failed to read. Worth ten minutes in class
if the room wants to know what a chart *actually* is — a data structure and
some string substitution, and nothing more.

---

## Upgrade and rollback

```bash
helm upgrade axispay ./charts/axispay --set global.image.tag=2.0.0 --atomic --timeout 10m
helm history axispay -n axispay-core
helm rollback axispay -n axispay-core --wait
```

`--atomic` rolls back automatically if the release does not become ready
inside the timeout. Without it a failed upgrade leaves the release wedged
half-way and someone has to reason about which pods are which version at
02:00. Use it every time.

`helm uninstall` deliberately leaves PVCs behind. The ledger is not
disposable, and Helm's willingness to delete what it created stops at data.

---

## What this chart is not

No sub-charts, no chart dependencies, no `tpl`, no `lookup`, no hooks beyond
what is written here. Every one of those is defensible in a real platform and
every one of them adds a layer between the person and the object. This chart
stays legible: someone who has never used Helm can read `values.yaml` and
predict what will exist in the cluster. That is the property worth protecting.
