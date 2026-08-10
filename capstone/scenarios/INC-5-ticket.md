# SEV-2 · Declined payments across multiple merchants

> **Hand to the student ~3 minutes after injection. Nothing else is said.**

```
────────────────────────────────────────────────────────────────────────
  AXISPAY OPERATIONS — INCIDENT TICKET
  Ref     OPS-2026-08-14-0471
  Raised  22:44 SAST          Severity  SEV-2
  Source  Merchant Support (escalated)
────────────────────────────────────────────────────────────────────────

  Merchant MER_7QK2XD9P4A (Kalahari Outfitters) reports customers being
  declined at checkout since approximately 22:41. Their own logs show our
  API returning responses, not errors.

  Two further merchants have since confirmed:
    MER_3XB8VN2LQK  (Sable Coffee Roasters)
    MER_9WD4PC7RTE  (Umhlanga Wellness Group)

  Merchant Support estimates approval rate is down roughly 30%.
  Checkout is slower than usual but is not timing out.

  Ops on call needs an update in 15 minutes.

────────────────────────────────────────────────────────────────────────
```

**Your update must answer three things:** what is the customer impact right now, what is the cause, and what is your next action.
