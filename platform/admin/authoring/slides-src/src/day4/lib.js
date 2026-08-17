// ============================================================================
// AxisPay Kubernetes Training — shared deck toolkit
// Palette chosen for the topic: financial navy + money amber + cloud teal.
// ============================================================================
const C = {
  navy:  "0B1F3A",  navy2: "12314F",  navy3: "1B4066",
  teal:  "1C7293",  teal2: "2E93B8",
  amber: "F2A03D",  amberD:"C97B1E",
  green: "2E9E63",  red:   "D64545",  purple:"8E6FBF",
  light: "F7F9FC",  card:  "FFFFFF",  rule:  "DCE4EE",
  ink:   "16232F",  muted: "63758B",  white: "FFFFFF",
  codebg:"0E2740",  codetx:"D8E6F2",
};
const F = { head: "Cambria", body: "Calibri", mono: "Courier New" };
const W = 13.333, H = 7.5, M = 0.62;

// Set once per deck by the day script: L.setDay(2)
let DAY_LABEL = "AxisPay · Kubernetes Comprehensive";
function setDay(n) { DAY_LABEL = `AxisPay · Kubernetes Comprehensive · Day ${n}`; }

function notes(o) {
  const L = [];
  L.push(`OBJECTIVE: ${o.obj || "—"}`);
  L.push(`TIMING: ${o.time || "3 min"}`);
  L.push("");
  L.push("SPEAKER NOTES");
  L.push(o.script || "");
  if (o.example) { L.push(""); L.push(`REAL-WORLD EXAMPLE: ${o.example}`); }
  if (o.demo)    { L.push(""); L.push(`>> LIVE DEMO: ${o.demo}`); }
  if (o.ask)     { L.push(""); L.push(`ASK THE ROOM: ${o.ask}`);
                   L.push(`EXPECTED ANSWER: ${o.answer || "—"}`); }
  if (o.callout) { L.push(""); L.push(`CALLOUT: ${o.callout}`); }
  if (o.tip)     { L.push(""); L.push(`TIP: ${o.tip}`); }
  if (o.warn)    { L.push(""); L.push(`WARNING: ${o.warn}`); }
  if (o.anim)    { L.push(""); L.push(`ANIMATION: ${o.anim}`); }
  if (o.next)    { L.push(""); L.push(`TRANSITION: ${o.next}`); }
  return L.join("\n");
}

// ---------- slide furniture -------------------------------------------------
function chip(s, text, colour) {
  s.addShape("roundRect", { x: M, y: 0.42, w: Math.max(1.1, 0.115 * text.length + 0.42), h: 0.32,
    fill: { color: colour || C.teal }, rectRadius: 0.16, line: { color: colour || C.teal } });
  s.addText(text, { x: M, y: 0.42, w: Math.max(1.1, 0.115 * text.length + 0.42), h: 0.32,
    fontFace: F.body, fontSize: 11, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
}
function foot(s, pres, left) {
  s.addText(left || DAY_LABEL,
    { x: M, y: H - 0.46, w: 8, h: 0.3, fontFace: F.body, fontSize: 9, color: C.muted, margin: 0 });
  s.addText(String(pres.__n),
    { x: W - M - 0.7, y: H - 0.46, w: 0.7, h: 0.3, fontFace: F.body, fontSize: 9,
      color: C.muted, align: "right", margin: 0 });
}
function newSlide(pres, dark) {
  pres.__n = (pres.__n || 0) + 1;
  const s = pres.addSlide();
  s.background = { color: dark ? C.navy : C.light };
  return s;
}
function heading(s, title, dark, y) {
  s.addText(title, { x: M, y: y === undefined ? 0.92 : y, w: W - 2 * M, h: 0.85,
    fontFace: F.head, fontSize: 32, bold: true, color: dark ? C.white : C.navy, margin: 0, valign: "middle" });
}

// ---------- slide types -----------------------------------------------------
function sTitle(pres, o) {
  const s = newSlide(pres, true);
  s.addShape("roundRect", { x: W - 4.9, y: -1.6, w: 6.4, h: 6.4, fill: { color: C.navy2 },
    line: { color: C.navy2 }, rectRadius: 1.0, rotate: 18 });
  s.addShape("ellipse", { x: W - 3.1, y: 4.5, w: 2.2, h: 2.2, fill: { color: C.teal, transparency: 55 }, line: { color: C.teal, transparency: 40 } });
  s.addText(o.eyebrow, { x: M, y: 1.35, w: 8.4, h: 0.4, fontFace: F.body, fontSize: 14,
    bold: true, color: C.amber, charSpacing: 2, margin: 0 });
  s.addText(o.title, { x: M, y: 1.9, w: 8.4, h: 1.9, fontFace: F.head, fontSize: 50, bold: true,
    color: C.white, margin: 0, lineSpacing: 50 });
  s.addText(o.sub, { x: M, y: 3.85, w: 8.0, h: 0.95, fontFace: F.body, fontSize: 17,
    color: C.codetx, margin: 0 });
  (o.meta || []).forEach((m, i) => {
    s.addShape("roundRect", { x: M + i * 2.55, y: 5.15, w: 2.35, h: 0.82,
      fill: { color: C.navy2 }, line: { color: C.navy3 }, rectRadius: 0.1 });
    s.addText(m[0], { x: M + i * 2.55, y: 5.22, w: 2.35, h: 0.3, fontFace: F.body, fontSize: 9,
      color: C.amber, align: "center", bold: true, charSpacing: 1, margin: 0 });
    s.addText(m[1], { x: M + i * 2.55, y: 5.5, w: 2.35, h: 0.4, fontFace: F.body, fontSize: 13,
      color: C.white, align: "center", bold: true, margin: 0 });
  });
  s.addText(o.footer, { x: M, y: 6.5, w: 9, h: 0.3, fontFace: F.body, fontSize: 10, color: C.muted, margin: 0 });
  s.addNotes(notes(o));
  return s;
}

function sSection(pres, o) {
  const s = newSlide(pres, true);
  s.addShape("ellipse", { x: W - 4.2, y: -1.2, w: 5.6, h: 5.6, fill: { color: C.navy2 }, line: { color: C.navy2 } });
  // Auto-size the module number: "M1.3" fits at 76pt, but a combined divider
  // like "M3.3 - M3.4" wraps and collides with the title beneath it.
  const numLen = String(o.num).length;
  const numSize = numLen <= 5 ? 76 : numLen <= 8 ? 52 : 40;
  s.addText(o.num, { x: M, y: 1.75, w: 6.2, h: 1.6, fontFace: F.head, fontSize: numSize,
    bold: true, color: C.amber, valign: "middle", margin: 0 });
  s.addText(o.title, { x: M, y: 3.25, w: 8.6, h: 1.0, fontFace: F.head, fontSize: 38, bold: true,
    color: C.white, margin: 0 });
  s.addText(o.sub, { x: M, y: 4.25, w: 8.2, h: 0.9, fontFace: F.body, fontSize: 15, color: C.codetx, margin: 0 });
  if (o.objectives) {
    s.addText("By the end of this module you will be able to:",
      { x: M, y: 5.15, w: 8.2, h: 0.3, fontFace: F.body, fontSize: 11, bold: true, color: C.amber, margin: 0 });
    s.addText(o.objectives.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < o.objectives.length - 1 } })),
      { x: M + 0.1, y: 5.45, w: 8.2, h: 1.2, fontFace: F.body, fontSize: 12, color: C.white,
        paraSpaceAfter: 4, margin: 0 });
  }
  s.addText(o.time || "", { x: W - 2.6, y: 6.55, w: 2.0, h: 0.35, fontFace: F.body, fontSize: 11,
    color: C.muted, align: "right", margin: 0 });
  s.addNotes(notes(o));
  return s;
}

// bullets with optional lead paragraph
function sPoints(pres, o) {
  const s = newSlide(pres);
  chip(s, o.chip, o.chipColour); heading(s, o.title);
  let y = 1.95;
  if (o.lead) {
    s.addText(o.lead, { x: M, y, w: W - 2 * M, h: 0.6, fontFace: F.body, fontSize: 16,
      italic: true, color: C.teal, margin: 0 });
    y += 0.72;
  }
  s.addText(o.points.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < o.points.length - 1 } })),
    { x: M + 0.08, y, w: W - 2 * M - 0.1, h: H - y - 1.0, fontFace: F.body, fontSize: 15,
      color: C.ink, paraSpaceAfter: 10, margin: 0 });
  foot(s, pres); s.addNotes(notes(o)); return s;
}

// n cards in a row (2-4)
function sCards(pres, o) {
  const s = newSlide(pres);
  chip(s, o.chip, o.chipColour); heading(s, o.title);
  if (o.lead) s.addText(o.lead, { x: M, y: 1.9, w: W - 2 * M, h: 0.45, fontFace: F.body,
    fontSize: 15, italic: true, color: C.teal, margin: 0 });
  const n = o.cards.length, gap = 0.32,
        cw = (W - 2 * M - gap * (n - 1)) / n,
        top = o.lead ? 2.55 : 2.15, ch = H - top - 1.0;
  o.cards.forEach((c, i) => {
    const x = M + i * (cw + gap);
    s.addShape("roundRect", { x, y: top, w: cw, h: ch, fill: { color: C.card },
      line: { color: C.rule }, rectRadius: 0.09,
      shadow: { type: "outer", angle: 90, blur: 8, offset: 1, opacity: 0.10, color: "8899AA" } });
    s.addShape("ellipse", { x: x + 0.28, y: top + 0.3, w: 0.62, h: 0.62,
      fill: { color: c.colour || C.teal }, line: { color: c.colour || C.teal } });
    s.addText(c.badge || String(i + 1), { x: x + 0.28, y: top + 0.3, w: 0.62, h: 0.62,
      fontFace: F.head, fontSize: 20, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    s.addText(c.title, { x: x + 0.28, y: top + 1.06, w: cw - 0.56, h: 0.62,
      fontFace: F.head, fontSize: 16, bold: true, color: C.navy, margin: 0 });
    s.addText(c.body, { x: x + 0.28, y: top + 1.7, w: cw - 0.56, h: ch - 2.0,
      fontFace: F.body, fontSize: 12.5, color: C.ink, margin: 0, lineSpacing: 17 });
  });
  foot(s, pres); s.addNotes(notes(o)); return s;
}

// terminal / code
function sCode(pres, o) {
  const s = newSlide(pres, true);
  chip(s, o.chip, o.chipColour); heading(s, o.title, true);
  let y = 1.9;
  if (o.lead) { s.addText(o.lead, { x: M, y, w: W - 2 * M, h: 0.42, fontFace: F.body,
    fontSize: 14, color: C.amber, italic: true, margin: 0 }); y += 0.56; }
  // Fit the block to its content instead of the slide: the title bar is 0.5in,
  // then N lines at 1.5x leading, then 0.2in bottom padding. If that exceeds the
  // space available, shrink the font rather than let text spill past the box.
  const avail = H - y - (o.note ? 1.35 : 0.95);
  let fs = o.size || 12.5;
  const need = n => 0.5 + n * (fs * 1.5 / 72) + 0.2;
  while (need(o.lines.length) > avail && fs > 8.5) fs -= 0.5;
  const bh = Math.min(avail, need(o.lines.length));
  s.addShape("roundRect", { x: M, y, w: W - 2 * M, h: bh, fill: { color: C.codebg },
    line: { color: C.navy3 }, rectRadius: 0.08 });
  ["D64545", "F2A03D", "2E9E63"].forEach((col, i) =>
    s.addShape("ellipse", { x: M + 0.22 + i * 0.24, y: y + 0.17, w: 0.13, h: 0.13,
      fill: { color: col }, line: { color: col } }));
  s.addText(o.lines.map((l, i) => {
    const t = typeof l === "string" ? l : l.t;
    const k = typeof l === "string" ? "out" : l.k;
    const col = k === "cmd" ? C.amber : k === "ok" ? C.green : k === "err" ? C.red
              : k === "dim" ? C.muted : k === "hi" ? C.white : C.codetx;
    return { text: t || " ", options: { color: col, bold: k === "cmd" || k === "hi",
             breakLine: i < o.lines.length - 1 } };
  }), { x: M + 0.26, y: y + 0.5, w: W - 2 * M - 0.5, h: bh - 0.7,
        fontFace: F.mono, fontSize: fs, lineSpacing: fs * 1.5, valign: "top", margin: 0 });
  if (o.note) s.addText(o.note, { x: M, y: y + bh + 0.18, w: W - 2 * M, h: 0.5,
    fontFace: F.body, fontSize: 13, color: C.codetx, italic: true, margin: 0 });
  foot(s, pres); s.addNotes(notes(o)); return s;
}

// big statistics
function sStats(pres, o) {
  const s = newSlide(pres, o.dark);
  chip(s, o.chip, o.chipColour); heading(s, o.title, o.dark);
  if (o.lead) s.addText(o.lead, { x: M, y: 1.9, w: W - 2 * M, h: 0.45, fontFace: F.body,
    fontSize: 15, italic: true, color: o.dark ? C.amber : C.teal, margin: 0 });
  const n = o.stats.length, gap = 0.35,
        cw = (W - 2 * M - gap * (n - 1)) / n, top = o.lead ? 2.7 : 2.3;
  o.stats.forEach((st, i) => {
    const x = M + i * (cw + gap);
    s.addText(st.v, { x, y: top, w: cw, h: 1.35, fontFace: F.head, fontSize: st.v.length > 6 ? 40 : 58,
      bold: true, color: st.colour || C.amber, align: "center", valign: "middle", margin: 0 });
    s.addText(st.l, { x, y: top + 1.38, w: cw, h: 0.95, fontFace: F.body, fontSize: 13,
      color: o.dark ? C.codetx : C.ink, align: "center", margin: 0, lineSpacing: 17 });
  });
  if (o.kicker) s.addText(o.kicker, { x: M, y: H - 1.5, w: W - 2 * M, h: 0.6, fontFace: F.body,
    fontSize: 14, color: o.dark ? C.white : C.navy, italic: true, align: "center", margin: 0 });
  foot(s, pres); s.addNotes(notes(o)); return s;
}

// question to ask students
function sAsk(pres, o) {
  const s = newSlide(pres, true);
  chip(s, o.chip || "ASK THE ROOM", C.amberD);
  const n = o.expect.length;
  const tight = n > 5;                       // 8-item knowledge check needs the room
  const qh = tight ? 1.5 : 2.5;
  s.addShape("roundRect", { x: M, y: 1.25, w: W - 2 * M, h: qh, fill: { color: C.navy2 },
    line: { color: C.amber }, rectRadius: 0.12 });
  s.addText("?", { x: M + 0.3, y: 1.25, w: 1.0, h: qh, fontFace: F.head, fontSize: tight ? 46 : 74,
    bold: true, color: C.amber, align: "center", valign: "middle", margin: 0 });
  s.addText(o.q, { x: M + 1.45, y: 1.25, w: W - 2 * M - 1.9, h: qh, fontFace: F.head,
    fontSize: tight ? 20 : 25, bold: true, color: C.white, valign: "middle", margin: 0,
    lineSpacing: tight ? 26 : 32 });
  const hy = 1.25 + qh + 0.22;
  s.addText(o.label || "What you are listening for", { x: M, y: hy, w: 7, h: 0.3,
    fontFace: F.body, fontSize: 11, bold: true, color: C.amber, charSpacing: 1, margin: 0 });
  s.addText(o.expect.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < n - 1 } })),
    { x: M + 0.08, y: hy + 0.32, w: W - 2 * M - 0.1, h: H - hy - 0.85,
      fontFace: F.body, fontSize: tight ? 12 : 13.5, color: C.codetx,
      paraSpaceAfter: tight ? 5 : 7, valign: "top", margin: 0 });
  foot(s, pres); s.addNotes(notes(o)); return s;
}

// lab launch
function sLab(pres, o) {
  const s = newSlide(pres, true);
  chip(s, o.type || "GUIDED LAB", C.green);
  s.addText(o.id, { x: M, y: 1.0, w: 3, h: 0.85, fontFace: F.head, fontSize: 40, bold: true, color: C.green, margin: 0 });
  s.addText(o.title, { x: M, y: 1.85, w: W - 2 * M, h: 0.8, fontFace: F.head, fontSize: 30, bold: true, color: C.white, margin: 0 });
  s.addShape("roundRect", { x: M, y: 2.8, w: 6.1, h: 3.1, fill: { color: C.navy2 }, line: { color: C.navy3 }, rectRadius: 0.1 });
  s.addText("YOU WILL", { x: M + 0.3, y: 2.98, w: 5.5, h: 0.3, fontFace: F.body, fontSize: 10, bold: true, color: C.amber, charSpacing: 1, margin: 0 });
  s.addText(o.will.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < o.will.length - 1 } })),
    { x: M + 0.35, y: 3.3, w: 5.5, h: 2.4, fontFace: F.body, fontSize: 13, color: C.white, paraSpaceAfter: 7, margin: 0 });
  s.addShape("roundRect", { x: M + 6.45, y: 2.8, w: 5.6, h: 3.1, fill: { color: C.navy2 }, line: { color: C.navy3 }, rectRadius: 0.1 });
  s.addText("DONE WHEN", { x: M + 6.75, y: 2.98, w: 5.0, h: 0.3, fontFace: F.body, fontSize: 10, bold: true, color: C.green, charSpacing: 1, margin: 0 });
  s.addText(o.done.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < o.done.length - 1 } })),
    { x: M + 6.8, y: 3.3, w: 5.0, h: 1.6, fontFace: F.body, fontSize: 13, color: C.white, paraSpaceAfter: 7, margin: 0 });
  s.addShape("roundRect", { x: M + 6.75, y: 5.05, w: 5.0, h: 0.62, fill: { color: C.codebg }, line: { color: C.teal }, rectRadius: 0.08 });
  s.addText(o.validate, { x: M + 6.9, y: 5.05, w: 4.7, h: 0.62, fontFace: F.mono, fontSize: 11.5, color: C.amber, valign: "middle", margin: 0 });
  s.addText(`${o.time}   ·   ${o.file}`, { x: M, y: 6.1, w: W - 2 * M, h: 0.4,
    fontFace: F.body, fontSize: 12, color: C.muted, margin: 0 });
  foot(s, pres); s.addNotes(notes(o)); return s;
}

// common mistakes table
function sMistakes(pres, o) {
  const s = newSlide(pres);
  chip(s, o.chip, C.red); heading(s, o.title);
  const rows = [[
    { text: "MISTAKE", options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 12 } },
    { text: "WHAT YOU SEE", options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 12 } },
    { text: "DO THIS INSTEAD", options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 12 } }]];
  o.rows.forEach((r, i) => rows.push([
    { text: r[0], options: { color: C.red, bold: true, fontSize: 12, fill: { color: i % 2 ? "EEF2F8" : C.card } } },
    { text: r[1], options: { color: C.ink, fontSize: 12, fill: { color: i % 2 ? "EEF2F8" : C.card } } },
    { text: r[2], options: { color: C.green, fontSize: 12, fill: { color: i % 2 ? "EEF2F8" : C.card } } }]));
  s.addTable(rows, { x: M, y: 2.0, w: W - 2 * M, colW: [3.4, 4.3, 4.4], border: { type: "solid", color: C.rule, pt: 1 },
    fontFace: F.body, valign: "middle", rowH: 0.52, autoPage: false });
  foot(s, pres); s.addNotes(notes(o)); return s;
}

// generic table
function sTable(pres, o) {
  const s = newSlide(pres);
  chip(s, o.chip, o.chipColour); heading(s, o.title);
  if (o.lead) s.addText(o.lead, { x: M, y: 1.9, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 14, italic: true, color: C.teal, margin: 0 });
  const rows = [o.head.map(h => ({ text: h, options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 12 } }))];
  o.rows.forEach((r, i) => rows.push(r.map((cell, j) => ({
    text: cell, options: { color: j === 0 ? C.navy : C.ink, bold: j === 0, fontSize: 12,
    fill: { color: i % 2 ? "EEF2F8" : C.card } } }))));
  s.addTable(rows, { x: M, y: o.lead ? 2.45 : 2.05, w: W - 2 * M, colW: o.colW,
    border: { type: "solid", color: C.rule, pt: 1 }, fontFace: F.body, valign: "middle",
    rowH: o.rowH || 0.48, autoPage: false });
  foot(s, pres); s.addNotes(notes(o)); return s;
}

// callout / warning banner slide
function sBanner(pres, o) {
  const s = newSlide(pres, true);
  const col = o.kind === "warn" ? C.red : o.kind === "tip" ? C.green : C.amber;
  chip(s, o.chip || (o.kind === "warn" ? "WARNING" : "KEY IDEA"), col);
  s.addShape("roundRect", { x: M, y: 1.7, w: W - 2 * M, h: 3.3, fill: { color: C.navy2 }, line: { color: col }, rectRadius: 0.12 });
  s.addText(o.big, { x: M + 0.6, y: 2.1, w: W - 2 * M - 1.2, h: 1.6, fontFace: F.head,
    fontSize: 30, bold: true, color: C.white, valign: "middle", margin: 0, lineSpacing: 38 });
  s.addText(o.sub, { x: M + 0.6, y: 3.75, w: W - 2 * M - 1.2, h: 1.0, fontFace: F.body,
    fontSize: 15, color: C.codetx, margin: 0, lineSpacing: 21 });
  if (o.points) s.addText(o.points.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < o.points.length - 1 } })),
    { x: M + 0.1, y: 5.25, w: W - 2 * M, h: 1.3, fontFace: F.body, fontSize: 13.5, color: C.codetx, paraSpaceAfter: 6, margin: 0 });
  foot(s, pres); s.addNotes(notes(o)); return s;
}

// ---------------------------------------------------------------------------
// sExplain — a MECHANISM WALKTHROUGH. Numbered steps, each with real
// explanation on the slide itself rather than only in the speaker notes.
// Use for "how does this actually work?" rather than "what is this?".
// ---------------------------------------------------------------------------
function sExplain(pres, o) {
  const s = newSlide(pres);
  chip(s, o.chip, o.chipColour); heading(s, o.title);
  let y = 1.9;
  // Optional general/universal definition, stated BEFORE the question box and
  // the AxisPay-specific steps below it — the concept in plain Kubernetes
  // terms, independent of any one application.
  if (o.lead) {
    s.addText(o.lead, { x: M, y, w: W - 2 * M, h: 0.5,
      fontFace: F.body, fontSize: 13.5, italic: true, color: C.teal,
      margin: 0, lineSpacing: 17 });
    y += 0.56;
  }
  if (o.question) {
    s.addShape("roundRect", { x: M, y, w: W - 2 * M, h: 0.62,
      fill: { color: "EAF1F8" }, line: { color: C.teal }, rectRadius: 0.08 });
    s.addText(o.question, { x: M + 0.22, y, w: W - 2 * M - 0.44, h: 0.62,
      fontFace: F.head, fontSize: 15, bold: true, color: C.navy,
      valign: "middle", margin: 0 });
    y += 0.82;
  }
  const n = o.steps.length;
  const avail = H - y - (o.kicker ? 1.05 : 0.75);
  const rh = Math.min(1.02, avail / n);
  o.steps.forEach((st, i) => {
    const ty = y + i * rh;
    s.addShape("ellipse", { x: M, y: ty + (rh - 0.44) / 2, w: 0.44, h: 0.44,
      fill: { color: st[2] || C.teal }, line: { color: st[2] || C.teal } });
    s.addText(String(i + 1), { x: M, y: ty + (rh - 0.44) / 2, w: 0.44, h: 0.44,
      fontFace: F.head, fontSize: 14, bold: true, color: C.white,
      align: "center", valign: "middle", margin: 0 });
    s.addText(st[0], { x: M + 0.62, y: ty, w: 3.5, h: rh,
      fontFace: F.head, fontSize: 14, bold: true, color: C.navy,
      valign: "middle", margin: 0 });
    s.addText(st[1], { x: M + 4.2, y: ty, w: W - M - 4.2 - M, h: rh,
      fontFace: F.body, fontSize: 12.5, color: C.ink,
      valign: "middle", margin: 0, lineSpacing: 16 });
  });
  if (o.kicker) s.addText(o.kicker, { x: M, y: H - 1.28, w: W - 2 * M, h: 0.6,
    fontFace: F.body, fontSize: 14, bold: true, color: C.teal,
    align: "center", valign: "middle", margin: 0 });
  foot(s, pres); s.addNotes(notes(o)); return s;
}

module.exports = { C, F, W, H, M, setDay, notes, chip, foot, newSlide, heading,
  sTitle, sSection, sPoints, sCards, sCode, sStats, sAsk, sLab, sMistakes, sTable,
  sBanner, sExplain };
