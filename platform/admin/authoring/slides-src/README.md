# Slides

## Decks

| File | Slides | Covers |
|---|---:|---|
| `day1/AxisPay-K8s-Day1.pptx` | 56 | M1.1 – M1.9, labs L1.1–L1.6, INC-1 |
| `day2/AxisPay-K8s-Day2.pptx` | 38 | M2.2 – M2.7, labs L2.1–L2.6, INC-2 |

## Every slide carries speaker notes

Open the notes pane in PowerPoint (View → Notes Page). Each slide's notes follow a
fixed structure so an instructor can find what they need mid-delivery:

```
OBJECTIVE:   what this slide must achieve
TIMING:      minutes budgeted
SPEAKER NOTES: what to say, and what to say it in what order
REAL-WORLD EXAMPLE / >> LIVE DEMO / ASK THE ROOM + EXPECTED ANSWER
CALLOUT / TIP / WARNING / ANIMATION / TRANSITION
```

Day 1 totals **34,000+ characters** of speaker notes across 51 slides — 19 slides
carry a question with its expected answer, 8 carry tips, 6 carry warnings.

## Rebuilding

Slides are generated from source, not hand-edited, so a change to a diagram or a
version pin propagates everywhere.

```bash
cd slides/src/day1
npm install pptxgenjs        # once
node day1.js                 # writes AxisPay-K8s-Day1.pptx
```

| File | Purpose |
|---|---|
| `lib.js` | Palette, fonts, and the 11 slide archetypes (title, section, cards, code, stats, ask, lab, mistakes, table, banner) |
| `diagrams.js` | Diagrams drawn as **native PowerPoint shapes** — editable in the deck, not images |
| `day1.js` | Day 1 content and speaker notes |

## Slide archetypes

Eleven types, each with a job. The two most important for teaching quality:

| Type | Job |
|---|---|
| `sExplain` | **Mechanism walkthrough.** Numbered steps with the explanation ON the slide, not only in the notes. Use for "how does this actually work?" — e.g. *How the kernel actually enforces a CPU limit*, *How a Service actually routes one packet*. |
| `sCode` | **Worked example.** Real commands and their REAL captured output. Every worked example in these decks was executed against the running platform before it was written down. |

Others: `sTitle` `sSection` `sPoints` `sCards` `sStats` `sAsk` `sLab` `sMistakes` `sTable` `sBanner`.

## Worked examples are verified, not written from memory

```bash
./platform/admin/validate/verify-examples.sh
```

Starts the AxisPay services locally (no cluster needed) and executes the same
sequences the slides and labs teach — payment flow, fee arithmetic, idempotency,
routing rules, the velocity bug, error classification, Job exit codes. **22 checks.**

Run it after any change to service code, before shipping. If a worked example on
a slide stops being true, this fails.

## Design system

| | |
|---|---|
| Canvas | 13.33 × 7.5 in (16:9) |
| Headers | Cambria bold — enterprise/financial register |
| Body | Calibri |
| Terminal | Courier New |
| Navy `0B1F3A` | Section dividers, code, diagrams, incidents |
| Light `F7F9FC` | Content slides — the "sandwich" structure |
| Amber `F2A03D` | Accent. Money. Used sparingly and never decoratively. |
| Teal `1C7293` | Module chips, control-plane concepts |
| Green `2E9E63` | Correct, healthy, labs |
| Red `D64545` | Failures, warnings, anti-patterns |

Colour is never the only signal — every coloured element also carries a label.

## QA before shipping any deck change

```bash
python scripts/office/validate.py AxisPay-K8s-Day1.pptx      # must print "All validations PASSED!"
soffice --headless --convert-to pdf AxisPay-K8s-Day1.pptx
pdftoppm -jpeg -r 110 AxisPay-K8s-Day1.pdf slide            # then LOOK at every slide
```

Text overflow is the defect this catches most often; check it first.
