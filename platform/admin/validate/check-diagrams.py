#!/usr/bin/env python3
"""
Structural validation of the Mermaid diagram sources.

    python3 platform/admin/validate/check-diagrams.py

WHY
---
`mermaid-cli` needs Node and a headless Chromium, which is a heavy dependency
for CI and is not available on every machine. But a `.mmd` file with an
unbalanced bracket fails at RENDER time — which, for a training repository,
means it fails in front of a room.

This checks the things that actually break: bracket and quote balance, a valid
diagram directive, `style` statements that reference nodes which exist, and
raw double quotes inside labels (the single most common Mermaid syntax error).

It is not a Mermaid parser and does not claim to be. `diagrams/render.sh`
remains the authoritative check.
"""

from __future__ import annotations

import os
import re
import sys
import glob

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "admin", "authoring", "diagrams", "mermaid")

G, R, Y, B, D = "\033[32m", "\033[31m", "\033[33m", "\033[1m", "\033[0m"

DIRECTIVES = ("graph ", "flowchart ", "sequenceDiagram", "stateDiagram",
              "classDiagram", "erDiagram", "gantt", "journey", "pie",
              "timeline", "mindmap", "quadrantChart")

FAILURES: list[str] = []
CHECKS = 0


def check(ok, label, detail=""):
    global CHECKS
    CHECKS += 1
    if not ok:
        print(f"  {R}FAIL{D}  {label}" + (f"\n          {detail}" if detail else ""))
        FAILURES.append(label)
    return bool(ok)


def strip_labels(text: str) -> str:
    """Remove quoted label contents so bracket counting is not confused by them."""
    return re.sub(r'"(?:[^"\\]|\\.)*"', '""', text)


def main():
    files = sorted(glob.glob(os.path.join(SRC, "*.mmd")))
    print(f"{B}AxisPay — Mermaid diagram sources{D}")
    print(f"{len(files)} files in diagrams/mermaid/\n")
    if not files:
        print(f"{R}no .mmd files found{D}")
        sys.exit(1)

    by_day: dict[str, int] = {}
    for f in files:
        name = os.path.basename(f)
        day = name.split("-")[0]
        by_day[day] = by_day.get(day, 0) + 1
        raw = open(f).read()
        body = "\n".join(l for l in raw.splitlines() if not l.strip().startswith("%%"))
        stripped = strip_labels(body)

        # 1. a recognised diagram directive
        first = next((l.strip() for l in body.splitlines() if l.strip()), "")
        check(first.startswith(DIRECTIVES), f"{name}: starts with a diagram directive",
              f"first line is {first[:50]!r}")

        # 2. balanced delimiters, ignoring label contents
        for open_c, close_c in (("[", "]"), ("(", ")"), ("{", "}")):
            a, b = stripped.count(open_c), stripped.count(close_c)
            check(a == b, f"{name}: {open_c}{close_c} balanced",
                  f"{a} {open_c} against {b} {close_c}")

        # 3. even number of double quotes
        check(body.count('"') % 2 == 0, f"{name}: quotes balanced",
              f"{body.count(chr(34))} double quotes — an odd count breaks the parse")

        # 4. every `style X` names a node that appears elsewhere
        # Nodes are declared wherever `NAME[`, `NAME(` or `NAME{` appears — not
        # only at the start of a line. `A -->|label| B["text"]` declares B.
        # Label contents are stripped first so text inside a label cannot
        # masquerade as a declaration.
        declared = set(re.findall(r'\b([A-Za-z_][A-Za-z0-9_]*)\s*[\[\({]', stripped))
        declared |= set(re.findall(r'^\s*subgraph\s+([A-Za-z_][A-Za-z0-9_]*)', body, re.M))
        styled = set(re.findall(r'^\s*style\s+([A-Za-z_][A-Za-z0-9_]*)', body, re.M))
        unknown = styled - declared
        check(not unknown, f"{name}: every style targets a declared node",
              f"unknown: {sorted(unknown)}")

        # 5. raw quotes inside a quoted label — the classic Mermaid break
        bad_quote = re.findall(r'\[\s*"[^"]*"[^\]]*"', body)
        check(not bad_quote, f"{name}: no unescaped quote inside a label",
              "use &quot; inside label text")

        # 6. arrows exist — a graph with no edges is almost always a mistake
        if first.startswith(("graph ", "flowchart ")):
            check(bool(re.search(r'-->|---|-\.->|==>', body)),
                  f"{name}: has at least one edge")

    print(f"\n{B}{'=' * 62}{D}")
    print("  " + "   ".join(f"{d}: {n}" for d, n in sorted(by_day.items())))
    if FAILURES:
        print(f"{R}{len(FAILURES)} of {CHECKS} checks failed{D}")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print(f"{G}All {CHECKS} diagram checks pass across {len(files)} sources.{D}")
    print("Render with:  cd diagrams && ./render.sh    (needs mermaid-cli)")


if __name__ == "__main__":
    main()
