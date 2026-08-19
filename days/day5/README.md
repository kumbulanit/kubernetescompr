# Security, packaging and operations

Day 5 is where the course shifts from **"the app runs"** to **"the app runs safely, predictably, and observably"**.

By the end of the day you should be able to explain, with real Kubernetes objects and real commands:

- how a pod gets an identity with a `ServiceAccount`
- how Pod Security Admission rejects workloads that are too risky
- how RBAC proves who can and cannot do something
- how Helm turns many resources into one repeatable release
- how one chart is promoted through dev, staging, and production values
- how metrics, dashboards, logs, and alerts help an operator find problems fast

## What this day is really teaching

For a Java developer, Day 5 is the point where Kubernetes stops looking like "just YAML".

You start seeing the platform as four connected concerns:

1. **Identity and access** — which workload or person is acting?
2. **Packaging and release** — how do we install and upgrade safely?
3. **Promotion** — how do we move the same thing between environments without surprises?
4. **Operations** — how do we know the system is healthy, degraded, or broken?

```mermaid
flowchart LR
  A[Pod identity<br/>ServiceAccount] --> B[Least privilege<br/>RBAC + Pod Security]
  B --> C[Repeatable install<br/>Helm chart]
  C --> D[Controlled promotion<br/>values-dev/staging/prod]
  D --> E[Operational feedback<br/>metrics + logs + alerts]
```

## Day 5 at a glance

| Lab | Theme | You will work with | Main success signal |
|---|---|---|---|
| **L5.1** | Identity and pod security | `ServiceAccount`, namespace labels, admission rejection | risky pod is **forbidden** before it runs |
| **L5.2** | RBAC | `Role`, `ClusterRole`, `RoleBinding`, `kubectl auth can-i` | you can prove **yes** and **no** answers |
| **L5.3** | Helm packaging | `Chart.yaml`, `values.yaml`, templates, `helm install` | one release creates the whole platform |
| **L5.4** | Promotion | `values-dev.yaml`, `values-staging.yaml`, `values-prod.yaml` | environments differ in **numbers**, not in **shape** |
| **L5.5** | Metrics and dashboards | `ServiceMonitor`, `PrometheusRule`, `kubectl top`, HPA | you can see both platform and business signals |
| **L5.6** | Logs and alerts | structured JSON logs, Loki/Alloy, Alertmanager routing | an event can be traced from log line to routed alert |

## Before you start Day 5

What you should expect to see: the platform from earlier days is already running, and Day 5 builds operational controls around it.

- The AxisPay workloads should already exist in the cluster.
- For **L5.5** and **L5.6**, the observability stack should be installed first.
- The main Helm chart used in L5.3 and L5.4 lives at `platform/charts/axispay/`.

Useful commands before the first lab:

```bash
kubectl get ns
kubectl get pods -A -l app.kubernetes.io/part-of=axispay
helm version
```

Expected result:

```text
$ kubectl get ns
NAME                    STATUS   AGE
axispay-async           Active   18h
axispay-core            Active   18h
axispay-data            Active   18h
axispay-edge            Active   18h
axispay-observability   Active   34m
axispay-ops             Active   18h
default                 Active   18h
kube-node-lease         Active   18h
kube-public             Active   18h
kube-system             Active   18h

$ kubectl get pods -A -l app.kubernetes.io/part-of=axispay
NAMESPACE               NAME                                   READY   STATUS    RESTARTS   AGE
axispay-edge            edge-gateway-7d9fcb88fb-8w7kt         1/1     Running   0          31m
axispay-edge            auth-service-7cc8d4c4bd-9h7vg         1/1     Running   0          31m
axispay-core            payment-service-6f869d7b7c-7s9lm      1/1     Running   0          31m
axispay-core            fraud-service-5bf4cc84f8-vg2m2        1/1     Running   0          31m
axispay-async           reporting-service-77b45f665c-l8x6h    1/1     Running   0          31m
axispay-observability   alert-sink-5f5449bc6b-r4wzk           1/1     Running   0          29m
axispay-ops             node-agent-r9t8d                      1/1     Running   0          31m

$ helm version
version.BuildInfo{Version:"v3.17.3", GitCommit:"f6f4b1239e2f3f2a3d89d8e8d4a0d1d6ec1b0a92", GitTreeState:"clean", GoVersion:"go1.23.7"}
```

If `kubectl get pods -A -l app.kubernetes.io/part-of=axispay` returns nothing, finish the earlier deployment steps first. Day 5 assumes there is already something real to secure, package, and observe.

## How to use this folder

1. Start with `days/day5/labs/README.md`.
2. Do the labs in order.
3. Read the README in each lab folder before running commands.
4. Compare your terminal output with the expected transcripts in the lab.
5. Run the validation command for that lab before moving on.

If you want to replay the whole Day 5 state from the repo, use the Day 5 apply script instead of a raw recursive `kubectl apply`:

```bash
bash days/day5/apply-all.sh
```

That script installs the observability stack first so the `ServiceMonitor`, `PrometheusRule`, and `AlertmanagerConfig` CRDs exist before the Day 5 manifests are applied.

Validation commands you will use repeatedly:

```bash
make validate-lab LAB=L5.1
make validate-lab LAB=L5.3
make validate-day5
```

Expected result:

```text
$ make validate-lab LAB=L5.1
[INFO] checking ServiceAccounts, token mounting and Pod Security labels
[PASS] every AxisPay pod has its own ServiceAccount
[PASS] no API token mounted except node-agent
[PASS] a privileged pod is refused at admission
[PASS] validation complete for L5.1

$ make validate-lab LAB=L5.3
[INFO] checking Helm chart structure and installed release
[PASS] chart validation succeeds
[PASS] release axispay is deployed
[PASS] selectors are immutable-safe
[PASS] validation complete for L5.3

$ make validate-day5
== Day 5 checkpoint ==
[PASS] security controls present
[PASS] Helm release healthy
[PASS] promotion values consistent
[PASS] observability objects loaded
[PASS] logs and alert routing healthy
Day 5 validation passed
```

## Cheat Sheet / Tips & Tricks

Quick commands:
- `kubectl get serviceaccount -A` — quickly see workload identities across namespaces.
- `kubectl auth can-i get secrets -n axispay-core --as=auditor@axis.example` — prove an allow/deny decision without doing the action.
- `kubectl get namespace axispay-core axispay-edge axispay-async --show-labels` — confirm Pod Security labels before debugging a forbidden pod.
- `helm lint platform/charts/axispay -f platform/charts/axispay/values.yaml` — catch chart problems before cluster install.
- `helm template axispay platform/charts/axispay -f platform/charts/axispay/values-staging.yaml | head -40` — preview the real YAML Helm will send.
- `helm upgrade --install axispay platform/charts/axispay -f platform/charts/axispay/values-staging.yaml -n axispay-core --wait --timeout 10m` — safe default for repeatable installs and upgrades.
- `helm diff upgrade axispay platform/charts/axispay -f platform/charts/axispay/values-prod.yaml` — see what promotion changes before rollout.
- `kubectl rollout status deployment/payment-service -n axispay-core` — wait for a deployment to finish changing.
- `kubectl rollout undo deployment/payment-service -n axispay-core --to-revision=<n>` — back out a bad rollout when history exists.
- `kubectl top pods -n axispay-core` — check live CPU and memory pressure.
- `kubectl get servicemonitor -A -L release` — verify Prometheus discovery labels.
- `kubectl logs -n axispay-core deploy/payment-service -f --since=10m` — stream only recent app logs during an incident.

Tips & tricks:
- `kubectl auth can-i` is the fastest way to debug “why can’t this user or service account do X?”
- Pod Security failures happen at create time; read the full `Forbidden` message because it usually names the exact missing fields.
- `helm template` is your friend when Helm feels magical; it turns the chart back into normal YAML.
- `helm upgrade --install` is easier to automate than separate install and upgrade branches.
- `kubectl rollout history` and `kubectl rollout undo` only help if old ReplicaSets were kept; `revisionHistoryLimit` matters.
- `kubectl top` needs `metrics-server`; if it fails, fix the metrics pipeline before trusting HPA behavior.
- A missing `release` label on a `ServiceMonitor` often means the target is absent from Prometheus, not merely unhealthy.
- `kubectl logs --previous` only works after a container actually restarted and old logs still exist.
- Start with `kubectl describe` when something is stuck; events often show the reason faster than scanning YAML.

## Rebuild everything from scratch (disaster recovery)

Use this when your cluster crashed, you are resuming Day 5 after a break and RBAC, Helm, metrics, or logging feel half-broken, or you want the cleanest possible full platform before the final assessment/capstone.

Why not just re-apply an old lab manifest? Because Kubernetes tries to merge your old YAML with the live object already in the cluster. If that live state has drifted, the merge can fail with confusing errors such as:

```text
The Deployment "payment-service" is invalid:
* spec.template.spec.containers[0].env[0].valueFrom: Invalid value: "": may not be specified when `value` is not empty
```

Deleting the AxisPay namespaces first removes that drifted state, so Kubernetes creates fresh objects instead of trying to patch a broken mix of old and new configuration.

One important Day 5 detail: `deploy-day5` **does** apply `platform/manifests/day5/observability/`, but that folder only contains the AxisPay observability objects (`ServiceMonitor`, `PrometheusRule`, `AlertmanagerConfig`, dashboard ConfigMaps, NetworkPolicies, and `alert-sink`). The actual Prometheus/Grafana/Loki/Alloy stack is still a separate Helm-based install from `make observability` (or `make observability-slim` on a smaller laptop).

**If this is a fresh cluster and observability is not installed yet, run this first:**

```bash
make observability
```

Expected result:

```text
$ make observability
==> Checking there is room for this
  cluster allocatable CPU: 6000m

==> Adding chart repositories
  OK   repositories updated
  OK   namespace axispay-observability ready (Pod Security: privileged — Alloy needs hostPath)

==> Installing kube-prometheus-stack 66.3.0
  this pulls ~900 MB and takes 5-15 minutes on first run
Release "kube-prometheus-stack" does not exist. Installing it now.
NAME: kube-prometheus-stack
LAST DEPLOYED: Fri Aug 22 09:14:03 2026
NAMESPACE: axispay-observability
STATUS: deployed
  OK   Prometheus, Alertmanager and Grafana installed

==> Installing Loki 6.24.0
Release "loki" does not exist. Installing it now.
NAME: loki
LAST DEPLOYED: Fri Aug 22 09:19:41 2026
NAMESPACE: axispay-observability
STATUS: deployed
  OK   Loki installed (single-binary, 24h retention)

==> Installing Alloy 0.10.1
Release "alloy" does not exist. Installing it now.
NAME: alloy
LAST DEPLOYED: Fri Aug 22 09:22:18 2026
NAMESPACE: axispay-observability
STATUS: deployed
  OK   Alloy installed (DaemonSet — one collector per node)

==> Applying the AxisPay observability manifests
servicemonitor.monitoring.coreos.com/axispay-edge created
servicemonitor.monitoring.coreos.com/axispay-core created
servicemonitor.monitoring.coreos.com/axispay-async created
servicemonitor.monitoring.coreos.com/axispay-ops created
prometheusrule.monitoring.coreos.com/axispay-slo created
alertmanagerconfig.monitoring.coreos.com/axispay-routing created
configmap/axispay-dashboard-platform created
configmap/axispay-dashboard-triage created
networkpolicy.networking.k8s.io/default-deny-all created
networkpolicy.networking.k8s.io/allow-dns-egress created
networkpolicy.networking.k8s.io/allow-prometheus-scrape created
networkpolicy.networking.k8s.io/allow-node-agent-to-apiserver created
networkpolicy.networking.k8s.io/allow-observability-internal created
networkpolicy.networking.k8s.io/allow-observability-egress created
deployment.apps/alert-sink created
serviceaccount/alert-sink created
service/alert-sink created
servicemonitor.monitoring.coreos.com/axispay-observability created
  OK   ServiceMonitors, rules, alert routing, dashboards and the sink applied

==> Verifying
  OK   alert-sink is Ready
  OK   5 ServiceMonitors registered
  OK   PrometheusRule applied
  OK   2 dashboards provisioned
```

**Run this:**

```bash
make rebuild-day5
```

This is the same rebuild pattern you first saw on Day 3, just at the final level: **you do not need to run five separate commands**. `make rebuild-day5` is one command that wipes the old platform, then rebuilds **Day 1**, **Day 2**, **Day 3**, **Day 4**, and **Day 5** in the correct dependency order. It gives you the complete course platform back from nothing.

Expected result:

```text
$ make rebuild-day5
==> Deleting all AxisPay namespaces — this removes every workload, PVC and secret
namespace "axispay-edge" deleted
namespace "axispay-core" deleted
namespace "axispay-async" deleted
namespace "axispay-ops" deleted
namespace "axispay-data" deleted
namespace "axispay-observability" deleted
Namespaces removed. Run 'make rebuild-day1' (or rebuild-day2 / day3 / day4 / day5) to recreate the platform.

namespace/axispay-edge created
namespace/axispay-core created
namespace/axispay-async created

==> Deploying Day 1
deployment.apps/edge-gateway created
deployment.apps/auth-service created
deployment.apps/merchant-service created
deployment.apps/payment-service created
service/edge-gateway created
service/auth-service created
service/merchant-service created
service/payment-service created
pod/payment-service-bare created
✓ DAY 1 CHECKPOINT PASSED — 12/12 checks

==> Deploying Day 2
namespace/axispay-ops created
deployment.apps/fraud-service created
deployment.apps/routing-service created
daemonset.apps/node-agent created
horizontalpodautoscaler.autoscaling/payment-service created
cronjob.batch/settlement-cron created
✓ DAY 2 CHECKPOINT PASSED — 21/21 checks

==> Deploying Day 3
namespace/axispay-data created
deployment.apps/customer-service created
deployment.apps/ledger-service created
statefulset.apps/postgres created
statefulset.apps/redis created
statefulset.apps/rabbitmq created
✓ DAY 3 CHECKPOINT PASSED — 29/29 checks

==> Deploying Day 4
secret/axispay-tls created
ingress.networking.k8s.io/axispay-api created
ingress.networking.k8s.io/axispay-portal created
networkpolicy.networking.k8s.io/default-deny-all created
networkpolicy.networking.k8s.io/allow-ingress-controller created
networkpolicy.networking.k8s.io/allow-core-to-data created
✓ DAY 4 CHECKPOINT PASSED — ingress, DNS and segmentation healthy

==> Deploying Day 5
serviceaccount/edge-gateway created
serviceaccount/auth-service created
serviceaccount/payment-service created
serviceaccount/axispay-core-workload created
serviceaccount/axispay-async-workload created
serviceaccount/node-agent created
clusterrole.rbac.authorization.k8s.io/axispay-auditor created
role.rbac.authorization.k8s.io/axispay-deployer created
role.rbac.authorization.k8s.io/axispay-oncall created
clusterrole.rbac.authorization.k8s.io/axispay-prometheus created
clusterrole.rbac.authorization.k8s.io/axispay-node-reader created
rolebinding.rbac.authorization.k8s.io/axispay-auditor created
rolebinding.rbac.authorization.k8s.io/axispay-deployer created
rolebinding.rbac.authorization.k8s.io/axispay-oncall created
clusterrolebinding.rbac.authorization.k8s.io/axispay-prometheus created
clusterrolebinding.rbac.authorization.k8s.io/axispay-node-agent created
namespace/axispay-core configured
namespace/axispay-edge configured
namespace/axispay-async configured
namespace/axispay-data configured
namespace/axispay-ops configured
namespace/axispay-observability created
servicemonitor.monitoring.coreos.com/axispay-edge created
servicemonitor.monitoring.coreos.com/axispay-core created
servicemonitor.monitoring.coreos.com/axispay-async created
servicemonitor.monitoring.coreos.com/axispay-ops created
prometheusrule.monitoring.coreos.com/axispay-slo created
alertmanagerconfig.monitoring.coreos.com/axispay-routing created
configmap/axispay-dashboard-platform created
configmap/axispay-dashboard-triage created
networkpolicy.networking.k8s.io/default-deny-all created
networkpolicy.networking.k8s.io/allow-dns-egress created
networkpolicy.networking.k8s.io/allow-prometheus-scrape created
networkpolicy.networking.k8s.io/allow-node-agent-to-apiserver created
networkpolicy.networking.k8s.io/allow-observability-internal created
networkpolicy.networking.k8s.io/allow-observability-egress created
deployment.apps/alert-sink created
serviceaccount/alert-sink created
service/alert-sink created
servicemonitor.monitoring.coreos.com/axispay-observability created

Cluster
----------------------------------------------------------------
  ✓ 1/1 nodes Ready
  ✓ Calico present — NetworkPolicy is actually enforced

Namespaces
----------------------------------------------------------------
  ✓ axispay-edge
  ✓ axispay-core
  ✓ axispay-ops
  ✓ axispay-async
  ✓ axispay-data
  ✓ axispay-observability

Day 5 — identity, packaging and observability
----------------------------------------------------------------
  ✓ no workload uses the default ServiceAccount
  ✓ Pod Security checked on the application namespaces
  ✓ RBAC assertions hold
  ✓ chart assertions hold
  ✓ PromQL assertions hold
  ✓ Prometheus Operator installed

End-to-end — a payment still works
----------------------------------------------------------------
  ✓ payment accepted through the Ingress (201)

✓ DAY 5 CHECKPOINT PASSED — 50/50 checks
```

On a fresh rebuild, Day 5 usually pauses longest around observability and the final checkpoint, because Prometheus targets, dashboards, and alerting objects all need time to settle.

**Warning:** this command is destructive. It deletes everything in the AxisPay namespaces, including current workloads, Secrets, PVCs, and all metrics/log history inside the observability namespace. Only run it when you are fine losing the current state.

There is no Day 6 rebuild target to point to after this — `make rebuild-day5` is the complete platform.

## What success looks like

By the end of Day 5, you should be able to say all of these out loud and prove them with commands:

- **This pod has this identity.**
- **This user can do this, but not that.**
- **This release came from this chart and these values.**
- **Staging and production are the same shape.**
- **This alert came from these metrics.**
- **This incident can be traced through logs.**
