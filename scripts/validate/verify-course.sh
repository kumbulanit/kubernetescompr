#!/usr/bin/env bash
# ==============================================================================
# Whole-course verification — everything that can be checked without a cluster
# ==============================================================================
#   bash scripts/validate/verify-course.sh
#   bash scripts/validate/verify-course.sh --inventory   counts only, no checks
#
# Run this before shipping the repository, before every cohort, and in CI.
# It proves that the artefacts agree with each other: the chart matches the
# manifests, the alerts match the chart, the labs reference files that exist,
# and every script parses.
#
# What it CANNOT prove is that the platform runs. That needs a cluster:
#   make deploy-all && make validate-day5
# ==============================================================================
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; R="$(cd "$D/../.." && pwd)"
cd "$R"

G=$'\033[32m'; RED=$'\033[31m'; Y=$'\033[33m'; B=$'\033[1m'; DIM=$'\033[2m'; N=$'\033[0m'
FAILED=0
ok()   { printf "  %s✓%s %s\n" "$G" "$N" "$1"; }
bad()  { printf "  %s✗%s %s\n" "$RED" "$N" "$1"; [[ -n "${2:-}" ]] && printf "    %s→ %s%s\n" "$DIM" "$2" "$N"; FAILED=$((FAILED+1)); }
head_() { printf "\n%s%s%s\n%s\n" "$B" "$1" "$N" "$(printf '%.0s-' {1..64})"; }

# ==============================================================================
head_ "Inventory"
# ==============================================================================
python3 - <<'PY'
import glob, os, yaml, json
def c(p): return len(glob.glob(p, recursive=True))
objs = 0
for f in glob.glob('manifests/**/*.yaml', recursive=True) + glob.glob('capstone/manifests/*.yaml'):
    try: objs += sum(1 for d in yaml.safe_load_all(open(f)) if d)
    except Exception: pass
alerts = 0
for f in glob.glob('manifests/day5/observability/02-prometheusrules.yaml'):
    for d in yaml.safe_load_all(open(f)):
        if d and d.get('kind') == 'PrometheusRule':
            alerts += sum(len(g['rules']) for g in d['spec']['groups'])
panels = 0
for f in glob.glob('manifests/day5/observability/04-grafana-dashboards.yaml'):
    for d in yaml.safe_load_all(open(f)):
        if d and d.get('kind') == 'ConfigMap':
            for body in d['data'].values():
                panels += len([p for p in json.loads(body)['panels'] if p['type'] != 'row'])
rows = [
    ("days",                 5),
    ("modules",              c('labs/day*/L*.md') + c('labs/day*/L*/README.md')),
    ("labs",                 c('labs/day*/L*.md') + c('labs/day*/L*/README.md')),
    ("incident windows",     c('labs/day*/INC*.md') + c('labs/day*/INC*/README.md') + 3),
    ("services",             len([d for d in glob.glob('images/*') if os.path.isdir(d) and '_shared' not in d])),
    ("manifest files",       c('manifests/**/*.yaml')),
    ("manifest objects",     objs),
    ("Helm chart templates", c('charts/axispay/templates/*')),
    ("values files",         c('charts/axispay/values*.yaml')),
    ("alert rules",          alerts),
    ("dashboard panels",     panels),
    ("mermaid diagrams",     c('diagrams/mermaid/*.mmd')),
    ("slide decks",          c('documents/slides/*.pptx')),
    ("participant manuals",  c('documents/manuals/*.pdf')),
    ("trainer guides",       c('documents/instructor/day*-trainer-guide.md')),
    ("assessments",          c('documents/assessments/day*-assessment.md') + c('documents/assessments/final-exam.md')),
    ("answer keys",          c('documents/assessments/answer-keys/*.md')),
    ("validators",           c('scripts/validate/*.sh') + c('scripts/validate/*.py')),
    ("scripts total",        c('scripts/**/*.sh') + c('scripts/**/*.py')),
    ("design docs",          c('documents/reference/*.md')),
]
for k, v in rows:
    print(f"  {k:22} {v}")
PY

if [[ "${1:-}" == "--inventory" ]]; then exit 0; fi

# ==============================================================================
head_ "1. Everything parses"
# ==============================================================================
BADSH=0
while read -r f; do bash -n "$f" 2>/dev/null || { bad "shell syntax: $f"; BADSH=1; }; done \
  < <(find scripts capstone diagrams -name '*.sh' 2>/dev/null)
[[ $BADSH -eq 0 ]] && ok "every shell script parses"

BADPY=0
while read -r f; do python3 -m py_compile "$f" 2>/dev/null || { bad "python syntax: $f"; BADPY=1; }; done \
  < <(find scripts images data -name '*.py' 2>/dev/null)
[[ $BADPY -eq 0 ]] && ok "every Python file compiles"

python3 - <<'PY' && ok "every YAML file parses" || bad "a YAML file does not parse"
import yaml, glob, sys
bad = []
for f in (glob.glob('manifests/**/*.yaml', recursive=True)
          + glob.glob('capstone/**/*.yaml', recursive=True)
          + glob.glob('charts/**/values*.yaml', recursive=True)
          + ['charts/axispay/Chart.yaml']):
    try: list(yaml.safe_load_all(open(f)))
    except Exception as e: bad.append(f"{f}: {str(e)[:70]}")
if bad:
    print("\n".join("    " + b for b in bad)); sys.exit(1)
PY

BADJS=0
if command -v node >/dev/null 2>&1; then
  while read -r f; do node --check "$f" >/dev/null 2>&1 || { bad "JS syntax: $f"; BADJS=1; }; done \
    < <(find slides/src -name '*.js' 2>/dev/null)
  [[ $BADJS -eq 0 ]] && ok "every deck source parses"
else
  printf "  %s·%s node not installed — deck sources not checked\n" "$DIM" "$N"
fi

# ==============================================================================
head_ "2. The artefacts agree with each other"
# ==============================================================================
for s in check-manifests.py simulate-netpol.py simulate-rbac.py \
         check-helm-chart.py check-promql.py check-diagrams.py; do
  if python3 "$D/$s" >/dev/null 2>&1; then
    ok "$s"
  else
    bad "$s reports failures" "python3 scripts/validate/$s"
  fi
done

# ==============================================================================
head_ "3. Every lab has a validator, and every validator has a lab"
# ==============================================================================
MISSING=""
for f in labs/day*/L*.md labs/day*/L*/README.md; do
  [[ -e "$f" ]] || continue
  case "$f" in
    */README.md) id="$(basename "$(dirname "$f")" | cut -d- -f1)" ;;
    *)           id="$(basename "$f" | cut -d- -f1)" ;;
  esac
  [[ -f "scripts/validate/validate-lab-${id}.sh" ]] || MISSING="$MISSING $id"
done
[[ -z "${MISSING// /}" ]] && ok "every lab has a validator" \
  || bad "labs without a validator:$MISSING" "write scripts/validate/validate-lab-<ID>.sh"

ORPHAN=""
for f in scripts/validate/validate-lab-*.sh; do
  id="$(basename "$f" .sh | sed 's/validate-lab-//')"
  ls labs/day*/"${id}"-*.md >/dev/null 2>&1 && continue
  ls -d labs/day*/"${id}"-*/ >/dev/null 2>&1 && continue
  ORPHAN="$ORPHAN $id"
done
[[ -z "${ORPHAN// /}" ]] && ok "every validator has a lab" \
  || bad "validators without a lab:$ORPHAN"

# ==============================================================================
head_ "4. Every day is complete"
# ==============================================================================
for d in 1 2 3 4 5; do
  MISS=""
  [[ -f "documents/slides/AxisPay-K8s-Day$d.pptx" ]]                || MISS="$MISS deck"
  [[ -f "documents/manuals/AxisPay-K8s-Day$d-Participant-Manual.pdf" ]] || MISS="$MISS manual"
  [[ -f "documents/instructor/day$d-trainer-guide.md" ]]        || MISS="$MISS trainer-guide"
  [[ -f "documents/assessments/day$d-assessment.md" ]]              || MISS="$MISS assessment"
  [[ -f "documents/assessments/answer-keys/day$d-answer-key.md" ]]  || MISS="$MISS answer-key"
  [[ -f "scripts/validate/checkpoint-day$d.sh" ]]                   || MISS="$MISS checkpoint"
  { ls labs/day$d/L*.md >/dev/null 2>&1 || ls -d labs/day$d/L*/ >/dev/null 2>&1; } || MISS="$MISS labs"
  ls diagrams/mermaid/d$d-*.mmd >/dev/null 2>&1                     || MISS="$MISS diagrams"
  T=$(ls -d topics/0$d-* 2>/dev/null | head -1)
  [[ -n "$T" && -f "$T/README.md" && -f "$T/manual-chapter.md" \
     && -f "$T/solutions.md" && -f "$T/AxisPay-K8s-Day$d.pptx" ]] || MISS="$MISS topic-folder"
  [[ -z "${MISS// /}" ]] && ok "Day $d complete" || bad "Day $d missing:$MISS"
done

# ==============================================================================
head_ "5. The topic copies have not drifted from documents/"
# ==============================================================================
# The PPTX and PDF exist in both documents/ and topics/. `make slides` and
# `make manuals` write both, so they can only differ if someone edited one by
# hand — which is exactly what this catches.
DRIFT=0
i=1
for t in topics/0*-*/; do
  for f in "AxisPay-K8s-Day$i.pptx" "AxisPay-K8s-Day$i-Participant-Manual.pdf"; do
    case "$f" in *.pptx) src="documents/slides/$f" ;; *) src="documents/manuals/$f" ;; esac
    if [[ -f "$src" && -f "$t$f" ]]; then
      cmp -s "$src" "$t$f" || { bad "drift: $t$f differs from $src" "make slides && make manuals"; DRIFT=1; }
    else
      bad "missing artefact: $t$f"; DRIFT=1
    fi
  done
  i=$((i+1))
done
# The trainer guide, assessment and answer key are copied into the topic folder
# too, for the same reason and with the same risk.
i=1
for t in topics/0*-*/; do
  for pair in "trainer-guide.md:documents/instructor/day$i-trainer-guide.md" \
              "assessment.md:documents/assessments/day$i-assessment.md" \
              "answer-key.md:documents/assessments/answer-keys/day$i-answer-key.md"; do
    f="${pair%%:*}"; src="${pair##*:}"
    if [[ -f "$src" && -f "$t$f" ]]; then
      cmp -s "$src" "$t$f" || { bad "drift: $t$f differs from $src" "cp \"$src\" \"$t$f\""; DRIFT=1; }
    else
      bad "missing: $t$f"; DRIFT=1
    fi
  done
  i=$((i+1))
done
[[ $DRIFT -eq 0 ]] && ok "every topic's deck, manual and instructor copies match documents/"

# ==============================================================================
head_ "5a. Every practical follows the format"
# ==============================================================================
# Each practical is a folder holding a README and its own YAML, written so a
# newcomer can work through it without leaving the folder. These are the
# sections that make that true; a missing one is a practical that assumes
# knowledge the student does not have yet.
FMT=0; NPRAC=0
while read -r f; do
  [[ -z "$f" ]] && continue
  NPRAC=$((NPRAC+1))
  MISS=""
  grep -q 'First time in a terminal' "$f"        || MISS="$MISS first-time-box"
  grep -q '^## What you are going to do\|^## What you are about to\|^## Read this before you start\|^## This lab is different' "$f" || MISS="$MISS what-you-will-do"
  grep -q '^## What is in this folder'  "$f"     || MISS="$MISS folder-contents"
  grep -q '^## If something went wrong\|^## If something went wrong' "$f" || MISS="$MISS troubleshooting"
  grep -q 'GETTING-STARTED.md'          "$f"     || MISS="$MISS getting-started-link"
  if [[ -n "${MISS// /}" ]]; then
    bad "$(dirname "$f" | sed 's|labs/||') missing:$MISS" "see labs/day1/L1.3-first-pod/README.md for the shape"
    FMT=1
  fi
done < <(find labs -mindepth 3 -name README.md | sort)
[[ $FMT -eq 0 ]] && ok "all $NPRAC practicals have the full newcomer format"

# ==============================================================================
head_ "5b. Lab manifests match the canonical manifests"
# ==============================================================================
# Each practical folder holds its own copy of the YAML it applies, so a student
# never leaves the folder. manifests/ remains the canonical set that
# `make deploy-dayN` uses. This catches the two copies drifting apart.
LDRIFT=0; LCOUNT=0
while read -r f; do
  [[ -z "$f" ]] && continue
  b="$(basename "$f")"
  # Look in THIS lab's day first. Later days deliberately supersede earlier
  # ones with the same filename — manifests/day2/resources/ replaces
  # manifests/day1/deployments/ — so a bare basename search finds the wrong file.
  day="$(echo "$f" | sed -n 's|^labs/\(day[0-9]\)/.*|\1|p')"
  src="$(find "manifests/$day" manifests/00-namespaces -name "$b" -type f 2>/dev/null | head -1)"
  [[ -z "$src" ]] && src="$(find manifests -name "$b" -type f | head -1)"
  LCOUNT=$((LCOUNT+1))
  if [[ -z "$src" ]]; then
    bad "$f has no counterpart in manifests/" "every lab manifest must be a copy of a canonical one"
    LDRIFT=1
  elif ! cmp -s "$f" "$src"; then
    bad "$f differs from $src" "diff \"$f\" \"$src\"   # then copy the canonical one over it"
    LDRIFT=1
  fi
done < <(find labs -path '*/manifests/*.yaml' 2>/dev/null | sort)
[[ $LDRIFT -eq 0 ]] && ok "all $LCOUNT lab manifest copies match manifests/"

# ==============================================================================
head_ "6. Cross-references resolve"
# ==============================================================================
python3 - <<'PY' && ok "every relative markdown link resolves" || bad "broken relative links"
import re, os, glob, sys
bad = []
for f in glob.glob('**/*.md', recursive=True):
    if 'node_modules' in f: continue
    base = os.path.dirname(f)
    for m in re.finditer(r'\[([^\]]+)\]\(([^)]+)\)', open(f, errors='ignore').read()):
        t = m.group(2)
        if t.startswith(('http', '#', 'mailto')): continue
        p = os.path.normpath(os.path.join(base, t.split('#')[0]))
        if not os.path.exists(p):
            bad.append(f"{f} -> {t}")
if bad:
    print("\n".join("    " + b for b in bad[:12])); sys.exit(1)
PY

python3 - <<'PY' && ok "every file referenced by a lab exists" || bad "a lab references a missing file"
import re, glob, os, sys
missing = []
pat = re.compile(r'(?:manifests|charts|scripts|images|data|capstone)/[A-Za-z0-9_./-]+')
for f in glob.glob('labs/**/*.md', recursive=True) + glob.glob('capstone/**/*.md', recursive=True):
    for m in pat.findall(open(f, errors='ignore').read()):
        p = m.rstrip('.,;:)')
        if any(ch in p for ch in '<>*$'): continue
        if not os.path.exists(p) and not os.path.exists(os.path.dirname(p)):
            missing.append(f"{os.path.basename(f)} -> {p}")
if missing:
    print("\n".join("    " + x for x in sorted(set(missing))[:12])); sys.exit(1)
PY

# ==============================================================================
head_ "7. Nothing real leaked into the fictional data"
# ==============================================================================
PAN=$(grep -rEc '\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b' \
      data/seed/*.sql 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
[[ "${PAN:-0}" -eq 0 ]] && ok "no card number (PAN) pattern anywhere in the seed data" \
  || bad "$PAN possible PAN(s) in the seed data" "payment card numbers must never appear, even fictional ones"

REAL=$(grep -rniE '\b(visa|mastercard|stripe|adyen|paypal) (inc|ltd|plc|corp)\b' \
       data/ images/ manifests/ 2>/dev/null | wc -l)
[[ "${REAL:-0}" -eq 0 ]] && ok "no real payment brand is presented as a party to the fiction" \
  || bad "$REAL reference(s) to a real company as an entity"

# ==============================================================================
head_ "8. Versions agree everywhere"
# ==============================================================================
python3 - <<'PY' && ok "VERSIONS.env, Chart.yaml and values.yaml agree" || bad "a version disagrees"
import yaml, sys, re
env = {}
text = open('VERSIONS.env').read().replace('\\\n', ' ')
for line in text.splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k, v = line.split('=', 1)
    env[k.strip()] = v.split('#')[0].strip().strip('"')
chart = yaml.safe_load(open('charts/axispay/Chart.yaml'))
vals = yaml.safe_load(open('charts/axispay/values.yaml'))
problems = []
if chart['appVersion'] != env['IMAGE_TAG']:
    problems.append(f"Chart appVersion {chart['appVersion']} != IMAGE_TAG {env['IMAGE_TAG']}")
if vals['global']['image']['tag'] != env['IMAGE_TAG']:
    problems.append("values.yaml image tag != IMAGE_TAG")
for zone, key in (('edge','NS_EDGE'),('core','NS_CORE'),('async','NS_ASYNC'),
                  ('data','NS_DATA'),('ops','NS_OPS'),('observability','NS_OBS')):
    if vals['namespaces'][zone] != env[key]:
        problems.append(f"namespace {zone} != {key}")
if problems:
    print("\n".join("    " + p for p in problems)); sys.exit(1)
PY

# ==============================================================================
printf "\n%s%s%s\n" "$B" "$(printf '%.0s=' {1..64})" "$N"
if [[ $FAILED -eq 0 ]]; then
  printf "%s%sThe course verifies.%s Every artefact agrees with every other.\n" "$G" "$B" "$N"
  printf "%sWhat this does NOT prove: that the platform runs. For that:%s\n" "$DIM" "$N"
  printf "%s  make cluster && make build && make deploy-all && make validate-day5%s\n\n" "$DIM" "$N"
  exit 0
fi
printf "%s%s%d check(s) failed.%s\n\n" "$RED" "$B" "$FAILED" "$N"
exit 1
