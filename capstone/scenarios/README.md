# Capstone incident scenarios

Three tickets, handed out during phase 3 of the capstone. They contain **symptoms only** — no causes, no hints, no mention of which component is involved.

| Ticket | Severity | Injected at | Inject with |
|---|---|---|---|
| [`INC-5-ticket.md`](./INC-5-ticket.md) | SEV-2 | 00:40 | `scripts/incidents/inject-INC-5.sh` |
| [`INC-6-ticket.md`](./INC-6-ticket.md) | SEV-2 | 00:52 | `scripts/incidents/inject-INC-6.sh` |
| [`INC-7-ticket.md`](./INC-7-ticket.md) | SEV-1 | 01:04 | `scripts/incidents/inject-INC-7.sh` |

Causes, hints and debrief questions are in [`documents/instructor/capstone-run-book.md`](../run-book.md) — instructor only.

## Why the tickets read like this

A ticket that says *"Redis is down"* tests nothing. Real tickets arrive as a customer-visible symptom filtered through a support agent, usually with one detail that turns out to matter and two that turn out not to. Each ticket above contains at least one useful signal and at least one plausible distraction, because separating those is the skill being assessed.

Note also what the tickets do **not** say: none of them mentions a pod, a namespace, or Kubernetes at all. That is accurate. Nobody outside the platform team describes an incident in those terms, and translating from "merchants are being declined" to "which component" is the first move of the triage loop.
