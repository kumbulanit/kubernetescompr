# SEV-1 · Merchant integrations cannot connect

> **Hand to the student immediately on injection. This one is SEV-1.**

```
────────────────────────────────────────────────────────────────────────
  AXISPAY OPERATIONS — INCIDENT TICKET
  Ref     OPS-2026-08-14-0478
  Raised  23:06 SAST          Severity  SEV-1
  Source  Merchant Integrations (P1 bridge open)
────────────────────────────────────────────────────────────────────────

  Three merchant integrations are failing to connect to the payment API.
  All three report the same thing in their own logs:

      SSLError: certificate verify failed: certificate has expired

  Our dashboards are green. Our own health checks pass. Internal
  service-to-service traffic is unaffected.

  Merchant onboarding has stopped. Two of the three merchants are in
  their go-live window tonight.

  A P1 bridge is open. They want a time to resolution.

────────────────────────────────────────────────────────────────────────
```

**Before you report this as fixed:** be able to say exactly how you verified it, and be ready to be asked why that verification is trustworthy.
