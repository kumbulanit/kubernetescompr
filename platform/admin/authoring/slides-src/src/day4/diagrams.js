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
  if (label) s.addText(label, { x: x - 0.5, y: y + h / 2 - 0.42, w: Math.max(Math.abs(w), 1.6) + 1.0, h: 0.34,
    fontFace: F.body, fontSize: 10, bold: true, color: colour || C.teal, align: "center", margin: 0 });
}

function panel(s, x, y, w, h, title, colour) {
  s.addShape("roundRect", { x, y, w, h, fill: { color: C.navy2 }, line: { color: colour }, rectRadius: 0.1 });
  s.addText(title, { x: x + 0.12, y: y + 0.1, w: w - 0.24, h: 0.3, fontFace: F.body, fontSize: 10.5,
    bold: true, color: colour, charSpacing: 1.0, align: "center", margin: 0 });
}
function tag(s, x, y, w, h, text, fill, txt) {
  s.addShape("roundRect", { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.06 });
  s.addText(text, { x, y, w, h, fontFace: F.body, fontSize: 10, bold: true, color: txt || C.white,
    align: "center", valign: "middle", margin: 0 });
}

function dServiceTypes(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);

  panel(s, 0.62, 2.0, 3.95, 3.65, "CLUSTERIP", C.teal);
  box(s, 0.95, 3.15, 1.05, 0.78, "web-app", "client", C.navy3);
  box(s, 2.28, 3.05, 1.3, 0.95, "Service", "10.96.0.25", C.teal);
  box(s, 3.83, 2.55, 0.55, 0.72, "Pod", "a", C.green);
  box(s, 3.83, 3.45, 0.55, 0.72, "Pod", "b", C.green);
  arrow(s, 2.02, 3.52, 0.22, 0, C.teal);
  arrow(s, 3.6, 3.48, 0.18, -0.5, C.green);
  arrow(s, 3.6, 3.52, 0.18, 0.5, C.green);
  s.addText("inside the cluster only", { x: 0.85, y: 4.92, w: 3.45, h: 0.28, fontFace: F.body, fontSize: 10.5,
    italic: true, color: C.codetx, align: "center", margin: 0 });

  panel(s, 4.7, 2.0, 3.95, 3.65, "NODEPORT", C.amber);
  box(s, 6.0, 2.33, 1.25, 0.72, "browser", "external", C.navy3);
  box(s, 4.98, 3.1, 1.05, 0.82, "node-a", ":30080", C.amberD);
  box(s, 4.98, 4.05, 1.05, 0.82, "node-b", ":30080", C.amberD);
  box(s, 6.48, 3.55, 1.2, 0.92, "Service", "nodePort", C.teal);
  box(s, 7.95, 3.12, 0.5, 0.7, "Pod", "a", C.green);
  box(s, 7.95, 4.02, 0.5, 0.7, "Pod", "b", C.green);
  arrow(s, 6.63, 3.02, -0.55, 0.45, C.amber, "same port");
  arrow(s, 6.63, 3.02, -0.55, 1.35, C.amber);
  arrow(s, 6.08, 3.5, 0.35, 0.35, C.teal);
  arrow(s, 6.08, 4.3, 0.35, -0.18, C.teal);
  arrow(s, 7.73, 3.98, 0.17, -0.45, C.green);
  arrow(s, 7.73, 4.02, 0.17, 0.35, C.green);
  s.addText("every node listens, even if no pod runs there", { x: 4.95, y: 4.92, w: 3.45, h: 0.28, fontFace: F.body, fontSize: 10,
    italic: true, color: C.codetx, align: "center", margin: 0 });

  panel(s, 8.78, 2.0, 3.95, 3.65, "LOADBALANCER", C.green);
  box(s, 10.08, 2.33, 1.25, 0.72, "browser", "external", C.navy3);
  box(s, 9.52, 3.12, 2.0, 0.82, "cloud LB", "203.0.113.10", C.purple);
  box(s, 9.95, 4.12, 1.15, 0.82, "Service", "ClusterIP", C.teal);
  box(s, 11.85, 3.12, 0.5, 0.72, "Pod", "a", C.green);
  box(s, 11.85, 4.02, 0.5, 0.72, "Pod", "b", C.green);
  arrow(s, 10.65, 3.0, -0.02, 0.08, C.green, "public IP");
  arrow(s, 10.45, 3.96, 0, 0.12, C.teal);
  arrow(s, 11.15, 4.43, 0.65, -0.72, C.green);
  arrow(s, 11.15, 4.43, 0.65, 0.18, C.green);
  s.addText("external address provisioned for you", { x: 9.05, y: 4.92, w: 3.35, h: 0.28, fontFace: F.body, fontSize: 10.5,
    italic: true, color: C.codetx, align: "center", margin: 0 });

  s.addText("A Service abstraction stays the same; only the way clients REACH it changes.",
    { x: M, y: 6.28, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 15, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

function dIngressController(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);

  box(s, 0.85, 2.55, 3.0, 2.15, "Ingress", "rules only", C.purple);
  s.addText("host: frontend.example.com\n/api → checkout-api\nTLS: web-tls", {
    x: 1.12, y: 3.15, w: 2.46, h: 1.1, fontFace: F.mono, fontSize: 10, color: C.white,
    align: "center", valign: "middle", margin: 0
  });
  tag(s, 1.15, 2.05, 2.4, 0.38, "without controller → ADDRESS: <pending>", C.red);

  box(s, 5.15, 2.75, 2.8, 1.55, "Ingress Controller", "nginx / traefik", C.teal);
  tag(s, 5.4, 2.32, 2.3, 0.38, "with controller → ADDRESS: 203.0.113.10", C.green);
  box(s, 9.1, 2.55, 1.75, 0.9, "Service", "frontend", C.green);
  box(s, 9.1, 4.05, 1.75, 0.9, "Service", "checkout-api", C.green);
  box(s, 11.2, 2.55, 1.0, 0.78, "Pod", "web", C.navy3);
  box(s, 11.2, 4.05, 1.0, 0.78, "Pod", "api", C.navy3);
  box(s, 4.95, 5.0, 3.15, 0.72, "proxy listens on 80/443 and forwards by rule", null, C.navy3);
  box(s, 5.85, 1.75, 1.45, 0.4, "browser", null, C.navy3);

  arrow(s, 3.95, 3.63, 1.1, 0, C.purple, "watches");
  arrow(s, 6.55, 2.18, 0, 0.14, C.teal);
  s.addText("traffic", { x: 6.8, y: 2.13, w: 1.0, h: 0.24, fontFace: F.body, fontSize: 10,
    bold: true, color: C.teal, margin: 0 });
  arrow(s, 7.98, 3.28, 1.02, -0.2, C.green, "host");
  arrow(s, 7.98, 3.78, 1.02, 0.6, C.green, "path");
  arrow(s, 10.9, 3.0, 0.25, 0, C.green);
  arrow(s, 10.9, 4.5, 0.25, 0, C.green);

  s.addText("Ingress is desired routing STATE. The controller is the component that actually accepts traffic.",
    { x: M, y: 6.28, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 15, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

function dNetworkPolicyMode(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);

  panel(s, 0.72, 2.1, 5.7, 3.5, "NO POLICY SELECTS backend", C.green);
  box(s, 2.82, 3.2, 1.5, 1.0, "backend", ":8080", C.teal);
  box(s, 1.1, 2.45, 1.25, 0.72, "frontend", null, C.navy3);
  box(s, 1.1, 4.38, 1.25, 0.72, "batch-job", null, C.navy3);
  box(s, 4.78, 2.45, 1.25, 0.72, "debug-pod", null, C.navy3);
  arrow(s, 2.38, 2.82, 0.38, 0.62, C.green);
  arrow(s, 2.38, 4.72, 0.38, -0.62, C.green);
  arrow(s, 4.67, 2.82, -0.28, 0.62, C.green);
  s.addText("every source can connect", { x: 2.0, y: 4.86, w: 2.95, h: 0.28, fontFace: F.body, fontSize: 10.5,
    italic: true, color: C.codetx, align: "center", margin: 0 });

  panel(s, 6.9, 2.1, 5.7, 3.5, "POLICY SELECTS backend", C.red);
  box(s, 9.0, 3.2, 1.5, 1.0, "backend", ":8080", C.teal);
  box(s, 8.58, 2.35, 2.35, 0.62, "NetworkPolicy", "allow tcp/8080 from frontend", C.purple);
  box(s, 7.28, 2.45, 1.25, 0.72, "frontend", null, C.navy3);
  box(s, 7.28, 4.38, 1.25, 0.72, "batch-job", null, C.navy3);
  box(s, 10.95, 2.45, 1.25, 0.72, "debug-pod", null, C.navy3);
  arrow(s, 8.56, 2.82, 0.38, 0.62, C.green, "allowed");
  s.addShape("line", { x: 8.56, y: 4.72, w: 0.38, h: -0.62, line: { color: C.red, width: 2, endArrowType: "triangle" } });
  s.addShape("line", { x: 11.05, y: 2.82, w: -0.5, h: 0.62, line: { color: C.red, width: 2, endArrowType: "triangle" } });
  s.addText("blocked", { x: 7.7, y: 4.16, w: 1.05, h: 0.25, fontFace: F.body, fontSize: 10, bold: true, color: C.red, align: "center", margin: 0 });
  s.addText("blocked", { x: 10.45, y: 3.1, w: 1.05, h: 0.25, fontFace: F.body, fontSize: 10, bold: true, color: C.red, align: "center", margin: 0 });

  s.addText("The first selecting policy flips a pod from open-by-default to allow-list-only.",
    { x: M, y: 6.28, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 15, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

function dAffinityTypes(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);

  panel(s, 0.72, 2.0, 5.75, 3.7, "NODEAFFINITY", C.teal);
  box(s, 2.1, 2.35, 2.95, 0.8, "gpu-workload", "needs accelerator In [nvidia]", C.purple);
  box(s, 1.05, 3.45, 2.05, 1.35, "node-a", "labels: accelerator=nvidia\nzone=west", C.green);
  box(s, 4.05, 3.45, 2.05, 1.35, "node-b", "labels: zone=east", C.navy3);
  arrow(s, 3.52, 3.1, -1.3, 0.48, C.green);
  s.addText("label match", { x: 1.6, y: 3.14, w: 1.6, h: 0.24, fontFace: F.body, fontSize: 10,
    bold: true, color: C.green, align: "center", margin: 0 });
  s.addShape("line", { x: 4.68, y: 3.1, w: 0.38, h: 0.48, line: { color: C.red, width: 2, endArrowType: "triangle" } });
  s.addText("no match", { x: 4.85, y: 3.42, w: 1.1, h: 0.22, fontFace: F.body, fontSize: 10, bold: true, color: C.red, align: "center", margin: 0 });
  s.addText("scheduler reads NODE labels", { x: 1.55, y: 5.02, w: 3.95, h: 0.28, fontFace: F.body, fontSize: 10.5,
    italic: true, color: C.codetx, align: "center", margin: 0 });

  panel(s, 6.85, 2.0, 5.75, 3.7, "POD ANTI-AFFINITY", C.amber);
  box(s, 8.22, 2.35, 3.0, 0.8, "web-app", "anti-affinity: app=web-app on hostname", C.purple);
  box(s, 7.2, 3.45, 2.05, 1.35, "node-a", "existing pod:\napp=web-app", C.red);
  box(s, 10.2, 3.45, 2.05, 1.35, "node-b", "existing pod:\napp=cache", C.green);
  s.addShape("line", { x: 9.1, y: 3.1, w: -1.0, h: 0.48, line: { color: C.red, width: 2, endArrowType: "triangle" } });
  arrow(s, 9.35, 3.1, 1.0, 0.48, C.green);
  s.addText("allowed", { x: 8.7, y: 3.18, w: 1.3, h: 0.22, fontFace: F.body, fontSize: 10, bold: true, color: C.green, align: "center", margin: 0 });
  s.addText("scheduler reads labels on OTHER PODS", { x: 7.65, y: 5.02, w: 3.95, h: 0.28, fontFace: F.body, fontSize: 10.5,
    italic: true, color: C.codetx, align: "center", margin: 0 });

  s.addText("Node affinity asks 'which nodes fit me?'; pod anti-affinity asks 'who is already there?'.",
    { x: M, y: 6.28, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 15, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

function dTaintsTolerations(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);

  box(s, 4.92, 2.25, 3.55, 2.65, "gpu-node", "taint: accelerator=nvidia:NoSchedule", C.red);
  box(s, 1.15, 2.75, 1.6, 0.82, "web-app", "no toleration", C.navy3);
  box(s, 1.15, 4.08, 1.6, 0.82, "gpu-job", "tolerates accelerator=nvidia", C.green);
  s.addShape("line", { x: 2.82, y: 3.17, w: 2.0, h: 0, line: { color: C.red, width: 2, endArrowType: "triangle" } });
  arrow(s, 2.82, 4.5, 2.0, -0.05, C.green, "eligible");
  s.addText("blocked", { x: 3.15, y: 2.82, w: 1.0, h: 0.25, fontFace: F.body, fontSize: 10, bold: true, color: C.red, align: "center", margin: 0 });
  box(s, 9.28, 2.75, 2.3, 0.82, "NoSchedule", "block new pods", C.amberD);
  box(s, 9.28, 3.75, 2.3, 0.82, "PreferNoSchedule", "soft repel", C.amber);
  box(s, 9.28, 4.75, 2.3, 0.82, "NoExecute", "block + evict", C.red);
  s.addText("A toleration is a pass, not a preference.", { x: 4.7, y: 5.1, w: 4.0, h: 0.3,
    fontFace: F.body, fontSize: 10.5, italic: true, color: C.codetx, align: "center", margin: 0 });

  s.addText("The node says 'keep out' first; a toleration only removes that refusal for matching pods.",
    { x: M, y: 6.28, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 15, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

function dPdbDrain(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  tag(s, 5.0, 1.98, 3.3, 0.4, "PDB: minAvailable 2 for app=web-app", C.purple);

  panel(s, 0.72, 2.45, 3.8, 2.95, "1 · BEFORE DRAIN", C.green);
  box(s, 1.05, 3.1, 0.88, 0.7, "node-a", null, C.navy3);
  box(s, 2.18, 3.1, 0.88, 0.7, "node-b", null, C.navy3);
  box(s, 3.31, 3.1, 0.88, 0.7, "node-c", null, C.navy3);
  tag(s, 1.08, 3.98, 0.82, 0.36, "ready", C.green);
  tag(s, 2.21, 3.98, 0.82, 0.36, "ready", C.green);
  tag(s, 3.34, 3.98, 0.82, 0.36, "ready", C.green);
  s.addText("3 ready · 1 eviction allowed", { x: 1.0, y: 4.56, w: 3.2, h: 0.28, fontFace: F.body, fontSize: 10.5,
    italic: true, color: C.codetx, align: "center", margin: 0 });

  panel(s, 4.77, 2.45, 3.8, 2.95, "2 · FIRST EVICTION", C.amber);
  box(s, 5.1, 3.1, 0.88, 0.7, "node-a", null, C.red);
  box(s, 6.23, 3.1, 0.88, 0.7, "node-b", null, C.navy3);
  box(s, 7.36, 3.1, 0.88, 0.7, "node-c", null, C.navy3);
  tag(s, 5.13, 3.98, 0.82, 0.36, "evicted", C.red);
  tag(s, 6.26, 3.98, 0.82, 0.36, "ready", C.green);
  tag(s, 7.39, 3.98, 0.82, 0.36, "ready", C.green);
  box(s, 5.85, 4.45, 1.7, 0.52, "replacement Pending", null, C.amberD);
  s.addText("2 ready now · 0 disruptions left", { x: 5.05, y: 5.0, w: 3.2, h: 0.24, fontFace: F.body, fontSize: 10,
    italic: true, color: C.codetx, align: "center", margin: 0 });

  panel(s, 8.82, 2.45, 3.8, 2.95, "3 · SECOND EVICTION", C.red);
  box(s, 9.15, 3.1, 0.88, 0.7, "node-b", null, C.navy3);
  box(s, 10.28, 3.1, 0.88, 0.7, "node-c", null, C.navy3);
  box(s, 11.41, 3.1, 0.88, 0.7, "node-d", null, C.green);
  tag(s, 9.18, 3.98, 0.82, 0.36, "ready", C.green);
  tag(s, 10.31, 3.98, 0.82, 0.36, "ready", C.green);
  tag(s, 11.34, 4.42, 1.0, 0.36, "blocked by PDB", C.red);
  s.addShape("line", { x: 11.05, y: 3.45, w: 0.26, h: 0.72, line: { color: C.red, width: 2, endArrowType: "triangle" } });
  s.addText("drain waits until a replacement becomes Ready", { x: 9.0, y: 5.0, w: 3.45, h: 0.24, fontFace: F.body, fontSize: 10,
    italic: true, color: C.codetx, align: "center", margin: 0 });

  s.addText("A PDB does not stop maintenance; it forces maintenance to move one replica at a time.",
    { x: M, y: 6.28, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 15, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

module.exports = {
  dServiceTypes,
  dIngressController,
  dNetworkPolicyMode,
  dAffinityTypes,
  dTaintsTolerations,
  dPdbDrain,
  box,
  arrow,
};
