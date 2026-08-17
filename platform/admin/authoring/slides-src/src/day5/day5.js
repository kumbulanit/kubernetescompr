const path = require("path");
const pptxgen = require("pptxgenjs");
const L = require("./lib.js");
const D = require("./diagrams.js");
const { C } = L;

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "AxisPay Curriculum Team";
p.company = "Axis Financial Services (fictional)";
p.title = "AxisPay Kubernetes Comprehensive — Day 5";
p.subject = "Security, Packaging, Observability and Production Operations";
p.__n = 0;
L.setDay(5);

// ============================================================================
// OPENING
// ============================================================================
L.sTitle(p, {
  eyebrow: "KUBERNETES COMPREHENSIVE · AXP-K8S-5D",
  title: "Day 5\nSecurity, Packaging & Running It",
  sub: "Everything you built this week, made operable. By 17:00 you will have upgraded a payment platform under live traffic while three faults are injected and nobody tells you what they are.",
  meta: [["DURATION", "7 hours"], ["THEORY", "215 min"], ["HANDS-ON", "365 min"], ["LABS", "6 + capstone"]],
  footer: "Four days of building. Today it becomes something you could hand to an on-call rotation.",
  obj: "Set the frame: today is about operability, and it ends with an assessment.",
  time: "3 min",
  script: "Open by saying what today is NOT: it is not more features. The platform is finished. Today is about the difference between a system that works and a system a team can run at 03:00 on a Saturday.\\n\\nTell them now that the capstone is 25% of the course, individual, and observed — and that the rubric scores METHOD over speed. Say the sentence out loud: 'A student who works systematically and does not finish scores higher than one who guesses correctly.' Say it now, and mean it, because it changes how they work all day.\\n\\nAlso set expectations about the observability install — if anyone has not run `make observability`, they need to start it in the background right now.",
  callout: "Check the room: who has NOT run `make observability`? They need 15 minutes of download before M5.5.",
});

L.sAsk(p, {
  chip: "MORNING RECAP", label: "Answers",
  q: "Five from yesterday. Answer out loud, no notes.",
  expect: [
    "A pod with no NetworkPolicy selecting it — allowed or denied?  →  ALLOWED. Default-allow until selected.",
    "How do you write a deny rule?  →  You cannot. You select the pod and permit nothing.",
    "Default-deny breaks everything. Why?  →  DNS is egress traffic on port 53.",
    "404, 502, 503 from an Ingress — three different layers. Which?  →  routing, backend unreachable, no ready endpoints.",
    "A PDB protects you from a node catching fire?  →  No. Voluntary disruption only.",
  ],
  obj: "Retrieval practice on Day 4, and settle the room.",
  time: "20 min",
  script: "Then everyone runs `make validate-day4` before touching anything. Today's labs assume working segmentation and a healthy Ingress; several will fail confusingly without them.\\n\\nIf someone's cluster is broken, pair them up now rather than losing them at 11:00.",
});

L.sTable(p, {
  chip: "TODAY", title: "What is still missing, and what it costs",
  lead: "A Kubernetes platform becomes operable when it can identify callers, authorise least-privilege access, package many objects repeatably, vary configuration by environment, and emit telemetry that turns behaviour into evidence. Those controls are generic; AxisPay is the payment-system example used to make them concrete.",
  head: ["Missing right now", "What it costs you", "Fixed in"],
  colW: [4.0, 5.8, 2.3],
  rows: [
    ["Workloads use default or unused API credentials", "A compromised pod gains a valid cluster identity before any authorisation check runs.", "L5.1"],
    ["Permissions are not modelled as roles and bindings", "Operators either get cluster-admin or cannot do routine support work.", "L5.2"],
    ["AxisPay is still 107 YAML files applied by hand", "A second environment or rollback is slow, manual and drift-prone.", "L5.3"],
    ["AxisPay environments are not expressed as data", "Nobody can explain how staging differs from production without diffing live objects.", "L5.4"],
    ["AxisPay exports no agreed service signals", "The payment SLO is an opinion, not a query you can run.", "L5.5"],
    ["AxisPay has no routed logs or alerts", "Merchants discover incidents before the platform team does.", "L5.6"],
  ],
  obj: "Derive today's agenda from gaps the students have felt all week.",
  time: "5 min",
  script: "Row 6 is the one to sit on. Go back through INC-1 to INC-4: every single one was discovered because someone told them, or because they happened to be looking. Not one was detected by the platform.\\n\\nThat is the honest state of what they have built, and it is what today fixes.",
  ask: "Which of these six would you fix first, if you could only fix one?",
  answer: "No wrong answer — but push for the reasoning. Most say observability, because you cannot fix what you cannot see.",
});

// ============================================================================
// M5.1 – M5.2  IDENTITY AND AUTHORISATION
// ============================================================================
L.sSection(p, {
  num: "M5.1 – M5.2", title: "Identity and least privilege",
  sub: "Who is this pod, and what is it allowed to do — two separate questions",
  objectives: [
    "Explain why an unused ServiceAccount token is a liability",
    "Apply Pod Security Admission and read a rejection",
    "Build and PROVE least-privilege RBAC with kubectl auth can-i",
  ],
  time: "80 min",
  obj: "Open the security module.",
  script: "Two orthogonal controls, and students routinely conflate them. Authentication answers 'who is this'. Admission answers 'is this pod allowed to exist in this shape'. A pod can have a perfect ServiceAccount and still run as root with a hostPath.",
});

D.dIdentity(p, {
  chip: "M5.1 · IDENTITY",
  title: "The credential nobody asked for",
  obj: "Show that the default ServiceAccount is a real, live credential.",
  time: "6 min",
  script: "In Kubernetes, every pod runs as a ServiceAccount identity, and many clusters mount a bearer token for that identity into the pod filesystem by default. If the workload never calls the API, that credential increases attack surface without adding business value.\n\nEvery pod they have deployed this week has been mounting a signed JWT at /var/run/secrets/kubernetes.io/serviceaccount/token. Nothing in AxisPay ever calls the Kubernetes API. It is pure liability.\n\nThe usual objection is 'but default has no permissions'. Answer it directly: that is a statement about today's RBAC, not a control. Change RBAC next quarter and the finding becomes an incident.",
  demo: "kubectl exec -n axispay-core deploy/payment-service -- head -c 60 /var/run/secrets/kubernetes.io/serviceaccount/token",
  ask: "The API returns 403 when we use that token. Is that good news?",
  answer: "No — 403 means the credential was ACCEPTED and then denied. A 401 would have meant no valid credential at all. This one authenticates.",
  anim: "Reveal BEFORE, discuss, then AFTER on click.",
});

L.sExplain(p, {
  chip: "M5.1 · IDENTITY",
  title: "Before RBAC can say what you may do, TLS must say who you are",
  lead: "Kubernetes authenticates every API request before it authorises it. In self-managed clusters, kubectl commonly proves identity with an X.509 client certificate from kubeconfig during the TLS handshake, and only that accepted username-and-group tuple is then evaluated by RBAC.",
  question: "Every kubectl command you've run all week — how did the API server know it was you?",
  steps: [
    ["Authentication happens inside TLS itself", "The API server accepts several auth methods, but the default kubeconfig path is an X.509 client certificate. kubectl presents a cert signed by the cluster's own CA during the TLS handshake, before a single line of HTTP is exchanged.", C.teal],
    ["A Kubernetes 'user' is just certificate text", "There is no built-in user table in the cluster. The certificate's Common Name (CN=) becomes the username, and the Organization fields (O=) become the RBAC groups. Group membership is baked in when the certificate is issued, not looked up from a database later.", C.amberD],
    ["This is what kubeconfig is storing", "kubectl config view is really showing three trust objects: the cluster CA certificate so kubectl can verify the API server, plus a client certificate and private key so the caller can prove its own identity. kubectl sends them automatically on every request.", C.green],
    ["Certificates expire, and rotation is the control", "Client and control-plane certificates both expire — kubeadm defaults to one year. There is no built-in revocation list, so short validity plus planned rotation is the real control kubeadm relies on.", C.purple],
  ],
  kicker: "TLS answers WHO. RBAC — the next module — answers WHAT. Confusing the two is the single most common production RBAC misconfiguration.",
  obj: "Separate Kubernetes authentication from Kubernetes authorisation, and tie both back to real kubeconfig contents.",
  time: "7 min",
  script: "Students have spent a week using kubectl without ever naming the credential in play. Make it explicit: before the API server can evaluate RBAC, it first has to accept an identity, and the classic self-managed cluster does that with a client certificate presented during the TLS handshake itself.\\n\\nThen land the second surprise: Kubernetes does not maintain an internal directory of humans. CN becomes the username. O becomes the groups. That makes certificate issuance an access-management act, because you are freezing group membership into the cert at issue time.\\n\\nClose on the operational consequence: expiry is normal, revocation is weak, so rotation matters. That gives the next kubeadm-upgrade slide a reason to exist instead of looking like pure admin trivia.",
  ask: "Two engineers get a 403 with valid, unexpired certificates. Is that an authentication or an authorisation problem?",
  answer: "Authorisation. A 403 means the identity was accepted and then denied. If authentication itself had failed, they would have seen a 401 or a TLS error.",
});

D.dTLSAuth(p, {
  chip: "M5.1 · AUTHN",
  title: "How kubeconfig becomes a Kubernetes user",
  obj: "Visualise the client-certificate path from kubeconfig to RBAC.",
  time: "5 min",
  script: "Use this to connect the previous slide's terms to a concrete flow. kubectl reads three things from kubeconfig: the cluster CA so it can trust the API server, plus a client certificate and private key so it can prove identity. During the TLS handshake, the API server accepts or rejects that certificate; only after that does RBAC evaluate the resulting username and groups.\\n\\nPoint out that Kubernetes is not looking a human up in an internal user table. The certificate text becomes the identity. That is why certificate issuance is access management, not just PKI hygiene.",
  ask: "Where does the Kubernetes username come from in this flow?",
  answer: "From the client certificate itself. The Common Name becomes the username and the Organization fields become RBAC groups.",
});

L.sExplain(p, {
  chip: "M5.1 · POD SECURITY",
  title: "Three tiers, three modes, and the one combination that lets you migrate",
  lead: "Pod Security Admission applies predefined security standards to pod specs at create and update time. Because namespace labels choose both the standard and the mode, teams can measure, warn on, and then enforce safer workload shapes without modifying Kubernetes itself.",
  question: "Why does Pod Security Admission have `audit` and `warn` as well as `enforce`?",
  steps: [
    ["privileged / baseline / restricted", "Three cumulative standards. Privileged permits everything. Baseline blocks the well-known escalations — privileged containers, host namespaces, hostPath. Restricted additionally demands non-root, dropped capabilities, a seccomp profile and no privilege escalation.", C.teal],
    ["enforce — the pod is REJECTED", "Admission control. The object is never created. There is no CrashLoopBackOff to investigate and no window in which it ran.", C.red],
    ["audit — written to the audit log", "The pod is created. A record appears in the API server's audit log. Nobody is interrupted.", C.amberD],
    ["warn — printed to the person applying", "The pod is created and whoever ran kubectl sees a warning immediately. This is the one that changes behaviour, because it reaches a human at the moment they can act.", C.green],
    ["The migration path", "A common rollout pattern is to set `enforce` to what workloads already satisfy and `warn`+`audit` to the target standard. The warnings become a backlog of concrete fixes. That is how AxisPay keeps axispay-data running while sizing the move to restricted.", C.purple],
  ],
  kicker: "axispay-data enforces baseline and warns at restricted. That gap is a to-do list, not an oversight.",
  obj: "Give students the mechanism AND the migration strategy.",
  time: "8 min",
  script: "Draw the point out that `enforce` is a blunt instrument on an existing cluster. If you turn on restricted everywhere on Monday morning, every workload that does not already comply fails its next rollout — and you will not find out until then, because PSA evaluates on create and update, not on running pods.\\n\\nThat last fact is worth repeating: existing pods keep running. The failure surfaces at the next deploy, which may be weeks later and will not obviously be connected to the label you changed.",
  warn: "PSA evaluates on CREATE and UPDATE. Existing pods keep running — the failure arrives at the next rollout.",
});

L.sCode(p, {
  chip: "M5.1 · WORKED EXAMPLE", title: "What a rejection actually looks like",
  lead: "Real output. Note that it names every rule broken at once, not just the first.",
  lines: [
    { k: "cmd", t: "$ kubectl run pci-violation -n axispay-core --image=busybox:1.37 \\" },
    { k: "cmd", t: "    --overrides='{\"spec\":{\"containers\":[{\"name\":\"x\"," },
    { k: "cmd", t: "      \"securityContext\":{\"privileged\":true,\"runAsUser\":0}}]}}'" },
    "",
    { k: "err", t: "Error from server (Forbidden): pods \"pci-violation\" is forbidden:" },
    { k: "err", t: "violates PodSecurity \"restricted:latest\": privileged (container \"x\"" },
    { k: "err", t: "must not set securityContext.privileged=true), allowPrivilegeEscalation" },
    { k: "err", t: "!= false, unrestricted capabilities, runAsNonRoot != true, seccompProfile" },
    "",
    { k: "dim", t: "# and in axispay-data, which enforces baseline but warns at restricted:" },
    { k: "cmd", t: "$ kubectl run legacy-tool -n axispay-data --image=busybox:1.37 ..." },
    { k: "warn", t: "Warning: would violate \"restricted:latest\": runAsNonRoot != true" },
    { k: "ok", t: "pod/legacy-tool created" },
  ],
  note: "One is refused. The other is created with a warning. Same standard, different mode.",
  obj: "Make admission control concrete rather than abstract.",
  time: "5 min",
  script: "Run both live. The contrast between the two outputs teaches the enforce/warn distinction better than the previous slide did.\\n\\nPoint at the fact that the rejection lists five violations, not one. Admission runs the whole check and reports everything — which is genuinely helpful, and unusual.",
  demo: "Both commands, back to back, in axispay-core then axispay-data.",
});

D.dRBAC(p, {
  chip: "M5.2 · RBAC",
  title: "Four objects, and the combination nobody teaches",
  obj: "Give the mental model before the syntax.",
  time: "8 min",
  script: "Kubernetes RBAC separates permission definition from permission attachment. Roles and ClusterRoles describe allowed verbs on allowed resources; RoleBindings and ClusterRoleBindings attach those grants to users, groups, or ServiceAccounts, and every matching grant is additive.\n\nThe bottom-left square is the one that matters and the one most people never discover: a ClusterRole referenced by a RoleBinding. The ClusterRole defines WHAT; the RoleBinding decides WHERE.\n\nThat is how axispay-auditor works — one permission set, bound in three namespaces. Without it you would maintain three identical Roles and they would drift.\n\nTop right is genuinely invalid: a ClusterRoleBinding cannot reference a namespaced Role. The API rejects it, which is at least an honest failure.",
  ask: "The auditor must read everything and must never read Secrets. How?",
  answer: "You do not deny Secrets. You write a role that never names them. RBAC is additive — the absence IS the control.",
});

L.sExplain(p, {
  chip: "M5.2 · RBAC",
  title: "Four rules that decide every RBAC question",
  lead: "Kubernetes RBAC grants permissions by binding a Role or ClusterRole — a named set of allowed verbs on allowed resources — to a user, group, or ServiceAccount. Effective access is the union of all matching bindings, so least privilege comes from narrow grants and from omitting what is not needed.",
  question: "Why can you not simply revoke a permission from one user?",
  steps: [
    ["RBAC is purely additive", "There is no deny rule anywhere in Kubernetes RBAC. A permission is absent, never removed. This is the whole reason 'the auditor must never read Secrets' is easy: you write a role that does not mention them.", C.teal],
    ["The union of all bindings wins", "Authorisation is evaluated over all matching bindings, so two different grants combine into one effective permission set. If a permission appears from nowhere, another binding is granting it — `kubectl auth can-i --list` shows the total.", C.teal],
    ["ClusterRole + RoleBinding is the useful pair", "Define the permission set once; bind it where it applies. Changing a RoleBinding to a ClusterRoleBinding silently promotes a namespace-scoped grant to the entire cluster.", C.amberD],
    ["Subresources are separate resources", "Kubernetes authorises subresources separately, so `pods`, `pods/log` and `pods/exec` are three independent grants. Granting `pods` grants none of the others — and `pods/exec` is effectively a path to every Secret those pods already consume.", C.red],
  ],
  kicker: "An RBAC review that checks the `secrets` resource and stops there has missed the larger hole.",
  obj: "Give the four properties that make RBAC predictable.",
  time: "8 min",
  script: "Rule 4 is the one that surprises experienced people. Walk it through slowly: every Secret consumed by a workload is present INSIDE the container as an environment variable or a mounted file. So anyone with pods/exec can read all of them without any `secrets` grant at all.\\n\\nSame is true of pods/portforward, and of `create` on pods — you can mount any Secret into a pod you create.",
  example: "A financial services platform team passed an access review on the strength of 'nobody has get on secrets', while eleven engineers had pods/exec in the namespace holding the signing key.",
});

L.sCode(p, {
  chip: "M5.2 · WORKED EXAMPLE", title: "Proof, not assertion",
  lead: "This block is the compliance evidence. Print it and attach it to the access review.",
  lines: [
    { k: "cmd", t: "$ A=\"--as=auditor@axis.example\"" },
    { k: "cmd", t: "$ kubectl auth can-i list pods    -n axispay-core $A" },
    { k: "ok", t: "yes" },
    { k: "cmd", t: "$ kubectl auth can-i get  pods/log -n axispay-core $A" },
    { k: "ok", t: "yes" },
    { k: "cmd", t: "$ kubectl auth can-i get  secrets  -n axispay-core $A" },
    { k: "err", t: "no" },
    { k: "cmd", t: "$ kubectl auth can-i create pods/exec -n axispay-core $A" },
    { k: "err", t: "no        <- the grant that would have defeated the one above" },
    "",
    { k: "cmd", t: "$ kubectl get secrets -n axispay-core $A" },
    { k: "err", t: "Error from server (Forbidden): secrets is forbidden: User" },
    { k: "err", t: "\"auditor@axis.example\" cannot list resource \"secrets\"" },
  ],
  note: "grep -c 'secrets' manifests/day5/rbac/02-roles.yaml  →  0.  The absence is the control.",
  obj: "Show that RBAC claims must be demonstrated, not described.",
  time: "6 min",
  script: "Run these live with --as. Then make the point about the last one: `kubectl auth can-i` asks the API server, which is the same authorisation path a real request takes. It is not a simulation of the policy — it IS the policy.\\n\\nOn a locked-down cluster `--as` will fail because impersonation is itself a permission. Mention that; it is a control worth knowing about.",
  tip: "platform/admin/validate/simulate-rbac.py runs 28 of these assertions offline, in CI, with no cluster.",
});

L.sMistakes(p, {
  chip: "M5.1 – M5.2",
  title: "Five ways this goes wrong in production",
  rows: [
    ["Granting `*` on `*` 'temporarily'", "It survives every access review. Nobody removes a grant that has not visibly broken anything.", "Write the narrow role. It takes ten minutes and it is the only version that survives an audit."],
    ["Reviewing `secrets` and stopping", "The access review looks clean while operators can still reach secret material through exec, port-forward or new-pod paths.", "Review the PATHS to a Secret: exec, portforward, create-on-pods, and the Secret itself."],
    ["ClusterRoleBinding by reflex", "A grant in every namespace, including ones nobody has created yet.", "RoleBinding unless the resource is genuinely cluster-scoped. Nodes yes; Deployments no."],
    ["Turning on `restricted` everywhere at once", "Nothing breaks today. AxisPay rollouts fail weeks later, apparently unconnected to the label change.", "enforce what you meet today; warn and audit at the target, as axispay-data does today."],
    ["Leaving `automountServiceAccountToken` at its default", "Every pod carries a live API credential it never uses.", "false by default. Turn it on only for the one workload, such as node-agent, that reads the API — and say why."],
  ],
  obj: "Name the failure modes explicitly before the lab.",
  time: "5 min",
  script: "Row 2 is the one worth dwelling on — it is the difference between an access review that means something and one that produces a document.",
});

L.sLab(p, {
  type: "GUIDED LABS", id: "L5.1 + L5.2", title: "Identity, Pod Security and least privilege",
  will: ["Read a live API token out of a running pod, and use it",
         "Give every service its own identity and remove the token",
         "Watch a privileged pod be refused at admission",
         "See the difference between enforce and warn, on the same cluster",
         "Prove every RBAC grant and every denial with auth can-i"],
  done: ["No workload uses `default`", "Nothing mounts a token except node-agent",
         "Six printable denials for the access review"],
  validate: "make validate-lab LAB=L5.1 && make validate-lab LAB=L5.2",
  time: "80 minutes", file: "labs/day5/L5.1-identity-and-pod-security/, L5.2-rbac.md",
  obj: "Hands on identity and authorisation.",
  script: "L5.1 step 2 is the moment that lands — they use the stolen token against the API and get 403. Make sure nobody skips it.\\n\\nIn L5.2, watch for students who write the role and move on without running auth can-i. Send them back. The proof is the deliverable, not the YAML.",
});

L.sExplain(p, {
  chip: "M5.2 · CLUSTER OPS",
  title: "Upgrading the cluster itself — kubeadm, one component at a time",
  lead: "kubeadm upgrades a self-managed cluster by changing control-plane state and node software in a supported order while the API stays available. Because components have version-skew limits and certificates expire, an upgrade is staged maintenance, not a single package update.",
  question: "This course runs on Minikube. A real AxisPay production cluster is self-managed. How does its Kubernetes VERSION actually get upgraded?",
  steps: [
    ["Control plane first, one minor at a time", "Kubernetes supports only limited version skew, so you upgrade sequentially rather than jumping from 1.28 straight to 1.31. `kubeadm upgrade plan` tells you what target versions are available and which upgrade path is actually supported.", C.teal],
    ["The first control-plane node runs the real apply", "`kubeadm upgrade apply v1.x.y` rewrites the static pod manifests for kube-apiserver, kube-controller-manager and kube-scheduler, and renews cluster certificates as a side effect. Additional control-plane nodes use the lighter `kubeadm upgrade node` path.", C.amberD],
    ["Every node is drained, upgraded, then returned", "Each node is handled individually: drain with `--ignore-daemonsets`, upgrade kubeadm/kubelet/kubectl, run `kubeadm upgrade node` where required, restart kubelet, then uncordon. This is exactly the voluntary disruption sequence Day 4's PodDisruptionBudgets were protecting.", C.green],
    ["Mixed versions are transitional, not normal", "A temporarily mixed set of kubelet versions is tolerated mid-rollout, but it is not a finished state. The upgrade is complete only once every control-plane node and worker is on the target version and normal scheduling has resumed.", C.purple],
  ],
  kicker: "This is precisely why Thursday's PodDisruptionBudgets exist — every drain in this sequence is exactly the voluntary disruption a PDB protects.",
  obj: "Show the supported kubeadm upgrade path and connect it to certificate renewal and Day 4 drain mechanics.",
  time: "8 min",
  script: "Students know how to upgrade an application by now; this slide is about the thing beneath the application. Keep the order strict: control plane first, then nodes, one minor version at a time. kubeadm is opinionated here because version skew rules are real, and the supported path is the safe path.\\n\\nMake the certificate point explicit. The previous slide explained that expiry is inevitable and revocation is weak. Here is where many clusters actually rotate part of that material in practice: control-plane upgrade time. That is operationally important, not trivia.\\n\\nThen tie it back to Thursday. Every drain here is a voluntary eviction event. PDBs were not a separate topic; they are what let this maintenance happen without taking the payment path down.",
  ask: "Why is `kubectl drain` part of a cluster upgrade instead of just an application rollout concern?",
  answer: "Because the kubelet on that node is about to be restarted or replaced. Workloads must be evicted safely first, and PDBs are what stop that maintenance drain from violating availability guarantees.",
});

D.dKubeadmUpgrade(p, {
  chip: "M5.2 · CLUSTER OPS",
  title: "The kubeadm upgrade path, drawn as a sequence",
  obj: "Show the supported control-plane-first and worker-serial upgrade order.",
  time: "5 min",
  script: "Keep the order strict and visual. One control-plane node runs `kubeadm upgrade apply` to move cluster state forward; the remaining control-plane nodes then follow with `kubeadm upgrade node`. Only after that do workers move, one at a time, through drain, package upgrade, kubelet restart and uncordon.\\n\\nThe point is not the exact flag set. The point is that Kubernetes tolerates temporary mixed versions only while you are moving through this sequence. The finished state is every node on the target version and schedulable again.",
  ask: "Why are workers handled one at a time instead of all together?",
  answer: "Because each drain removes real capacity. Serial worker upgrades preserve service while the cluster converges on the target version.",
});

L.sTable(p, {
  chip: "M5.2 · CLUSTER OPS",
  title: "The kubeadm upgrade sequence, as a checklist",
  lead: "A kubeadm upgrade is a repeatable maintenance sequence: plan the next supported version, move control-plane state first, then drain and upgrade each node before returning it to service. Any cluster follows that order; in a payment platform, each uncordon restores transaction capacity before the next node is touched.",
  head: ["Step", "Command", "Why"],
  colW: [1.6, 5.0, 5.493],
  rows: [
    ["Plan", "`kubeadm upgrade plan`", "Shows the supported target version and the safe next hop."],
    ["First control plane", "`kubeadm upgrade apply v1.x.y`", "Upgrades the primary control-plane node and renews certificates."],
    ["Other control planes", "`kubeadm upgrade node`", "Brings additional control-plane nodes onto the new control-plane state."],
    ["Drain node", "`kubectl drain <node> --ignore-daemonsets`", "Evicts normal workloads so replicas resettle before kubelet/package work begins."],
    ["Upgrade packages", "OS package manager for kubeadm, kubelet, kubectl", "Installs the node-side binaries for the target Kubernetes version."],
    ["Restart kubelet", "`systemctl daemon-reload && systemctl restart kubelet`", "Makes the upgraded kubelet process pick up the new binary and config."],
    ["Return node", "`kubectl uncordon <node>`", "Restores schedulable capacity before the next node is touched."],
  ],
  obj: "Leave students with an ordered kubeadm runbook they can recognise in production.",
  time: "5 min",
  script: "Read this top to bottom once, then stop. The value is not memorising flags; it is memorising the sequence and knowing why each step exists. The most common production mistake is not a typo — it is doing the right command in the wrong order, or forgetting that a drained node must be explicitly uncordoned before the cluster is really healthy again.",
});

// ============================================================================
// M5.3 – M5.4  PACKAGING AND PROMOTION
// ============================================================================
L.sSection(p, {
  num: "M5.3 – M5.4", title: "Packaging and promotion",
  sub: "One artefact, five configurations, and an honest account of what templating costs",
  objectives: [
    "Explain what a chart is: a data structure and string substitution",
    "Install the whole platform in one command",
    "Find the defect that only appears on the second release",
    "State the difference between three environments as data",
  ],
  time: "70 min",
  obj: "Open the packaging module.",
  script: "Be even-handed here. Helm is not obviously good — it adds a layer between the person and the object, and `helm template` becomes the only way to see what is applied. Present the trade honestly and the room will engage with it instead of either adopting it uncritically or dismissing it.",
});

D.dHelm(p, {
  chip: "M5.3 · HELM",
  title: "What a chart actually is",
  obj: "Demystify Helm before any syntax.",
  time: "7 min",
  script: "A Helm chart is a package of templates plus values that renders into ordinary Kubernetes YAML. A Helm release is the stored record of one rendered install or upgrade, not a continuously running controller.\n\nThe single most useful thing to say: Helm is not a controller. Nothing watches your chart. `helm upgrade` renders, diffs against the last stored release, and applies. Between commands Helm is not running at all.\n\nThe release being a Secret containing gzipped YAML has three consequences worth stating: rollback re-applies a stored copy rather than re-rendering from git; deleting that Secret loses your history; and Helm has no idea what happened to the cluster between your commands.",
  ask: "If someone runs `kubectl scale` on a Helm-managed Deployment, what happens?",
  answer: "Nothing, until the next `helm upgrade` — which resets it. Except for HPA-managed workloads, where the chart deliberately omits `replicas` so the autoscaler keeps ownership.",
  demo: "kubectl get secret -n default -l owner=helm  → then decode one and show it is the rendered manifests.",
});

L.sCode(p, {
  chip: "M5.3 · WORKED EXAMPLE", title: "Render before you install. Always.",
  lead: "Three seconds, and it is the only way to see what will actually be applied.",
  lines: [
    { k: "cmd", t: "$ helm template axispay ./charts/axispay | grep '^kind:' | sort | uniq -c" },
    { k: "out", t: "     15 kind: NetworkPolicy      13 kind: Deployment" },
    { k: "out", t: "     15 kind: ServiceAccount     13 kind: Service" },
    { k: "out", t: "      5 kind: PodDisruptionBudget 4 kind: ServiceMonitor" },
    { k: "out", t: "      2 kind: HorizontalPodAutoscaler  2 kind: Ingress" },
    { k: "out", t: "      1 kind: PrometheusRule      1 kind: DaemonSet  1 kind: CronJob" },
    "",
    { k: "cmd", t: "$ make helm-check" },
    { k: "ok", t: "All 94 chart assertions hold." },
    { k: "dim", t: "  every container has three probes, liveness != readiness" },
    { k: "dim", t: "  no selector carries a version label" },
    { k: "dim", t: "  no HPA-managed Deployment pins .spec.replicas" },
    { k: "dim", t: "  every *_SERVICE_URL resolves to a Service the chart creates" },
  ],
  note: "94 assertions, offline, no cluster and no helm binary required.",
  obj: "Establish the render-first habit and show the chart validates itself.",
  time: "6 min",
  script: "Installing a chart you have not rendered is applying YAML you have not read. Say it plainly.\\n\\nThe 94 assertions are worth a moment: they are this week's platform rules turned into tests. `helm lint` checks syntax; it has no opinion about whether your liveness probe points at the same endpoint as your readiness probe. That check had to be written.",
  demo: "make helm-check — let it scroll.",
});

L.sExplain(p, {
  chip: "M5.3 · HELM",
  title: "One chart depending on another — Helm's dependency model",
  lead: "A Helm chart can depend on other charts so one release installs a composed application stack. Dependency management is both packaging and supply-chain control: you declare child charts in `Chart.yaml`, lock exact versions, and vendor the resolved archives that rendering will actually use.",
  question: "AxisPay's chart needs PostgreSQL, Redis and RabbitMQ. Does the platform team write Kubernetes manifests for all three by hand?",
  steps: [
    ["Dependencies are declared in Chart.yaml", "A parent chart lists subcharts under `dependencies:` with a name, version constraint and repository URL. `helm dependency update` resolves those entries and downloads them into `charts/` as `.tgz` archives. A subchart is not a special object — it is just another ordinary chart, vendored inside the parent.", C.teal],
    ["Values flow downward through the tree", "The parent chart's values file can configure a subchart under a key matching that subchart's name, and the special `global:` block is visible to every subchart at once. One release can therefore configure a web-app plus Redis, or AxisPay plus PostgreSQL, Redis and RabbitMQ, from one values hierarchy.", C.amberD],
    ["condition and tags make dependencies optional", "A dependency can be switched on or off per environment using `condition` and `tags`. That means `values-dev.yaml` can disable an included subchart — for example an ingress controller or optional data service — without deleting the dependency declaration from Chart.yaml.", C.green],
    ["Vendored bytes can drift from declared intent", "`helm dependency update` captures a snapshot into `charts/` at that moment. `helm install` and `helm upgrade` do not automatically go back upstream and re-resolve everything. If `Chart.lock` and `charts/` are not kept in sync and committed together, two clones of the same repo can render different platforms.", C.purple],
  ],
  kicker: "Chart.lock pins exact versions. charts/ vendors the bytes. Commit both, or every clone of this repo may render a different platform.",
  obj: "Teach Helm dependency management as versioned supply-chain control, not just convenience.",
  time: "7 min",
  script: "Most teams meet Helm dependencies backwards: they inherit a charts/ directory and never learn where it came from. Start with Chart.yaml, because that is the declaration of intent. Then show that the actual bytes are fetched later into charts/, and that this gap between declared and vendored state is where repeatability is either preserved or lost.\\n\\nThe `global:` point matters because it explains how one release can coordinate cross-cutting settings like domain names, image registries or TLS secrets without copy-pasting the same value into every child chart.\\n\\nEnd on the operational warning. Dependencies are not live pointers. Helm is not npm. If you do not keep Chart.lock and charts/ aligned, 'same chart' stops meaning 'same platform'.",
  ask: "A teammate clones the axispay chart repo and runs `helm install` straight away, without `helm dependency update` first. What happens?",
  answer: "Either the install fails because required subcharts are missing, or it uses whatever stale subcharts are already vendored locally. That is why `charts/` and `Chart.lock` must be committed together, or dependency update must be enforced in CI before every install and upgrade.",
});

D.dHelmDeps(p, {
  chip: "M5.3 · HELM",
  title: "Chart dependencies: declared, configured, then vendored",
  obj: "Show how Chart.yaml, values, subcharts and charts/ fit together.",
  time: "5 min",
  script: "Walk it left to right. `Chart.yaml` declares which child charts the parent depends on. `helm dependency update` resolves those declarations into vendored `.tgz` archives under `charts/`. Separately, the parent values file pushes configuration down into those subcharts, so one release can tune the whole stack from one tree of values.\\n\\nSay the operational sentence clearly: rendering uses the vendored bytes, not whatever is latest upstream today. That is why Chart.lock and charts/ are part of release reproducibility.",
  ask: "What does `helm dependency update` change here?",
  answer: "It resolves the declared dependencies and vendors exact chart archives into `charts/`, so later renders use pinned child-chart bytes.",
});

L.sBanner(p, {
  chip: "THE DEFECT", kind: "warn",
  big: "It works on the first release.\nIt fails on the second.",
  sub: "Put a version label in .spec.selector and the NEXT upgrade that changes the version fails with `field is immutable` — often weeks later, usually at 02:00.",
  points: [
    "A Deployment's .spec.selector cannot be changed after creation. Ever.",
    "helm.sh/chart and app.kubernetes.io/version change on every release.",
    "The first install succeeds. The first upgrade succeeds. The version bump does not.",
    "The only fix is deleting the Deployment — in production, during the incident.",
    "This is why axispay.selectorLabels contains identity ONLY, and why check-helm-chart.py asserts it.",
  ],
  obj: "Name the most common Helm chart defect and show the guard against it.",
  time: "6 min",
  script: "Students break this on purpose in L5.3 step 7. Do not pre-empt the lab with the fix — let them cause the error and read it.\\n\\nThe deeper lesson is about latency between cause and symptom. A defect that surfaces on the second release with a different version is one nobody connects to the change that caused it. That is the class of bug worth building a test for, and it is why the assertion exists.",
  warn: "In L5.3 the students deliberately introduce this. Make sure they restore _helpers.tpl afterwards.",
});

D.dPromotion(p, {
  chip: "M5.4 · PROMOTION",
  title: "Three environments, one artefact",
  obj: "Show promotion as data rather than as a process.",
  time: "6 min",
  script: "Environment promotion usually means moving the same application artefact through environments by changing configuration data, not by hand-editing a new set of manifests each time. The safest differences are numeric and operational; identity, network boundaries, and security policy should remain structurally consistent.\n\nThe green bar is the important line. Every relaxation in dev is stated with its trade — one replica because nobody depends on dev availability, no PDB because a PDB on one replica blocks every drain. But NetworkPolicy, Pod Security and token mounting are identical in all three.\n\nSay why: a policy you only enable in production is a policy you first test in production. Every NetworkPolicy bug shows up as an application failure that looks like something else. You want to meet those in dev, on a Tuesday, with one replica and no merchants.",
  ask: "Staging has a HIGHER rate limit than production. Why would you do that?",
  answer: "So load tests can actually run. It is a deliberate difference, written down — which is the whole point of the file.",
});

L.sTable(p, {
  chip: "M5.4", title: "The five values files, and when each is right",
  head: ["File", "Pods · CPU", "What it is for"],
  colW: [2.9, 2.5, 6.7],
  rows: [
    ["values.yaml", "26 · 1670m", "Generic parent defaults any environment inherits before overrides."],
    ["values-dev.yaml", "12 · 760m", "Vanilla developer profile: one replica, no Ingress, no operator CRs, debug logs."],
    ["values-staging.yaml", "22 · 1420m", "AxisPay production-like shape at smaller numbers. Load generator on."],
    ["values-prod.yaml", "41 · 3380m", "AxisPay HA profile: anti-affinity, PDBs, maxSurge 2, 99.95% SLO. Read it; do not install it."],
    ["values-slim.yaml", "9 · 275m", "AxisPay constrained-laptop fallback. Says at the top what you lose."],
  ],
  lead: "Helm values files let one chart render differently per environment by changing data, not templates. A good values set starts with generic defaults, then records deliberate trade-offs in scale, exposure, resiliency, and logging; AxisPay uses that pattern to describe dev, staging, prod, and slim profiles.",
  obj: "Orient students before the lab.",
  time: "4 min",
  script: "values-prod fits Profile A at rest — 3380m against about 4500m schedulable. What does not fit is its autoscaler ceiling: payment-service at maxReplicas 20 requests 4000m on its own. Render it and read it; run the labs on values.yaml.\\n\\nvalues-slim states at the top of the file exactly which three labs stop working. Nobody should discover that mid-exercise.",
});

L.sLab(p, {
  type: "GUIDED LABS", id: "L5.3 + L5.4", title: "Packaging and promotion",
  will: ["Render 69 objects and predict them before you look",
         "Install the entire platform in one command",
         "Deliberately break the selector and read `field is immutable`",
         "Wedge a release with a bad image, then --atomic your way out",
         "Diff three environments as data, and reconcile real drift"],
  done: ["The platform installs from zero in one command", "You have caused and recovered from a failed release"],
  validate: "make validate-lab LAB=L5.3 && make validate-lab LAB=L5.4",
  time: "90 minutes", file: "labs/day5/L5.3-helm-packaging/, L5.4-promotion.md",
  obj: "Hands on packaging.",
  script: "Step 8 of L5.3 — the wedged release — is the one that transfers directly to their jobs. They should leave knowing that `--atomic` costs nothing and prevents the state where half the pods are one version and half cannot pull.\\n\\nWatch for students who skip `helm template` and go straight to install. Send them back; the habit is the point.",
});

// ============================================================================
// M5.5 – M5.6  OBSERVABILITY
// ============================================================================
L.sSection(p, {
  num: "M5.5 – M5.6", title: "Observability",
  sub: "Make the SLO a query, and connect a spike on a graph to the line that caused it",
  objectives: [
    "Trace the path from a Python counter to a graph, naming every hop",
    "Write PromQL for the four golden signals and one business question",
    "Explain why a histogram, not an average, answers 'how slow is it'",
    "Follow one payment across seven services from a single ID",
  ],
  time: "65 min",
  obj: "Open observability — the module that pays back the whole week.",
  script: "This is where Monday's correlation ID finally earns its place. Flag that now so students are listening for it.",
});

D.dScrape(p, {
  chip: "M5.5 · METRICS",
  title: "Four hops from a counter to a graph",
  obj: "Give the path, and the failure mode at each hop.",
  time: "7 min",
  script: "A Prometheus-style metrics pipeline is pull-based: application code exposes a text endpoint, discovery selects targets, and the collector scrapes them on a schedule. Each hop can fail differently, so 'no data' must be separated from 'target down'.\n\nPrometheus PULLS. Nothing is pushed. That single fact explains most of its behaviour, including why a pod that dies between scrapes leaves a gap rather than an error.\n\nThe ServiceMonitor selecting the SERVICE rather than the pods is worth calling out: Prometheus discovers the endpoints behind it, so an unready pod is never scraped. You get readiness-gating for free, and a starting pod does not drag your averages around.\n\nThe red box is the ticket you will actually receive. Missing and down are completely different problems and people conflate them constantly.",
  ask: "A target is missing entirely from Status → Targets. Where do you look first?",
  answer: "The ServiceMonitor's labels. Missing means never selected — almost always the release label. Down would mean Prometheus tried and failed.",
  demo: "Remove the release label live, wait 45 seconds, show the target disappear, put it back.",
});

L.sExplain(p, {
  chip: "M5.5 · GOLDEN SIGNALS",
  title: "Four signals, and the two mistakes almost everyone makes",
  lead: "The four golden signals are a workload-health lens: traffic, errors, latency, and saturation. Together they show demand, correctness, user experience, and capacity pressure; using them well means choosing metrics that match user outcomes and reading them together rather than as isolated graphs.",
  question: "Why is the average latency the wrong number, and why is a 409 not an error?",
  steps: [
    ["Traffic — how much is happening", "Traffic is usually measured as a rate of requests, messages or jobs over time. Here that is `sum by (service) (rate(axispay_http_requests_total[5m]))`. Probe endpoints are excluded at the application, so the AxisPay graph shows real traffic rather than the kubelet checking health.", C.teal],
    ["Errors — only 5xx counts", "Errors should count requests that failed to deliver the service the user expected, not every non-2xx outcome. In AxisPay, a 409 fraud decline and a 402 insufficient-funds response are valid business outcomes; only 5xx burns the error budget.", C.red],
    ["Latency — a histogram, never an average", "Latency SLOs are tracked with histograms because quantiles show tail behaviour. If 99 requests take 10ms and one takes 3s, the average is 40ms. One merchant in a hundred still waited three seconds, so AxisPay writes the SLO on p99.", C.amberD],
    ["Saturation — measured against the REQUEST", "Saturation asks how close a resource is to the point where work queues, throttles or sheds load. In Kubernetes, CPU saturation for an HPA-managed pod is interpreted against the request, because that is what the scheduler reserved and what the autoscaler divides by.", C.purple],
  ],
  kicker: "Bucket boundaries sit around 300ms on purpose, so the p99 is accurate exactly where the threshold is.",
  obj: "Give the four signals with the reasoning that makes them usable.",
  time: "9 min",
  script: "Run the average and the p99 side by side in Prometheus while the load generator is going. The average will look fine while the p99 does not. That picture does more than the explanation.\\n\\nOn buckets: a quantile estimated between two far-apart buckets is a guess. Ours are placed at 0.15, 0.2, 0.3, 0.5 precisely so the 300ms figure is real.",
});

L.sCode(p, {
  chip: "M5.5 · WORKED EXAMPLE", title: "The SLO, as a query",
  lead: "Availability stops being an opinion the moment it is written down like this.",
  lines: [
    { k: "dim", t: "# availability across a change window" },
    { k: "cmd", t: "sum(rate(axispay_http_requests_total{service=\"payment-service\"," },
    { k: "cmd", t: "                                     status!~\"5..\"}[110m]))" },
    { k: "cmd", t: "  / sum(rate(axispay_http_requests_total{service=\"payment-service\"}[110m]))" },
    { k: "ok", t: "0.99871      <- 99.87%, against an SLO of 99.5%" },
    "",
    { k: "dim", t: "# p99 latency — histogram, not average" },
    { k: "cmd", t: "histogram_quantile(0.99, sum by (le) (rate(" },
    { k: "cmd", t: "  axispay_http_request_duration_seconds_bucket{service=\"payment-service\"}[5m])))" },
    { k: "ok", t: "0.241        <- 241ms, against an SLO of 300ms" },
    "",
    { k: "cmd", t: "$ make validate-promql" },
    { k: "ok", t: "All 11 PromQL assertions hold (47 expressions, 2 LogQL queries)." },
    { k: "dim", t: "  a misspelled metric evaluates to an empty vector — the alert" },
    { k: "dim", t: "  never fires, and nothing tells you" },
  ],
  note: "Every expression in this repository is parsed and every metric name checked against what actually exists.",
  obj: "Make the SLO concrete and show why PromQL needs testing.",
  time: "6 min",
  script: "The last block matters more than it looks. A PromQL typo does not fail loudly — Prometheus accepts the rule, it evaluates to nothing, and the alert simply never fires. You find out during the incident it was written for.\\n\\nThat is why the repository parses all 47 expressions in CI.",
});

L.sBanner(p, {
  chip: "THE ALERT THAT MATTERS MOST", kind: "info",
  big: "sum(rate(axispay_payments_total[10m])) == 0",
  sub: "The most valuable alert you will build today fires when NOTHING is happening.",
  points: [
    "Every pod Ready. No error rate elevated. Latency perfect — there is no traffic to be slow.",
    "Not one infrastructure alert will fire, because nothing infrastructural is wrong.",
    "The cause is upstream: a DNS record still pointing at the old load balancer, an expired merchant API key, a CDN rule swallowing POSTs.",
    "Alerting on the ABSENCE of traffic is the only way to see it.",
    "Most platforms discover they need this the expensive way.",
  ],
  obj: "Land the single most transferable idea in the module.",
  time: "5 min",
  script: "Ask the room how they would have detected it before showing the query. Let them work through 'is the pod up' and hit the wall themselves.\\n\\nThen scale loadgen to zero live and watch the panel fall to zero while everything else stays green. It is thirty seconds and it is the picture they will remember.",
  demo: "kubectl scale deployment/loadgen -n axispay-ops --replicas=0, then watch the Payments-per-minute panel.",
});

D.dAlertFlow(p, {
  chip: "M5.6 · ALERTING",
  title: "WHETHER is Prometheus. WHO is Alertmanager.",
  obj: "Separate the two responsibilities cleanly.",
  time: "7 min",
  script: "In the Prometheus ecosystem, rule evaluation and notification delivery are separate systems. Prometheus decides when a condition is firing; Alertmanager groups, suppresses, routes and repeats notifications for humans or downstream tools.\n\nConfusing these two is why teams end up with alert rules containing team names and business hours.\n\nInhibition is the mechanism that makes an on-call rotation survivable. When payment-service has no ready endpoints, its error rate is also high and its latency is also bad — three pages for one fault. Without inhibition, one bad node produces eight pods' worth of pages and the person receiving them starts filtering the channel. That is the real failure.\n\nThe alert-sink is how we make routing provable. A route that matches too broadly looks identical to a correct one until the wrong team is paged at 03:00.",
  ask: "Why does `for: 5m` exist? Why not alert the moment the expression is true?",
  answer: "Because one slow scrape would page someone at 03:00. `for:` is what separates an alert from a notification.",
});

D.dLogs(p, {
  chip: "M5.6 · LOGS",
  title: "Labels are indexed. Content is scanned.",
  obj: "Give the one rule that governs all Loki usage.",
  time: "7 min",
  script: "Loki stores logs as streams identified by labels, so labels must stay low-cardinality and stable. Querying log content is a scan over selected streams, which is why correlation IDs belong in the body and namespace or service names belong in labels.\n\nEverything about how you use Loki follows from that one sentence. A query must start with a label selector; filtering on content is a scan; a high-cardinality label creates a stream per value and will fall over.\n\nDo the arithmetic out loud: correlation_id is unique per request. At 20 requests per second that is 1.7 million streams a day from ONE service. And the symptom is not 'the label is wrong' — it is Loki running out of memory and the log platform going down during the incident you needed it for.\n\nSame trap exists in Prometheus with labels like payment_id.",
  warn: "The identical mistake in Prometheus is a label like merchant_id — 25 values today, 25,000 next year.",
});

L.sCode(p, {
  chip: "M5.6 · WORKED EXAMPLE", title: "Monday's header, Friday's answer",
  lead: "One correlation ID. Seven services. One query. This is the payoff for the whole week.",
  lines: [
    { k: "cmd", t: "{namespace=~\"axispay-.*\"} | json | correlation_id=\"7f3a9c21-...\"" },
    "",
    { k: "out", t: "02:14:07  edge-gateway      request            1247.3 ms" },
    { k: "out", t: "02:14:07  auth-service      request               3.1 ms" },
    { k: "out", t: "02:14:07  payment-service   payment created    1198.7 ms" },
    { k: "out", t: "02:14:07  merchant-service  request               4.8 ms" },
    { k: "err", t: "02:14:07  fraud-service     risk assessed      1102.4 ms   <-- here" },
    { k: "out", t: "02:14:08  routing-service   request              12.2 ms" },
    { k: "out", t: "02:14:08  ledger-service    journal posted        6.9 ms" },
    "",
    { k: "dim", t: "# the merchant gave you a payment reference and nothing else." },
    { k: "dim", t: "# reference -> payment -> correlation_id -> this." },
  ],
  note: "edge-gateway has been minting X-Correlation-Id since Monday. Nobody was told why.",
  obj: "Deliver the callback that ties the week together.",
  time: "6 min",
  script: "Do this live if the timing allows. Generate a payment, grab the header, paste the query into Grafana Explore.\\n\\nThen say the thing explicitly: on Monday they implemented a header for no visible reason, and today it is what turns 'seven services touched this payment' into a single sorted list with the slow one obvious. Design decisions pay back on a delay.",
  demo: "POST a payment, read X-Correlation-Id from the response headers, query Loki.",
});

L.sMistakes(p, {
  chip: "M5.5 – M5.6",
  title: "Five ways observability becomes useless",
  rows: [
    ["A label with unbounded values", "One series per request. Prometheus or Loki runs out of memory during the incident you needed it for.", "Bounded dimensions only. Unbounded values go in the log body, queried with | json."],
    ["Alerting on causes rather than symptoms", "Pages fire for infrastructure facts even when user-visible service is still healthy.", "Alert on symptoms users would notice; `axispay-slo` is the concrete example."],
    ["No `for:` clause", "One slow scrape pages someone at 03:00. Within a month the channel is muted.", "5m for error rate, 2m for missing endpoints, 15m for a business trend."],
    ["Counting 4xx as errors", "The error budget burns while the risk engine does its job correctly.", "status=~\"5..\" only. A 409 decline and a 402 are outcomes, not failures."],
    ["Dashboards edited in the UI", "The change disappears at restart and cannot be reviewed or versioned like application code.", "Edit the dashboard source and regenerate; for AxisPay that source is build-dashboards.py."],
  ],
  obj: "Name the failure modes before the lab.",
  time: "5 min",
  script: "Row 5 is demonstrated in L5.5 step 7 — they edit a dashboard, restart Grafana, and watch the change vanish. It is a cheap lesson and it sticks.",
});

L.sLab(p, {
  type: "GUIDED LABS", id: "L5.5 + L5.6", title: "Metrics, dashboards, logs and alerts",
  will: ["Break Prometheus discovery on purpose and see MISSING rather than down",
         "Write the four golden signals, and one business query you cannot answer yet",
         "Build the alert that fires on silence, and watch it fire",
         "Follow one payment across seven services from a single ID",
         "Prove an alert reached the payments channel and NOT the finance one"],
  done: ["The SLO is a query", "A latency spike leads to the log line that caused it",
         "Alert routing is proven rather than assumed"],
  validate: "make validate-lab LAB=L5.5 && make validate-lab LAB=L5.6",
  time: "100 minutes", file: "labs/day5/L5.5-metrics-and-dashboards/, L5.6-logs-and-alerts.md",
  obj: "Hands on observability.",
  script: "The challenge in L5.5 is the best exercise of the day: write the approval-rate-per-acquirer alert, discover the acquirer label does not exist, and reason about whether adding it is safe. That is a real production conversation — and the answer for merchant_id is different from the answer for acquirer, which is the whole lesson about cardinality.",
});

// ============================================================================
// CAPSTONE
// ============================================================================
L.sSection(p, {
  num: "CAPSTONE", title: "Production upgrade under fire",
  sub: "110 minutes · individual · observed · 25% of the course",
  objectives: [
    "Upgrade a payment platform under live traffic with no maintenance window",
    "Triage three unannounced faults while defending an SLO",
    "Recover, validate, and present an incident report to a change board",
  ],
  time: "110 min",
  obj: "Set the frame for the assessment.",
  script: "Read the change request out loud, verbatim. The constraints are contractual and they are the assessment.\\n\\nRepeat the scoring rule one more time before they start: method over speed. Then say you will answer questions about tools and not about causes, and hold that line.",
});

L.sPoints(p, {
  chip: "CR-2026-0814 · APPROVED", chipColour: C.red,
  title: "The change request",
  lead: "A production change request states user-visible constraints, integrity requirements, and evidence expectations before any implementation detail is discussed. Kubernetes is only the means; the business contract is availability, latency, correctness, and auditability during change.",
  points: [
    "Availability during the window must stay above the agreed SLO.",
    "Tail latency must stay inside the user-facing threshold.",
    "ZERO payments may be lost or double-processed.",
    "The ledger must balance to zero at the end.",
    "Every AxisPay operator action must be auditable.",
    "Release 2.0.0 contains a new fraud model, a settlement schema migration, a larger connection pool and a new reporting endpoint.",
  ],
  obj: "Give the constraints in the language the business would use.",
  time: "4 min",
  script: "Note that none of these constraints mentions Kubernetes. That is accurate and deliberate — nobody outside the platform team describes an incident or a change in those terms, and translating between the two is the skill being assessed.",
});

L.sTable(p, {
  chip: "CAPSTONE", title: "The nine competencies, and where each is assessed",
  lead: "A production-operations assessment measures repeatable competencies, not lucky outcomes. The first checks are generic to any Kubernetes platform — deploy, scale, secure, observe, troubleshoot — and the final evidence becomes AxisPay-specific because this capstone must prove money-safe recovery.",
  head: ["Competency", "Where", "Evidence"],
  colW: [2.6, 3.3, 6.2],
  rows: [
    ["Deploy · Upgrade", "Phase 2", "Release 2.0.0 deployed; rollback path preserved; migration ran exactly once"],
    ["Scale", "Phase 3", "Replica count reacts to load without starving node capacity"],
    ["Secure", "Phase 3", "Nothing weakened to restore service"],
    ["Monitor", "Throughout", "Two of three AxisPay incidents detected BEFORE the ticket"],
    ["Troubleshoot", "Phase 3", "Three root causes, correctly identified"],
    ["Recover · Validate", "Phase 4", "capstone-validate.sh exits 0; the ledger balances"],
    ["Present", "Phase 5", "Timeline, causes, impact, two preventive actions"],
  ],
  obj: "Make the assessment criteria explicit before it starts.",
  time: "4 min",
  script: "Publishing the rubric before the exercise is deliberate. Nothing here is a trick, and students who know what is being measured behave more like engineers and less like exam candidates.",
});

L.sBanner(p, {
  chip: "BEFORE YOU START", kind: "warn",
  big: "The fastest fix and the correct fix are\nfrequently different.",
  sub: "In a regulated environment, knowing the difference is the job — and it is worth more than the minutes you save.",
  points: [
    "You will be under time pressure with a ticket asking for an update in fifteen minutes.",
    "At least one fault will have a fix that takes two seconds and destroys something you built earlier this week.",
    "The constraints in the change request are contractual. They do not relax because you are in a hurry.",
    "If you are about to delete a security object to restore service — stop, and consider what you are trading.",
    "Every action you take today appears in the audit trail for next week's assessment.",
  ],
  obj: "Give a fair warning without revealing which incident it applies to.",
  time: "3 min",
  script: "This is a fair warning, not a hint. It names a principle rather than an incident, and students who internalise it will handle all three faults better — not just the one it applies to.\\n\\nDo not elaborate if asked which fault. 'You will know it when you see it.'",
});

// ============================================================================
// CLOSING
// ============================================================================
D.dWeek(p, {
  chip: "THE WEEK", title: "One application, five days",
  obj: "Consolidate the arc of the whole course.",
  time: "4 min",
  script: "Walk it left to right and name what each day added to the SAME application. Nothing was thrown away; nothing was a toy.\\n\\nEnd on the correlation ID: written on Monday for no visible reason, and on Friday it is what turns seven services into one sorted list. Design decisions pay back on a delay, and recognising which ones will is most of what seniority means.",
});

L.sStats(p, {
  chip: "END OF THE WEEK", dark: true, title: "What you built",
  stats: [
    { v: "16", l: "services, deployed,\nscaled, upgraded and\nrecovered under load", colour: C.teal },
    { v: "0", l: "payments lost across\na rolling upgrade with\nthree injected faults", colour: C.green },
    { v: "9", l: "alerts that fire on\nsymptoms a merchant\nwould actually feel", colour: C.amber },
    { v: "1", l: "command installs the\nentire platform on\nany cluster", colour: C.purple },
  ],
  kicker: "The ledger balances to zero. Through an upgrade, three incidents and 110 minutes under pressure, the money still adds up.",
  obj: "Close the week on the number that matters.",
  time: "3 min",
  script: "Run the ledger query live as the final act of the course:\\n\\nkubectl -n axispay-data exec postgres-0 -- psql -U axispay_app -d axispay -t -c 'SELECT SUM(amount_minor) FROM ledger_entries;'\\n\\nZero. That is the note to end on.",
});

L.sPoints(p, {
  chip: "WHERE TO GO NEXT", chipColour: C.teal,
  title: "The honest list of what this course did not cover",
  lead: "Five days builds a working mental model, not complete mastery. The next topics are the ones most teams meet immediately after a first successful cluster: safer change automation, richer control loops, resilience across regions, service-to-service trust, and cost discipline.",
  points: [
    "GitOps — ArgoCD or Flux. You applied changes by hand all week; production should apply them from a repository.",
    "Operators and CRDs — you consumed ServiceMonitor and PrometheusRule. Writing one teaches you what a controller really is.",
    "Multi-cluster and DR — AxisPay ran in one cluster all week; real payment platforms repeat this shape across regions.",
    "Service mesh — mTLS between AxisPay services, and an honest look at whether the complexity is worth it for your platform.",
    "Cost — requests you never revisit are money AxisPay would spend forever. Nothing in this course measured it.",
    "The CKA and CKAD exams — you have covered most of the CKAD syllabus and a good part of the CKA.",
  ],
  obj: "Be honest about scope and give a genuine next step.",
  time: "4 min",
  script: "Do not oversell what a week can do. They can deploy, operate and troubleshoot a real platform — that is a lot, and it is not everything.\\n\\nThe cost bullet is the one most courses omit and most employers care about within a month.",
  next: "Course feedback, then certificates.",
});

p.writeFile({ fileName: "/tmp/deck/AxisPay-K8s-Day5.pptx" })
 .then(f => console.log("WROTE", f, "— slides:", p.__n));
