// Day 2 native-shape diagrams
const L = require("./lib.js");
const D = require("./diagrams.js");
const { C, F, W, H, M } = L;
const box = D.box, arrow = D.arrow;

// --- probes by consequence --------------------------------------------------
function dProbes(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  const cols = [
    ["startupProbe", "/startupz", "Has init finished?", "Keep waiting.\nLiveness SUSPENDED.", C.amberD, "No"],
    ["livenessProbe", "/healthz", "Is this process\nunrecoverable?", "RESTART\nthe container", C.red, "NEVER"],
    ["readinessProbe", "/readyz", "Can THIS pod\nserve right now?", "Remove from\nEndpoints", C.green, "YES — the point"],
  ];
  cols.forEach((c, i) => {
    const x = 0.75 + i * 4.1;
    s.addShape("roundRect", { x, y: 1.95, w: 3.75, h: 4.15, fill: { color: C.navy2 },
      line: { color: c[4] }, rectRadius: 0.1 });
    s.addText(c[0], { x, y: 2.1, w: 3.75, h: 0.4, fontFace: F.head, fontSize: 17, bold: true,
      color: c[4], align: "center", margin: 0 });
    s.addText(c[1], { x, y: 2.52, w: 3.75, h: 0.32, fontFace: F.mono, fontSize: 12,
      color: C.codetx, align: "center", margin: 0 });
    s.addText(c[2], { x: x + 0.2, y: 2.95, w: 3.35, h: 0.7, fontFace: F.body, fontSize: 13,
      color: C.white, align: "center", italic: true, margin: 0 });
    s.addText("CONSEQUENCE OF FAILURE", { x, y: 3.72, w: 3.75, h: 0.28, fontFace: F.body,
      fontSize: 9, bold: true, color: C.amber, align: "center", charSpacing: 1, margin: 0 });
    s.addShape("roundRect", { x: x + 0.28, y: 4.02, w: 3.19, h: 0.92, fill: { color: c[4] },
      line: { color: c[4] }, rectRadius: 0.08 });
    s.addText(c[3], { x: x + 0.28, y: 4.02, w: 3.19, h: 0.92, fontFace: F.head, fontSize: 13.5,
      bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    s.addText("Check dependencies?", { x, y: 5.08, w: 3.75, h: 0.28, fontFace: F.body,
      fontSize: 10, color: C.muted, align: "center", margin: 0 });
    s.addText(c[5], { x, y: 5.36, w: 3.75, h: 0.4, fontFace: F.head, fontSize: 16, bold: true,
      color: c[5] === "NEVER" ? C.red : c[5].startsWith("YES") ? C.green : C.muted,
      align: "center", margin: 0 });
  });
  s.addText("Learn the CONSEQUENCE, not the name. Every probe mistake in production is made by someone who knew the definitions.",
    { x: M, y: 6.3, w: W - 2 * M, h: 0.45, fontFace: F.body, fontSize: 14, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- cascading failure ------------------------------------------------------
function dCascade(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.red); L.heading(s, o.title, true);
  box(s, 4.9, 1.9, 3.5, 0.8, "40-second blip", "in ONE dependency", C.navy3);
  s.addText("liveness → /healthz", { x: 0.8, y: 2.95, w: 5.4, h: 0.35, fontFace: F.head,
    fontSize: 15, bold: true, color: C.green, align: "center", margin: 0 });
  s.addText("liveness → /readyz", { x: 7.1, y: 2.95, w: 5.4, h: 0.35, fontFace: F.head,
    fontSize: 15, bold: true, color: C.red, align: "center", margin: 0 });
  const good = ["Readiness fails → pods leave endpoints",
                "Pods keep running, keep their state",
                "Dependency returns → rejoin in ~10s",
                "NO intervention. NO restart."];
  const bad  = ["Liveness fails on EVERY replica",
                "ALL pods restart simultaneously",
                "Cold start, empty pools, thundering herd",
                "CrashLoopBackOff — total outage"];
  good.forEach((t, i) => {
    s.addShape("roundRect", { x: 0.8, y: 3.4 + i * 0.68, w: 5.4, h: 0.56,
      fill: { color: C.navy2 }, line: { color: C.green }, rectRadius: 0.07 });
    s.addText(`${i + 1}.  ${t}`, { x: 1.0, y: 3.4 + i * 0.68, w: 5.1, h: 0.56,
      fontFace: F.body, fontSize: 12.5, color: C.white, valign: "middle", margin: 0 });
  });
  bad.forEach((t, i) => {
    s.addShape("roundRect", { x: 7.1, y: 3.4 + i * 0.68, w: 5.4, h: 0.56,
      fill: { color: i === 3 ? "5A2A2A" : C.navy2 }, line: { color: C.red }, rectRadius: 0.07 });
    s.addText(`${i + 1}.  ${t}`, { x: 7.3, y: 3.4 + i * 0.68, w: 5.1, h: 0.56,
      fontFace: F.body, fontSize: 12.5, bold: i === 3, color: C.white, valign: "middle", margin: 0 });
  });
  arrow(s, 5.2, 2.72, -1.6, 0.18, C.green);
  arrow(s, 8.1, 2.72, 1.6, 0.18, C.red);
  s.addText("A 40-second dependency blip becomes a total outage — long after the blip is over.",
    { x: M, y: 6.35, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 14.5, bold: true,
      color: C.red, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- namespace isolation -----------------------------------------------------
function dNamespace(pres, o) {
  const s = L.newSlide(pres);
  L.chip(s, o.chip, C.teal); L.heading(s, o.title);
  s.addShape("roundRect", { x: 0.72, y: 1.95, w: 11.9, h: 3.95, fill: { color: "F7F9FC" },
    line: { color: C.rule }, rectRadius: 0.08 });
  s.addText("One cluster", { x: 0.95, y: 2.08, w: 1.4, h: 0.3, fontFace: F.head, fontSize: 16,
    bold: true, color: C.navy, margin: 0 });
  s.addShape("roundRect", { x: 1.05, y: 2.5, w: 5.0, h: 2.85, fill: { color: "FFFFFF" },
    line: { color: C.teal }, rectRadius: 0.08 });
  s.addShape("roundRect", { x: 7.25, y: 2.5, w: 5.0, h: 2.85, fill: { color: "FFFFFF" },
    line: { color: C.purple }, rectRadius: 0.08 });
  s.addText("namespace: team-a", { x: 1.3, y: 2.72, w: 2.3, h: 0.3, fontFace: F.head, fontSize: 15,
    bold: true, color: C.teal, margin: 0 });
  s.addText("namespace: team-b", { x: 7.5, y: 2.72, w: 2.3, h: 0.3, fontFace: F.head, fontSize: 15,
    bold: true, color: C.purple, margin: 0 });
  box(s, 1.42, 3.18, 1.75, 0.78, "Service", "web", C.navy3);
  box(s, 3.86, 3.18, 1.75, 0.78, "StatefulSet", "db", C.navy3);
  box(s, 1.42, 4.22, 1.75, 0.78, "Pod", "web-7fd8", C.green);
  box(s, 3.86, 4.22, 1.75, 0.78, "Pod", "db-0", "8A93A0");
  box(s, 7.62, 3.18, 1.75, 0.78, "Service", "web", C.navy3);
  box(s, 10.06, 3.18, 1.75, 0.78, "StatefulSet", "db", C.navy3);
  box(s, 7.62, 4.22, 1.75, 0.78, "Pod", "web-2ac4", C.green);
  box(s, 10.06, 4.22, 1.75, 0.78, "Pod", "db-0", "8A93A0");
  s.addText("same object names are legal because the namespace qualifies identity", {
    x: 2.0, y: 5.43, w: 8.9, h: 0.28, fontFace: F.body, fontSize: 10.5, italic: true,
    color: C.muted, align: "center", margin: 0
  });
  s.addText("quota, RBAC and defaults attach per namespace; traffic is NOT isolated unless NetworkPolicy says so",
    { x: M, y: 6.28, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 14, bold: true,
      color: C.navy, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- requests vs limits ------------------------------------------------------
function dReqLimit(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  s.addText("scheduler sees REQUESTS", { x: 0.95, y: 1.95, w: 3.9, h: 0.3, fontFace: F.head,
    fontSize: 15, bold: true, color: C.teal, align: "center", margin: 0 });
  s.addText("kernel enforces LIMITS", { x: 8.45, y: 1.95, w: 3.9, h: 0.3, fontFace: F.head,
    fontSize: 15, bold: true, color: C.amber, align: "center", margin: 0 });
  s.addShape("roundRect", { x: 0.8, y: 2.3, w: 4.15, h: 3.7, fill: { color: C.navy2 },
    line: { color: C.teal }, rectRadius: 0.1 });
  s.addText("Node allocatable\n2000m CPU", { x: 1.0, y: 2.45, w: 3.75, h: 0.56, fontFace: F.head,
    fontSize: 18, bold: true, color: C.white, align: "center", margin: 0 });
  [["web 500m", C.green], ["api 300m", C.purple], ["worker 700m", C.amberD], ["free 500m", C.codebg]]
    .reduce((y, r) => {
      s.addShape("roundRect", { x: 1.25, y, w: 3.25, h: 0.42, fill: { color: r[1] }, line: { color: r[1] }, rectRadius: 0.05 });
      s.addText(r[0], { x: 1.25, y, w: 3.25, h: 0.42, fontFace: F.head, fontSize: 12.5, bold: true,
        color: r[0].startsWith("free") ? C.codetx : C.white, align: "center", valign: "middle", margin: 0 });
      return y + 0.5;
    }, 3.1);
  s.addText("booking only — idle CPU does not change this", { x: 1.05, y: 5.62, w: 3.65, h: 0.32, fontFace: F.body,
    fontSize: 10.5, color: C.codetx, italic: true, align: "center", margin: 0 });
  box(s, 5.55, 2.7, 2.2, 0.9, "Pod spec", "request 300m", C.purple);
  box(s, 5.55, 3.9, 2.2, 0.9, "Same pod", "limit 600m", C.amberD);
  arrow(s, 5.0, 3.18, 0.45, 0, C.teal, "fits?");
  arrow(s, 7.85, 4.35, 0.55, 0, C.amber, "cap");
  s.addShape("roundRect", { x: 8.55, y: 2.3, w: 4.0, h: 3.45, fill: { color: C.navy2 },
    line: { color: C.amber }, rectRadius: 0.1 });
  s.addText("Container runtime", { x: 8.8, y: 2.52, w: 3.5, h: 0.34, fontFace: F.head, fontSize: 17,
    bold: true, color: C.white, align: "center", margin: 0 });
  box(s, 9.02, 3.02, 3.05, 0.78, "usage 580m", "still allowed", C.green);
  box(s, 9.02, 4.0, 3.05, 0.88, "usage 750m", "CPU throttled here", C.red);
  s.addText("memory over limit would be OOMKilled, not slowed", { x: 8.95, y: 5.08, w: 3.2, h: 0.32,
    fontFace: F.body, fontSize: 10.8, italic: true, color: C.codetx, align: "center", margin: 0 });
  s.addText("Requests answer 'Can it be placed?' Limits answer 'How far may it run once placed?'",
    { x: M, y: 6.28, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 14, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- rolling update timeline ------------------------------------------------
function dRollout(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  const steps = [
    ["t0", "RS-A: 3 ready", "v1.0.0", "total 3 · serving 3", C.teal],
    ["t1", "RS-B: +1 pod", "not ready yet", "total 4 · serving 3", C.amberD],
    ["t2", "new pod READY", "joins endpoints", "total 4 · serving 4", C.green],
    ["t3", "old pod drains", "preStop → SIGTERM", "total 3 · serving 3", C.teal],
    ["t5", "RS-B: 3 ready", "RS-A: 0, kept", "total 3 · serving 3", C.green],
  ];
  steps.forEach((st, i) => {
    const x = 0.62 + i * 2.48;
    s.addShape("roundRect", { x, y: 2.25, w: 2.28, h: 2.5, fill: { color: C.navy2 },
      line: { color: st[4] }, rectRadius: 0.1 });
    s.addText(st[0], { x, y: 2.4, w: 2.28, h: 0.4, fontFace: F.head, fontSize: 18, bold: true,
      color: st[4], align: "center", margin: 0 });
    s.addText(st[1], { x: x + 0.12, y: 2.85, w: 2.04, h: 0.55, fontFace: F.head, fontSize: 12.5,
      bold: true, color: C.white, align: "center", margin: 0 });
    s.addText(st[2], { x: x + 0.12, y: 3.42, w: 2.04, h: 0.5, fontFace: F.body, fontSize: 10.5,
      color: C.codetx, align: "center", italic: true, margin: 0 });
    s.addShape("roundRect", { x: x + 0.14, y: 4.02, w: 2.0, h: 0.55, fill: { color: C.codebg },
      line: { color: C.navy3 }, rectRadius: 0.06 });
    s.addText(st[3], { x: x + 0.14, y: 4.02, w: 2.0, h: 0.55, fontFace: F.mono, fontSize: 9.5,
      color: C.amber, align: "center", valign: "middle", margin: 0 });
    if (i < 4) s.addShape("line", { x: x + 2.3, y: 3.5, w: 0.16, h: 0,
      line: { color: C.teal, width: 2, endArrowType: "triangle" } });
  });
  s.addShape("roundRect", { x: M, y: 5.15, w: W - 2 * M, h: 0.85, fill: { color: C.navy2 },
    line: { color: C.green }, rectRadius: 0.1 });
  s.addText("maxUnavailable: 0   ·   maxSurge: 1        →   serving capacity NEVER drops below 3",
    { x: M, y: 5.15, w: W - 2 * M, h: 0.85, fontFace: F.head, fontSize: 16, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0 });
  s.addText("Cost: headroom for one extra pod, and a slower release. On a payment path, that is the correct trade.",
    { x: M, y: 6.2, w: W - 2 * M, h: 0.4, fontFace: F.body, fontSize: 13, color: C.codetx,
      align: "center", italic: true, margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- workload decision tree -------------------------------------------------
function dWorkloads(pres, o) {
  const s = L.newSlide(pres);
  L.chip(s, o.chip, o.chipColour); L.heading(s, o.title);
  const rows = [
    ["\"N copies, always running\"", "Deployment", "edge-gateway, payment-service", C.teal],
    ["\"One on EVERY node, whatever the count\"", "DaemonSet", "node-agent — PCI file integrity", C.green],
    ["\"Do this once, then stop\"", "Job", "recon-worker — ledger reconciliation", C.amberD],
    ["\"Do this at 23:00 every night\"", "CronJob", "settlement-cron — nightly batch", C.purple],
    ["\"Stable identity + its own storage\"", "StatefulSet", "PostgreSQL — Day 3", "8A93A0"],
  ];
  rows.forEach((r, i) => {
    const y = 2.05 + i * 0.9;
    s.addShape("roundRect", { x: M, y, w: 5.0, h: 0.74, fill: { color: "FFFFFF" },
      line: { color: C.rule }, rectRadius: 0.07 });
    s.addText(r[0], { x: M + 0.2, y, w: 4.6, h: 0.74, fontFace: F.body, fontSize: 13,
      italic: true, color: C.ink, valign: "middle", margin: 0 });
    s.addShape("roundRect", { x: M + 5.3, y, w: 2.5, h: 0.74, fill: { color: r[3] },
      line: { color: r[3] }, rectRadius: 0.07 });
    s.addText(r[1], { x: M + 5.3, y, w: 2.5, h: 0.74, fontFace: F.head, fontSize: 15, bold: true,
      color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
    s.addText(r[2], { x: M + 8.05, y, w: 4.0, h: 0.74, fontFace: F.body, fontSize: 12,
      color: C.muted, valign: "middle", margin: 0 });
    s.addShape("line", { x: M + 5.05, y: y + 0.37, w: 0.2, h: 0,
      line: { color: r[3], width: 2, endArrowType: "triangle" } });
  });
  s.addText("Choose by SHAPE, not by habit. Three of these are not a Deployment.",
    { x: M, y: 6.7, w: W - 2 * M, h: 0.4, fontFace: F.body, fontSize: 14, bold: true,
      color: C.navy, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- cronjob / job timeline --------------------------------------------------
function dCronJob(pres, o) {
  const s = L.newSlide(pres);
  L.chip(s, o.chip, C.purple); L.heading(s, o.title);
  s.addText("time", { x: 0.88, y: 2.05, w: 0.6, h: 0.24, fontFace: F.head, fontSize: 13,
    bold: true, color: C.muted, margin: 0 });
  ["22:59", "23:00", "23:03", "23:06", "23:10"].forEach((t, i) => {
    const x = 1.55 + i * 2.2;
    s.addShape("line", { x, y: 2.45, w: 0, h: 3.15, line: { color: C.rule, width: 1.2, dash: "dash" } });
    s.addText(t, { x: x - 0.38, y: 2.12, w: 0.76, h: 0.24, fontFace: F.mono, fontSize: 11.5,
      color: C.navy, align: "center", margin: 0 });
  });
  s.addText("CronJob", { x: 0.82, y: 2.72, w: 0.9, h: 0.24, fontFace: F.head, fontSize: 13,
    bold: true, color: C.purple, margin: 0 });
  s.addText("Job", { x: 0.98, y: 3.68, w: 0.6, h: 0.24, fontFace: F.head, fontSize: 13,
    bold: true, color: C.amberD, margin: 0 });
  s.addText("Pod", { x: 0.98, y: 4.64, w: 0.6, h: 0.24, fontFace: F.head, fontSize: 13,
    bold: true, color: C.green, margin: 0 });
  box(s, 3.0, 2.6, 1.25, 0.62, "0 23 * * *", "", C.purple);
  arrow(s, 3.62, 3.24, 0, 0.34, C.purple);
  box(s, 2.68, 3.64, 1.9, 0.68, "Job nightly-report-291", "", C.amberD);
  arrow(s, 3.62, 4.34, 0, 0.34, C.amberD);
  box(s, 2.98, 4.62, 1.3, 0.68, "Pod run #1", "", C.green);
  s.addShape("line", { x: 4.28, y: 4.96, w: 2.05, h: 0, line: { color: C.green, width: 2 } });
  s.addText("running", { x: 4.77, y: 4.63, w: 1.0, h: 0.22, fontFace: F.body, fontSize: 11,
    italic: true, color: C.muted, align: "center", margin: 0 });
  box(s, 6.22, 4.62, 1.05, 0.68, "Complete", "", C.teal);
  box(s, 7.38, 2.6, 1.25, 0.62, "0 23 * * *", "", C.purple);
  arrow(s, 8.0, 3.24, 0, 0.34, C.purple);
  box(s, 7.15, 3.62, 1.7, 0.72, "if prior Job\nstill running", "", C.navy3);
  box(s, 9.32, 3.64, 1.6, 0.68, "Forbid → skip", "", C.red);
  arrow(s, 8.88, 3.98, 0.34, 0, C.red);
  s.addText("CronJob decides WHEN to start; Job decides WHEN the work is finished or failed.",
    { x: M, y: 6.28, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 14, bold: true,
      color: C.navy, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- HPA loop ---------------------------------------------------------------
function dHPA(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  box(s, 0.8, 2.4, 2.3, 1.0, "Pods", "actual CPU", C.navy3);
  box(s, 3.5, 2.4, 2.3, 1.0, "kubelet", "cAdvisor", C.navy3);
  box(s, 6.2, 2.4, 2.5, 1.0, "metrics-server", "aggregates", C.purple);
  box(s, 9.1, 2.4, 3.4, 1.0, "HPA controller", "every 15 seconds", C.green);
  arrow(s, 3.15, 2.9, 0.3, 0, C.teal);
  arrow(s, 5.85, 2.9, 0.3, 0, C.teal);
  arrow(s, 8.75, 2.9, 0.3, 0, C.teal);
  s.addShape("roundRect", { x: 2.6, y: 3.85, w: 8.1, h: 1.0, fill: { color: C.codebg },
    line: { color: C.amber }, rectRadius: 0.08 });
  s.addText("desiredReplicas = ceil( currentReplicas × currentUtilisation ÷ targetUtilisation )",
    { x: 2.6, y: 3.85, w: 8.1, h: 1.0, fontFace: F.mono, fontSize: 13.5, bold: true,
      color: C.amber, align: "center", valign: "middle", margin: 0 });
  s.addShape("roundRect", { x: 2.6, y: 5.05, w: 8.1, h: 1.15, fill: { color: "5A2A2A" },
    line: { color: C.red }, rectRadius: 0.08 });
  s.addText("utilisation = usage ÷ the REQUEST   (not the limit, not the node)",
    { x: 2.6, y: 5.15, w: 8.1, h: 0.4, fontFace: F.head, fontSize: 14.5, bold: true,
      color: C.white, align: "center", margin: 0 });
  s.addText("No request → no denominator → TARGETS: <unknown> → the HPA does nothing, forever, with no error.",
    { x: 2.7, y: 5.58, w: 7.9, h: 0.5, fontFace: F.body, fontSize: 12, color: C.codetx,
      align: "center", italic: true, margin: 0 });
  arrow(s, 10.8, 3.4, 0, 0.4, C.green);
  s.addText("This is why L2.1 (resources) comes before L2.4 (autoscaling). The dependency is arithmetic, not preference.",
    { x: M, y: 6.35, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 13.5, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}
module.exports = { dProbes, dCascade, dNamespace, dReqLimit, dRollout, dWorkloads, dCronJob, dHPA };
