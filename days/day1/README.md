# Foundations and Core Objects

*Day 1 of AxisPay · Kubernetes Comprehensive — “Deploy it”*

The reconciliation loop, the request path through the API server, and the four objects everything else is built on: namespaces, pods, deployments, services.

---

## What is in this folder

| File | What it is |
|---|---|
| [`AxisPay-K8s-Day1.pptx`](./AxisPay-K8s-Day1.pptx) | The deck. Every slide has speaker notes: objectives, timings, demo cues, questions with expected answers. |
| [`manual-chapter.md`](./manual-chapter.md) | The participant manual chapter — source. Every topic on the 16-point template, plus cheat sheet, review questions and interview questions. |
| [`AxisPay-K8s-Day1-Participant-Manual.pdf`](./AxisPay-K8s-Day1-Participant-Manual.pdf) | The same chapter, rendered for printing. |
| [`trainer-guide.md`](./trainer-guide.md) | Minute-by-minute timing, what to cut when running late, where students get stuck, the demos worth doing live. |
| [`assessment.md`](./assessment.md) | The end-of-day paper. 15 minutes, 10 items. |
| [`answer-key.md`](./answer-key.md) | Answers with marking guidance and the reasoning behind each distractor. |
| [`solutions.md`](./solutions.md) | Worked answers to every lab challenge and bonus exercise. |

## Learning objectives

By the end of this topic you can:

1. Explain the reconciliation loop and why it makes Kubernetes predictable
2. Trace what happens between `kubectl apply` and a running container
3. Distinguish a pod that is Running from one that is Ready
4. Apply the six-step triage loop to an unknown failure

## Labs

Labs live in [`labs/day1/`](./labs/) — they are kept together so a student can work the whole week in one place.

| Lab | Title |
|---|---|
| [`L1.1-cluster-recon`](./labs/L1.1-cluster-recon/) | Look Around Your Cluster |
| [`L1.2-namespaces`](./labs/L1.2-namespaces/) | Namespaces — Giving AxisPay Somewhere To Live |
| [`L1.3-first-pod`](./labs/L1.3-first-pod/) | Your First Pod — And Why You Must Never Ship One |
| [`L1.4-deployments`](./labs/L1.4-deployments/) | Deployments — Telling Kubernetes What You *Want* |
| [`L1.5-services`](./labs/L1.5-services/) | Services — A Name That Does Not Change |
| [`L1.6-platform-assembly`](./labs/L1.6-platform-assembly/) | Assemble The Platform — On Your Own |
| [`INC-1-imagepullbackoff`](./labs/INC-1-imagepullbackoff/) | Your First Incident |

## The Kubernetes objects this topic applies

`manifests/day1/` — 9 file(s). Applied with:

```bash
make deploy-day1
make validate-day1
```

## Diagram sources

- [`d1-01-orchestration-problem.mmd`](../../platform/admin/authoring/diagrams/mermaid/d1-01-orchestration-problem.mmd)
- [`d1-02-reconciliation-loop.mmd`](../../platform/admin/authoring/diagrams/mermaid/d1-02-reconciliation-loop.mmd)
- [`d1-03-cluster-architecture.mmd`](../../platform/admin/authoring/diagrams/mermaid/d1-03-cluster-architecture.mmd)
- [`d1-04-apply-request-flow.mmd`](../../platform/admin/authoring/diagrams/mermaid/d1-04-apply-request-flow.mmd)
- [`d1-05-pod-anatomy.mmd`](../../platform/admin/authoring/diagrams/mermaid/d1-05-pod-anatomy.mmd)
- [`d1-06-ownership-chain.mmd`](../../platform/admin/authoring/diagrams/mermaid/d1-06-ownership-chain.mmd)
- [`d1-07-service-selection.mmd`](../../platform/admin/authoring/diagrams/mermaid/d1-07-service-selection.mmd)
- [`d1-08-namespaces-trust-zones.mmd`](../../platform/admin/authoring/diagrams/mermaid/d1-08-namespaces-trust-zones.mmd)
- [`d1-09-triage-loop.mmd`](../../platform/admin/authoring/diagrams/mermaid/d1-09-triage-loop.mmd)
- [`d1-10-day1-end-state.mmd`](../../platform/admin/authoring/diagrams/mermaid/d1-10-day1-end-state.mmd)

Rendered with `cd diagrams && ./render.sh --only d1` (needs mermaid-cli). The deck's diagrams are separate and native to PowerPoint — their source is `slides/src/day1/diagrams.js`.

## Rebuild everything from scratch (disaster recovery)

Use this when your cluster crashed, your Minikube VM got corrupted, you are coming back to the training later and the environment feels broken, or you just want a guaranteed-clean **Day 1** platform again before continuing.

Why not just re-apply an old lab manifest? Because Kubernetes tries to merge your old YAML with the live object already in the cluster. If that live state has drifted, the merge can fail with confusing errors such as:

```text
The Deployment "payment-service" is invalid:
* spec.template.spec.containers[0].env[0].valueFrom: Invalid value: "": may not be specified when `value` is not empty
```

Deleting the AxisPay namespaces first removes that drifted state, so Kubernetes creates fresh objects instead of trying to patch a broken mix of old and new configuration.

**Run this:**

```bash
make rebuild-day1
```

This rebuilds **Day 1 only**. If you are already further along the course, use the higher rebuild target instead — for example, `make rebuild-day3` recreates **Day 1 + Day 2 + Day 3** together. The full pattern is documented in [`../day3/README.md`](../day3/README.md).

Expected result:

```text
$ make rebuild-day1
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
```

**Important:** this command is destructive. It deletes everything in the AxisPay namespaces, including current workloads and data, so only use it when you are happy to lose the current state.

---

*The PPTX and PDF here are copies. The canonical set is in [`documents/`](../); both are regenerated by `make slides` and `make manuals`, so they cannot drift.*
