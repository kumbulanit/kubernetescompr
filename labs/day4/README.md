# Day 4 — Networking and Exposure

*“Let the world in.”* Service types, DNS, HTTPS, zero-trust segmentation, placement, and draining a node without dropping a payment.

**New here?** Read [Getting started](../GETTING-STARTED.md) first.

| Practical | Time |
|---|---|
| [L4.1 — The Five Service Types](L4.1-service-types/) | 35 minutes |
| [L4.2 — DNS — The Thing You Have Been Trusting All Week](L4.2-dns/) | 30 minutes |
| [L4.3 — Ingress and TLS — A Merchant Can Reach You](L4.3-ingress-tls/) | 45 minutes |
| [L4.4 — Zero Trust — And Everything Breaks In The Middle](L4.4-networkpolicy/) | 50 minutes |
| [L4.5 — Placement — Stop Putting All The Eggs In One Node](L4.5-placement/) | 35 minutes |
| [L4.6 — Drain a Node Without Dropping a Payment](L4.6-pdb-drain/) | 40 minutes |
| [INC-4 — Three Faults, One Of Them Silent](INC-4-three-faults/) | 55 minutes |

**Work them in order.** Each one assumes the last is finished.

## Checking your work

```bash
make validate-lab LAB=L4.3      # one practical
make validate-day4              # the whole day, before you go home
```

A practical is finished when the check passes — not when the commands have run.

## If you get stuck

Every practical has an **If something went wrong** table listing the failures we
actually see, what causes each, and the command that confirms it. Look there first.

The method, which works on anything: 1. Is it **Ready**? 2. What do the **events**
say? 3. What do the **logs** say? 4. Is the **config** what you think? 5. Can it
**reach** its dependencies? 6. What **changed**?

## When you finish

Worked answers to every challenge:
[`topics/04-networking-and-exposure/solutions.md`](../../topics/04-networking-and-exposure/solutions.md)

The written material, including the 16-point reference on every subject:
[`topics/`](../../topics/)
