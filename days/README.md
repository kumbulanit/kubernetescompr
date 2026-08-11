# Labs

Thirty-one practicals and four incident windows, in the order they are taught. Every
one builds on the one before it — nothing here is a standalone exercise, and nothing
built on Monday is thrown away.

## New here? Start with [Getting started](./GETTING-STARTED.md)

It covers installing everything on Ubuntu, a terminal primer if you need one, and
how to create your cluster. Twenty minutes, once.

## Each practical is a folder

```
day1/L1.3-first-pod/
├── README.md        the lab — every step, every command, what you should see
└── manifests/       the YAML that lab uses, right there
```

Open the folder, read the README, run the commands. **You never have to go looking
for a file in another directory.**

> The YAML in a lab folder is a copy of the canonical version in `manifests/`, which
> is what `make deploy-dayN` applies. `make verify` compares them byte for byte, so
> the copy you work with is always the real thing.

| Day | Topic | Labs |
|---|---|---|
| [day1/](./day1/labs/) | [Foundations and core objects](./day1/) | L1.1 – L1.6 + INC-1 |
| [day2/](./day2/labs/) | [Workloads, scaling and releases](./day2/) | L2.1 – L2.6 + INC-2 |
| [day3/](./day3/labs/) | [Storage and configuration](./day3/) | L3.1 – L3.7 + INC-3 |
| [day4/](./day4/labs/) | [Networking and exposure](./day4/) | L4.1 – L4.6 + INC-4 |
| [day5/](./day5/labs/) | [Security, packaging and operations](./day5/) | L5.1 – L5.6 |
| [../capstone/](../capstone/) | Production upgrade under fire | INC-5, INC-6, INC-7 |

## Every lab has the same twelve sections

Objectives · Scenario · Architecture · Prerequisites · Commands · Expected output ·
Validation · Cleanup · Troubleshooting · Challenge · Bonus · What you built.

The **Troubleshooting** table is worth reading before you start, not after you are stuck.

## Validating your work

```bash
make validate-lab LAB=L3.6      # one lab
make validate-day3              # the whole day's end state
```

A lab is not finished when the commands have run. It is finished when the validator
passes — which is the same discipline the incidents and the capstone are scored on.

## If you are self-studying

Work them in order. The [lab roadmap](../platform/reference/03-LAB-ROADMAP.md) gives
the timings and says which labs depend on which, and the
[dependency map](../platform/reference/02-DEPENDENCY-MAP.md) shows why the order is
what it is.

Answers to every challenge and bonus exercise are in each topic's `solutions.md` —
for example [`topics/03-storage-and-configuration/solutions.md`](./day3/solutions.md).
