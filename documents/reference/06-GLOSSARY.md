# Glossary

*Every term the course uses, defined as it is used here. Where a definition is commonly got wrong, the wrong version is named.*

---

## A

**Admission controller** — Code that runs inside the API server after authentication and authorisation and before persistence. *Mutating* controllers change the object; *validating* controllers accept or reject it. Pod Security Admission is a validating controller compiled into the API server, which is why it has no failure mode of its own.

**Affinity / anti-affinity** — Scheduling constraints expressed as label selectors over pods (`podAffinity`) or nodes (`nodeAffinity`). `required...` is a hard constraint — the pod stays `Pending` if it cannot be met. `preferred...` is a weighting the scheduler tries to honour.

**Alertmanager** — Receives firing alerts from Prometheus and decides *who* is notified, *how often*, and whether an alert should be suppressed. Prometheus decides *whether* something is wrong; Alertmanager decides everything else.

**API group** — A namespace for API resources: `""` (core), `apps`, `batch`, `networking.k8s.io`, `rbac.authorization.k8s.io`. RBAC rules must name the group, and getting it wrong produces a rule that silently matches nothing.

**API server** — The only component that talks to etcd. Everything else — kubectl, the scheduler, controllers, kubelets — talks to the API server.

---

## B

**Baseline (Pod Security Standard)** — Blocks the well-known escalations: privileged containers, host namespaces, **hostPath volumes**, host ports, added capabilities. *Commonly got wrong:* people assume baseline permits hostPath because it sounds mild. It does not, and that is why a log collector cannot run under it.

**Bound service account token** — A projected token that is time-limited, audience-scoped and tied to the pod's lifetime. The kubelet refreshes it. Better than the old permanent tokens, but still a live credential while the pod runs.

---

## C

**cAdvisor** — Container metrics (`container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`) exposed by the kubelet. This is how you see resource usage for workloads that expose no metrics of their own — a database, for instance.

**Cardinality** — The number of distinct label-value combinations. In Prometheus each combination is a **series**; in Loki each is a **stream**. Memory scales with it. Putting a request ID in a label is the single most common way to take either system down.

**Chart** — A Helm package: `Chart.yaml`, `values.yaml`, `templates/`. Rendered by text substitution into ordinary Kubernetes YAML.

**ClusterIP** — The default Service type. A stable virtual IP reachable only inside the cluster. It is not a proxy: kube-proxy programs iptables or IPVS rules and traffic goes directly to a pod.

**ClusterRole** — A set of RBAC permissions not scoped to a namespace. Bound by a ClusterRoleBinding (cluster-wide) or — the more useful case — by a RoleBinding (that namespace only).

**ConfigMap** — Non-secret configuration. Consumed as environment variables (a **snapshot** taken at pod start) or as a volume (updated in place, roughly within a minute — **except** with `subPath`, which never updates).

**Control plane** — API server, scheduler, controller-manager, etcd. Upgraded before the kubelets, always.

**Controller** — A loop: observe actual state, compare with desired state, act to close the gap, repeat. Every Kubernetes object of consequence has one. This is the idea the whole week is built on.

**CoreDNS** — The cluster DNS server, in `kube-system`. Resolves `service.namespace.svc.cluster.local`. When it is unavailable, the symptom is a *name resolution* failure, not a connection refusal — which is why a DNS outage and a NetworkPolicy that blocks port 53 look identical.

**CronJob** — Creates a Job on a schedule. `timeZone` matters (the cluster's midnight is UTC). `concurrencyPolicy: Forbid` prevents a second run starting while the first is going.

---

## D

**DaemonSet** — One pod per node, automatically covering nodes added later. The correct kind for node-local agents: log collectors, metrics agents. *Commonly got wrong:* modelled as a Deployment with `replicas` equal to the node count, which stops being true the moment someone adds a node.

**Default-allow** — The state of pod networking before any NetworkPolicy selects a pod. Every pod can reach every pod. This is why "we have NetworkPolicies" and "we have segmentation" are different claims.

**Deployment** — Manages ReplicaSets, which manage pods. Provides rolling updates and rollback. The ownership chain is Deployment → ReplicaSet → Pod, and understanding it explains why deleting a pod does not remove it.

**Drain** — `kubectl drain` evicts pods from a node, respecting PodDisruptionBudgets. A slow drain is usually a PDB doing its job. `--force` on a slow drain deletes the pod the PDB was protecting.

---

## E

**EndpointSlice** — The list of ready pod addresses behind a Service, maintained by the endpoints controller. An empty one means either every pod is unready or the selector matches nothing — and `kubectl get endpointslices` is the fastest way to tell a label typo from an application failure.

**Error budget** — The allowance implied by an SLO. 99.5% availability is a 0.5% budget. Alert thresholds are the budget expressed as a rate.

**etcd** — The cluster's datastore. Only the API server talks to it. Backing it up is backing up the cluster's desired state — not your application data.

---

## F

**`for:` (alert)** — How long an alert expression must remain true before the alert fires. This is what separates an alert from a notification: without it a single slow scrape pages someone at 03:00.

**`fsGroup`** — A pod-level security context field that changes the group ownership of mounted volumes, so a non-root process can write to them. Without it, a container running as UID 10001 cannot write to a freshly provisioned volume owned by root.

---

## G

**Golden signals** — Traffic, errors, latency, saturation. The minimum set that answers "is this service healthy" for any request-driven system.

**Grafana** — Queries Prometheus and Loki and draws the results. In this platform dashboards are provisioned from labelled ConfigMaps by a sidecar, so a dashboard is data in version control rather than something clicked into existence.

---

## H

**Headless Service** — `clusterIP: None`. DNS returns the pod addresses directly rather than a virtual IP. Required by StatefulSets so each pod gets a stable, individually-resolvable name.

**Helm** — A package manager for Kubernetes. Renders templates, applies them, and stores each release as a Secret containing a gzipped copy of the rendered manifests. **Not a controller** — nothing watches your chart.

**Histogram** — A metric type recording observations into buckets, enabling `histogram_quantile`. Place bucket boundaries around your SLO threshold, or the quantile at that threshold is an interpolation between two distant buckets.

**HorizontalPodAutoscaler (HPA)** — Adjusts replica count from a metric. `ceil(currentReplicas × currentUtilisation / targetUtilisation)`, where utilisation is measured against the **request**, not the limit.

---

## I

**Idempotency key** — A client-supplied identifier that makes a retried request safe. AxisPay returns `200` and `Idempotent-Replay: true` for a repeat, rather than taking money twice. Not a Kubernetes concept — a payments one, and the reason the capstone checks for duplicates.

**Ingress** — A routing rule object. It does nothing on its own: an Ingress **controller** must claim it. An Ingress with an empty `ADDRESS` almost always means no controller has.

**Init container** — Runs to completion before the app containers start. Used here to wait for PostgreSQL before the migration Job begins.

**ipBlock** — A NetworkPolicy peer expressed as a CIDR, used when the destination is not a pod — the API server or the kubelet, for example. Neither can be matched by a `namespaceSelector`, because neither is a pod.

---

## J

**Job** — Runs a pod to completion. Success is the container exiting 0 — not staying up. `backoffLimit` bounds the retries. `restartPolicy` must be `Never` or `OnFailure`.

---

## K

**kubeconfig** — Clusters, users and contexts. A context binds a cluster to a user and a default namespace. Most "it worked on my machine" incidents are the wrong context.

**kubelet** — The agent on each node. Starts containers, runs probes, reports status, projects tokens. It may lag the API server by up to three minor versions but must never lead it — which is what fixes the upgrade ordering.

**kube-proxy** — Programs the iptables or IPVS rules that make a Service IP work. It is not in the data path; it writes the rules the kernel then uses.

---

## L

**LimitRange** — Namespace-level defaults and bounds for container resources. Where ResourceQuota caps the total, LimitRange governs the individual.

**Liveness probe** — Failure ⇒ **restart the container**. Point it at something that only a restart can fix. Pointing it at a dependency check converts one slow database into a cluster-wide restart storm.

**Loki** — Log storage that indexes **labels** and scans content. A query must start with a label selector; that is what makes it finite.

**LogQL** — Loki's query language: `{namespace="axispay-core"} | json | level="error"`. The part before the pipe is an index lookup; everything after it is a scan.

---

## M

**maxSurge / maxUnavailable** — Rolling-update parameters. `maxUnavailable: 0` with `maxSurge: 1` never reduces capacity. Both at zero makes progress impossible.

**Minor units** — Money as an integer: 125000 is R1,250.00. Floating-point money is a defect, not a style choice. JPY has zero decimal places, which is why the exponent is per-currency.

---

## N

**Namespace** — A scope for names and a boundary for quota, policy and RBAC. Not a security boundary on its own — that requires NetworkPolicy and RBAC.

**ndots** — The `resolv.conf` option controlling when a name is treated as absolute. Kubernetes sets `ndots:5`, so `postgres.axispay-data.svc.cluster.local` (four dots) is tried against every search domain first — several wasted round-trips per lookup.

**NetworkPolicy** — Pod-level firewall rules. **Default-allow until selected. Additive — there is no deny rule. Ingress and egress are independent, and both ends must permit a flow.** Requires a CNI that enforces it; Minikube's default does not.

---

## O

**OOMKilled** — The kernel killed a container for exceeding its memory limit. Exit code 137. Memory has no throttle: crossing the limit is instant death, not a slowdown.

**Operator** — A controller for a custom resource. The Prometheus Operator turns ServiceMonitor and PrometheusRule objects into Prometheus configuration.

---

## P

**PersistentVolume (PV) / PersistentVolumeClaim (PVC)** — The claim is the request; the volume is the storage. A pod references a claim, never a volume. `ReadWriteOnce` means one **node**, not one pod.

**Pod** — The smallest deployable unit: one or more containers sharing a network namespace and volumes. Pods are disposable by design.

**PodDisruptionBudget (PDB)** — Constrains **voluntary** disruption only: drains, upgrades, descheduling. It will not save you from a node that catches fire. A PDB on a single replica permits the drain and protects nothing.

**Pod Security Admission (PSA)** — Enforces one of three standards per namespace via labels, in three modes (`enforce`, `audit`, `warn`). Evaluates on **create and update**, never continuously.

**PromQL** — Prometheus's query language. `rate()` on counters, `histogram_quantile()` on histogram buckets, `sum by (label)` to aggregate.

**Prometheus** — Pull-based metrics. It scrapes your `/metrics` endpoint; nothing is pushed.

---

## Q

**QoS class** — `Guaranteed` (requests equal limits), `Burstable` (requests set, limits higher), `BestEffort` (neither). Determines eviction order when a node is under memory pressure — BestEffort goes first.

---

## R

**Readiness probe** — Failure ⇒ **remove the pod from Service endpoints**. The pod keeps running. This is the probe that should check dependencies, because the correct response to a broken dependency is to stop receiving traffic, not to restart.

**Reconciliation loop** — Observe, compare, act, repeat. See *Controller*. It is the single idea that makes the rest of Kubernetes predictable.

**ReplicaSet** — Maintains a replica count. Created and managed by a Deployment; you rarely create one yourself.

**ResourceQuota** — A namespace-level cap on total requests, limits and object counts. Requests must fit; limits may be oversubscribed.

**Restricted (Pod Security Standard)** — Baseline plus: non-root, all capabilities dropped, `allowPrivilegeEscalation: false`, a seccomp profile, and restricted volume types.

**Role / RoleBinding** — Namespace-scoped RBAC permissions and their grant. A RoleBinding may reference a **ClusterRole**, which is the most useful of the four combinations.

**Rollback** — `helm rollback` re-applies a **stored** copy of a previous release. It does not re-render from your repository, so it works even after the chart source has changed.

---

## S

**Secret** — Base64-encoded, **not encrypted**. Protected by RBAC and — if you enable it — encryption at rest in etcd. Anyone with `pods/exec` in the namespace can read every Secret those pods consume.

**Selector** — A label query. A Service's selector chooses pods; a Deployment's `.spec.selector` is **immutable after creation**, which is why volatile labels must never appear in it.

**ServiceAccount** — An identity for a pod. Every namespace has a `default`, and it is mounted unless you say otherwise.

**ServiceMonitor** — A Prometheus Operator CRD describing what to scrape. It selects a **Service**, so unready pods are not scraped. It must carry the label the operator selects on, or Prometheus ignores it entirely — the target is *absent*, not *down*.

**SLO / SLI** — Service Level Objective (the target) and Indicator (the measurement). AxisPay: 99.5% availability, 300 ms p99. An SLO that is not a query is an opinion.

**StatefulSet** — Stable network identity, stable per-pod storage, ordered operations. Needed when the pods are not interchangeable — a database, a queue.

**StorageClass** — Describes a class of storage and how to provision it. `volumeBindingMode: WaitForFirstConsumer` defers binding until a pod is scheduled, so the volume lands where the pod does.

---

## T

**Taint / toleration** — A taint repels pods from a node; a toleration lets a specific pod ignore it. This is how control-plane nodes stay clear of application workloads.

**terminationGracePeriodSeconds** — How long between SIGTERM and SIGKILL. Combined with a `preStop` sleep, it is what lets a pod finish in-flight requests during a rollout.

**Topology spread constraints** — Distribute pods across a topology domain — nodes, zones — with a `maxSkew`. More expressive than anti-affinity for "spread evenly" rather than "never co-locate".

---

## V

**Values file** — Helm's input data. Merged deeply, later files winning. **Lists replace rather than append**, which surprises everyone once.

**Version skew** — The permitted difference between component versions. The kubelet may lag the API server by up to three minor versions and must never lead it — which is why the control plane is upgraded first.

---

## W

**Working set** — The memory a container is actually using, as the kernel accounts it. `container_memory_working_set_bytes` is the number to compare against the limit; `container_memory_usage_bytes` includes reclaimable cache and reads high.

---

## Terms specific to this course

**AxisPay** — The fictional payment platform built across the week. Sixteen services, one application, extended every day.

**alert-sink** — A service that receives Alertmanager webhooks so alert routing can be *proved* rather than assumed.

**Correlation ID** — `X-Correlation-Id`, minted by `edge-gateway` on Day 1 and carried through every downstream call. On Day 5 it is what turns "seven services touched this payment" into one sorted list.

**Profile A / Profile B** — The two supported classroom cluster sizes: 3 nodes × 2 CPU (recommended) and 2 nodes × 2 CPU (minimum, use `values-slim.yaml`).

**The triage loop** — The six-step method taught on Day 1 and applied to every incident: is it Ready → what do the events say → what do the logs say → is the config what you think → can it reach its dependencies → what changed.

**The trap** — The capstone fault whose fastest fix destroys a control built earlier in the week. Deleting a NetworkPolicy restores service in two seconds and removes the cardholder-data segmentation. Knowing the difference between the fastest fix and the correct one is the job.
