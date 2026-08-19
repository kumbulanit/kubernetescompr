// ============================================================================
// Native PowerPoint diagrams — real shapes, editable in the deck.
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
  if (label) s.addText(label, { x: x - 0.5, y: y + h / 2 - 0.42, w: Math.max(Math.abs(w), 1.6) + 1.0, h: 0.34,
    fontFace: F.body, fontSize: 10, bold: true, color: colour || C.teal, align: "center", margin: 0 });
}

function dConfigMap(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  box(s, 4.95, 1.95, 3.35, 0.92, "ConfigMap", "config-data", C.teal);
  // Outer Pod containers are drawn directly (not via box()) so the title
  // strip stays a fixed 0.42in and never grows to overlap the nested boxes.
  s.addShape("roundRect", { x: 0.75, y: 3.1, w: 4.05, h: 2.05, fill: { color: C.navy2 }, line: { color: C.navy2 }, rectRadius: 0.08 });
  s.addText("Pod A", { x: 0.83, y: 3.16, w: 3.89, h: 0.3, fontFace: F.head, fontSize: 14, bold: true, color: C.white, align: "center", margin: 0 });
  s.addText("web-app · env/envFrom", { x: 0.83, y: 3.44, w: 3.89, h: 0.26, fontFace: F.body, fontSize: 10.5, italic: true, color: C.codetx, align: "center", margin: 0 });
  s.addShape("roundRect", { x: 8.55, y: 3.1, w: 4.05, h: 2.05, fill: { color: C.navy2 }, line: { color: C.navy2 }, rectRadius: 0.08 });
  s.addText("Pod B", { x: 8.63, y: 3.16, w: 3.89, h: 0.3, fontFace: F.head, fontSize: 14, bold: true, color: C.white, align: "center", margin: 0 });
  s.addText("web-app · volumeMount", { x: 8.63, y: 3.44, w: 3.89, h: 0.26, fontFace: F.body, fontSize: 10.5, italic: true, color: C.codetx, align: "center", margin: 0 });
  box(s, 1.15, 3.85, 1.45, 0.72, "ENV", "LOG_LEVEL", C.amberD);
  box(s, 2.95, 3.85, 1.45, 0.72, "ENV", "DB_HOST", C.amberD);
  box(s, 8.95, 3.85, 1.3, 0.85, "FILE", "app.yaml", C.green);
  box(s, 10.45, 3.85, 1.7, 0.85, "FILE", "feature.flag", C.green);
  arrow(s, 6.05, 2.92, -2.7, 0.55, C.amber);
  arrow(s, 7.2, 2.92, 2.6, 0.55, C.green);
  s.addText("resolved at pod start", { x: 2.6, y: 2.55, w: 3.0, h: 0.3,
    fontFace: F.body, fontSize: 10, bold: true, color: C.amber, align: "center", margin: 0 });
  s.addText("files refreshed later", { x: 7.7, y: 2.55, w: 3.0, h: 0.3,
    fontFace: F.body, fontSize: 10, bold: true, color: C.green, align: "center", margin: 0 });
  s.addShape("roundRect", { x: 1.0, y: 5.38, w: 3.55, h: 0.62, fill: { color: "5A2A2A" }, line: { color: C.red }, rectRadius: 0.08 });
  s.addText("change ConfigMap → env stays stale", { x: 1.0, y: 5.38, w: 3.55, h: 0.62,
    fontFace: F.body, fontSize: 10.5, color: C.white, align: "center", valign: "middle", margin: 0 });
  s.addShape("roundRect", { x: 8.8, y: 5.38, w: 3.55, h: 0.62, fill: { color: C.green }, line: { color: C.green }, rectRadius: 0.08 });
  s.addText("change ConfigMap → files update", { x: 8.8, y: 5.38, w: 3.55, h: 0.62,
    fontFace: F.body, fontSize: 10.5, color: C.white, align: "center", valign: "middle", margin: 0 });
  s.addText("Same source object. Two delivery paths. Only the mounted-files path changes under a running pod.",
    { x: M, y: 6.35, w: W - 2 * M, h: 0.4, fontFace: F.body, fontSize: 14.5, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

function dSecretVsConfig(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  box(s, 1.0, 2.0, 4.1, 1.15, "ConfigMap", "web-config", C.teal);
  box(s, 8.2, 2.0, 4.1, 1.15, "Secret", "db-secret", C.red);
  box(s, 1.0, 3.45, 4.1, 1.35, "plain data keys", "HOST · PORT · FEATURE_FLAG", C.navy3);
  box(s, 8.2, 3.45, 4.1, 1.35, "sensitive keys", "username · password · tls.key", C.navy3);
  box(s, 4.95, 5.0, 3.3, 0.82, "Pod", "mount or inject selectively", C.green);
  arrow(s, 3.05, 4.92, 2.0, 0.08, C.teal, "non-confidential");
  arrow(s, 10.25, 4.92, -2.0, 0.08, C.red, "sensitive");
  s.addText("ConfigMap: readable config", { x: 1.25, y: 4.95, w: 3.6, h: 0.3, fontFace: F.body, fontSize: 10.5,
    color: C.teal, align: "center", bold: true, margin: 0 });
  s.addText("Secret: base64 data, tighter RBAC, encrypt etcd", { x: 8.35, y: 4.95, w: 3.8, h: 0.3, fontFace: F.body, fontSize: 10.2,
    color: C.red, align: "center", bold: true, margin: 0 });
  s.addText("Same API pattern. Different risk class. Secret changes WHO may read it; encryption at rest changes what a backup reveals.",
    { x: M, y: 6.3, w: W - 2 * M, h: 0.45, fontFace: F.body, fontSize: 14.3, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

function dPvPvc(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  box(s, 0.8, 3.0, 2.6, 1.2, "PersistentVolumeClaim", "request: 20Gi · RWO", C.teal);
  box(s, 4.15, 2.0, 2.8, 0.9, "StorageClass", "fast-ssd", C.purple);
  box(s, 4.15, 3.0, 2.8, 1.2, "PersistentVolume", "supply: real disk", C.green);
  box(s, 8.0, 3.0, 4.2, 1.2, "Pod", "database mounts /var/lib/data", C.navy2);
  arrow(s, 3.45, 3.6, 0.6, 0, C.amber, "binds");
  arrow(s, 5.55, 2.92, 0, 0.08, C.purple, "provisions");
  arrow(s, 7.0, 3.6, 0.9, 0, C.green, "mounted into");
  s.addShape("roundRect", { x: 0.95, y: 4.7, w: 2.3, h: 0.62, fill: { color: C.navy3 }, line: { color: C.navy3 }, rectRadius: 0.08 });
  s.addText("claim asks for capacity", { x: 0.95, y: 4.7, w: 2.3, h: 0.62, fontFace: F.body, fontSize: 10.5,
    color: C.white, align: "center", valign: "middle", margin: 0 });
  s.addShape("roundRect", { x: 4.4, y: 4.7, w: 2.3, h: 0.62, fill: { color: C.navy3 }, line: { color: C.navy3 }, rectRadius: 0.08 });
  s.addText("PV is the bound asset", { x: 4.4, y: 4.7, w: 2.3, h: 0.62, fontFace: F.body, fontSize: 10.5,
    color: C.white, align: "center", valign: "middle", margin: 0 });
  s.addShape("roundRect", { x: 8.95, y: 4.7, w: 2.3, h: 0.62, fill: { color: C.navy3 }, line: { color: C.navy3 }, rectRadius: 0.08 });
  s.addText("pod sees a filesystem", { x: 8.95, y: 4.7, w: 2.3, h: 0.62, fontFace: F.body, fontSize: 10.5,
    color: C.white, align: "center", valign: "middle", margin: 0 });
  s.addText("Applications claim storage. Kubernetes finds or creates it, binds it, then mounts it like ordinary disk.",
    { x: M, y: 6.3, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 14.5, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

function dWaitForFirstConsumer(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  box(s, 0.8, 2.0, 5.65, 3.55, "Immediate", "volume before scheduling", C.navy2);
  box(s, 6.9, 2.0, 5.65, 3.55, "WaitForFirstConsumer", "schedule first, provision second", C.navy2);
  box(s, 1.2, 2.65, 1.8, 0.82, "PVC", "created", C.teal);
  box(s, 3.55, 2.65, 1.8, 0.82, "PV", "zone-a", C.red);
  box(s, 2.4, 4.05, 1.8, 0.82, "Pod", "lands zone-b", C.amberD);
  arrow(s, 3.0, 3.05, 0.45, 0, C.red);
  arrow(s, 4.45, 3.47, -1.15, 0.52, C.red, "affinity conflict");
  box(s, 7.35, 2.65, 1.8, 0.82, "PVC", "created", C.teal);
  box(s, 9.65, 2.65, 1.8, 0.82, "Pod", "scheduled zone-b", C.amberD);
  box(s, 8.5, 4.05, 1.8, 0.82, "PV", "provisioned zone-b", C.green);
  arrow(s, 9.15, 3.05, 0.4, 0, C.amber, "scheduler first");
  arrow(s, 10.25, 3.52, -0.85, 0.48, C.green, "then create volume");
  s.addText("Left: storage and scheduling decide independently.", { x: 1.2, y: 4.95, w: 4.8, h: 0.3,
    fontFace: F.body, fontSize: 10.5, color: C.red, align: "center", bold: true, margin: 0 });
  s.addText("Right: provisioning follows the pod's chosen topology.", { x: 7.35, y: 4.95, w: 4.8, h: 0.3,
    fontFace: F.body, fontSize: 10.5, color: C.green, align: "center", bold: true, margin: 0 });
  s.addText("On topology-aware storage, Pending can be correct: the claim is waiting for the scheduler to tell storage where to exist.",
    { x: M, y: 6.3, w: W - 2 * M, h: 0.45, fontFace: F.body, fontSize: 14.1, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

function dProjectedVolume(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  ["Secret", "ConfigMap", "downwardAPI", "serviceAccountToken"].forEach((t, i) =>
    box(s, 0.8, 2.05 + i * 0.92, 2.55, 0.68, t, i === 0 ? "db-secret" : i === 1 ? "app-config" : i === 2 ? "pod metadata" : "short-lived token",
      i === 0 ? C.red : i === 1 ? C.teal : i === 2 ? C.amberD : C.green));
  box(s, 4.45, 2.7, 3.2, 1.8, "projected volume", "/etc/app/", C.purple);
  box(s, 9.0, 2.95, 3.0, 1.3, "Pod", "one mount, many files", C.navy2);
  arrow(s, 3.45, 2.4, 0.9, 0.78, C.red);
  arrow(s, 3.45, 3.32, 0.9, 0.28, C.teal);
  arrow(s, 3.45, 4.24, 0.9, -0.18, C.amber);
  arrow(s, 3.45, 5.16, 0.9, -0.68, C.green);
  arrow(s, 7.8, 3.6, 1.1, 0, C.purple, "mounted");
  s.addText("db/password", { x: 4.85, y: 3.05, w: 2.3, h: 0.22, fontFace: F.mono, fontSize: 9.5, color: C.codetx, align: "center", margin: 0 });
  s.addText("config/app.yaml", { x: 4.85, y: 3.4, w: 2.3, h: 0.22, fontFace: F.mono, fontSize: 9.5, color: C.codetx, align: "center", margin: 0 });
  s.addText("meta/labels", { x: 4.85, y: 3.75, w: 2.3, h: 0.22, fontFace: F.mono, fontSize: 9.5, color: C.codetx, align: "center", margin: 0 });
  s.addText("token", { x: 4.85, y: 4.1, w: 2.3, h: 0.22, fontFace: F.mono, fontSize: 9.5, color: C.codetx, align: "center", margin: 0 });
  s.addText("Kubernetes can merge several sources into one directory tree so the application reads files, not APIs.",
    { x: M, y: 6.3, w: W - 2 * M, h: 0.42, fontFace: F.body, fontSize: 14.5, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

function dReclaim(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  box(s, 5.0, 1.95, 3.3, 0.92, "PVC", "deleted", C.red);
  box(s, 1.0, 3.0, 4.1, 2.0, "Retain", "PV stays Released · bytes preserved", C.green);
  box(s, 8.2, 3.0, 4.1, 2.0, "Delete", "PV removed · backing disk destroyed", C.red);
  box(s, 1.45, 3.75, 1.4, 0.78, "PV", "Released", C.navy3);
  box(s, 3.1, 3.75, 1.55, 0.78, "Disk", "manual cleanup", C.navy3);
  box(s, 8.65, 3.75, 1.4, 0.78, "PV", "deleted", "5A2A2A");
  box(s, 10.3, 3.75, 1.55, 0.78, "Disk", "deleted", "5A2A2A");
  arrow(s, 5.9, 2.92, -2.4, 0.42, C.green, "preserve");
  arrow(s, 7.4, 2.92, 2.3, 0.42, C.red, "tear down");
  arrow(s, 2.9, 4.15, 0.15, 0, C.green);
  arrow(s, 10.1, 4.15, 0.15, 0, C.red);
  s.addText("Retain adds recovery work. Delete removes recovery options.",
    { x: M, y: 6.25, w: W - 2 * M, h: 0.45, fontFace: F.body, fontSize: 14.8, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

function dStatefulSet(pres, o) {
  const s = L.newSlide(pres, true);
  L.chip(s, o.chip, C.amberD); L.heading(s, o.title, true);
  box(s, 4.9, 1.95, 3.55, 0.85, "StatefulSet", "replicas: 3", C.teal);
  box(s, 0.8, 2.85, 2.35, 0.68, "Headless Service", "clusterIP: None", C.purple);
  ["web-0", "web-1", "web-2"].forEach((n, i) => {
    const x = 3.4 + i * 2.95;
    box(s, x, 3.95, 2.35, 0.82, "Pod", n, C.navy2);
    box(s, x, 5.15, 2.35, 0.78, "PVC", `data-${n}`, C.green);
    arrow(s, x + 1.17, 4.79, 0, 0.24, C.green);
  });
  arrow(s, 6.7, 2.82, -2.2, 0.05, C.teal, "creates ordinals");
  arrow(s, 3.15, 3.26, 0.15, 0, C.purple);
  arrow(s, 3.15, 3.62, 3.05, 0, C.purple);
  s.addText("DNS: web-0.svc, web-1.svc, web-2.svc", { x: 3.15, y: 3.68, w: 5.6, h: 0.24,
    fontFace: F.body, fontSize: 9.5, bold: true, color: C.purple, align: "center", margin: 0 });
  s.addText("each replica keeps its own claim", { x: 4.0, y: 6.0, w: 5.3, h: 0.28,
    fontFace: F.body, fontSize: 10.8, color: C.green, align: "center", bold: true, margin: 0 });
  s.addText("Stable pod names, one PVC per ordinal, and direct replica DNS are the three stateful primitives.",
    { x: M, y: 6.55, w: W - 2 * M, h: 0.35, fontFace: F.body, fontSize: 13.5, bold: true,
      color: C.amber, align: "center", margin: 0 });
  L.foot(s, pres); s.addNotes(L.notes(o)); return s;
}

module.exports = {
  dConfigMap, dSecretVsConfig, dPvPvc, dWaitForFirstConsumer,
  dProjectedVolume, dReclaim, dStatefulSet, box, arrow,
};
