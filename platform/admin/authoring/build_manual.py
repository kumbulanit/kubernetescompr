#!/usr/bin/env python3
"""
Build a participant-manual PDF from Markdown.

    python3 platform/admin/authoring/build_manual.py days/day1/manual-chapter.md \
        -o days/day1/AxisPay-K8s-Day1-Participant-Manual.pdf

Markdown -> HTML (python-markdown) -> PDF (WeasyPrint). The stylesheet is
inline so the build has no external asset dependencies and renders identically
on any machine.
"""
import argparse, datetime, pathlib, re, sys

import markdown
from weasyprint import HTML, CSS

CSS_TEXT = """
@page {
  size: A4; margin: 20mm 18mm 18mm 18mm;
  @top-left  { content: "AxisPay · Kubernetes Comprehensive";
               font-family: Calibri, sans-serif; font-size: 8pt; color: #7A8899; }
  @top-right { content: string(chapter);
               font-family: Calibri, sans-serif; font-size: 8pt; color: #7A8899; }
  @bottom-center { content: counter(page);
               font-family: Calibri, sans-serif; font-size: 9pt; color: #63758B; }
}
@page :first { @top-left { content: ""; } @top-right { content: ""; } }

body { font-family: Calibri, Carlito, sans-serif; font-size: 10.2pt; line-height: 1.52;
       color: #16232F; }

h1 { font-family: Cambria, Caladea, serif; font-size: 22pt; color: #0B1F3A;
     margin: 0 0 6pt 0; padding-top: 4pt; string-set: chapter content();
     page-break-before: always; page-break-after: avoid; }
h1:first-of-type { page-break-before: avoid; }
h2 { font-family: Cambria, Caladea, serif; font-size: 14.5pt; color: #12314F;
     margin: 16pt 0 5pt 0; page-break-after: avoid; }
h3 { font-family: Cambria, Caladea, serif; font-size: 11.8pt; color: #1C7293;
     margin: 12pt 0 4pt 0; page-break-after: avoid; }
p  { margin: 0 0 7pt 0; }
ul, ol { margin: 0 0 7pt 0; padding-left: 16pt; }
li { margin-bottom: 3pt; }
strong { color: #0B1F3A; }
em { color: #12314F; }
hr { border: none; border-top: 1px solid #DCE4EE; margin: 16pt 0; }

a { color: #1C7293; text-decoration: none; }

code { font-family: "Courier New", monospace; font-size: 8.8pt;
       background: #EEF2F8; padding: 1pt 3pt; border-radius: 2pt; color: #0B1F3A; }
pre  { background: #0E2740; color: #D8E6F2; padding: 8pt 10pt; border-radius: 4pt;
       font-size: 8.4pt; line-height: 1.45; overflow-wrap: break-word;
       white-space: pre-wrap; page-break-inside: avoid; margin: 6pt 0 9pt 0; }
pre code { background: none; color: inherit; padding: 0; font-size: 8.4pt; }

table { border-collapse: collapse; width: 100%; margin: 6pt 0 11pt 0;
        font-size: 9pt; page-break-inside: avoid; }
thead { background: #0B1F3A; color: #FFFFFF; }
th { text-align: left; padding: 5pt 6pt; font-weight: bold; font-size: 8.6pt; }
td { padding: 4.5pt 6pt; border-bottom: 1px solid #DCE4EE; vertical-align: top; }
tbody tr:nth-child(even) { background: #F4F7FB; }
td:first-child { font-weight: 600; color: #12314F; }

blockquote { border-left: 3px solid #F2A03D; background: #FFF8EE;
             margin: 8pt 0 10pt 0; padding: 7pt 11pt; page-break-inside: avoid; }
blockquote p:last-child { margin-bottom: 0; }
blockquote strong { color: #C97B1E; }

h1 + p em, h2 + p em { color: #63758B; }
"""

COVER = """
<div style="page-break-after:always; padding-top:52mm;">
  <div style="font-family:Calibri,sans-serif; font-size:10pt; letter-spacing:2pt;
              color:#C97B1E; font-weight:bold;">KUBERNETES COMPREHENSIVE · AXP-K8S-5D</div>
  <div style="font-family:Cambria,serif; font-size:34pt; color:#0B1F3A;
              font-weight:bold; margin-top:8mm; line-height:1.15;">{title}</div>
  <div style="font-family:Calibri,sans-serif; font-size:12pt; color:#12314F;
              margin-top:6mm;">Participant Manual</div>
  <div style="border-top:2px solid #F2A03D; width:60mm; margin:10mm 0 8mm 0;"></div>
  <table style="width:88mm; font-size:9.5pt; border:none;">
    <tr><td style="border:none;">Platform</td><td style="border:none;font-weight:normal;">AxisPay (fictional)</td></tr>
    <tr><td style="border:none;">Kubernetes</td><td style="border:none;font-weight:normal;">v1.36</td></tr>
    <tr><td style="border:none;">Environment</td><td style="border:none;font-weight:normal;">Ubuntu 26.04 LTS · Minikube</td></tr>
    <tr><td style="border:none;">Built</td><td style="border:none;font-weight:normal;">{date}</td></tr>
  </table>
  <div style="position:absolute; bottom:26mm; font-size:8pt; color:#63758B; width:150mm;">
    Every merchant, customer, card token, acquirer and transaction in this manual is
    fictional. No real institution is represented and no card number exists anywhere in
    this platform — only tokens. The platform is <b>not</b> PCI-DSS compliant and is not
    presented as such; it uses PCI-shaped constraints to make security controls
    consequential in a training context.
  </div>
</div>
"""


def build(src: pathlib.Path, out: pathlib.Path, title: str) -> None:
    text = src.read_text(encoding="utf-8")

    # Mermaid blocks are rendered separately into platform/admin/authoring/diagrams/png; in the PDF they
    # become a labelled reference rather than an unreadable wall of source.
    text = re.sub(
        r"```mermaid\n(.*?)```",
        lambda m: "> **Diagram** — see `platform/admin/authoring/diagrams/png/` for the rendered version.\n",
        text, flags=re.S,
    )

    html_body = markdown.markdown(
        text,
        extensions=["tables", "fenced_code", "toc", "attr_list", "sane_lists", "md_in_html"],
        extension_configs={"toc": {"permalink": False}},
    )
    cover = COVER.format(title=title, date=datetime.date.today().strftime("%d %B %Y"))
    html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>{title}</title></head>" \
           f"<body>{cover}{html_body}</body></html>"

    out.parent.mkdir(parents=True, exist_ok=True)
    HTML(string=html, base_url=str(src.parent)).write_pdf(out, stylesheets=[CSS(string=CSS_TEXT)])
    print(f"wrote {out}  ({out.stat().st_size/1024:.0f} KB)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("source", type=pathlib.Path)
    ap.add_argument("-o", "--output", type=pathlib.Path, required=True)
    ap.add_argument("-t", "--title", default="Day 1\nFoundations &amp; First Deployment")
    a = ap.parse_args()
    if not a.source.exists():
        sys.exit(f"no such file: {a.source}")
    build(a.source, a.output, a.title.replace("\\n", "<br/>"))
