#!/usr/bin/env python3
"""
A deliberately small Go text/template + Sprig renderer.

WHY THIS EXISTS
---------------
`helm lint` and `helm template` are the authoritative checks on a chart, and
the lab instructions tell students to run them. This module is not a
replacement for Helm. It exists so that the *repository itself* can prove its
own chart renders to valid Kubernetes YAML in CI, on a machine that may have
no Helm binary and no network.

It also earns its keep in the classroom: a chart is not magic, and reading
250 lines that turn `{{ .Values.x }}` into text demystifies the whole thing
faster than any slide.

DESIGN RULE — FAIL LOUDLY
-------------------------
Every construct this renderer does not understand raises TemplateError. It
never silently skips an action and never emits `<no value>`. A validator that
quietly ignores what it cannot parse is worse than no validator, because it
reports success on a chart it never really read.

SUPPORTED
---------
  actions      {{ ... }}  {{- ... }}  {{ ... -}}  {{- ... -}}
  comments     {{/* ... */}}
  control      if / else if / else / end, range (over map and list), with-less
  assignment   {{- $x := PIPELINE }}
  templates    define / include
  literals     "double quoted", `raw`, numbers, true/false, nil
  selectors    . $ $var .a.b.c $var.a.b $.Values.a
  pipelines    A | f x | g
  functions    and or not eq ne lt gt default quote squote trunc trimSuffix
               trimPrefix printf replace upper lower title sha256sum toYaml
               nindent indent include dict list has omit keys len index fail
               sub add mul div divf float64 int required empty coalesce
               semverCompare(no) — anything absent raises.

NOT SUPPORTED (raises rather than guesses)
------------------------------------------
  with, block, template, range over channels, method calls, .Capabilities,
  lookup, tpl, files, sub-charts.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover
    raise SystemExit("PyYAML is required: pip install pyyaml")


class TemplateError(Exception):
    pass


class FailCalled(TemplateError):
    """Raised by the Sprig `fail` function — a deliberate chart error."""


# =============================================================================
# Scanner — split a template into text and action nodes
# =============================================================================

class Action:
    __slots__ = ("body", "ltrim", "rtrim", "is_comment", "line")

    def __init__(self, body, ltrim, rtrim, is_comment, line):
        self.body = body
        self.ltrim = ltrim
        self.rtrim = rtrim
        self.is_comment = is_comment
        self.line = line

    def __repr__(self):
        return f"Action({self.body!r}@{self.line})"


def scan(src: str) -> list:
    """Return a flat list of str (literal text) and Action."""
    out: list = []
    i = 0
    n = len(src)
    while i < n:
        j = src.find("{{", i)
        if j == -1:
            out.append(src[i:])
            break
        out.append(src[i:j])
        line = src.count("\n", 0, j) + 1
        k = j + 2
        ltrim = False
        if k < n and src[k] == "-" and k + 1 < n and src[k + 1] in " \t\n":
            ltrim = True
            k += 1
        rest = src[k:]
        stripped = rest.lstrip()
        if stripped.startswith("/*"):
            end = src.find("*/", k)
            if end == -1:
                raise TemplateError(f"line {line}: unterminated {{{{/* comment")
            close = src.find("}}", end)
            if close == -1:
                raise TemplateError(f"line {line}: unterminated comment action")
            rtrim = src[close - 1] == "-"
            out.append(Action("", ltrim, rtrim, True, line))
            i = close + 2
            continue
        # find the closing }} while respecting string literals
        p = k
        depth_q = None
        while p < n - 1:
            c = src[p]
            if depth_q:
                if c == "\\" and depth_q == '"':
                    p += 2
                    continue
                if c == depth_q:
                    depth_q = None
                p += 1
                continue
            if c in "\"`":
                depth_q = c
                p += 1
                continue
            if c == "}" and src[p + 1] == "}":
                break
            p += 1
        else:
            raise TemplateError(f"line {line}: unterminated action")
        body = src[k:p]
        rtrim = body.endswith("-") and (len(body) < 2 or body[-2] in " \t\n")
        if rtrim:
            body = body[:-1]
        out.append(Action(body.strip(), ltrim, rtrim, False, line))
        i = p + 2
    return out


# =============================================================================
# Expression lexer
# =============================================================================

TOKEN_RE = re.compile(
    r"""
      (?P<ws>\s+)
    | (?P<rawstr>`[^`]*`)
    | (?P<string>"(?:[^"\\]|\\.)*")
    | (?P<assign>:=)
    | (?P<pipe>\|)
    | (?P<lparen>\()
    | (?P<rparen>\))
    | (?P<comma>,)
    | (?P<number>-?\d+\.\d+|-?\d+)
    | (?P<var>\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_-]*)*
             |\$(?:\.[A-Za-z_][A-Za-z0-9_-]*)+
             |\$)
    | (?P<field>\.(?:[A-Za-z_][A-Za-z0-9_-]*)(?:\.[A-Za-z_][A-Za-z0-9_-]*)*|\.)
    | (?P<ident>[A-Za-z_][A-Za-z0-9_]*)
    """,
    re.VERBOSE,
)


class Tok:
    __slots__ = ("kind", "val")

    def __init__(self, kind, val):
        self.kind, self.val = kind, val

    def __repr__(self):
        return f"{self.kind}:{self.val}"


def lex(expr: str, line: int) -> list:
    toks, pos = [], 0
    while pos < len(expr):
        m = TOKEN_RE.match(expr, pos)
        if not m:
            raise TemplateError(f"line {line}: cannot lex {expr[pos:pos + 30]!r} in {expr!r}")
        pos = m.end()
        kind = m.lastgroup
        if kind == "ws":
            continue
        toks.append(Tok(kind, m.group()))
    return toks


def split_top(toks: list, kind: str) -> list:
    """Split a token list on a top-level token kind, respecting parens."""
    parts, cur, depth = [], [], 0
    for t in toks:
        if t.kind == "lparen":
            depth += 1
        elif t.kind == "rparen":
            depth -= 1
        if depth == 0 and t.kind == kind:
            parts.append(cur)
            cur = []
        else:
            cur.append(t)
    parts.append(cur)
    return parts


def split_args(toks: list) -> list:
    """Split a command's tokens into individual argument token-groups."""
    args, cur, depth = [], [], 0
    for t in toks:
        if t.kind == "lparen":
            if depth == 0 and cur:
                args.append(cur)
                cur = []
            depth += 1
            cur.append(t)
            continue
        if t.kind == "rparen":
            depth -= 1
            cur.append(t)
            if depth == 0:
                args.append(cur)
                cur = []
            continue
        if depth > 0:
            cur.append(t)
            continue
        if cur:
            args.append(cur)
        cur = [t]
    if cur:
        args.append(cur)
    return args


# =============================================================================
# Value helpers
# =============================================================================

def truthy(v: Any) -> bool:
    if v is None or v is False:
        return False
    if v is True:
        return True
    if isinstance(v, (int, float)):
        return v != 0
    if isinstance(v, (str, list, dict, tuple)):
        return len(v) > 0
    return True


def go_yaml(v: Any) -> str:
    text = yaml.safe_dump(v, default_flow_style=False, sort_keys=True, width=4096)
    return text.rstrip("\n")


def go_printf(fmt: str, args: list) -> str:
    py = fmt.replace("%v", "%s")
    conv = []
    verbs = re.findall(r"%[-+ #0]*\d*(?:\.\d+)?([a-zA-Z%])", py)
    vi = 0
    for v in verbs:
        if v == "%":
            continue
        a = args[vi] if vi < len(args) else ""
        vi += 1
        if v in "dq":
            conv.append(int(a) if v == "d" else a)
        elif v == "f":
            conv.append(float(a))
        else:
            conv.append("" if a is None else (str(a).lower() if isinstance(a, bool) else str(a)))
    py = py.replace("%q", "%s")
    return py % tuple(conv)


def indent_text(text: str, n: int) -> str:
    pad = " " * n
    return "\n".join(pad + ln if ln.strip() else ln for ln in text.split("\n"))


# =============================================================================
# Renderer
# =============================================================================

class Renderer:
    def __init__(self, values: dict, release: dict, chart: dict):
        self.root = {"Values": values, "Release": release, "Chart": chart}
        self.defines: dict[str, list] = {}

    # ---- template registry --------------------------------------------------
    def load_defines(self, src: str, origin: str):
        nodes = scan(src)
        i = 0
        while i < len(nodes):
            nd = nodes[i]
            if isinstance(nd, Action) and not nd.is_comment and nd.body.startswith("define "):
                name = nd.body[len("define "):].strip().strip('"')
                depth, j = 1, i + 1
                body = []
                while j < len(nodes):
                    m = nodes[j]
                    if isinstance(m, Action) and not m.is_comment:
                        head = m.body.split(" ", 1)[0]
                        if head in ("if", "range", "define", "with"):
                            depth += 1
                        elif head == "end":
                            depth -= 1
                            if depth == 0:
                                break
                    body.append(m)
                    j += 1
                if depth != 0:
                    raise TemplateError(f"{origin}: define {name!r} is not closed")
                # Apply the trim markers on `{{- define ... -}}` and `{{- end -}}`
                # to the body itself, or every include emits a stray blank line.
                if nd.rtrim and body and isinstance(body[0], str):
                    body[0] = body[0].lstrip(" \t\n")
                if nodes[j].ltrim and body and isinstance(body[-1], str):
                    body[-1] = body[-1].rstrip(" \t\n")
                self.defines[name] = body
                i = j + 1
                continue
            i += 1

    # ---- entry point --------------------------------------------------------
    def render(self, src: str, origin: str) -> str:
        nodes = [n for n in scan(src)
                 if not (isinstance(n, Action) and not n.is_comment
                         and (n.body.startswith("define ") or n.body == "end"
                              and False))]
        # strip define blocks from the rendered output
        nodes = self._strip_defines(scan(src), origin)
        out = self._exec(nodes, self.root, {}, origin)
        return out

    def _strip_defines(self, nodes: list, origin: str) -> list:
        keep, i = [], 0
        while i < len(nodes):
            nd = nodes[i]
            if isinstance(nd, Action) and not nd.is_comment and nd.body.startswith("define "):
                depth, j = 1, i + 1
                while j < len(nodes) and depth:
                    m = nodes[j]
                    if isinstance(m, Action) and not m.is_comment:
                        head = m.body.split(" ", 1)[0]
                        if head in ("if", "range", "define", "with"):
                            depth += 1
                        elif head == "end":
                            depth -= 1
                    j += 1
                i = j
                continue
            keep.append(nd)
            i += 1
        return keep

    # ---- node execution -----------------------------------------------------
    def _exec(self, nodes: list, dot: Any, vars: dict, origin: str) -> str:
        parts: list[str] = []
        i = 0
        while i < len(nodes):
            nd = nodes[i]
            if isinstance(nd, str):
                parts.append(nd)
                i += 1
                continue
            if nd.ltrim and parts:
                parts[-1] = parts[-1].rstrip(" \t\n")
            if nd.is_comment:
                i = self._apply_rtrim(nodes, i, nd)
                continue
            body = nd.body
            head = body.split(" ", 1)[0] if body else ""

            if head == "if":
                blocks, i = self._collect_if(nodes, i, origin)
                chosen = None
                for cond, blk in blocks:
                    if cond is None or truthy(self._eval(cond, dot, vars, nd.line, origin)):
                        chosen = blk
                        break
                if chosen is not None:
                    parts.append(self._exec(chosen, dot, vars, origin))
                continue

            if head == "range":
                blk, i = self._collect_block(nodes, i, origin)
                parts.append(self._do_range(body, blk, dot, vars, nd.line, origin))
                continue

            if head in ("with", "block", "template"):
                raise TemplateError(
                    f"{origin} line {nd.line}: {head!r} is not supported by this renderer. "
                    f"Rewrite the template or run real `helm template`.")

            if head == "end" or head.startswith("else"):
                raise TemplateError(f"{origin} line {nd.line}: unexpected {{{{ {body} }}}}")

            # assignment
            toks = lex(body, nd.line)
            if len(toks) >= 2 and toks[0].kind == "var" and toks[1].kind == "assign":
                vars[toks[0].val] = self._eval_toks(toks[2:], dot, vars, nd.line, origin)
                i = self._apply_rtrim(nodes, i, nd)
                continue

            val = self._eval_toks(toks, dot, vars, nd.line, origin)
            parts.append(self._stringify(val))
            i = self._apply_rtrim(nodes, i, nd)
        return "".join(parts)

    @staticmethod
    def _stringify(val: Any) -> str:
        if val is None:
            return ""
        if isinstance(val, bool):
            return "true" if val else "false"
        if isinstance(val, float) and val.is_integer():
            return str(int(val))
        return str(val)

    def _apply_rtrim(self, nodes, i, nd):
        if nd.rtrim and i + 1 < len(nodes) and isinstance(nodes[i + 1], str):
            nodes[i + 1] = nodes[i + 1].lstrip(" \t\n")
        return i + 1

    # ---- control-flow collection -------------------------------------------
    def _collect_if(self, nodes, i, origin):
        """Return ([(cond_or_None, block)], next_index) for an if/else chain."""
        start = nodes[i]
        cond = start.body[len("if "):].strip()
        blocks, cur, depth = [], [], 1
        j = i + 1
        pending_cond = cond
        while j < len(nodes):
            m = nodes[j]
            if isinstance(m, Action) and not m.is_comment:
                head = m.body.split(" ", 1)[0]
                if head in ("if", "range", "with", "define"):
                    depth += 1
                elif head == "end":
                    depth -= 1
                    if depth == 0:
                        blocks.append((pending_cond, cur))
                        if m.rtrim and j + 1 < len(nodes) and isinstance(nodes[j + 1], str):
                            nodes[j + 1] = nodes[j + 1].lstrip(" \t\n")
                        if m.ltrim and cur and isinstance(cur[-1], str):
                            cur[-1] = cur[-1].rstrip(" \t\n")
                        return blocks, j + 1
                elif depth == 1 and head == "else":
                    if m.ltrim and cur and isinstance(cur[-1], str):
                        cur[-1] = cur[-1].rstrip(" \t\n")
                    blocks.append((pending_cond, cur))
                    cur = []
                    rest = m.body[len("else"):].strip()
                    pending_cond = rest[len("if "):].strip() if rest.startswith("if ") else None
                    nxt = nodes[j + 1] if j + 1 < len(nodes) else None
                    if m.rtrim and isinstance(nxt, str):
                        nodes[j + 1] = nxt.lstrip(" \t\n")
                    j += 1
                    continue
            cur.append(m)
            j += 1
        raise TemplateError(f"{origin} line {start.line}: if is not closed")

    def _collect_block(self, nodes, i, origin):
        start = nodes[i]
        cur, depth, j = [], 1, i + 1
        while j < len(nodes):
            m = nodes[j]
            if isinstance(m, Action) and not m.is_comment:
                head = m.body.split(" ", 1)[0]
                if head in ("if", "range", "with", "define"):
                    depth += 1
                elif head == "end":
                    depth -= 1
                    if depth == 0:
                        if m.ltrim and cur and isinstance(cur[-1], str):
                            cur[-1] = cur[-1].rstrip(" \t\n")
                        if m.rtrim and j + 1 < len(nodes) and isinstance(nodes[j + 1], str):
                            nodes[j + 1] = nodes[j + 1].lstrip(" \t\n")
                        return cur, j + 1
            cur.append(m)
            j += 1
        raise TemplateError(f"{origin} line {start.line}: range is not closed")

    def _do_range(self, body, blk, dot, vars, line, origin):
        expr = body[len("range "):].strip()
        names = []
        if ":=" in expr:
            lhs, expr = expr.split(":=", 1)
            names = [x.strip() for x in lhs.split(",")]
            expr = expr.strip()
        seq = self._eval(expr, dot, vars, line, origin)
        out = []
        if seq is None:
            return ""
        items = (sorted(seq.items()) if isinstance(seq, dict)
                 else list(enumerate(seq)) if isinstance(seq, (list, tuple))
                 else None)
        if items is None:
            raise TemplateError(f"{origin} line {line}: range over {type(seq).__name__}")
        for k, v in items:
            sub = dict(vars)
            if len(names) == 2:
                sub[names[0]], sub[names[1]] = k, v
            elif len(names) == 1:
                sub[names[0]] = v
            # deep-copy the block so trims applied in one iteration do not leak
            out.append(self._exec([n for n in blk], v if not names else dot, sub, origin))
        return "".join(out)

    # ---- expression evaluation ---------------------------------------------
    def _eval(self, expr: str, dot, vars, line, origin):
        return self._eval_toks(lex(expr, line), dot, vars, line, origin)

    def _eval_toks(self, toks, dot, vars, line, origin):
        cmds = split_top(toks, "pipe")
        val, first = None, True
        for cmd in cmds:
            if not cmd:
                raise TemplateError(f"{origin} line {line}: empty pipeline stage")
            val = self._eval_cmd(cmd, dot, vars, line, origin,
                                 piped=None if first else val, has_pipe=not first)
            first = False
        return val

    def _eval_cmd(self, cmd, dot, vars, line, origin, piped=None, has_pipe=False):
        args = split_args(cmd)
        head = args[0]
        if len(head) == 1 and head[0].kind == "ident":
            name = head[0].val
            rest = args[1:]
            if has_pipe:
                rest = rest + [[Tok("__piped__", piped)]]
            return self._call(name, rest, dot, vars, line, origin)
        if has_pipe:
            raise TemplateError(
                f"{origin} line {line}: pipeline stage {self._src(cmd)!r} is not a function")
        if len(args) != 1:
            raise TemplateError(f"{origin} line {line}: cannot evaluate {self._src(cmd)!r}")
        return self._arg(args[0], dot, vars, line, origin)

    @staticmethod
    def _src(toks):
        return " ".join(str(t.val) for t in toks)

    def _arg(self, toks, dot, vars, line, origin):
        if len(toks) == 1 and toks[0].kind == "__piped__":
            return toks[0].val
        if toks and toks[0].kind == "lparen":
            if toks[-1].kind != "rparen":
                raise TemplateError(f"{origin} line {line}: unbalanced parentheses")
            return self._eval_toks(toks[1:-1], dot, vars, line, origin)
        if len(toks) != 1:
            return self._eval_toks(toks, dot, vars, line, origin)
        t = toks[0]
        if t.kind == "string":
            return t.val[1:-1].encode().decode("unicode_escape")
        if t.kind == "rawstr":
            return t.val[1:-1]
        if t.kind == "number":
            return float(t.val) if "." in t.val else int(t.val)
        if t.kind == "ident":
            if t.val == "true":
                return True
            if t.val == "false":
                return False
            if t.val in ("nil", "null"):
                return None
            return self._call(t.val, [], dot, vars, line, origin)
        if t.kind == "var":
            parts = t.val.split(".")
            base = parts[0]
            if base == "$":
                cur = self.root
            elif base in vars:
                cur = vars[base]
            else:
                raise TemplateError(f"{origin} line {line}: undefined variable {base}")
            return self._walk(cur, parts[1:], t.val, line, origin)
        if t.kind == "field":
            if t.val == ".":
                return dot
            return self._walk(dot, t.val.lstrip(".").split("."), t.val, line, origin)
        raise TemplateError(f"{origin} line {line}: unexpected token {t}")

    @staticmethod
    def _walk(cur, path, label, line, origin):
        for p in path:
            if cur is None:
                raise TemplateError(
                    f"{origin} line {line}: nil pointer evaluating {label!r} at .{p} — "
                    f"the parent key does not exist in values")
            if isinstance(cur, dict):
                cur = cur.get(p)
            else:
                raise TemplateError(
                    f"{origin} line {line}: cannot take field .{p} of "
                    f"{type(cur).__name__} in {label!r}")
        return cur

    # ---- function table -----------------------------------------------------
    def _call(self, name, argtoks, dot, vars, line, origin):
        lazy = {"and", "or"}
        if name in lazy:
            result = None
            for a in argtoks:
                result = self._arg(a, dot, vars, line, origin)
                if name == "and" and not truthy(result):
                    return result
                if name == "or" and truthy(result):
                    return result
            return result

        if name == "include":
            tpl_name = self._arg(argtoks[0], dot, vars, line, origin)
            ctx = self._arg(argtoks[1], dot, vars, line, origin)
            if tpl_name not in self.defines:
                raise TemplateError(
                    f"{origin} line {line}: include of undefined template {tpl_name!r}. "
                    f"Defined: {sorted(self.defines)}")
            return self._exec([n for n in self.defines[tpl_name]], ctx, {},
                              f"{origin}->{tpl_name}")

        a = [self._arg(x, dot, vars, line, origin) for x in argtoks]

        try:
            return self._builtin(name, a, line, origin)
        except FailCalled:
            raise
        except TemplateError:
            raise
        except Exception as exc:
            raise TemplateError(f"{origin} line {line}: {name}({a!r}) -> {exc}") from exc

    def _builtin(self, name, a, line, origin):
        if name == "default":
            return a[0] if not truthy(a[1]) else a[1]
        if name == "quote":
            return '"%s"' % self._stringify(a[0])
        if name == "squote":
            return "'%s'" % self._stringify(a[0])
        if name == "trunc":
            n = int(a[0])
            s = str(a[1])
            return s[:n] if n >= 0 else s[n:]
        if name == "trimSuffix":
            return str(a[1])[: -len(a[0])] if a[0] and str(a[1]).endswith(a[0]) else str(a[1])
        if name == "trimPrefix":
            return str(a[1])[len(a[0]):] if a[0] and str(a[1]).startswith(a[0]) else str(a[1])
        if name == "printf":
            return go_printf(a[0], a[1:])
        if name == "replace":
            return str(a[2]).replace(a[0], a[1])
        if name == "upper":
            return str(a[0]).upper()
        if name == "lower":
            return str(a[0]).lower()
        if name == "title":
            return str(a[0]).title()
        if name == "sha256sum":
            return hashlib.sha256(str(a[0]).encode()).hexdigest()
        if name == "toYaml":
            return go_yaml(a[0])
        if name == "nindent":
            return "\n" + indent_text(str(a[1]), int(a[0]))
        if name == "indent":
            return indent_text(str(a[1]), int(a[0]))
        if name == "dict":
            if len(a) % 2:
                raise TemplateError(f"{origin} line {line}: dict needs an even number of args")
            return {a[i]: a[i + 1] for i in range(0, len(a), 2)}
        if name == "list":
            return list(a)
        if name == "has":
            return a[0] in (a[1] or [])
        if name == "omit":
            return {k: v for k, v in a[0].items() if k not in a[1:]}
        if name == "pick":
            return {k: v for k, v in a[0].items() if k in a[1:]}
        if name == "keys":
            return sorted(a[0].keys())
        if name == "len":
            return len(a[0]) if a[0] is not None else 0
        if name == "index":
            cur = a[0]
            for k in a[1:]:
                cur = cur.get(k) if isinstance(cur, dict) else cur[k]
            return cur
        if name == "not":
            return not truthy(a[0])
        if name == "empty":
            return not truthy(a[0])
        if name == "coalesce":
            for x in a:
                if truthy(x):
                    return x
            return None
        if name == "eq":
            return all(a[0] == x for x in a[1:])
        if name == "ne":
            return a[0] != a[1]
        if name == "lt":
            return a[0] < a[1]
        if name == "gt":
            return a[0] > a[1]
        if name == "le":
            return a[0] <= a[1]
        if name == "ge":
            return a[0] >= a[1]
        if name == "add":
            return sum(a)
        if name == "sub":
            return a[0] - a[1]
        if name == "mul":
            r = 1
            for x in a:
                r *= x
            return r
        if name == "div":
            return int(a[0] // a[1])
        if name == "divf":
            return float(a[0]) / float(a[1])
        if name == "float64":
            return float(a[0])
        if name == "int":
            return int(a[0])
        if name == "required":
            if not truthy(a[1]):
                raise TemplateError(f"{origin} line {line}: {a[0]}")
            return a[1]
        if name == "fail":
            raise FailCalled(f"{origin} line {line}: {a[0]}")
        raise TemplateError(
            f"{origin} line {line}: function {name!r} is not implemented by this "
            f"renderer. Add it to lib_gotemplate.py or run real `helm template`.")


# =============================================================================
# Values merging — Helm's mergeMaps semantics
# =============================================================================

def deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for k, v in (override or {}).items():
        if v is None:
            out.pop(k, None)
        elif isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out
