# Diagrams

**Mermaid is the master source.** SVG, PNG and PPTX are generated from it. Edit
the `.mmd` file and re-run `render.sh`; never edit a generated file.

| Directory | Contents | Edit? |
|---|---|---|
| `mermaid/` | `.mmd` sources — **the source of truth** | Yes |
| `drawio/` | Editable `.drawio` for complex architecture figures | Yes |
| `svg/` | Rendered — web, manual, GitHub | No |
| `png/` | Rendered @2x — PowerPoint, print | No |
| `pptx/` | Native PowerPoint shapes — editable in-deck | No |

## Naming

`d<day>-<nn>-<topic>.mmd` — e.g. `d1-06-ownership-chain.mmd`

## Palette

Chosen for projector contrast and to be distinguishable with the two most
common forms of colour blindness. Never use colour as the *only* signal —
every coloured node also carries a label.

| Meaning | Fill | Stroke |
|---|---|---|
| Control plane / core concept | `#1f2b3b` | `#42a5f5` blue |
| Healthy / correct / new | `#1f3b2b` | `#66bb6a` green |
| Storage / state | `#3b2f1f` | `#ffa726` amber |
| Security / CDE / regulated | `#3b1f2b` | `#c2185b` pink |
| Failure / anti-pattern | `#3b1f1f` | `#d32f2f` red |
| Deprecated / inactive | `#2b2b2b` | `#888` grey |
| Packaging / observability | `#2b1f3b` | `#ab47bc` purple |

## Rendering

```bash
npm install -g @mermaid-js/mermaid-cli    # once
./render.sh                                # all formats
./render.sh --only d1                      # just Day 1
```

## Originality

Every diagram here is an original work. They are informed by publicly
documented architectural patterns from CNCF, the Kubernetes project, and major
cloud vendors, but no diagram is copied, traced or adapted from any source.
