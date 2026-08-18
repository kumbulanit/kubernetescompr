# Day 4 — Networking and exposure

This day is about helping traffic reach the right place in a safe way.

The main ideas are simple:
- use Services to reach pods reliably
- use DNS so services can find each other by name
- use Ingress and TLS to expose apps outside the cluster
- use NetworkPolicy to control traffic
- use placement rules for the right nodes
- use PodDisruptionBudgets during maintenance

For every lab in this day:
1. Read the lab README.
2. Apply the manifest.
3. Check the result with `kubectl`.
4. Run the validation command.
