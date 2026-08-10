# Topics

One folder per teaching topic — five topics, one per day of the course.

Each folder is **self-contained enough to teach from**: the deck, the manual chapter
in both source and printed form, the trainer guide, the assessment and its answer
key, and worked solutions to every lab challenge.

| # | Topic | Theme | Labs |
|---|---|---|---|
| 01 | [Foundations and core objects](01-foundations-and-core-objects/) | Deploy it | [L1.1 – L1.6 + INC-1](../labs/day1/) |
| 02 | [Workloads, scaling and releases](02-workloads-scaling-and-releases/) | Keep it up | [L2.1 – L2.6 + INC-2](../labs/day2/) |
| 03 | [Storage and configuration](03-storage-and-configuration/) | Give it memory | [L3.1 – L3.7 + INC-3](../labs/day3/) |
| 04 | [Networking and exposure](04-networking-and-exposure/) | Let the world in | [L4.1 – L4.6 + INC-4](../labs/day4/) |
| 05 | [Security, packaging and operations](05-security-packaging-and-operations/) | Run it | [L5.1 – L5.6](../labs/day5/) + the [capstone](../capstone/) |

## Why the labs are not in here

They are in [`labs/`](../labs/), together, because a student works through the week
in one place rather than hopping between five folders. Each topic README links
straight to its own labs.

## Why the deck and manual appear twice

Every topic folder holds a copy of its own `.pptx` and `.pdf` so it can be handed
over as a unit. The canonical set lives in [`../documents/`](../documents/), and
`make slides` and `make manuals` write both locations — so they cannot drift.
`make verify` checks it byte for byte.
