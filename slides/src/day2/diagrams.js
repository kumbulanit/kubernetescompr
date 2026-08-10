// ============================================================================
// Native PowerPoint diagrams — real shapes, editable in the deck.
// (The brief requires PowerPoint-editable diagrams, so these are not images.)
// ============================================================================
const L = require("./lib.js");
const { C, F, W, H, M } = L;

function box(s, x, y, w, h, title, sub, fill, txt) {
  s.addShape("roundRect", { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.08 });
  s.addText(title, { x: x + 0.08, y: sub ? y + 0.12 : y, w: w - 0.16, h: sub ? h * 0.46 : h,
    fontFace: F.head, fontSize: 14, bold: true, color: txt || C.white, align: "center",
    valign: "middle", margin: 0 });
  if (sub) s.addText(sub, { x: x + 0.08, y: y + h * 0.5, w: w - 0.16, h: h * 0.44,
    fontFace: F.body, fontSize: 10.5, color: txt || C.codetx, align: "center", valign: "middle",
    margin: 0, italic: true });
}
function arrow(s, x, y, w, h, colour, label, flip) {
  s.addShape("line", { x, y, w, h, line: { color: colour || C.teal, width: 2, endArrowType: "triangle" }, flipV: !!flip });
  if (label) s.addText(label, { x: x - 0.5, y: y + h / 2 - 0.42, w: Math.max(w, 1.6) + 1.0, h: 0.34,
    fontFace: F.body, fontSize: 10, bold: true, color: colour || C.teal, align: "center", margin: 0 });
}

// --- reconciliation loop ----------------------------------------------------
function dReconcile(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  box(s, 0.9, 2.35, 3.2, 1.5, "spec", "DESIRED — what you wrote", C.navy3);
  s.addText("replicas: 3", { x: 0.9, y: 3.55, w: 3.2, h: 0.35, fontFace: F.mono, fontSize: 12,
    color: C.amber, align: "center", margin: 0 });
  box(s, 5.1, 2.35, 3.1, 1.5, "CONTROLLER", "observe → diff → act", C.teal);
  s.addText("forever", { x: 5.1, y: 3.55, w: 3.1, h: 0.35, fontFace: F.body, fontSize: 11,
    color: C.white, align: "center", italic: true, margin: 0 });
  box(s, 9.2, 2.35, 3.2, 1.5, "status", "ACTUAL — what is", C.navy3);
  s.addText("readyReplicas: 2", { x: 9.2, y: 3.55, w: 3.2, h: 0.35, fontFace: F.mono, fontSize: 12,
    color: C.red, align: "center", margin: 0 });
  arrow(s, 4.15, 3.05, 0.9, 0, C.amber, "reads");
  arrow(s, 9.15, 3.05, -0.9, 0, C.amber, "reads");
  s.addShape("roundRect", { x: 4.85, y: 4.9, w: 3.6, h: 0.85, fill: { color: C.green }, line: { color: C.green }, rectRadius: 0.08 });
  s.addText("ACT — create 1 pod", { x: 4.85, y: 4.9, w: 3.6, h: 0.85, fontFace: F.head,
    fontSize: 14, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
  arrow(s, 6.65, 3.9, 0, 0.95, C.green, "spec ≠ status");
  s.addShape("line", { x: 8.45, y: 5.32, w: 2.35, h: 0, line: { color: C.green, width: 2 } });
  s.addShape("line", { x: 10.8, y: 3.9, w: 0, h: 1.42, line: { color: C.green, width: 2, endArrowType: "triangle" }, flipV: true });
  s.addText("changes the world", { x: 8.5, y: 5.38, w: 2.3, h: 0.3, fontFace: F.body, fontSize: 10,
    color: C.green, align: "center", margin: 0 });
  s.addText("Every controller in Kubernetes is this one loop with a different spec.",
    { x: M, y: 6.3, w: W - 2 * M, h: 0.45, fontFace: F.body, fontSize: 15, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- cluster architecture ---------------------------------------------------
function dCluster(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  s.addShape("roundRect", { x: 0.7, y: 1.95, w: 6.5, h: 3.5, fill: { color: C.navy2 },
    line: { color: C.teal }, rectRadius: 0.1 });
  s.addText("CONTROL PLANE", { x: 0.85, y: 2.05, w: 6.2, h: 0.3, fontFace: F.body, fontSize: 10,
    bold: true, color: C.teal, charSpacing: 1.5, margin: 0 });
  box(s, 0.95, 2.45, 3.0, 1.15, "kube-apiserver", "the only door", C.navy3);
  box(s, 4.1, 2.45, 2.95, 1.15, "etcd", "the only truth", C.purple);
  box(s, 0.95, 3.78, 3.0, 1.15, "kube-scheduler", "decides WHERE", C.navy3);
  box(s, 4.1, 3.78, 2.95, 1.15, "controller-mgr", "runs the loops", C.navy3);
  s.addShape("roundRect", { x: 7.55, y: 1.95, w: 5.1, h: 3.5, fill: { color: C.navy2 },
    line: { color: C.green }, rectRadius: 0.1 });
  s.addText("EVERY NODE", { x: 7.7, y: 2.05, w: 4.8, h: 0.3, fontFace: F.body, fontSize: 10,
    bold: true, color: C.green, charSpacing: 1.5, margin: 0 });
  box(s, 7.8, 2.45, 4.6, 0.85, "kubelet", "makes pods real · runs probes", C.navy3);
  box(s, 7.8, 3.42, 4.6, 0.78, "kube-proxy", "programs Service routing", C.navy3);
  box(s, 7.8, 4.32, 2.2, 0.72, "containerd", "CRI", C.navy3);
  box(s, 10.2, 4.32, 2.2, 0.72, "Calico", "CNI", C.navy3);
  s.addShape("roundRect", { x: 0.95, y: 5.75, w: 2.4, h: 0.6, fill: { color: C.amberD }, line: { color: C.amberD }, rectRadius: 0.08 });
  s.addText("kubectl", { x: 0.95, y: 5.75, w: 2.4, h: 0.6, fontFace: F.head, fontSize: 14,
    bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
  arrow(s, 2.15, 5.72, 0, -2.1, C.amber, null, true);
  arrow(s, 3.95, 3.02, 0.15, 0, C.purple);
  arrow(s, 2.45, 3.78, 0, -0.16, C.teal, null, true);
  arrow(s, 5.57, 3.78, 0, -0.16, C.teal, null, true);
  arrow(s, 7.75, 2.87, -0.7, 0, C.green);
  s.addText("Every arrow points at the API server. Components never talk to each other.",
    { x: M, y: 6.55, w: W - 2 * M, h: 0.4, fontFace: F.body, fontSize: 15, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- ownership chain --------------------------------------------------------
function dOwnership(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  box(s, 4.55, 1.95, 4.2, 0.95, "Deployment", "payment-service", C.teal);
  box(s, 1.6, 3.25, 3.5, 0.95, "ReplicaSet  -7d4f9c8b6", "replicas: 3  ← current", C.green);
  box(s, 8.2, 3.25, 3.5, 0.95, "ReplicaSet  -6c9d4b7f5", "replicas: 0  ← previous", "3A4552");
  ["x7k2p", "m9v4t", "p2n8w"].forEach((n, i) =>
    box(s, 0.75 + i * 1.62, 4.85, 1.45, 0.8, "Pod", n, C.navy3));
  box(s, 5.55, 4.85, 1.9, 0.8, "Pod deleted", "✗", "5A2A2A");
  box(s, 7.75, 4.85, 2.0, 0.8, "Pod -k4j8w", "new, ~8s", C.green);
  arrow(s, 5.4, 2.92, -1.5, 0.3, C.teal, "owns");
  arrow(s, 7.9, 2.92, 1.6, 0.3, "5A6674", "owns");
  arrow(s, 2.2, 4.22, -0.5, 0.6, C.green);
  arrow(s, 3.35, 4.22, 0.0, 0.6, C.green);
  arrow(s, 4.4, 4.22, 0.6, 0.6, C.green);
  arrow(s, 4.1, 4.22, 4.3, 0.6, C.amber, "observes 2 ≠ 3 → creates replacement");
  s.addText("A Deployment never creates a Pod. It manages ReplicaSets — and that is exactly how rollback works.",
    { x: M, y: 6.2, w: W - 2 * M, h: 0.5, fontFace: F.body, fontSize: 14.5, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- service selection ------------------------------------------------------
function dService(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  box(s, 0.7, 3.1, 2.15, 1.0, "edge-gateway", "caller", C.navy3);
  box(s, 3.15, 2.05, 2.6, 1.0, "CoreDNS", "name → 10.96.14.22", C.purple);
  box(s, 3.15, 3.55, 2.6, 1.15, "Service", "ClusterIP + SELECTOR", C.teal);
  box(s, 6.15, 3.55, 2.9, 1.15, "EndpointSlice", "written by the controller", C.green);
  ["10.244.1.5", "10.244.2.7", "10.244.2.9"].forEach((ip, i) =>
    box(s, 9.5, 2.35 + i * 1.12, 2.95, 0.88, "Pod", ip, C.navy3));
  arrow(s, 2.9, 3.35, 0.2, -0.85, C.purple);
  s.addText("1. resolve", { x: 0.7, y: 2.5, w: 2.15, h: 0.3, fontFace: F.body,
    fontSize: 10, bold: true, color: C.purple, align: "center", margin: 0 });
  arrow(s, 4.45, 3.05, 0, 0.45, C.purple);
  arrow(s, 5.8, 4.12, 0.3, 0, C.teal);
  s.addText("2. selects by LABEL", { x: 4.55, y: 3.16, w: 3.1, h: 0.3, fontFace: F.body,
    fontSize: 10, bold: true, color: C.teal, align: "center", margin: 0 });
  arrow(s, 9.1, 4.05, 0.35, -0.9, C.green);
  arrow(s, 9.1, 4.12, 0.35, 0.0, C.green);
  arrow(s, 9.1, 4.2, 0.35, 0.9, C.green);
  s.addShape("roundRect", { x: 5.95, y: 5.15, w: 3.1, h: 0.72, fill: { color: "5A2A2A" }, line: { color: C.red }, rectRadius: 0.08 });
  s.addText("label changed → silently drops out", { x: 6.0, y: 5.15, w: 3.0, h: 0.72,
    fontFace: F.body, fontSize: 10.5, color: C.white, align: "center", valign: "middle", margin: 0 });
  arrow(s, 7.5, 5.12, 0, -0.28, C.red, null, true);
  s.addText("A Service does not CONTAIN pods. It SELECTS them, continuously, by label.",
    { x: M, y: 6.25, w: W - 2 * M, h: 0.45, fontFace: F.body, fontSize: 15, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- pod anatomy ------------------------------------------------------------
function dPod(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  s.addShape("roundRect", { x: 2.6, y: 2.0, w: 8.2, h: 3.55, fill: { color: C.navy2 },
    line: { color: C.teal }, rectRadius: 0.12 });
  s.addText("POD — one IP · one lifecycle · always one node", { x: 2.75, y: 2.1, w: 7.9, h: 0.32,
    fontFace: F.body, fontSize: 11, bold: true, color: C.teal, charSpacing: 1, margin: 0 });
  box(s, 2.9, 2.55, 2.4, 1.15, "pause", "holds the namespaces", "3A4552");
  box(s, 5.45, 2.55, 2.4, 1.15, "initContainer", "runs first (Day 3)", C.amberD);
  box(s, 8.0, 2.55, 2.55, 1.15, "sidecar", "log shipper (Day 5)", C.purple);
  box(s, 2.9, 3.85, 5.0, 1.05, "payment-service  :8080", "your application", C.green);
  box(s, 8.0, 3.85, 2.55, 1.05, "volume", "shared", C.navy3);
  s.addText("localhost", { x: 7.85, y: 4.15, w: 0.9, h: 0.3, fontFace: F.mono, fontSize: 9,
    color: C.amber, align: "center", margin: 0 });
  s.addShape("roundRect", { x: 0.7, y: 3.3, w: 1.6, h: 0.9, fill: { color: C.navy3 }, line: { color: C.navy3 }, rectRadius: 0.08 });
  s.addText("Node\nm02", { x: 0.7, y: 3.3, w: 1.6, h: 0.9, fontFace: F.head, fontSize: 13,
    bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
  arrow(s, 2.35, 3.75, 0.2, 0, C.teal);
  s.addText("The Pod is the smallest thing Kubernetes will schedule — never a container on its own.",
    { x: M, y: 5.9, w: W - 2 * M, h: 0.45, fontFace: F.body, fontSize: 15, bold: true,
      color: C.amber, align: "center", margin: 0 });
  s.addText("The pause container holds the network namespace open, so your container can restart without the Pod losing its IP.",
    { x: M, y: 6.35, w: W - 2 * M, h: 0.4, fontFace: F.body, fontSize: 12.5, color: C.codetx,
      align: "center", italic: true, margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- triage loop ------------------------------------------------------------
function dTriage(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.red); L.heading(s, o.title, true);
  const steps = [
    ["1", "DESIRED?", "kubectl get -o yaml"],
    ["2", "ACTUAL?", "kubectl get pods -o wide"],
    ["3", "CLUSTER says?", "describe / get events"],
    ["4", "APP says?", "logs --previous"],
    ["5", "From INSIDE?", "exec / debug / port-forward"],
    ["6", "What CHANGED?", "rollout history / git diff"],
  ];
  steps.forEach((st, i) => {
    const x = 0.62 + i * 2.06;
    s.addShape("roundRect", { x, y: 2.3, w: 1.88, h: 2.15, fill: { color: C.navy2 },
      line: { color: i === 2 ? C.amber : C.navy3 }, rectRadius: 0.1 });
    s.addShape("ellipse", { x: x + 0.66, y: 2.48, w: 0.56, h: 0.56,
      fill: { color: i === 2 ? C.amber : C.teal }, line: { color: i === 2 ? C.amber : C.teal } });
    s.addText(st[0], { x: x + 0.66, y: 2.48, w: 0.56, h: 0.56, fontFace: F.head, fontSize: 18,
      bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    s.addText(st[1], { x: x + 0.1, y: 3.15, w: 1.68, h: 0.5, fontFace: F.head, fontSize: 13,
      bold: true, color: C.white, align: "center", margin: 0 });
    s.addText(st[2], { x: x + 0.1, y: 3.66, w: 1.68, h: 0.7, fontFace: F.mono, fontSize: 8.5,
      color: C.codetx, align: "center", margin: 0 });
    if (i < 5) s.addShape("line", { x: x + 1.9, y: 3.35, w: 0.14, h: 0,
      line: { color: C.teal, width: 2, endArrowType: "triangle" } });
  });
  ["FIX", "VERIFY", "WHAT WOULD HAVE CAUGHT IT?"].forEach((t, i) => {
    const w = i === 2 ? 4.6 : 2.4, x = 0.62 + (i === 0 ? 0 : i === 1 ? 2.75 : 5.5);
    s.addShape("roundRect", { x, y: 4.95, w, h: 0.72,
      fill: { color: i === 0 ? C.navy3 : i === 1 ? C.green : C.purple },
      line: { color: i === 0 ? C.navy3 : i === 1 ? C.green : C.purple }, rectRadius: 0.08 });
    s.addText(t, { x, y: 4.95, w, h: 0.72, fontFace: F.head, fontSize: 13, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0 });
  });
  s.addText("Work outside-in. Steps 1–3 always work; step 4 needs a container that actually started.",
    { x: M, y: 6.05, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 14.5, bold: true,
      color: C.amber, align: "center", margin: 0 });
  s.addText("You will use this loop eight more times this week — three of them simultaneously, on Friday.",
    { x: M, y: 6.45, w: W - 2 * M, h: 0.4, fontFace: F.body, fontSize: 12.5, color: C.codetx,
      align: "center", italic: true, margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

// --- request flow -----------------------------------------------------------
function dFlow(pres, o) {
  const s = L.newSlide(pres);
  L.chip(s, o.chip, o.chipColour); L.heading(s, o.title);
  const lanes = [["Merchant", C.muted], ["edge-gateway", C.teal], ["auth-service", C.teal],
                 ["payment-service", C.amberD], ["merchant-service", C.green]];
  lanes.forEach((ln, i) => {
    const x = 0.62 + i * 2.46;
    s.addShape("roundRect", { x, y: 2.0, w: 2.3, h: 0.62, fill: { color: ln[1] }, line: { color: ln[1] }, rectRadius: 0.08 });
    s.addText(ln[0], { x, y: 2.0, w: 2.3, h: 0.62, fontFace: F.head, fontSize: 12.5, bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0 });
    s.addShape("line", { x: x + 1.15, y: 2.68, w: 0, h: 3.3, line: { color: C.rule, width: 1, dashType: "dash" } });
  });
  const msgs = [
    [0, 1, "POST /charges + Bearer", 2.95],
    [1, 2, "verify token", 3.5],
    [2, 1, "merchant_id, scopes", 4.05],
    [1, 3, "POST /payments  (X-Correlation-Id)", 4.6],
    [3, 4, "GET /merchants + /pricing", 5.15],
    [3, 1, "201 {payment_id, reference}", 5.7],
  ];
  msgs.forEach(m => {
    const x1 = 0.62 + m[0] * 2.46 + 1.15, x2 = 0.62 + m[1] * 2.46 + 1.15;
    s.addShape("line", { x: Math.min(x1, x2), y: m[3], w: Math.abs(x2 - x1), h: 0,
      line: { color: x2 > x1 ? C.teal : C.green, width: 1.75,
              endArrowType: "triangle", beginArrowType: "none" }, flipH: x2 < x1 });
    s.addText(m[2], { x: Math.min(x1, x2), y: m[3] - 0.34, w: Math.abs(x2 - x1), h: 0.3,
      fontFace: F.body, fontSize: 10, color: C.ink, align: "center", margin: 0 });
  });
  s.addText("One merchant call. Four services. Every hop carries the same correlation ID — which is how you trace it on Friday.",
    { x: M, y: 6.3, w: W - 2 * M, h: 0.5, fontFace: F.body, fontSize: 13.5, bold: true,
      color: C.navy, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}
module.exports = { dReconcile, dCluster, dOwnership, dService, dPod, dTriage, dFlow, box, arrow };
