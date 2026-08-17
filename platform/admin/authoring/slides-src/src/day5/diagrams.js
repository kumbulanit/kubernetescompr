// ============================================================================
// Day 5 diagrams — native PowerPoint shapes, editable in the deck.
// Original work. Industry architecture diagrams were consulted for accuracy of
// the mechanisms, never copied.
// ============================================================================
const L = require("./lib.js");
const { C, F, W, H, M } = L;

function box(s, x, y, w, h, title, sub, fill, txt) {
  s.addShape("roundRect", { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08 });
  s.addText(title, { x: x + 0.08, y: sub ? y + 0.10 : y, w: w - 0.16, h: sub ? h * 0.46 : h,
    fontFace: F.head, fontSize: 13, bold: true, color: txt || C.white, align: "center",
    valign: "middle", margin: 0 });
  if (sub) s.addText(sub, { x: x + 0.08, y: y + h * 0.48, w: w - 0.16, h: h * 0.46,
    fontFace: F.body, fontSize: 10, color: txt || C.codetx, align: "center", valign: "middle",
    margin: 0, italic: true });
}
function arrow(s, x, y, w, h, colour, label, dash) {
  s.addShape("line", { x, y, w, h,
    line: { color: colour || C.teal, width: 2, endArrowType: "triangle",
            dashType: dash ? "dash" : "solid" } });
  if (label) s.addText(label, { x: x - 0.55, y: y + h / 2 - 0.40, w: Math.max(Math.abs(w), 1.4) + 1.1, h: 0.32,
    fontFace: F.body, fontSize: 9.5, bold: true, color: colour || C.teal, align: "center", margin: 0 });
}
function kicker(s, text, colour) {
  s.addText(text, { x: M, y: 6.32, w: W - 2 * M, h: 0.5, fontFace: F.body, fontSize: 15,
    bold: true, color: colour || C.amber, align: "center", valign: "middle", margin: 0 });
}

// ---------------------------------------------------------------------------
// 1. IDENTITY — the token nobody asked for, and the admission gate
// ---------------------------------------------------------------------------
function dIdentity(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);

  // BEFORE
  s.addShape("roundRect", { x: 0.75, y: 2.05, w: 5.6, h: 3.55,
    fill: { color: C.navy2 }, line: { color: C.red, width: 2 }, rectRadius: 0.12 });
  s.addText("TODAY", { x: 0.75, y: 2.12, w: 5.6, h: 0.34, fontFace: F.head, fontSize: 12,
    bold: true, color: C.red, align: "center", margin: 0 });
  box(s, 1.05, 2.62, 2.35, 0.95, "payment-service", "ServiceAccount: default", C.navy3);
  box(s, 1.05, 3.80, 2.35, 0.95, "fraud-service", "ServiceAccount: default", C.navy3);
  box(s, 4.35, 3.10, 1.75, 1.35, "API\nserver", null, C.teal);
  arrow(s, 3.45, 3.10, 0.85, 0.30, C.red);
  arrow(s, 3.45, 4.28, 0.85, -0.55, C.red);
  s.addText("token", { x: 3.40, y: 2.68, w: 0.95, h: 0.28, fontFace: F.body, fontSize: 9.5,
    bold: true, color: C.red, align: "center", margin: 0 });
  s.addText("token", { x: 3.40, y: 4.42, w: 0.95, h: 0.28, fontFace: F.body, fontSize: 9.5,
    bold: true, color: C.red, align: "center", margin: 0 });
  s.addText("403 = the credential was ACCEPTED, then denied.\nOnly RBAC stands between it and the cluster.",
    { x: 1.05, y: 4.88, w: 5.0, h: 0.6, fontFace: F.body, fontSize: 10.5, color: C.red,
      align: "center", margin: 0, lineSpacing: 13 });

  // AFTER
  s.addShape("roundRect", { x: 7.0, y: 2.05, w: 5.55, h: 3.55,
    fill: { color: C.navy2 }, line: { color: C.green, width: 2 }, rectRadius: 0.12 });
  s.addText("AFTER L5.1", { x: 7.0, y: 2.12, w: 5.55, h: 0.34, fontFace: F.head, fontSize: 12,
    bold: true, color: C.green, align: "center", margin: 0 });
  box(s, 7.3, 2.62, 2.35, 0.95, "payment-service", "own SA · NO token", C.navy3);
  box(s, 7.3, 3.80, 2.35, 0.95, "node-agent", "own SA · token", C.navy3);
  box(s, 10.6, 3.10, 1.65, 1.35, "API\nserver", null, C.teal);
  arrow(s, 9.7, 3.10, 0.85, 0.30, C.muted, null, true);
  arrow(s, 9.7, 4.28, 0.85, -0.55, C.green);
  s.addText("nothing", { x: 9.60, y: 2.68, w: 1.05, h: 0.28, fontFace: F.body, fontSize: 9.5,
    bold: true, color: C.muted, align: "center", margin: 0 });
  s.addText("lists nodes", { x: 9.55, y: 4.42, w: 1.15, h: 0.28, fontFace: F.body, fontSize: 9.5,
    bold: true, color: C.green, align: "center", margin: 0 });
  s.addText("One exception, and the reason is written next to it.",
    { x: 7.3, y: 4.88, w: 5.0, h: 0.6, fontFace: F.body, fontSize: 10.5, color: C.green,
      align: "center", margin: 0, lineSpacing: 13 });

  kicker(s, "An unused credential grants nothing the application needs and everything an attacker wants.");
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// ---------------------------------------------------------------------------
// 2. RBAC — the 2x2 nobody teaches, and the one square that matters
// ---------------------------------------------------------------------------
function dRBAC(pres, o) {
  const s = L.newSlide(pres, false);
  L.chip(s, o.chip, C.teal); L.heading(s, o.title, false);

  const x0 = 3.05, y0 = 2.35, cw = 4.55, ch = 1.75;
  s.addText("Role\n(one namespace)", { x: 0.75, y: y0, w: 2.15, h: ch, fontFace: F.head,
    fontSize: 13, bold: true, color: C.navy, align: "right", valign: "middle", margin: 0 });
  s.addText("ClusterRole\n(cluster-wide)", { x: 0.75, y: y0 + ch + 0.2, w: 2.15, h: ch,
    fontFace: F.head, fontSize: 13, bold: true, color: C.navy, align: "right", valign: "middle", margin: 0 });
  s.addText("+ RoleBinding", { x: x0, y: y0 - 0.5, w: cw, h: 0.42, fontFace: F.head, fontSize: 13,
    bold: true, color: C.teal, align: "center", margin: 0 });
  s.addText("+ ClusterRoleBinding", { x: x0 + cw + 0.2, y: y0 - 0.5, w: cw, h: 0.42, fontFace: F.head,
    fontSize: 13, bold: true, color: C.teal, align: "center", margin: 0 });

  const cell = (cx, cy, head, sub, fill, border) => {
    s.addShape("roundRect", { x: cx, y: cy, w: cw, h: ch, fill: { color: fill },
      line: { color: border || fill, width: border ? 2.5 : 1 }, rectRadius: 0.1 });
    s.addText(head, { x: cx + 0.15, y: cy + 0.14, w: cw - 0.3, h: 0.5, fontFace: F.head,
      fontSize: 14, bold: true, color: C.white, align: "center", margin: 0 });
    s.addText(sub, { x: cx + 0.15, y: cy + 0.64, w: cw - 0.3, h: ch - 0.78, fontFace: F.body,
      fontSize: 11, color: C.light, align: "center", valign: "top", margin: 0, lineSpacing: 14 });
  };
  cell(x0, y0, "Works", "Permissions apply in that one namespace.\nThe ordinary case.", C.navy3);
  cell(x0 + cw + 0.2, y0, "Does not work", "A ClusterRoleBinding cannot reference a\nnamespaced Role. The API rejects it.", C.muted);
  cell(x0, y0 + ch + 0.2, "THE USEFUL ONE", "Define the permission set ONCE;\nbind it in three namespaces.\naxispay-auditor is exactly this.", C.teal, C.amber);
  cell(x0 + cw + 0.2, y0 + ch + 0.2, "Cluster-wide", "Every namespace, including ones that\ndo not exist yet. Use for nodes only.", C.navy3);

  kicker(s, "RBAC is additive. There is no deny — you protect Secrets by never naming them.", C.teal);
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// ---------------------------------------------------------------------------
// 3. HELM — what a chart actually is
// ---------------------------------------------------------------------------
function dHelm(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);

  box(s, 0.75, 2.5, 2.5, 1.15, "values.yaml", "the DATA", C.navy3);
  box(s, 0.75, 3.95, 2.5, 1.15, "templates/", "the SUBSTITUTION", C.navy3);
  box(s, 4.15, 3.2, 2.3, 1.2, "render", "text in, text out", C.teal);
  box(s, 7.35, 3.2, 2.4, 1.2, "69 objects", "ordinary YAML", C.green);
  box(s, 10.65, 3.2, 1.9, 1.2, "cluster", null, C.amber, C.navy);

  arrow(s, 3.3, 3.05, 0.8, 0.5, C.amber);
  arrow(s, 3.3, 4.5, 0.8, -0.6, C.amber);
  arrow(s, 6.5, 3.8, 0.8, 0, C.amber, "helm template");
  arrow(s, 9.8, 3.8, 0.8, 0, C.amber, "apply");

  // the release secret
  s.addShape("roundRect", { x: 4.15, y: 5.15, w: 5.6, h: 0.85, fill: { color: C.navy2 },
    line: { color: C.purple, width: 2 }, rectRadius: 0.1 });
  s.addText("Release = a Secret holding a gzipped copy of the rendered YAML",
    { x: 4.15, y: 5.15, w: 5.6, h: 0.85, fontFace: F.body, fontSize: 11.5, bold: true,
      color: C.purple, align: "center", valign: "middle", margin: 0 });
  arrow(s, 8.5, 4.45, -1.0, 0.65, C.purple);
  s.addText("helm rollback re-applies a STORED copy —\nit does not re-render from git.",
    { x: 0.75, y: 5.15, w: 3.2, h: 0.85, fontFace: F.body, fontSize: 10.5, color: C.codetx,
      align: "center", valign: "middle", margin: 0, lineSpacing: 13 });

  kicker(s, "Nothing watches your chart. Between commands, Helm is not running.");
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// ---------------------------------------------------------------------------
// 4. TLS AUTH — kubeconfig, certs, and the RBAC identity they become
// ---------------------------------------------------------------------------
function dTLSAuth(pres, o) {
  const s = L.newSlide(pres, false);
  L.chip(s, o.chip, C.teal); L.heading(s, o.title, false);

  box(s, 0.75, 3.05, 1.65, 1.0, "operator", "kubectl", C.navy3);
  box(s, 2.95, 2.3, 2.55, 1.0, "kubeconfig", "cluster CA · cert · key", C.navy3);
  box(s, 2.95, 4.2, 1.55, 0.82, "client cert", "CN=alice · O=devs", C.navy3);
  box(s, 4.7, 4.2, 0.95, 0.82, "key", null, C.navy3);
  box(s, 6.45, 3.0, 2.05, 1.1, "API server", "mutual TLS handshake", C.teal);
  box(s, 9.0, 2.4, 2.2, 0.95, "authenticated user", "alice · group devs", C.green);
  box(s, 9.0, 4.15, 2.2, 0.95, "RBAC", "verbs + resources", C.purple);
  box(s, 11.55, 3.0, 1.0, 1.1, "allow\nor\nforbid", null, C.amber, C.navy);

  arrow(s, 2.45, 3.55, 0.45, 0, C.amberD, "reads");
  arrow(s, 4.25, 3.32, 0, 0.8, C.muted, null, true);
  arrow(s, 5.15, 3.32, 0, 0.8, C.muted, null, true);
  arrow(s, 5.75, 3.55, 0.6, 0, C.amberD, "presents");
  arrow(s, 8.6, 3.12, 0.35, -0.25, C.green);
  s.addText("CN / O", { x: 7.35, y: 2.62, w: 1.2, h: 0.24, fontFace: F.body, fontSize: 10,
    bold: true, color: C.green, align: "center", margin: 0 });
  arrow(s, 10.1, 3.35, 0, 0.72, C.purple);
  arrow(s, 11.25, 4.62, 0.25, -1.07, C.amberD);
  s.addText("decision", { x: 10.55, y: 4.15, w: 1.3, h: 0.24, fontFace: F.body, fontSize: 10,
    bold: true, color: C.amberD, align: "center", margin: 0 });

  s.addText("No internal user table — the certificate text IS the user record.",
    { x: 7.0, y: 5.25, w: 4.9, h: 0.38, fontFace: F.body, fontSize: 11, color: C.ink,
      align: "center", margin: 0 });

  kicker(s, "The certificate proves identity first; RBAC only evaluates the username and groups it produced.", C.teal);
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// ---------------------------------------------------------------------------
// 5. HELM DEPENDENCIES — declared in Chart.yaml, resolved into charts/
// ---------------------------------------------------------------------------
function dHelmDeps(pres, o) {
  const s = L.newSlide(pres, false);
  L.chip(s, o.chip, C.teal); L.heading(s, o.title, false);

  box(s, 0.75, 2.45, 2.35, 0.95, "Chart.yaml", "name · version · repo", C.navy3);
  box(s, 0.75, 4.15, 2.35, 0.95, "values.yaml", "parent + global values", C.navy3);

  box(s, 4.0, 2.05, 2.1, 0.82, "redis", "subchart", C.teal);
  box(s, 4.0, 3.3, 2.1, 0.82, "postgresql", "subchart", C.teal);
  box(s, 4.0, 4.55, 2.1, 0.82, "rabbitmq", "subchart", C.teal);

  s.addShape("roundRect", { x: 8.0, y: 2.35, w: 4.15, h: 3.0, fill: { color: C.navy2 },
    line: { color: C.green, width: 2 }, rectRadius: 0.1 });
  s.addText("charts/", { x: 8.0, y: 2.46, w: 4.15, h: 0.34, fontFace: F.head, fontSize: 13,
    bold: true, color: C.green, align: "center", margin: 0 });
  box(s, 8.35, 2.95, 3.45, 0.62, "redis-18.0.0.tgz", null, C.green, C.navy);
  box(s, 8.35, 3.72, 3.45, 0.62, "postgresql-14.1.0.tgz", null, C.green, C.navy);
  box(s, 8.35, 4.49, 3.45, 0.62, "rabbitmq-12.0.0.tgz", null, C.green, C.navy);

  arrow(s, 3.2, 2.92, 4.6, 0.3, C.amberD);
  s.addText("helm dependency update", { x: 4.05, y: 3.02, w: 3.6, h: 0.24, fontFace: F.body, fontSize: 10,
    bold: true, color: C.amberD, align: "center", margin: 0 });
  arrow(s, 3.2, 4.62, 0.7, -2.05, C.purple, "values");
  arrow(s, 3.2, 4.62, 0.7, -0.8, C.purple);
  arrow(s, 3.2, 4.62, 0.7, 0.45, C.purple);
  arrow(s, 7.75, 3.26, -1.55, -0.73, C.green, null, true);
  arrow(s, 7.75, 3.83, -1.55, -0.12, C.green, null, true);
  arrow(s, 7.75, 4.4, -1.55, 0.49, C.green, null, true);
  s.addText("resolved bytes", { x: 5.85, y: 3.55, w: 1.55, h: 0.5, fontFace: F.body, fontSize: 9.5,
    bold: true, color: C.green, align: "center", valign: "middle", margin: 0 });

  s.addText("One release renders the parent chart and every vendored child chart together.",
    { x: 3.45, y: 5.72, w: 6.0, h: 0.34, fontFace: F.body, fontSize: 11, color: C.ink,
      align: "center", margin: 0 });

  kicker(s, "Dependencies are declared in Chart.yaml, configured by parent values, and rendered from vendored chart archives.", C.teal);
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// ---------------------------------------------------------------------------
// 6. KUBEADM UPGRADE — control plane first, workers one by one
// ---------------------------------------------------------------------------
function dKubeadmUpgrade(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);

  box(s, 0.75, 3.05, 1.55, 1.0, "plan", "next supported minor", C.navy3);
  box(s, 2.75, 2.45, 2.15, 1.6, "control plane", "Node-1\nkubeadm upgrade apply", C.teal);
  box(s, 5.35, 2.45, 2.15, 1.6, "control plane", "Node-2 · Node-3\nkubeadm upgrade node", C.navy3);
  box(s, 7.95, 2.45, 2.45, 1.6, "workers", "worker-a then worker-b\ndrain → upgrade → uncordon", C.purple);
  box(s, 10.85, 3.05, 1.7, 1.0, "target", "all nodes v1.x.y", C.green);

  arrow(s, 2.35, 3.55, 0.35, 0, C.amberD, "1");
  arrow(s, 4.95, 3.25, 0.35, 0, C.amberD, "2");
  arrow(s, 7.55, 3.25, 0.35, 0, C.amberD, "3");
  arrow(s, 10.45, 3.55, 0.35, 0, C.amberD, "4");

  s.addText("Only the first control-plane node runs the full apply path.",
    { x: 2.7, y: 4.35, w: 2.25, h: 0.32, fontFace: F.body, fontSize: 10.5, color: C.codetx,
      align: "center", margin: 0 });
  s.addText("Workers move one at a time so service capacity returns before the next drain.",
    { x: 7.7, y: 4.35, w: 2.95, h: 0.44, fontFace: F.body, fontSize: 10.5, color: C.codetx,
      align: "center", margin: 0, lineSpacing: 13 });

  s.addShape("roundRect", { x: 2.75, y: 5.0, w: 7.65, h: 0.82, fill: { color: C.navy2 },
    line: { color: C.amber, width: 2 }, rectRadius: 0.1 });
  s.addText("Temporary mixed versions are tolerated only while the sequence is in progress.",
    { x: 2.85, y: 5.0, w: 7.45, h: 0.82, fontFace: F.body, fontSize: 11.5, bold: true,
      color: C.amber, align: "center", valign: "middle", margin: 0 });

  kicker(s, "Upgrade apply once, upgrade every other node in order, and finish with the whole cluster schedulable again.");
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// ---------------------------------------------------------------------------
// 7. PROMOTION — one artefact, three environments
// ---------------------------------------------------------------------------
function dPromotion(pres, o) {
  const s = L.newSlide(pres, false);
  L.chip(s, o.chip, C.teal); L.heading(s, o.title, false);

  s.addShape("roundRect", { x: 0.75, y: 3.2, w: 2.6, h: 1.66, fill: { color: C.navy },
    line: { color: C.navy }, rectRadius: 0.1 });
  s.addText("charts/axispay", { x: 0.75, y: 3.34, w: 2.6, h: 0.5, fontFace: F.head, fontSize: 14,
    bold: true, color: C.white, align: "center", margin: 0 });
  s.addText("ONE chart\nONE set of templates", { x: 0.75, y: 3.84, w: 2.6, h: 0.9, fontFace: F.body,
    fontSize: 10.5, color: C.codetx, align: "center", margin: 0, italic: true, lineSpacing: 13 });

  // y values keep the top card clear of the heading (which ends at 1.77)
  const envs = [
    ["dev",     "12 pods · 760m",  "1 replica · no Ingress\ndebug logs · no PDBs", C.teal2,  2.68],
    ["staging", "22 pods · 1420m", "production's SHAPE\nsmaller numbers",          C.teal,   4.03],
    ["prod",    "41 pods · 3380m", "anti-affinity · PDBs\nmaxUnavailable 0",       C.amberD, 5.38],
  ];
  envs.forEach(([n, size, detail, col, y]) => {
    s.addShape("roundRect", { x: 5.2, y: y - 0.56, w: 3.3, h: 1.12, fill: { color: col },
      line: { color: col }, rectRadius: 0.1 });
    s.addText(`values-${n}.yaml`, { x: 5.2, y: y - 0.46, w: 3.3, h: 0.38, fontFace: F.head,
      fontSize: 13, bold: true, color: C.white, align: "center", margin: 0 });
    s.addText(size, { x: 5.2, y: y - 0.04, w: 3.3, h: 0.3, fontFace: F.mono, fontSize: 10,
      color: C.white, align: "center", margin: 0 });
    s.addText(detail, { x: 8.75, y: y - 0.5, w: 3.9, h: 1.0, fontFace: F.body, fontSize: 10.5,
      color: C.ink, valign: "middle", margin: 0, lineSpacing: 14 });
    arrow(s, 3.4, 4.03, 1.7, y - 4.03, col);
  });

  s.addShape("roundRect", { x: 5.2, y: 6.15, w: 7.45, h: 0.62, fill: { color: C.green },
    line: { color: C.green }, rectRadius: 0.1 });
  s.addText("NEVER relaxed per environment:  NetworkPolicy · Pod Security · token mounting",
    { x: 5.2, y: 6.15, w: 7.45, h: 0.62, fontFace: F.body, fontSize: 11.5, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0 });
  s.addText("Structure identical.\nOnly numbers differ.", { x: 0.75, y: 5.25, w: 2.6, h: 0.8,
    fontFace: F.body, fontSize: 11.5, bold: true, color: C.teal, align: "center",
    margin: 0, lineSpacing: 14 });

  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// ---------------------------------------------------------------------------
// 8. SCRAPE PATH — four hops, and the one that fails silently
// ---------------------------------------------------------------------------
function dScrape(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);

  box(s, 0.75, 2.9, 2.35, 1.3, "Counter.inc()", "in the code", C.navy3);
  box(s, 3.55, 2.9, 2.15, 1.3, "/metrics", "a text endpoint", C.navy3);
  box(s, 6.15, 2.9, 2.4, 1.3, "Prometheus", "PULLS every 15s", C.teal);
  box(s, 9.0, 2.9, 1.65, 1.3, "TSDB", "6h", C.navy3);
  box(s, 11.1, 2.9, 1.45, 1.3, "Grafana", null, C.green);

  arrow(s, 3.15, 3.55, 0.35, 0, C.amber);
  arrow(s, 5.75, 3.55, 0.35, 0, C.amber);
  arrow(s, 8.6, 3.55, 0.35, 0, C.amber);
  arrow(s, 10.7, 3.55, 0.35, 0, C.amber);

  // the CRD that generates the scrape config
  box(s, 5.9, 4.9, 2.9, 1.0, "ServiceMonitor", "a CRD, not Kubernetes", C.purple);
  arrow(s, 7.35, 4.85, 0, -0.6, C.purple, null, true);
  s.addText("the operator generates\nthe scrape config", { x: 8.95, y: 4.95, w: 3.6, h: 0.9,
    fontFace: F.body, fontSize: 10.5, color: C.codetx, valign: "middle", margin: 0, lineSpacing: 13 });

  s.addShape("roundRect", { x: 0.75, y: 4.9, w: 4.85, h: 1.0, fill: { color: C.navy2 },
    line: { color: C.red, width: 2 }, rectRadius: 0.1 });
  s.addText("MISSING ≠ DOWN", { x: 0.85, y: 4.98, w: 4.65, h: 0.36, fontFace: F.head,
    fontSize: 12, bold: true, color: C.red, align: "center", margin: 0 });
  s.addText("down = tried and failed.   missing = never selected.",
    { x: 0.85, y: 5.34, w: 4.65, h: 0.5, fontFace: F.body, fontSize: 10.5, color: C.codetx,
      align: "center", valign: "middle", margin: 0 });

  kicker(s, "No release label → Prometheus ignores the object. Valid YAML, zero targets.");
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// ---------------------------------------------------------------------------
// 9. ALERT FLOW — Prometheus decides WHETHER, Alertmanager decides WHO
// ---------------------------------------------------------------------------
function dAlertFlow(pres, o) {
  const s = L.newSlide(pres, false);
  L.chip(s, o.chip, C.teal); L.heading(s, o.title, false);

  box(s, 0.75, 2.9, 2.3, 1.15, "Prometheus", "evaluates the rule", C.navy3);
  s.addText("WHETHER", { x: 0.75, y: 2.5, w: 2.3, h: 0.34, fontFace: F.head, fontSize: 11,
    bold: true, color: C.muted, align: "center", margin: 0 });

  box(s, 4.0, 2.9, 3.1, 1.15, "Alertmanager", null, C.teal);
  s.addText("WHO, and HOW OFTEN", { x: 4.0, y: 2.5, w: 3.1, h: 0.34, fontFace: F.head,
    fontSize: 11, bold: true, color: C.muted, align: "center", margin: 0 });
  arrow(s, 3.1, 3.47, 0.8, 0, C.amberD, "firing");

  const mech = [
    ["GROUP",   "8 pods, 1 fault → 1 notification"],
    ["INHIBIT", "root symptom suppresses the derived ones"],
    ["THROTTLE","repeatInterval stops a 4-hour page storm"],
    ["ROUTE",   "match on labels → the team that can act"],
  ];
  mech.forEach(([k, v], i) => {
    const y = 4.35 + i * 0.52;
    s.addShape("roundRect", { x: 4.0, y, w: 1.35, h: 0.42, fill: { color: C.navy3 },
      line: { color: C.navy3 }, rectRadius: 0.06 });
    s.addText(k, { x: 4.0, y, w: 1.35, h: 0.42, fontFace: F.head, fontSize: 10, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0 });
    s.addText(v, { x: 5.5, y, w: 4.0, h: 0.42, fontFace: F.body, fontSize: 10.5, color: C.ink,
      valign: "middle", margin: 0 });
  });

  // A spine from the Alertmanager box to the fan-out point, so the arrows are
  // visibly connected to what produces them.
  s.addShape("line", { x: 7.15, y: 3.47, w: 2.4, h: 0, line: { color: C.muted, width: 2 } });
  const recv = [["payments-oncall", C.red, 2.6], ["finance-ops", C.amberD, 3.5],
                ["risk-team", C.purple, 4.4], ["platform", C.teal, 5.3]];
  recv.forEach(([n, col, y]) => {
    s.addShape("roundRect", { x: 10.15, y, w: 2.45, h: 0.62, fill: { color: col },
      line: { color: col }, rectRadius: 0.08 });
    s.addText(n, { x: 10.15, y, w: 2.45, h: 0.62, fontFace: F.body, fontSize: 11, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0 });
    arrow(s, 9.6, 3.47, 0.45, y + 0.31 - 3.47, col);
  });

  kicker(s, "alert-sink proves the routing. A route that matches too broadly looks correct until 03:00.", C.teal);
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// ---------------------------------------------------------------------------
// 10. LOG PIPELINE — labels are indexed, content is scanned
// ---------------------------------------------------------------------------
function dLogs(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);

  box(s, 0.75, 2.6, 2.2, 1.1, "pod", "JSON to stdout", C.navy3);
  box(s, 3.4, 2.6, 2.2, 1.1, "the NODE", "/var/log/pods", C.navy3);
  box(s, 6.05, 2.6, 2.4, 1.1, "Alloy", "DaemonSet — one per node", C.teal);
  box(s, 8.9, 2.6, 1.9, 1.1, "Loki", null, C.green);
  box(s, 11.25, 2.6, 1.3, 1.1, "Grafana", null, C.navy3);
  arrow(s, 3.0, 3.15, 0.35, 0, C.amber);
  arrow(s, 5.65, 3.15, 0.35, 0, C.amber);
  arrow(s, 8.5, 3.15, 0.35, 0, C.amber);
  arrow(s, 10.85, 3.15, 0.35, 0, C.amber);

  s.addShape("roundRect", { x: 0.75, y: 4.25, w: 5.75, h: 1.75, fill: { color: C.navy2 },
    line: { color: C.green, width: 2 }, rectRadius: 0.1 });
  s.addText("LABELS — indexed, must be BOUNDED", { x: 0.9, y: 4.35, w: 5.45, h: 0.36,
    fontFace: F.head, fontSize: 12, bold: true, color: C.green, align: "center", margin: 0 });
  s.addText("namespace · service · pod · container · node\n\n{namespace=\"axispay-core\"}  ← index lookup",
    { x: 0.9, y: 4.72, w: 5.45, h: 1.2, fontFace: F.mono, fontSize: 10.5, color: C.codetx,
      align: "center", valign: "middle", margin: 0, lineSpacing: 14 });

  s.addShape("roundRect", { x: 6.85, y: 4.25, w: 5.7, h: 1.75, fill: { color: C.navy2 },
    line: { color: C.amber, width: 2 }, rectRadius: 0.1 });
  s.addText("BODY — scanned, may be UNBOUNDED", { x: 7.0, y: 4.35, w: 5.4, h: 0.36,
    fontFace: F.head, fontSize: 12, bold: true, color: C.amber, align: "center", margin: 0 });
  s.addText("correlation_id · payment_id · merchant_id\n\n| json | correlation_id=\"...\"  ← a scan",
    { x: 7.0, y: 4.72, w: 5.4, h: 1.2, fontFace: F.mono, fontSize: 10.5, color: C.codetx,
      align: "center", valign: "middle", margin: 0, lineSpacing: 14 });

  kicker(s, "correlation_id as a LABEL = one stream per request = 1.7 million streams a day.", C.red);
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// ---------------------------------------------------------------------------
// 11. THE WEEK — one arc, closing slide
// ---------------------------------------------------------------------------
function dWeek(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);

  const days = [
    ["MON", "Deploy it", "namespaces · pods\ndeployments · services", C.navy3],
    ["TUE", "Keep it up", "resources · probes\nscaling · rollouts", C.navy3],
    ["WED", "Give it memory", "volumes · databases\nconfig · secrets", C.navy3],
    ["THU", "Let the world in", "services · DNS · ingress\nnetwork policy", C.navy3],
    ["FRI", "Run it", "identity · packaging\nobservability", C.teal],
  ];
  const w = 2.28, gap = 0.19, x0 = 0.75;
  days.forEach(([d, t, sub, col], i) => {
    const x = x0 + i * (w + gap);
    s.addShape("roundRect", { x, y: 2.5, w, h: 2.55, fill: { color: col }, line: { color: col }, rectRadius: 0.1 });
    s.addText(d, { x, y: 2.62, w, h: 0.36, fontFace: F.head, fontSize: 12, bold: true,
      color: C.amber, align: "center", margin: 0 });
    s.addText(t, { x: x + 0.08, y: 3.0, w: w - 0.16, h: 0.6, fontFace: F.head, fontSize: 14,
      bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    s.addText(sub, { x: x + 0.1, y: 3.6, w: w - 0.2, h: 1.3, fontFace: F.body, fontSize: 10,
      color: C.codetx, align: "center", valign: "top", margin: 0, lineSpacing: 13 });
    if (i < 4) s.addShape("line", { x: x + w + 0.02, y: 3.78, w: gap - 0.04, h: 0,
      line: { color: C.amber, width: 2, endArrowType: "triangle" } });
  });

  s.addShape("roundRect", { x: 0.75, y: 5.35, w: 11.83, h: 0.85, fill: { color: C.navy2 },
    line: { color: C.amber, width: 2 }, rectRadius: 0.1 });
  s.addText("ONE application, extended every day. Nothing thrown away. The correlation ID you wrote on Monday is what finds the slow service on Friday.",
    { x: 0.85, y: 5.35, w: 11.63, h: 0.85, fontFace: F.body, fontSize: 13, bold: true,
      color: C.amber, align: "center", valign: "middle", margin: 0 });

  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

module.exports = { box, arrow, kicker, dIdentity, dRBAC, dHelm, dTLSAuth,
                   dHelmDeps, dKubeadmUpgrade, dPromotion, dScrape,
                   dAlertFlow, dLogs, dWeek };
