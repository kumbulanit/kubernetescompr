# Documents

Everything you present from, print, or hand to someone.

| Folder | Contents |
|---|---|
| [`slides/`](slides/) | The five PowerPoint decks. **179 slides, every one with speaker notes** — objectives, timings, live-demo cues, questions with expected answers, callouts and warnings. |
| [`manuals/`](manuals/) | The five participant manual PDFs — **166 pages**. Every topic on the 16-point template, plus cheat sheets, review questions and interview questions. |
| [`instructor/`](instructor/) | Five trainer guides, the capstone run-book and the capstone rubric. **The run-book and rubric contain the capstone answers — do not distribute them.** |
| [`assessments/`](assessments/) | Five end-of-day papers and the 60-minute final examination, with [`answer-keys/`](assessments/answer-keys/) holding marking guidance and band descriptors. |
| [`reference/`](reference/) | The nine documents that describe the whole course: curriculum, architecture, dependency map, lab roadmap, repository structure, traceability, glossary, command reference and completion checklist. |

## The decks and manuals are generated

Never edit a `.pptx` or a `.pdf` by hand. They are built from source and the edit
would be lost at the next build.

| To change | Edit | Then run |
|---|---|---|
| A slide | `slides/src/day<N>/day<N>.js` | `make slides` |
| A manual chapter | `topics/<topic>/manual-chapter.md` | `make manuals` |
| A Grafana dashboard | `scripts/build/build-dashboards.py` | `make dashboards` |

Each build also refreshes the copy inside the matching topic folder, and
`make verify` fails if the two ever differ.

## Start here

| You are… | Read |
|---|---|
| **An instructor preparing to deliver** | [`reference/08-COURSE-COMPLETION-CHECKLIST.md`](reference/08-COURSE-COMPLETION-CHECKLIST.md), then [`instructor/`](instructor/) |
| **Reviewing the curriculum** | [`reference/00-CURRICULUM.md`](reference/00-CURRICULUM.md) → [`reference/05-TRACEABILITY.md`](reference/05-TRACEABILITY.md) |
| **Looking something up mid-lab** | [`reference/07-COMMAND-REFERENCE.md`](reference/07-COMMAND-REFERENCE.md) · [`reference/06-GLOSSARY.md`](reference/06-GLOSSARY.md) |
| **Running the capstone** | [`instructor/capstone-run-book.md`](instructor/capstone-run-book.md) |
