# Workloads, Scaling and Releases

*Day 2 of AxisPay · Kubernetes Comprehensive — “Keep it up”*

Resource requests and limits, the three probes separated by consequence, autoscaling, the workload kinds, and a rolling update that drops nothing.

---

## What is in this folder

| File | What it is |
|---|---|
| [`AxisPay-K8s-Day2.pptx`](./AxisPay-K8s-Day2.pptx) | The deck. Every slide has speaker notes: objectives, timings, demo cues, questions with expected answers. |
| [`manual-chapter.md`](./manual-chapter.md) | The participant manual chapter — source. Every topic on the 16-point template, plus cheat sheet, review questions and interview questions. |
| [`AxisPay-K8s-Day2-Participant-Manual.pdf`](./AxisPay-K8s-Day2-Participant-Manual.pdf) | The same chapter, rendered for printing. |
| [`trainer-guide.md`](./trainer-guide.md) | Minute-by-minute timing, what to cut when running late, where students get stuck, the demos worth doing live. |
| [`assessment.md`](./assessment.md) | The end-of-day paper. 15 minutes, 10 items. |
| [`answer-key.md`](./answer-key.md) | Answers with marking guidance and the reasoning behind each distractor. |
| [`solutions.md`](./solutions.md) | Worked answers to every lab challenge and bonus exercise. |

## Learning objectives

By the end of this topic you can:

1. Say what requests and limits each do, and who reads them
2. Name the three probes by CONSEQUENCE, not by name
3. Explain why a liveness probe must never check a dependency
4. Run a zero-downtime release under live traffic

## Labs

Labs live in [`labs/day2/`](./labs/) — they are kept together so a student can work the whole week in one place.

| Lab | Title |
|---|---|
| [`L2.1-resources`](./labs/L2.1-resources/) | Requests and Limits — Telling the Scheduler the Truth |
| [`L2.2-quota-limitrange`](./labs/L2.2-quota-limitrange/) | Quota and LimitRange — Governance Nobody Can Opt Out Of |
| [`L2.3-probes`](./labs/L2.3-probes/) | Health Probes — Thirty Lines That Decide Everything |
| [`L2.4-autoscaling`](./labs/L2.4-autoscaling/) | Autoscaling — More Pods, Automatically |
| [`L2.5-workload-types`](./labs/L2.5-workload-types/) | Not Everything Is a Deployment |
| [`L2.6-zero-downtime-rollout`](./labs/L2.6-zero-downtime-rollout/) | Release Under Live Traffic, and Drop Nothing |
| [`INC-2-oomkill-crashloop`](./labs/INC-2-oomkill-crashloop/) | The Service That Keeps Dying |

## The Kubernetes objects this topic applies

`manifests/day2/` — 17 file(s). Applied with:

```bash
make deploy-day2
make validate-day2
```

## Diagram sources

- [`d2-01-requests-vs-limits.mmd`](../../platform/admin/authoring/diagrams/mermaid/d2-01-requests-vs-limits.mmd)
- [`d2-02-probe-consequences.mmd`](../../platform/admin/authoring/diagrams/mermaid/d2-02-probe-consequences.mmd)
- [`d2-03-cascading-failure.mmd`](../../platform/admin/authoring/diagrams/mermaid/d2-03-cascading-failure.mmd)
- [`d2-04-hpa-loop.mmd`](../../platform/admin/authoring/diagrams/mermaid/d2-04-hpa-loop.mmd)
- [`d2-05-workload-types.mmd`](../../platform/admin/authoring/diagrams/mermaid/d2-05-workload-types.mmd)
- [`d2-06-rolling-update.mmd`](../../platform/admin/authoring/diagrams/mermaid/d2-06-rolling-update.mmd)
- [`d2-07-graceful-shutdown.mmd`](../../platform/admin/authoring/diagrams/mermaid/d2-07-graceful-shutdown.mmd)
- [`d2-08-day2-end-state.mmd`](../../platform/admin/authoring/diagrams/mermaid/d2-08-day2-end-state.mmd)

Rendered with `cd diagrams && ./render.sh --only d2` (needs mermaid-cli). The deck's diagrams are separate and native to PowerPoint — their source is `slides/src/day2/diagrams.js`.

## Rebuild everything from scratch (disaster recovery)

Use this when your cluster crashed, you are coming back to Day 2 after a break and something feels broken, or you want a clean **Day 1 + Day 2** platform again before continuing with resources, probes, autoscaling, workload types, and rolling updates.

Why not just re-apply an old lab manifest? Because Kubernetes tries to merge your old YAML with the live object already in the cluster. If that live state has drifted, the merge can fail with confusing errors such as:

```text
The Deployment "payment-service" is invalid:
* spec.template.spec.containers[0].env[0].valueFrom: Invalid value: "": may not be specified when `value` is not empty
```

Deleting the AxisPay namespaces first removes that drifted state, so Kubernetes creates fresh objects instead of trying to patch a broken mix of old and new configuration.

**Run this:**

```bash
make rebuild-day2
```

This is the important part: **you do not need to run two separate commands**. `make rebuild-day2` is one command that wipes the old Day 1–2 platform, then rebuilds **Day 1**, then **Day 2** in the correct dependency order. Even though you are on Day 2, this single command gives you a complete, working **Day 1 + Day 2** platform from absolutely nothing.

Expected result:

```text
$ make rebuild-day2
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

Cluster
----------------------------------------------------------------
  ✓ 1/1 nodes Ready

Namespaces
----------------------------------------------------------------
  ✓ axispay-edge
  ✓ axispay-core

Workloads for day 1
----------------------------------------------------------------
  ✓ Deployment axispay-edge/edge-gateway has 1/1 ready replica(s)
  ✓ Deployment axispay-edge/auth-service has 1/1 ready replica(s)
  ✓ Deployment axispay-core/payment-service has 1/1 ready replica(s)
  ✓ Deployment axispay-core/merchant-service has 1/1 ready replica(s)

Services have endpoints
----------------------------------------------------------------
  ✓ Service axispay-edge/edge-gateway has 1 endpoint(s)
  ✓ Service axispay-edge/auth-service has 1 endpoint(s)
  ✓ Service axispay-core/payment-service has 1 endpoint(s)
  ✓ Service axispay-core/merchant-service has 1 endpoint(s)

End-to-end — a payment still works
----------------------------------------------------------------
  ✓ edge-gateway reaches payment-service in-cluster

✓ DAY 1 CHECKPOINT PASSED — 12/12 checks

==> Deploying Day 2
namespace/axispay-ops created
resourcequota/axispay-core-quota created
limitrange/axispay-core-limits created
deployment.apps/edge-gateway configured
deployment.apps/auth-service configured
deployment.apps/merchant-service configured
deployment.apps/payment-service configured
deployment.apps/fraud-service created
deployment.apps/routing-service created
deployment.apps/loadgen created
service/fraud-service created
service/routing-service created
service/node-agent created
service/loadgen created
horizontalpodautoscaler.autoscaling/payment-service created
horizontalpodautoscaler.autoscaling/fraud-service created
daemonset.apps/node-agent created
job.batch/recon-worker created
cronjob.batch/settlement-cron created
deployment.apps/payment-service configured

Cluster
----------------------------------------------------------------
  ✓ 1/1 nodes Ready

Namespaces
----------------------------------------------------------------
  ✓ axispay-edge
  ✓ axispay-core
  ✓ axispay-ops
  ✓ axispay-async

Day 2 — resources, probes and autoscaling
----------------------------------------------------------------
  ✓ every container has a memory limit
  ✓ HorizontalPodAutoscaler present
  ✓ settlement-cron CronJob present

✓ DAY 2 CHECKPOINT PASSED — 21/21 checks
```

If you are already further on in the course, use the higher rebuild target instead — for example, `make rebuild-day4` recreates **Day 1 through Day 4** together; the full pattern is documented in [`days/day3/README.md`](../day3/README.md).

This command is **destructive**: it deletes everything in those namespaces, including data, so only use it when you are happy to lose the current state.

---

*The PPTX and PDF here are copies. The canonical set is in [`documents/`](../); both are regenerated by `make slides` and `make manuals`, so they cannot drift.*
