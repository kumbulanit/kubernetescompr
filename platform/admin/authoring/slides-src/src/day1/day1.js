const pptxgen = require("pptxgenjs");
const L = require("./lib.js");
const D = require("./diagrams.js");
const { C } = L;

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "AxisPay Curriculum Team";
p.company = "Axis Financial Services (fictional)";
p.title = "AxisPay Kubernetes Comprehensive — Day 1";
p.subject = "Foundations and First Deployment";
p.__n = 0;
L.setDay(1);

/* ========================= OPENING ========================= */
L.sTitle(p, {
  eyebrow: "KUBERNETES COMPREHENSIVE · AXP-K8S-5D",
  title: "Day 1\nFoundations & First Deployment",
  sub: "From container to running platform. By 17:00 you will have four AxisPay payment services deployed, load-balanced and talking to each other.",
  meta: [["DURATION", "7 hours"], ["THEORY", "260 min"], ["HANDS-ON", "300 min"], ["LABS", "6 + 1 incident"]],
  footer: "Ubuntu 26.04 LTS · Minikube · Kubernetes v1.36 · Java 21 LTS + Spring Boot 3.4 + Maven",
  obj: "Set the tone: this is a hands-on course built around one real platform.",
  time: "2 min",
  script: "Welcome. Introduce yourself in 60 seconds — your background, and one production Kubernetes incident you personally lived through. That story buys you credibility for the rest of the week and it costs a minute.\n\nMake the promise explicit: by 17:00 today, every person in this room will have a payment platform running on Kubernetes that they built themselves. Not a demo. Not nginx. A real payments platform with merchants, card tokens, fee arithmetic and idempotency.",
  ask: "Quick show of hands — who has run kubectl before today?",
  answer: "Use this to calibrate. If more than half are experienced, compress M1.2 and spend the time on M1.4. If almost nobody, slow down on M1.3 — the declarative model is the whole week.",
  tip: "Do NOT skip the personal incident story. It is the single cheapest thing you can do to establish authority with a sceptical room.",
});

L.sCards(p, {
  chip: "THE WEEK", title: "Five days, one platform",
  lead: "Kubernetes learning compounds because later controls attach to objects you created earlier. In this course, Monday's namespaces become Friday's Helm values.",
  cards: [
    { badge: "1", colour: C.teal, title: "Foundations", body: "Namespaces, Pods, Deployments, Services.\n\nFour AxisPay services running and talking to each other." },
    { badge: "2", colour: C.green, title: "Reliability", body: "Resources, probes, autoscaling, zero-downtime releases.\n\nThe platform survives Monday morning." },
    { badge: "3", colour: C.amberD, title: "State", body: "ConfigMaps, Secrets, storage, PostgreSQL as a StatefulSet.\n\n5,000 seeded transactions." },
    { badge: "4", colour: C.red, title: "Networking", body: "Ingress, TLS, DNS, zero-trust NetworkPolicy, placement, PDBs.\n\nMerchants can reach you." },
    { badge: "5", colour: C.purple, title: "Production", body: "RBAC, Helm, Prometheus, Grafana, Loki.\n\nCapstone: upgrade under fire." },
  ],
  obj: "Show the arc so students understand today's work is load-bearing.",
  time: "4 min",
  script: "Walk left to right. The key message is CUMULATIVE: this is not five independent days. The PodDisruptionBudgets you write on Thursday are what stop Friday's capstone upgrade from taking the platform down.\n\nSay explicitly: if you skip a lab, you do not miss a topic — you miss a COMPONENT, and you will notice on Friday.",
  ask: "Which of these five days do you think causes the most production outages in real life?",
  answer: "Day 2 — resources and probes. Almost every 'Kubernetes broke our deployment' story is a missing readiness probe or a wrong memory limit. Notably, the source syllabus for this course does not cover probes at all.",
});

L.sTable(p, {
  chip: "HOW TODAY RUNS", title: "The rhythm of every day this week",
  head: ["Time", "Block", "What happens"],
  colW: [1.9, 3.3, 6.9],
  rows: [
    ["09:00", "Morning recap", "Yesterday in five questions. Restore platform state."],
    ["09:20", "Theory + live demo", "New concept, then I drive a terminal. You watch — no typing."],
    ["10:25", "Guided lab", "We type together. I set the pace."],
    ["12:05", "Independent lab", "You work alone. I float and answer questions about tools."],
    ["15:40", "Progressive project", "Extend the platform. Tomorrow depends on it."],
    ["16:30", "Injected incident", "Something breaks. You have not been told what."],
    ["16:55", "Knowledge check", "Eight questions, discussed live. Not scored."],
    ["17:10", "Day assessment", "Ten items. Scored. 40% of your final mark."],
  ],
  obj: "Predictability reduces cognitive load over a five-day course.",
  time: "3 min",
  script: "Two things to flag. First, during LIVE DEMO nobody types — hands off keyboards. People who type during a demo miss the explanation and then need it repeated. Second, the 16:30 incident is unannounced every single day. Something will break and you will not be told what.",
  warn: "INSTRUCTOR: the 16:30 incident block is the highest-value 25 minutes of the day and the first thing you will be tempted to cut when running late. Protect it. Cut theory block C instead — that content is in the participant manual.",
  callout: "Assessment: 40% daily tests, 25% capstone, 20% incident triage, 15% project checkpoints. Pass mark 70%.",
});

/* ========================= M1.1 — CONTEXT ========================= */
L.sSection(p, {
  num: "M1.1", title: "The platform you are going to build",
  sub: "AxisPay — a fictional pan-African payment orchestration platform",
  objectives: ["Describe the AxisPay business problem and name the services you will build",
               "Explain why a payments domain makes Kubernetes concepts consequential"],
  time: "30 min",
  obj: "Establish the business context that motivates every technical decision this week.",
  script: "This module is short but it does real work. Every constraint in this platform maps onto a Kubernetes topic later in the week. Students who understand the business problem ask much better questions on Thursday.",
});

L.sPoints(p, {
  chip: "M1.1 · CONTEXT", title: "Axis Financial Services sells exactly one thing",
  lead: "Many platform businesses hide several provider integrations behind one stable API, so clients integrate once while the platform handles routing, failover and settlement complexity. AxisPay is the concrete example used in this course.",
  points: [
    "A Cape Town merchant selling into Nairobi and London would otherwise need three acquiring relationships, three integrations, three settlement files and three reconciliation processes.",
    "AxisPay collapses that into one integration.",
    "For every transaction, AxisPay decides — in about 40 milliseconds — which acquirer to route to, based on currency, card brand, amount, cost and live success rate.",
    "Axis earns a merchant discount rate in basis points, a fixed per-transaction fee, and an FX margin when the settlement currency differs.",
    "Everything in this course is fictional. No real institution, merchant or cardholder is represented, and no card number exists anywhere in this platform — only tokens.",
  ],
  obj: "Give students a business model they can reason about.",
  time: "5 min",
  script: "Keep this crisp. The point students must leave with: AxisPay makes money per transaction, so downtime is not an abstraction — it is revenue that does not arrive. When we set a 300 ms latency SLO on Friday, that number will already mean something.",
  example: "This is the same business model as Stripe Connect, Adyen or Checkout.com — payment orchestration rather than acquiring. Students who work in fintech will recognise it immediately.",
  ask: "If AxisPay processes 50,000 transactions a day at an average of R450, and charges 180 basis points — what does one hour of downtime cost?",
  answer: "About R16,875 of lost margin per hour of complete outage (50,000 x 450 x 0.018 / 24). More importantly, merchants have contractual SLAs, so there are penalties on top. The number is less important than the habit of asking it.",
});

L.sTable(p, {
  chip: "M1.1 · CONTEXT", title: "Why payments makes every concept matter",
  lead: "Operational requirements are what make Kubernetes features necessary rather than academic. AxisPay uses payments as the worked example, but the same mapping exists for any workload with latency, data, security or availability constraints.",
  head: ["Business constraint", "Forces you to care about", "Taught"],
  colW: [4.5, 5.4, 2.2],
  rows: [
    ["Money must never be double-charged", "Idempotency, graceful shutdown, preStop, SIGTERM handling", "Day 2"],
    ["Authorisation must answer in under 300 ms", "Requests/limits, CPU throttling, HPA, DNS latency", "Day 2"],
    ["Cardholder data is regulated", "Namespaces, NetworkPolicy, RBAC, Secrets, Pod Security", "Days 3-5"],
    ["The ledger must never lose an entry", "PersistentVolumes, StatefulSets, reclaim policies, RPO", "Day 3"],
    ["Settlement runs at 23:00 nightly", "CronJob, concurrencyPolicy, activeDeadlineSeconds", "Day 2"],
    ["Merchants have contractual uptime SLAs", "PodDisruptionBudget, anti-affinity, rolling updates, SLOs", "Days 4-5"],
    ["Every action auditable for seven years", "Event-driven architecture, log aggregation, correlation IDs", "Days 3, 5"],
  ],
  obj: "Make the week's syllabus feel derived rather than arbitrary.",
  time: "6 min",
  script: "This is the most important slide in M1.1. Work down the left column and let students see that the syllabus is DERIVED from the business, not imposed on it.\n\nStop on row 1. Ask what happens if a pod is killed mid-authorisation. Let them work out that the customer may be charged without the merchant being told — which is the worst possible failure in payments, because it is invisible until someone reconciles.",
  callout: "This platform is NOT PCI-DSS compliant and is not presented as such. It uses PCI-shaped constraints because they make security controls feel consequential. Say this out loud — overclaiming here is a disservice to students who work in regulated environments.",
});

D.dFlow(p, {
  chip: "M1.1 · CONTEXT", title: "One card payment, four services",
  obj: "Give students the reference request flow they will trace all week.",
  time: "6 min",
  script: "Walk the arrows in order. This is the flow they will build today, instrument on Day 5, and defend during the capstone.\n\nPoint at the X-Correlation-Id on the fourth arrow. Tell them to remember it. On Friday they will take a latency spike in Grafana and pull back every log line from all seven services for one payment — because of that header, which they implement today without being told why.",
  anim: "Reveal one arrow at a time, top to bottom. Six clicks.",
  ask: "Where would you put the retry logic if the acquirer call times out?",
  answer: "Nowhere naive. A blind retry on a payment authorisation is how you double-charge a customer. The correct answer involves an idempotency key, which is exactly what we implement today. Accept any answer that identifies the double-charge risk.",
  next: "So that is what we are building. Now — why does any of this need Kubernetes at all?",
});

/* ========================= M1.2 — WHY ORCHESTRATION ========================= */
L.sSection(p, {
  num: "M1.2", title: "Why orchestration exists",
  sub: "Containers solved one problem and created six new ones",
  objectives: ["Explain the operational problems containers create at scale",
               "Justify orchestration to a non-technical stakeholder",
               "Distinguish orchestration from virtualisation"],
  time: "35 min",
  obj: "Motivate Kubernetes before explaining it.",
  script: "Resist the urge to start with architecture. Students who do not feel the problem will not retain the solution.",
});

L.sStats(p, {
  chip: "M1.2 · WHY", dark: true,
  title: "The 02:14 page",
  lead: "A true-shaped story. Tell it before you show any architecture.",
  stats: [
    { v: "02:14", l: "A node runs out of memory.\nThe kernel OOM-killer terminates\nthe single payment-service process.", colour: C.red },
    { v: "41 min", l: "Card authorisations fail until a\nhuman wakes up, reads the alert\nand recreates the container.", colour: C.amber },
    { v: "R38,000", l: "Lost Saturday-morning trade for\none merchant. Three merchants\nbreached their uptime SLA.", colour: C.red },
  ],
  kicker: "Nothing was watching. Nothing brought it back. That is the problem orchestration exists to solve.",
  obj: "Create the emotional hook that makes controllers memorable.",
  time: "4 min",
  script: "Tell this slowly. Do not rush to the solution.\n\nThen ask the room: how many of you have been paged for something a computer could have fixed in eight seconds? Almost every hand goes up. That shared experience is what makes the reconciliation loop land in M1.3.",
  ask: "What would have had to be true for nobody to be paged that night?",
  answer: "Something must be continuously watching, comparing what SHOULD be running with what IS running, and acting on the difference. That is a controller, and it is the next module.",
  next: "Hold that thought. We come back to this exact scenario in lab L1.4 — and you will watch the fix work.",
});

L.sCards(p, {
  chip: "M1.2 · WHY", title: "Containers solved packaging. Then what?",
  lead: "Containers package an application and its dependencies into one portable runtime unit, but they do not coordinate many replicas across many hosts. Once a generic web-app must survive node failure, scale out and stay discoverable, you need orchestration.",
  cards: [
    { badge: "?", colour: C.red, title: "Placement", body: "For a vanilla web-app, an orchestrator must choose a node with enough free CPU, memory and required capabilities. In AxisPay's pre-Kubernetes world, that answer lived in a spreadsheet already out of date." },
    { badge: "?", colour: C.red, title: "Healing", body: "A platform needs a control loop that notices failed processes and recreates them automatically. Without that, AxisPay's 02:14 payment-service death waits for a human." },
    { badge: "?", colour: C.red, title: "Release", body: "A platform must update many instances gradually, keep capacity during the change and offer rollback. For AxisPay, that means shipping v2 across twelve servers without interrupting authorisations." },
    { badge: "?", colour: C.red, title: "Discovery", body: "Callers need one stable name even when backends restart and their IPs change. In AxisPay, hard-coding payment-service's current IP breaks at the next reschedule." },
  ],
  obj: "Enumerate the operational gap containers leave behind.",
  time: "6 min",
  script: "Go one card at a time and ask how each is handled today in the students' own organisations. You will hear: spreadsheets, Nagios, bash scripts, a wiki page, 'Dave knows'. Those answers ARE the argument for orchestration — you do not have to make it yourself.\n\nThere are two more not on this slide: scaling for Black Friday and back down again, and evacuating a failing server. Add them verbally.",
  ask: "How does your organisation currently answer 'which server has capacity?'",
  answer: "Expect: a spreadsheet, a monitoring dashboard, or a person. All three are the same answer — a human is the scheduler. That does not scale past about a dozen machines.",
  tip: "If the room is quiet, name a service you know they run and ask 'where does that run, and who decided?'",
});

L.sTable(p, {
  chip: "M1.2 · WHY", title: "Orchestration is not virtualisation",
  lead: "Virtualisation multiplexes operating systems on a host, while orchestration coordinates application workloads across hosts. Most production platforms use both at the same time because they solve different layers of the problem.",
  head: ["", "Virtualisation (VMware, KVM)", "Orchestration (Kubernetes)"],
  colW: [2.7, 4.7, 4.7],
  rows: [
    ["Unit", "A virtual machine with its own kernel", "A Pod — one or more containers sharing a host kernel"],
    ["Boot time", "Tens of seconds to minutes", "Under a second"],
    ["Isolation", "Strong — hardware-level", "Weaker — namespaces and cgroups"],
    ["Question it answers", "How do I run many OSes on one machine?", "How do I run many applications across many machines?"],
    ["Failure model", "The VM is a pet. You repair it.", "The Pod is cattle. You replace it."],
    ["They compete?", "No. Most Kubernetes clusters run on VMs.", "Your Minikube nodes are containers on your laptop."],
  ],
  obj: "Remove a misconception that blocks understanding of scheduling.",
  time: "5 min",
  script: "The last row usually gets a reaction. Kubernetes and virtualisation are not alternatives — almost every managed cluster in the world runs on virtual machines.\n\nThe pets-versus-cattle row is the one that matters most. It reframes 'my container died' from a crisis into a routine event, and that reframing is what the rest of the week depends on.",
  ask: "Your database has been running on one VM for four years and everyone is scared to reboot it. Pet or cattle?",
  answer: "A pet — and that is exactly the problem StatefulSets and PersistentVolumes address on Day 3. Good moment to plant the flag for Wednesday.",
});

/* ========================= M1.3 — DECLARATIVE ========================= */
L.sSection(p, {
  num: "M1.3", title: "The declarative model",
  sub: "Desired state, actual state, and the loop that closes the gap",
  objectives: ["Explain desired state versus actual state",
               "Trace a reconciliation cycle end to end",
               "Predict what a controller does when a pod is deleted"],
  time: "40 min",
  obj: "Install the single organising idea of the entire course.",
  script: "This is THE module of Day 1. Everything else this week is a variation on what happens here. If you are running late, cut something else.",
});

L.sTable(p, {
  chip: "M1.3 · DECLARATIVE", title: "Imperative tells HOW. Declarative states WHAT.",
  lead: "Imperative systems execute the exact steps you issue now. Declarative systems store the target state and let controllers keep reconciling towards it over time.",
  head: ["", "Imperative", "Declarative"],
  colW: [2.4, 5.0, 4.7],
  rows: [
    ["You say", "'Start three containers on servers 4, 7 and 9'", "'Three replicas of this should exist'"],
    ["Who acts", "You, every time", "A controller, continuously"],
    ["If one dies", "Nothing. It stays dead until you notice.", "It is replaced in seconds. Nobody is paged."],
    ["If you run it twice", "Six containers", "Still three"],
    ["Source of truth", "Whatever you last typed", "The object stored in the cluster"],
    ["In this course", "kubectl scale, kubectl run — for experiments", "kubectl apply -f — for anything you keep"],
  ],
  obj: "Contrast the two models before showing the mechanism.",
  time: "6 min",
  script: "Row 4 is the one to dwell on: idempotence. Applying a declarative manifest twice changes nothing the second time. That property is what makes GitOps possible, and it is why 'apply' is the verb rather than 'create'.\n\nBe honest about the last row. Imperative commands are excellent during an incident. The danger is only when you use them and then forget that your YAML no longer matches reality.",
  warn: "kubectl scale changes the cluster but NOT your file. The next kubectl apply silently reverts it. This divergence is one of the most common causes of 'it worked yesterday'. Students meet it in lab L1.4, step 7.",
});

D.dReconcile(p, {
  chip: "M1.3 · DECLARATIVE", title: "The reconciliation loop",
  obj: "Make the control loop concrete and visual — the spine of the whole week.",
  time: "10 min",
  script: "Draw this on the whiteboard as well as showing it. Students should be able to reproduce it from memory by Friday.\n\nThe loop never stops. It is not triggered by your kubectl command — it is running right now, for every object in the cluster, whether or not anyone is watching. When you 'delete a pod', you do not really delete anything permanently; you change actual state, and the loop notices.\n\nThen say the line at the bottom slowly: every controller in Kubernetes is this one loop with a different spec. ReplicaSet, Deployment, StatefulSet, Job, HorizontalPodAutoscaler, the Ingress controller, cert-manager, every Operator anyone has ever written. Same loop.",
  anim: "Build in four clicks: spec, status, controller reading both, then the ACT arrow closing the circle.",
  ask: "I delete a pod that belongs to a Deployment with three replicas. Walk me through what happens, in order.",
  answer: "Actual state becomes 2. The ReplicaSet controller observes 2 != 3. It creates a new Pod object with no node assigned. The scheduler sees an unscheduled pod, picks a node and binds it. The kubelet on that node sees a pod assigned to it and starts the container. Roughly eight seconds end to end. Accept any answer that gets the observe-diff-act sequence right.",
  callout: "This is why you were paged at 02:14 in the earlier story and why you would not be now. Tie it back explicitly.",
});

L.sExplain(p, {
  chip: "M1.3 · DECLARATIVE",
  title: "How a controller actually closes the gap",
  lead: "Most Kubernetes controllers watch objects, compare desired with actual state, then make one small corrective API change. For a generic web-app Deployment or AxisPay's payment-service, the loop is the same: level-triggered code that converges from current state even after missed events or restarts.",
  question: "You run `kubectl delete pod`. Nobody tells Kubernetes to create a replacement. So what happens, exactly?",
  steps: [
    ["OBSERVE", "For a vanilla web-app Deployment, the ReplicaSet controller keeps a local cache of every Pod it owns via a WATCH — a streaming connection to the API server that pushes changes as they happen. It does not poll.", C.teal],
    ["DIFF", "It compares spec.replicas (3) with the number of Pods it can actually see (2). This is a CURRENT-STATE comparison, not delete-event logic, which is why a missed event still corrects itself on the next pass.", C.teal],
    ["ACT", "It creates ONE new Pod object with spec.nodeName EMPTY. For a generic web-app, that is the whole correction; for AxisPay later today, payment-service is repaired exactly the same way.", C.green],
    ["HAND OFF", "The scheduler sees an unscheduled Pod, filters and scores nodes, and writes a node name. The kubelet on that node sees a Pod assigned to it and calls containerd.", C.green],
    ["REPEAT", "The loop runs again. spec now equals status, so it does nothing — and keeps doing nothing, forever, until something changes.", C.amberD],
  ],
  kicker: "Total elapsed: about eight seconds. Four components, none of which called another.",
  obj: "Turn the reconciliation loop from a slogan into a mechanism students can trace.",
  time: "8 min",
  script: "This is the slide that converts 'self-healing' from marketing into engineering.\n\nStep 3 is the one to dwell on: the ReplicaSet controller creates a Pod OBJECT with no node. That is the whole of its job. Students consistently believe controllers start containers — they do not. Getting this right is what makes Pending versus ContainerCreating debuggable tomorrow.\n\nStep 2 is worth a sentence too: because the controller compares against current state rather than reacting to the delete event, Kubernetes tolerates lost events, controller restarts and network partitions. That is level-triggered design, and it is why the system is so hard to wedge.",
  ask: "If the controller crashes between step 3 and step 4, what happens?",
  answer: "Nothing bad. The Pod object exists with no node; when the scheduler next runs it picks it up. And when the controller restarts, its first reconcile compares current state and finds 3 pods, so it does nothing. No duplicate, no orphan. That resilience is a direct consequence of level-triggered design.",
});

L.sBanner(p, {
  chip: "KEY IDEA", kind: "key",
  big: "You do not tell Kubernetes what to do.\nYou tell it what you want, and it works continuously to make that true.",
  sub: "spec is your intent. status is reality. The controller's only job is to close the gap between them, forever.",
  points: [
    "You write spec. You never write status — a controller does.",
    "The loop runs whether or not you are watching, and whether or not anything has changed.",
    "'Self-healing' is not a feature that was added. It is a side effect of the model.",
    "Every object you meet this week — Deployment, Service, PVC, Ingress, HPA — is spec plus a controller.",
  ],
  obj: "Consolidate the module into one sentence students can repeat.",
  time: "3 min",
  script: "Say the big text out loud, then pause. Let it sit.\n\nThis is the sentence to return to every time a student asks 'but how does Kubernetes know to...?' The answer, all week, is: a controller is watching, and it is comparing spec with status.",
  next: "So who runs these loops, and where do they live? That is the architecture.",
});

/* ========================= M1.4 — ARCHITECTURE ========================= */
L.sSection(p, {
  num: "M1.4", title: "Cluster architecture",
  sub: "Six components, one door",
  objectives: ["Name every control-plane and node component and state its single responsibility",
               "Trace kubectl apply through apiserver, etcd, scheduler, kubelet and the container runtime",
               "Locate each component in a live Minikube cluster"],
  time: "70 min",
  obj: "Give students a mental map they can debug against.",
  script: "The goal is not memorisation for its own sake. It is that when something breaks on Thursday, they know WHICH component to interrogate.",
});

D.dCluster(p, {
  chip: "M1.4 · ARCHITECTURE", title: "The whole cluster on one slide",
  obj: "Establish the component map and the hub-and-spoke communication pattern.",
  time: "8 min",
  script: "In any Kubernetes cluster, control-plane and node agents coordinate indirectly through API objects, not direct peer-to-peer RPC calls. Do not read every box. Instead make the single structural point at the bottom: every arrow points AT the API server.\n\nThe scheduler does not call the kubelet. The controller manager does not call etcd. Nothing calls anything except the API server. Each component watches the API server for things it cares about and writes results back.\n\nThat is what makes Kubernetes extensible: to add behaviour, you write another thing that watches the API server. It is also why kubectl can observe everything that happens — there is only one place anything happens.",
  anim: "Reveal control plane, then node, then the kubectl arrow, then the watch arrows.",
  ask: "etcd holds the entire state of the cluster. What is your backup strategy?",
  answer: "Snapshot etcd regularly and test the restore. Losing etcd means losing every object definition in the cluster. In managed services the provider handles it; on self-managed clusters it is entirely yours. Flag that etcd backup and restore is a CKA exam topic and one of the gaps this course does not cover practically.",
  callout: "On Minikube the control-plane components run as STATIC PODS — created by the kubelet from files in /etc/kubernetes/manifests/, not by the API server. That is the bootstrap answer to 'what starts the API server if the API server creates everything?'",
});

L.sCards(p, {
  chip: "M1.4 · ARCHITECTURE", title: "Control plane — four responsibilities",
  lead: "The control plane is a set of specialised processes that validate intent, persist state, choose placement and run reconciliation. Each component has one narrow responsibility and coordinates through the API server rather than direct peer-to-peer calls.",
  cards: [
    { badge: "1", colour: C.teal, title: "kube-apiserver", body: "In every cluster, the API server is the front door. Requests from kubectl, controllers and kubelets pass authentication, authorisation and admission before any object changes.\n\nA generic web-app apply — or AxisPay's Deployment apply — only talks here." },
    { badge: "2", colour: C.purple, title: "etcd", body: "In every cluster, etcd is the persistent backing store for API objects and their latest committed state.\n\nAxisPay's Namespaces, Deployments and Services all exist here before anything runs. Lose it and you lose the cluster." },
    { badge: "3", colour: C.teal, title: "kube-scheduler", body: "For each unscheduled pod, the scheduler filters impossible nodes, scores feasible ones and writes back the chosen node name.\n\nA new web-app pod or payment-service replica follows exactly this path. It never starts anything." },
    { badge: "4", colour: C.teal, title: "controller-manager", body: "This process runs built-in control loops that watch objects and act when actual state drifts from desired state.\n\nReplicaSet healing for a generic app and AxisPay's endpoint updates both live here." },
  ],
  obj: "Assign one clear responsibility per component.",
  time: "9 min",
  script: "One sentence per card, then the nuance.\n\nOn the scheduler: emphasise that it does NOT start containers. It writes a node name into the pod object and stops. Students consistently assume the scheduler runs things. It does not — the kubelet does. Getting this wrong makes Day 4's placement module much harder.\n\nOn the API server: the three-stage pipeline (authN, authZ, admission) is where Day 5's RBAC and Pod Security Admission plug in. Plant that flag now.",
  ask: "The scheduler crashes. What breaks, and what keeps working?",
  answer: "Existing pods keep running untouched — kubelets do not need the scheduler. New pods stay Pending forever because nothing assigns them a node. This is a great diagnostic instinct: 'everything running is fine, nothing new starts' points straight at the scheduler.",
});

L.sCards(p, {
  chip: "M1.4 · ARCHITECTURE", title: "Every node — three jobs and three interfaces",
  lead: "Node components turn Pod specs into running Linux processes, network reachability and attached storage on one machine. Whether the workload is a vanilla web-app or AxisPay's payment-service, Kubernetes keeps this layer pluggable so runtimes, CNIs and storage backends can vary by environment.",
  cards: [
    { badge: "1", colour: C.green, title: "kubelet", body: "On every node, the kubelet watches for pods bound to that node, asks the runtime to create containers, runs probes and reports status back.\n\nFor a generic nginx pod or AxisPay payment-service replica, this is the agent that makes it real." },
    { badge: "2", colour: C.green, title: "kube-proxy", body: "For Services, kube-proxy programs dataplane rules into the host kernel, usually with iptables or IPVS.\n\nThat is how a frontend reaches a backend Service, and later how edge-gateway reaches payment-service, with almost no added latency." },
    { badge: "3", colour: C.amberD, title: "CRI · CNI · CSI", body: "Kubernetes defines interfaces instead of hard-coding one runtime, network stack or storage system. Any cluster needs one implementation of each; in AxisPay, containerd fulfils CRI, Calico fulfils CNI, and CSI drivers attach storage." },
  ],
  obj: "Explain the node and introduce the interface layer.",
  time: "8 min",
  script: "The third card is the one to spend time on. Kubernetes deliberately does not implement container running, networking or storage. It defines interfaces and lets you plug in an implementation.\n\nThat design decision is why this course insists on --cni=calico. Minikube's default CNI implements the network but does NOT enforce NetworkPolicy — so on Thursday every security policy would silently pass while protecting nothing.",
  warn: "Check now, not on Thursday: kubectl get pods -n kube-system -l k8s-app=calico-node. If that returns nothing, the cluster was built wrong and CNI cannot be changed on a running cluster. Lab L1.1 makes students verify this for exactly this reason.",
});

D.dPod(p, {
  chip: "M1.4 · ARCHITECTURE", title: "What actually runs: the Pod",
  obj: "Bridge from cluster components to the unit of work.",
  time: "6 min",
  script: "A Pod is Kubernetes' scheduling, networking and lifecycle boundary for one or more cooperating containers. This previews M1.6 but belongs here, because it answers 'what does the kubelet actually create?'\n\nThe pause container is worth thirty seconds: it holds the network and IPC namespaces open so your application container can crash and restart without the Pod losing its IP address. Students see pause in crictl output during L1.3's challenge and otherwise find it baffling.",
  ask: "Why does the Pod exist at all? Why not just schedule containers?",
  answer: "Because some things must share a network namespace and filesystem to work: an app and its log shipper, an app and a proxy sidecar, an app and an init container that prepares its data. The Pod is the smallest unit that can express 'these must live together, on the same node, sharing one IP'.",
});

L.sExplain(p, {
  chip: "M1.4 · ARCHITECTURE",
  title: "What a Pod actually is, at the Linux level",
  lead: "A Pod is the smallest deployable unit in Kubernetes: one or more containers scheduled together on one node, sharing a network namespace and optionally shared volumes. For a vanilla web-app or AxisPay's payment-service, the kubelet assembles that abstraction from ordinary Linux primitives rather than a special 'pod' kernel object.",
  question: "There is no such thing as a 'pod' in Linux. So what does the kubelet really create?",
  steps: [
    ["A network namespace", "Created first, held open by the tiny `pause` container. It owns the IP address. A generic web-app and its sidecar JOIN it rather than creating their own — which is why they share one IP and reach each other on localhost.", C.teal],
    ["A set of cgroups", "One per container, nested under a pod-level cgroup. This is where requests and limits are written: cpu.weight, cpu.max, memory.max. Tomorrow's resource module is entirely about these files.", C.amberD],
    ["Mount namespaces", "Each container gets its own filesystem view. Shared volumes are bind-mounted into every container that declares them — that is the only filesystem they share.", C.teal],
    ["Container processes", "containerd starts them via the CRI. Init containers run to completion first, in order; app containers then run concurrently — whether that is a generic web-app or AxisPay's payment-service plus future helpers.", C.green],
  ],
  kicker: "A Pod is a shared network namespace plus a cgroup boundary. Everything else follows from that.",
  obj: "Ground the Pod abstraction in the Linux primitives it is built from.",
  time: "6 min",
  script: "Students who have used Docker already know namespaces and cgroups; this slide connects the two vocabularies and makes the Pod stop feeling arbitrary.\n\nStep 1 explains why the pause container exists, which otherwise looks like clutter in crictl output. It holds the namespace open so your container can crash and restart WITHOUT the Pod losing its IP address.\n\nStep 2 is a deliberate forward reference: tomorrow's entire resource module is about writing values into those cgroup files, and students will read cpu.stat directly in L2.1.",
  ask: "Two containers in one Pod both try to listen on port 8080. What happens?",
  answer: "The second fails to bind — address already in use. They share ONE network namespace, so they share one port space. This catches people the first time they add a sidecar that happens to use the same port.",
});

L.sCode(p, {
  chip: "M1.4 · LIVE DEMO", title: "What happens when you run kubectl apply",
  lead: "Watch the terminal. Hands off keyboards.",
  lines: [
    { k: "cmd", t: "$ kubectl apply -f deployment.yaml -v=6" },
    { k: "dim", t: "POST https://192.168.49.2:8443/apis/apps/v1/namespaces/axispay-core/deployments 201 Created" },
    { k: "hi",  t: "deployment.apps/payment-service created" },
    "",
    { k: "dim", t: "# kubectl is now DONE. Nothing is running yet." },
    "",
    { k: "cmd", t: "$ kubectl get events -n axispay-core --sort-by='.lastTimestamp' | tail -6" },
    { k: "ok",  t: "ScalingReplicaSet   Scaled up replica set payment-service-7d4f9c8b6 to 3   deployment-controller" },
    { k: "ok",  t: "SuccessfulCreate    Created pod: payment-service-7d4f9c8b6-x7k2p          replicaset-controller" },
    { k: "ok",  t: "Scheduled           Assigned axispay-core/...-x7k2p to axispay-m02        default-scheduler" },
    { k: "ok",  t: "Pulled              Container image already present on machine            kubelet" },
    { k: "ok",  t: "Created             Created container payment-service                     kubelet" },
    { k: "ok",  t: "Started             Started container payment-service                     kubelet" },
  ],
  note: "Read the right-hand column: five different components each did one small thing, in order, without ever talking to each other.",
  obj: "Prove the architecture is real by watching components hand off through the API server.",
  time: "8 min",
  demo: "Run this live in axispay-core. Have `kubectl get events -w` in a second terminal BEFORE applying, so students see events arrive in real time. Then run `kubectl get pods -w` and delete a pod so they see the loop close.",
  script: "The most important moment is the pause after 'deployment created'. kubectl has finished. Nothing is running. Everything that follows was done by controllers reacting to an object appearing in etcd.\n\nThen point at the right-hand column of the events output — deployment-controller, replicaset-controller, default-scheduler, kubelet. Five components, one at a time, each watching the API server. This is the architecture slide, but real.",
  ask: "Why does 'Scheduled' appear AFTER 'SuccessfulCreate'?",
  answer: "Because the ReplicaSet controller creates a Pod object with an empty nodeName. Only then does the scheduler see an unscheduled pod and bind it. Creation and placement are two separate steps by two separate components — which is exactly why a Pending pod means 'created but not placed'.",
  tip: "-v=6 shows the HTTP calls kubectl makes; -v=8 shows full bodies. It is the fastest way to convince someone that kubectl is just a REST client.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L1.1", title: "Cluster reconnaissance",
  will: ["Identify every control-plane and node component in YOUR cluster",
         "Find the static pod manifests on disk",
         "Verify Calico is enforcing NetworkPolicy — before Thursday depends on it",
         "Read node capacity and allocatable, and explain the difference"],
  done: ["All nodes Ready", "Calico DaemonSet present", "You can name each component's job"],
  validate: "make validate-lab LAB=L1.1",
  time: "30 minutes", file: "labs/day1/L1.1-cluster-recon/",
  obj: "Ground the architecture module in the students' own cluster.",
  time_note: "",
  script: "Set this up in 90 seconds and let them work. Float.\n\nThe check that actually matters is Calico. If anyone's cluster is missing it, deal with it NOW — CNI cannot be changed on a running cluster, and by Thursday they will have four days of work they do not want to lose.",
  warn: "If a student has only ONE node, they can add more non-destructively with `minikube node add -p axispay`. Do it today, not on Thursday.",
});

/* ========================= M1.5 — NAMESPACES ========================= */
L.sSection(p, {
  num: "M1.5", title: "Namespaces",
  sub: "Trust boundaries, not folders",
  objectives: ["Design a namespace layout for a segmented payments estate",
               "Create, switch and scope namespaces",
               "Identify which resources are NOT namespaced"],
  time: "50 min",
  obj: "Establish the segmentation model that Days 4 and 5 attach to.",
  script: "Students often treat namespaces as cosmetic. Frame them from the start as the thing NetworkPolicy and RBAC select on.",
});

D.dNamespaces(p, {
  chip: "M1.5 · NAMESPACES", title: "Two namespaces, same names, one flat network",
  obj: "Show generic namespace scoping before the AxisPay segmentation example.",
  time: "6 min",
  script: "Start with the generic example: team-a and team-b can both contain a web-app and a database with the same names, because names are qualified by namespace in the API and DNS.\n\nThen point at the arrow. By default, those pods can still reach across namespaces. Name isolation and network isolation are different mechanisms. That distinction is why NetworkPolicy matters on Day 4 and why namespace labels matter on Day 1.",
  ask: "Why can both namespaces have a Service named web-app without conflict, yet one pod can still call the other namespace's database by FQDN?",
  answer: "Because names are scoped by namespace, but network reachability is cluster-wide by default. A namespace is the handle policies attach to; it is not itself the firewall.",
});

L.sCards(p, {
  chip: "M1.5 · NAMESPACES", title: "AxisPay's three zones",
  lead: "A namespace is the API scope for object names, RBAC, quotas and policy attachment. It is commonly used to separate environments, teams or trust zones, but by itself it is not a network firewall or a separate cluster.",
  cards: [
    { badge: "E", colour: C.green, title: "axispay-edge", body: "A common pattern is an edge namespace for ingress-facing components and controlled north-south entry points. In AxisPay, that is edge-gateway and auth-service.\n\nThe only namespace permitted to receive traffic from outside the cluster.\n\npci-scope: false" },
    { badge: "C", colour: C.red, title: "axispay-core", body: "A core namespace usually holds the workloads that process sensitive business transactions and therefore get the tightest policy. In AxisPay, this CDE contains payment, merchant, fraud, routing, ledger, customer.\n\nDefault-deny networking from Day 4.\n\npci-scope: true" },
    { badge: "A", colour: C.purple, title: "axispay-async", body: "A separate async namespace is a common way to isolate batch or event-driven workloads with different scaling and failure patterns. In AxisPay, this zone holds settlement, notification, audit, reporting.\n\nPopulated from Day 2 onward.\n\npci-scope: true" },
  ],
  obj: "Present the segmentation design and its rationale.",
  time: "6 min",
  script: "The business driver: a QSA auditing this platform asks one question that determines the cost of the entire audit — what is in scope? Every system that stores, processes or transmits cardholder data is in the CDE and must meet the full control set.\n\nA flat platform means everything is in scope. Namespace design is the first line of the segmentation argument.\n\nThen point at the labels. On Thursday a NetworkPolicy will say 'allow from any namespace where zone=edge'. On Friday Pod Security Admission will enforce restricted where pci-scope=true. Get the labels right today and the rest is wiring.",
  ask: "edge-gateway handles every card payment. Why is it labelled pci-scope=false?",
  answer: "Because it TRANSMITS but does not STORE or PROCESS cardholder data — and in this platform it only ever sees a token, never a card number. That is a real audit argument and it hinges on the tokenisation boundary. Accept any answer that identifies tokenisation as the reason.",
});

L.sBanner(p, {
  chip: "WARNING", kind: "warn",
  big: "Namespaces do NOT isolate the network.",
  sub: "By default, every pod in the cluster can reach every other pod, in any namespace. Namespaces isolate NAMES, RBAC scope and resource quotas — nothing else.",
  points: [
    "In lab L1.2 you will ping a pod in axispay-core from a pod in axispay-edge. It works.",
    "In a payments environment, a flat pod network is an audit finding.",
    "The fix is NetworkPolicy — and it needs a CNI that enforces it, which is why we insisted on Calico.",
    "That is Day 4. Today, just see the problem clearly.",
  ],
  obj: "Kill the single most common misconception about namespaces.",
  time: "4 min",
  script: "This is the misconception that causes real security incidents. People assume namespaces are a security boundary. They are an ORGANISATIONAL boundary with RBAC attached.\n\nMake them do the ping in the lab. Seeing it succeed is worth more than being told.",
  ask: "So what IS a namespace good for, security-wise?",
  answer: "It is the unit that RBAC, ResourceQuota, LimitRange, Pod Security Admission and NetworkPolicy all attach to. It is not itself a boundary — it is the handle you hang boundaries on.",
});

L.sTable(p, {
  chip: "M1.5 · NAMESPACES", title: "Namespaced or cluster-scoped?",
  lead: "Some Kubernetes objects live inside a namespace, so `web-app` can exist once in team-a and again in team-b. Others are cluster-scoped because they describe shared infrastructure, global policy or the namespace boundary itself.",
  head: ["Namespaced (exist inside a namespace)", "Cluster-scoped (exist once, globally)"],
  colW: [6.05, 6.05],
  rows: [
    ["Pod, Deployment, ReplicaSet, StatefulSet", "Node"],
    ["Service, Ingress, NetworkPolicy", "Namespace itself"],
    ["ConfigMap, Secret, ServiceAccount", "PersistentVolume, StorageClass"],
    ["PersistentVolumeClaim", "ClusterRole, ClusterRoleBinding"],
    ["Role, RoleBinding", "CustomResourceDefinition"],
    ["Job, CronJob, HPA, PodDisruptionBudget", "IngressClass, CSIDriver"],
  ],
  obj: "Prevent a common and dangerous confusion.",
  time: "5 min",
  script: "Note the pairs that appear on both sides: Role vs ClusterRole, RoleBinding vs ClusterRoleBinding, PVC vs PV. Those pairings are deliberate and they are where mistakes happen.\n\nA ClusterRoleBinding grants access in EVERY namespace, including ones that do not exist yet. Someone who meant to grant read access to one namespace and used ClusterRoleBinding has just granted it cluster-wide. That is Friday's module, but the seed is here.",
  tip: "kubectl api-resources --namespaced=false lists every cluster-scoped kind in your cluster. Worth putting on the cheat sheet.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L1.2", title: "Namespace design for a segmented estate",
  will: ["Create the three AxisPay namespaces with their zone and pci-scope labels",
         "Scope your kubectl context so you stop typing -n",
         "Prove that namespaces isolate names but NOT the network",
         "Challenge: add axispay-data yourself, unaided"],
  done: ["3 namespaces exist with correct labels", "Cross-namespace ping succeeds — and you can say why that matters"],
  validate: "make validate-lab LAB=L1.2",
  time: "30 minutes", file: "labs/day1/L1.2-namespaces/",
  obj: "Build the segmentation and see its current absence.",
  script: "The ping is the point of this lab. Make sure everyone runs it and sees it succeed.",
});

/* ========================= M1.6 — PODS ========================= */
L.sSection(p, {
  num: "M1.6", title: "Pods",
  sub: "The atomic unit — and why you must never ship a bare one",
  objectives: ["Explain why the Pod exists rather than 'a container'",
               "Write a Pod manifest and inspect, exec and log a running Pod",
               "Explain why bare Pods are unsuitable for production"],
  time: "80 min",
  obj: "Teach the unit of work, then deliberately show its limits.",
  script: "The plan is to show students the WRONG way on purpose, let them feel the gap, then fix it in M1.7. That contrast is far more durable than an assertion.",
});

D.dHierarchy(p, {
  chip: "M1.6 · PODS", title: "Image → container → Pod → Node",
  obj: "Separate the artifact you build from the workload Kubernetes actually schedules.",
  time: "6 min",
  script: "Walk left to right. An image is just a packaged filesystem plus metadata. A container is one running instance of that image. Kubernetes does not schedule either directly; it schedules a Pod, which may hold one or more containers, onto one node.\n\nUse the generic web-app plus log-shipper example first, then tie it to AxisPay: payment-service is built as an image, started as a container, but owned and restarted only as part of a Pod.",
  ask: "If two containers come from the same image, are they the same thing in Kubernetes?",
  answer: "No. The image is the reusable artifact, each container is one runtime instance, and Kubernetes reasons about them through the Pod that groups them on one node.",
});

L.sTable(p, {
  chip: "M1.6 · PODS", title: "Every object has the same four fields",
  lead: "Most Kubernetes manifests share the same envelope: apiVersion, kind, metadata and spec. A generic Pod, Deployment or Service reads this way before any controller acts; later controllers add status so you can separate your intent from the cluster's observation.",
  head: ["Field", "Means", "Example"],
  colW: [2.5, 5.3, 4.3],
  rows: [
    ["apiVersion", "Which API group and version this object belongs to", "v1  ·  apps/v1"],
    ["kind", "What sort of object", "Pod  ·  Deployment  ·  Service"],
    ["metadata", "Name, namespace, labels, annotations", "name: web-app  ·  namespace: team-a"],
    ["spec", "DESIRED STATE — what you want. You write this.", "replicas: 3"],
    ["status", "ACTUAL STATE — what is. A controller writes this.", "readyReplicas: 2"],
  ],
  obj: "Give students the universal manifest shape.",
  time: "5 min",
  script: "Tie this straight back to M1.3: spec is your intent, status is reality, and everything in Kubernetes is the machinery driving the second towards the first.\n\nThe practical tip: when you kubectl get -o yaml, you get back far more than you wrote. Kubernetes fills in dozens of defaults. Knowing that defaults exist, and that you can see them, saves hours of confusion.",
  tip: "kubectl explain pod.spec.containers.resources — built-in, offline documentation for every field of every object. The most under-used command in Kubernetes.",
});

L.sCode(p, {
  chip: "M1.6 · PODS", title: "A Pod manifest, annotated",
  lines: [
    { k: "cmd", t: "apiVersion: v1" },
    { k: "cmd", t: "kind: Pod" },
    "metadata:",
    "  name: payment-service-bare",
    "  namespace: axispay-core",
    "  labels:",
    { k: "hi", t: "    app.kubernetes.io/name: payment-service      # ← the wiring. Services find pods by this." },
    "spec:",
    "  containers:",
    "    - name: payment-service",
    { k: "hi", t: "      image: axispay/payment-service:1.0.0        # ← pinned. never :latest" },
    { k: "hi", t: "      imagePullPolicy: IfNotPresent               # ← built into Minikube; never pull" },
    "      ports:",
    "        - name: http",
    "          containerPort: 8080",
    { k: "ok", t: "      env:                                          # ← Downward API" },
    { k: "ok", t: "        - name: POD_NAME" },
    { k: "ok", t: "          valueFrom: { fieldRef: { fieldPath: metadata.name } }" },
  ],
  size: 11,
  note: "The Downward API injects pod identity into the process — which is what makes /api/v1/_info able to tell you WHICH pod answered.",
  obj: "Read a real manifest field by field.",
  time: "7 min",
  script: "Three fields carry weight.\n\nLabels: this is the wiring. In forty minutes a Service will find these pods by exactly this label. Not by name — by label.\n\nimagePullPolicy IfNotPresent: we build images directly into the Minikube runtime, so there is no registry, no push and no Docker Hub rate limit. Works on a locked-down corporate network.\n\nDownward API: this is why every AxisPay service can report its own pod name. You will use that endpoint today to prove load balancing, tomorrow to watch a rollout, and Thursday to prove anti-affinity spread replicas across nodes. It is built in on purpose.",
  warn: "Never use :latest. Which image is running becomes unknowable, rollbacks stop working, and nodes disagree about what 'latest' means. Every manifest in this repository is pinned.",
});

L.sMistakes(p, {
  chip: "COMMON MISTAKES", title: "What goes wrong with Pods",
  rows: [
    ["Using a bare Pod in production", "It dies. Nothing brings it back.", "Always use a controller — Deployment, StatefulSet, Job"],
    ["Writing logs to a file in the container", "kubectl logs is empty; logs vanish on restart", "Log JSON to stdout. The kubelet captures it."],
    ["Running as root", "Container escape becomes host compromise", "USER 10001 in the image AND runAsNonRoot in the pod spec"],
    ["Assuming logs exist after a crash", "payment-service never started; logs say nothing", "kubectl describe for events, or logs --previous if it DID start"],
    ["Using :latest", "Today's payment-service and tomorrow's replacement may differ", "Pin an immutable tag or a digest"],
    ["One pod, many unrelated processes", "payment-service and fraud-service cannot scale independently", "One concern per container; use sidecars deliberately"],
  ],
  obj: "Pre-empt the errors students are about to make.",
  time: "6 min",
  script: "Most of these mistakes come from treating a pod like a small VM instead of an ephemeral workload boundary. Row 2 deserves a moment. It is the most common mistake made by people coming from VMs, where writing to /var/log is correct. In a container it produces logs nobody can read and that disappear when the pod restarts.\n\nRow 4 is the one they will hit in about two hours, during INC-1. Plant it now so the memory is available when they need it.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L1.3", title: "The first Pod — and why you must never ship one",
  will: ["Create a bare Pod and reach it with port-forward",
         "exec into it, read its logs, describe it",
         "See readyz return 503 while healthz returns 200 — and understand why",
         "Delete it, and watch nothing happen"],
  done: ["Pod reached via port-forward", "You can state why bare Pods are unfit for production"],
  validate: "make validate-lab LAB=L1.3",
  time: "40 minutes", file: "labs/day1/L1.3-first-pod/",
  obj: "Experience the Pod, then experience its limitation.",
  script: "The last step is the lesson: they delete the Pod and nothing comes back. Do NOT rescue them from that. Let it sit. In L1.4 they delete a Deployment-managed pod and watch a replacement appear in eight seconds, and the contrast does the teaching.\n\nAlso flag: readyz returns 503 because merchant-service does not exist yet. That is CORRECT. The process is alive but cannot serve. They are seeing the liveness/readiness distinction before it is formally taught — point at it and say 'remember this, it is tomorrow morning'.",
});

/* ========================= M1.7 — DEPLOYMENTS ========================= */
L.sSection(p, {
  num: "M1.7", title: "Deployments & ReplicaSets",
  sub: "Self-healing, scaling, and the object that makes rollbacks possible",
  objectives: ["Explain the Deployment → ReplicaSet → Pod ownership chain",
               "Write a Deployment, scale it, and demonstrate self-healing",
               "Read ownerReferences from a live cluster"],
  time: "90 min",
  obj: "Deliver the controller that solves the 02:14 page.",
  script: "This module pays for itself twice: today with self-healing, and tomorrow with rolling updates, which are impossible to explain without the ReplicaSet layer.",
});

D.dOwnership(p, {
  chip: "M1.7 · DEPLOYMENTS", title: "Deployment → ReplicaSet → Pod",
  obj: "Establish the ownership chain that underpins every update and rollback.",
  time: "10 min",
  script: "Ask first, before revealing: what owns a Pod created by a Deployment?\n\nMost people say the Deployment. It is the ReplicaSet. The Deployment never creates a Pod — it creates and manages ReplicaSets.\n\nThat is not trivia. It is the entire mechanism behind rolling updates: a Deployment updates by creating a NEW ReplicaSet and gradually shifting replicas from the old one to the new. Both continue to exist. A rollback simply scales the old one back up. Note the greyed-out box on the right — replicas: 0, kept for exactly that purpose.\n\nTen minutes here buys the whole of Tuesday morning.",
  anim: "Reveal Deployment, then current ReplicaSet, then pods, then the deleted pod and its replacement, then the previous ReplicaSet.",
  ask: "Why does Kubernetes keep the old ReplicaSet around at zero replicas?",
  answer: "So a rollback is just scaling it back up — no image pull, no new object, near-instant. kubectl rollout undo does exactly that. Revision history length is configurable.",
  callout: "In lab L1.4 students trace this chain themselves with ownerReferences. Make sure they actually run it rather than reading the slide.",
});

L.sBanner(p, {
  chip: "WARNING", kind: "warn",
  big: "spec.selector is immutable, and it must be a SUBSET of the pod template labels.",
  sub: "Choose it carelessly on Day 1 and fixing it means deleting and recreating the Deployment — in production, with traffic on it.",
  points: [
    "Put only labels that will NEVER change in the selector. Never put a version number in it.",
    "AxisPay selects on two labels: app.kubernetes.io/name and app.kubernetes.io/instance.",
    "If the selector contains a label the template lacks, admission rejects it — but the error is not obvious the first time.",
    "Relabel a running pod and it silently leaves both its Service AND its ReplicaSet. Nothing errors. You just get an orphan and a replacement.",
  ],
  obj: "Prevent an expensive, irreversible mistake.",
  time: "5 min",
  script: "The last bullet is the best five minutes in lab L1.4 — challenge 2 has them relabel a pod and count what happens. They end up with four pods and three endpoints, and they can explain why.\n\nLabels are not decoration. They are the wiring.",
});

L.sStats(p, {
  chip: "M1.7 · DEPLOYMENTS", dark: true, title: "The 02:14 page, revisited",
  lead: "Same failure. Same cluster. Different outcome.",
  stats: [
    { v: "~8 sec", l: "Time for the ReplicaSet controller to\nobserve the gap and create a replacement.", colour: C.green },
    { v: "0", l: "Humans paged.\nThe engineer reads about it\nover breakfast.", colour: C.green },
    { v: "R0", l: "Lost trade.\nNo merchant breached\ntheir SLA.", colour: C.green },
  ],
  kicker: "Nobody told Kubernetes to create a new pod. The loop from M1.3 noticed, and acted.",
  obj: "Close the narrative loop opened in M1.2.",
  time: "3 min",
  script: "Explicitly call back to the story from M1.2. Same node failure, same OOM kill — but a controller was watching.\n\nThis is the moment where the reconciliation loop stops being abstract. Students are about to reproduce it themselves in the next lab.",
  next: "Let's go and watch it happen.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L1.4", title: "From Pod to Deployment",
  will: ["Deploy payment-service with 3 replicas",
         "Trace the ownership chain with ownerReferences",
         "Delete a pod and time the replacement",
         "Scale to 5 and back — and learn why that diverges from your YAML"],
  done: ["3/3 replicas ready", "A deleted pod is replaced automatically", "You can explain what owns a Pod"],
  validate: "make validate-lab LAB=L1.4",
  time: "55 minutes", file: "labs/day1/L1.4-deployments/",
  obj: "Reproduce self-healing and the ownership chain first-hand.",
  script: "The validation script actually deletes a pod and waits for the replacement, so it proves self-healing rather than asserting it.\n\nPush strong students to challenge 2 (relabel a pod). It is the most illuminating five minutes of the day.",
});

/* ========================= M1.8 — SERVICES ========================= */
L.sSection(p, {
  num: "M1.8", title: "Services",
  sub: "Stable identity for things that keep being replaced",
  objectives: ["Explain why pod IPs cannot be used directly",
               "Describe label selector → EndpointSlice → kube-proxy",
               "Expose a Deployment and prove load balancing"],
  time: "70 min",
  obj: "Solve the addressing problem self-healing creates.",
  script: "Frame it as a consequence: we just made pods disposable, which means their addresses are disposable too. Something has to be stable.",
});

L.sBanner(p, {
  chip: "THE PROBLEM", kind: "warn",
  big: "You just made pods disposable. Their IP addresses went with them.",
  sub: "A junior engineer hard-coded a pod IP into the gateway configuration. It worked for four hours. Then the pod was rescheduled, got a new IP, and every card authorisation failed until someone noticed.",
  points: [
    "Every pod replacement gets a new IP. You proved this yourself in L1.4.",
    "Three replicas means three IPs — and which one should a caller use?",
    "Scaling changes the set. Rescheduling changes the set. A node failure changes the set.",
    "You need one stable name that always points at whatever is currently healthy.",
  ],
  obj: "Motivate Services from the consequence of the previous module.",
  time: "4 min",
  script: "Ask them to recall the IPs they saw change in L1.4. The problem should already feel real.\n\nThen the framing sentence: pods are cattle, and cattle do not have fixed addresses. Something else has to hold the address.",
});

D.dService(p, {
  chip: "M1.8 · SERVICES", title: "Service → EndpointSlice → kube-proxy",
  obj: "Establish the selection chain and the direction of causation.",
  time: "10 min",
  script: "A Service is a stable virtual IP and DNS name backed by a live label selection, not a container that forwards traffic. The direction of causation is what people get wrong, so say it twice: a Service does not CONTAIN pods. It SELECTS them, continuously, by label.\n\nThe endpoint controller evaluates your selector and writes the result into an EndpointSlice. kube-proxy watches EndpointSlices and programs iptables or IPVS rules into the kernel.\n\nNote what is NOT in the request path: there is no proxy process. It is kernel rules. That is why a ClusterIP Service adds almost no latency, and it is the foundation of Thursday's networking module.\n\nPoint at the red box. Change a pod's labels and it silently drops out. Nothing errors.",
  ask: "kubectl get svc shows a healthy Service with a ClusterIP. Requests fail. What is the FIRST thing you check?",
  answer: "The EndpointSlice — kubectl get endpointslice -n <ns> -l kubernetes.io/service-name=<svc>. A Service always has an IP whether or not its selector matches anything. 'No endpoints' is the single most common Service bug, and get svc will never tell you.",
  callout: "This becomes INC-4 on Thursday, under time pressure. Students who write it on their cheat sheet today find it in two minutes then.",
});

L.sExplain(p, {
  chip: "M1.8 · SERVICES",
  title: "How a Service actually routes one packet",
  lead: "A Service gives clients a stable virtual IP and DNS name while backing pods change underneath. For a generic frontend→api call or AxisPay's edge-gateway→payment-service call, it selects ready endpoints and relies on node-level dataplane rules rather than a proxy container in every request path.",
  question: "edge-gateway calls http://payment-service:8080. Follow the packet.",
  steps: [
    ["Name to ClusterIP", "A generic frontend pod asks CoreDNS for `api` and gets the Service's ClusterIP — perhaps 10.96.14.22. That IP belongs to nothing: no interface anywhere in the cluster has it.", C.purple],
    ["Connect to a virtual IP", "The frontend opens a TCP connection to 10.96.14.22:8080. The packet leaves the Pod's network namespace and hits the node's kernel. AxisPay's edge-gateway does the same when it calls payment-service.", C.teal],
    ["Kernel DNAT", "iptables (or IPVS) rules programmed by kube-proxy match the destination and REWRITE it to one real pod IP — 10.244.2.7:8080 — chosen statistically among ready endpoints.", C.green],
    ["Delivered", "The packet is routed to that pod by the CNI, across the node boundary if needed. The reply is un-rewritten on the way back, so the client never learns which pod answered.", C.green],
  ],
  kicker: "There is no proxy process in the path. It is kernel rules — which is why ClusterIP costs almost no latency.",
  obj: "Make Service routing concrete rather than magical.",
  time: "7 min",
  script: "Step 1 usually gets a reaction: the ClusterIP is not assigned to any interface. It exists only as a match in a kernel rule. If you try to ping it you may get nothing, which confuses people who assume it is a real address.\n\nStep 3 is the load-balancing decision, and it happens per CONNECTION, not per request. That is the fact behind the keep-alive question on the demo slide and behind gRPC needing special handling.\n\nOn Thursday students will run iptables-save on a node and find these exact rules. Tell them that now so it lands as a payoff rather than a surprise.",
  ask: "Why can you not ping a ClusterIP?",
  answer: "Because nothing owns it. It is a destination-match in an iptables rule, not an address on an interface. The rules typically match TCP on the Service port only, so ICMP has nothing to match. A Service 'existing' and a Service 'working' are different things — which is exactly why you check EndpointSlices.",
});

L.sTable(p, {
  chip: "M1.8 · SERVICES", title: "DNS — the minimum you need today",
  lead: "Every Service gets DNS records inside the cluster. Search domains resolve short names only within the caller's namespace, so a generic frontend can call `api` locally, while cross-namespace calls need `service.namespace` or the full FQDN.",
  head: ["Form", "Resolves from", "Use it when"],
  colW: [4.6, 3.5, 4.0],
  rows: [
    ["api", "Same namespace only", "A frontend calling a backend beside it"],
    ["api.backend", "Anywhere in the cluster", "Readable cross-namespace calls"],
    ["payment-service.axispay-core.svc.cluster.local", "Anywhere. Fully qualified.", "The explicit form AxisPay uses in manifests"],
  ],
  rowH: 0.62,
  obj: "Give the fact now; the mechanism comes on Day 4.",
  time: "5 min",
  script: "Be explicit that this is a deliberate simplification and you will open it up on Thursday. Students appreciate being told when they are getting the short version.\n\nWhy AxisPay manifests always use the FQDN: edge-gateway lives in axispay-edge and calls payment-service in axispay-core. The short name would resolve to nothing. Using the FQDN everywhere removes a whole class of bug and makes the manifests copy-pasteable across namespaces.",
  tip: "In lab L1.5 students try all three forms from a pod in the wrong namespace and watch the short one fail. Much better than being told.",
});

L.sCode(p, {
  chip: "M1.8 · LIVE DEMO", title: "Proving load balancing — not asserting it",
  lead: "This is why every AxisPay service reports its own pod name.",
  lines: [
    { k: "cmd", t: "$ kubectl run lbtest -n axispay-core --rm -it --restart=Never \\" },
    { k: "cmd", t: "    --image=curlimages/curl:8.11.1 -- sh -c '" },
    { k: "cmd", t: "    for i in $(seq 1 20); do" },
    { k: "cmd", t: "      curl -s http://payment-service:8080/api/v1/_info \\" },
    { k: "cmd", t: "        | tr \",\" \"\\n\" | grep pod_name | cut -d: -f2 | tr -d \"\\\" \"" },
    { k: "cmd", t: "    done | sort | uniq -c'" },
    "",
    { k: "ok", t: "      7 payment-service-7d4f9c8b6-x7k2p" },
    { k: "ok", t: "      7 payment-service-7d4f9c8b6-p2n8w" },
    { k: "ok", t: "      6 payment-service-7d4f9c8b6-m9v4t" },
  ],
  note: "Twenty requests, three pods, roughly even. You did not configure a load balancer — the Service is one.",
  obj: "Demonstrate load balancing empirically.",
  time: "6 min",
  demo: "Run this live. Then scale to 5 replicas and run it again so students see the distribution change with no configuration edit.",
  script: "The /api/v1/_info endpoint exists in every AxisPay service precisely so this is visible. It is not scaffolding — you will use it tomorrow to watch a rolling update progress pod by pod, and on Thursday to prove anti-affinity spread replicas across nodes.\n\nIf someone asks why the distribution is not exactly 7/7/6: iptables uses statistical probability per rule, not round-robin. Over 20 requests you get approximate balance, not exact.",
  ask: "Why did I use a fresh curl per request instead of one long-lived connection?",
  answer: "Because kube-proxy load-balances CONNECTIONS, not requests. An HTTP keep-alive connection is balanced once and then every request on it goes to the same pod. This surprises people debugging 'uneven' load — and it is the reason gRPC needs special handling in Kubernetes.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L1.5", title: "Services and stable identity",
  will: ["Expose payment-service with a ClusterIP Service",
         "Read the EndpointSlice the selector produced",
         "Prove load balancing across three pods",
         "Break the Service with a one-word label change — and watch nothing error"],
  done: ["Service has 3 endpoints", "20 requests reach at least 2 distinct pods"],
  validate: "make validate-lab LAB=L1.5",
  time: "40 minutes", file: "labs/day1/L1.5-services/",
  obj: "Build and then deliberately break service discovery.",
  script: "Step 8 (relabel a pod) is the one to make sure everyone does. Seeing a Service silently lose an endpoint, with no error anywhere, is what makes them check endpoints first on Thursday.",
});

L.sCode(p, {
  chip: "M1.8 · WORKED EXAMPLE", title: "A real payment, end to end",
  lead: "Captured from the running platform. This is the exact response L1.6 produces.",
  lines: [
    { k: "cmd", t: "$ TOKEN=$(curl -s -X POST http://edge-gateway:8080/api/v1/login \\" },
    { k: "cmd", t: "    -H 'Content-Type: application/json' \\" },
    { k: "cmd", t: "    -d '{\"api_key\":\"ak_live_kalahari_7QK2XD9P4A\"}' | jq -r .access_token)" },
    "",
    { k: "cmd", t: "$ curl -s -X POST http://edge-gateway:8080/api/v1/charges \\" },
    { k: "cmd", t: "    -H \"Authorization: Bearer $TOKEN\" \\" },
    { k: "cmd", t: "    -H 'Idempotency-Key: my-first-payment' \\" },
    { k: "cmd", t: "    -d '{\"amount_minor\":129900,\"currency\":\"ZAR\"," },
    { k: "cmd", t: "         \"card_token\":\"tok_a71ef4c2900bd5386ff1240e\"}'" },
    "",
    { k: "ok",  t: "{ \"payment_id\":  \"pay_6633ac397928256cc24c17db\"," },
    { k: "ok",  t: "  \"reference\":   \"AXP-20260807-63075987\"," },
    { k: "ok",  t: "  \"status\":      \"captured\"," },
    { k: "hi",  t: "  \"amount_minor\": 129900,   \"fee_minor\": 2488,   \"net_minor\": 127412," },
    { k: "ok",  t: "  \"card_brand\":  \"visa\",   \"card_last4\": \"4242\"," },
    { k: "ok",  t: "  \"display_amount\": \"R1,299.00\" }" },
  ],
  size: 11.5,
  note: "129900 x 180bps = 2338, + 150 fixed = 2488 fee. Net 127412. fee + net = gross, EXACTLY — integer minor units, no floating point anywhere.",
  obj: "Show a real, verifiable end-to-end result before students attempt it.",
  time: "6 min",
  demo: "Run this live if you have the platform up. Then change the amount and let the room predict the fee before you press enter.",
  script: "Walk the arithmetic out loud. Kalahari's merchant discount rate is 180 basis points plus a R1.50 fixed fee.\n\nThe point to land is the last line of the note: fee plus net equals gross, exactly, every time. Floating point cannot represent 0.1 — in a ledger that must balance across ten thousand entries that is not pedantry, it is an audit finding waiting to happen. Money is an integer in minor units with a separate currency code, everywhere in this platform.",
  ask: "The card_token starts with tok_. Where is the actual card number stored?",
  answer: "Nowhere. It does not exist in this platform — not in the database, not in a fixture, not in a log. Only tokens. That is what keeps edge-gateway out of the cardholder data environment, and it is a real architectural decision rather than a simplification for the course.",
});

L.sCode(p, {
  chip: "M1.8 · WORKED EXAMPLE", title: "Idempotency — the same key must not charge twice",
  lead: "Real output. The client retried after a timeout; the customer was not charged again.",
  lines: [
    { k: "cmd", t: "# first call" },
    { k: "ok",  t: "HTTP 201   pay_6633ac397928256cc24c17db" },
    "",
    { k: "cmd", t: "# EXACT same request, EXACT same Idempotency-Key" },
    { k: "hi",  t: "HTTP 200   pay_6633ac397928256cc24c17db   Idempotent-Replay: true" },
    "",
    { k: "dim", t: "# same payment_id      -> no second charge" },
    { k: "dim", t: "# 200 instead of 201   -> 'here is the existing one', not 'I created one'" },
    { k: "dim", t: "# Idempotent-Replay    -> the client can tell the difference" },
  ],
  note: "Without the 200 and the header, a client that timed out and retried would believe it created a SECOND payment — and a merchant reconciling their books would see a discrepancy that does not exist.",
  obj: "Demonstrate the guarantee that makes payment APIs safe to retry.",
  time: "5 min",
  script: "This is non-negotiable in payments and it is built in from Day 1 rather than added later.\n\nThe subtle part is the status code. Returning 201 on a replay is a real bug — it tells the client it created something new. We found and fixed exactly that while building this platform; the gateway now propagates the downstream 200.\n\nStudents prove this themselves in L1.6 task 5.",
  ask: "A merchant's network drops after we authorise but before they receive the response. They retry. What must happen?",
  answer: "The same payment comes back, with 200 and Idempotent-Replay. Anything else risks charging the cardholder twice — and the merchant has no way to tell, because from their side both attempts look identical.",
});

L.sLab(p, {
  type: "INDEPENDENT LAB", id: "L1.6", title: "Four services, one platform",
  will: ["Deploy edge-gateway, auth-service and merchant-service unaided",
         "Take a real R1,299.00 payment end to end",
         "Prove idempotency — same key must not double-charge",
         "Trace one request across all four services by correlation ID"],
  done: ["Payment returns 201 with a reference", "Replay returns 200 + Idempotent-Replay", "Correlation ID found in all four logs"],
  validate: "make validate-lab LAB=L1.6",
  time: "55 minutes", file: "labs/day1/L1.6-platform-assembly/",
  obj: "Assemble the platform independently and process a real payment.",
  script: "This is INDEPENDENT. Fewer commands are given. Answer questions about TOOLS, not about answers.\n\nThe fee arithmetic is worth pointing at when they finish: Kalahari's MDR is 180 bps plus R1.50. 129900 x 0.0180 = 2338, +150 = 2488. Net 127412. Fee plus net equals gross, exactly — integer minor units, no floating point anywhere. In a ledger that must balance across ten thousand entries, that is not pedantry, it is an audit finding waiting to happen.",
  tip: "Task 6 (correlation ID tracing) is the Day 5 payoff planted on Day 1. Make sure everyone completes it and keeps the output.",
});

/* ========================= M1.9 — TRIAGE ========================= */
L.sSection(p, {
  num: "M1.9", title: "Troubleshooting as a method",
  sub: "You have four hours of Kubernetes knowledge. That is exactly why you learn the method now.",
  objectives: ["Apply the 6-step triage loop",
               "Diagnose an ImagePullBackOff unaided",
               "Distinguish a pod that cannot start from one that started and crashed"],
  time: "50 min",
  obj: "Install a repeatable investigation method before pattern-matching becomes possible.",
  script: "Say the subtitle out loud. Teaching triage on Day 1 is deliberate: they do not yet know enough to recognise symptoms, so they have to INVESTIGATE. That is the habit that transfers to production.",
});

D.dTriage(p, {
  chip: "M1.9 · TRIAGE", title: "The 6-step loop",
  obj: "Give students a repeatable method they will use eight more times this week.",
  time: "8 min",
  script: "In Kubernetes, debug outside-in: desired state, observed state, cluster signals, then application internals. Work outside-in. Steps 1 to 3 use only the control plane and ALWAYS work. Step 4 needs a container that started at least once.\n\nThat ordering matters. If you jump to kubectl logs first and get 'container is waiting to start', you have learned almost nothing and burned a minute you did not have. In about twenty minutes, that is exactly what will happen to about half of you.\n\nThe last two boxes are what separate an engineer from someone who got lucky. VERIFY: a fix is not a fix until you have proved it. And then: what would have caught this before a merchant phoned?",
  callout: "This loop is on the back of the Day 1 cheat sheet. It is the most portable thing anyone takes away from this course.",
  ask: "Why is 'what changed?' step 6 and not step 1?",
  answer: "Because you need to know what is actually broken before change history is useful. Ninety percent of the time it IS the recent change — but starting there biases you towards the last deploy and makes you blind to everything else. Accept the counter-argument too: experienced engineers often check it early. The point is to check it deliberately, not reflexively.",
});

L.sTable(p, {
  chip: "M1.9 · TRIAGE", title: "Reading a pod status — what it is actually telling you",
  lead: "Pod status is a compressed view of where startup or serving failed: scheduling, image pull, container start, probe success or shutdown. Read it correctly for a generic web-app or AxisPay's payment-service and it tells you which subsystem to inspect first and which commands will be useless.",
  head: ["Status", "Container started?", "First move"],
  colW: [3.5, 3.0, 5.6],
  rows: [
    ["Pending", "No — not even placed", "describe → Events. Scheduler could not place it."],
    ["ContainerCreating", "No — being set up", "describe. Usually image pull or volume mount."],
    ["ImagePullBackOff", "NEVER started", "describe → Events. logs will be USELESS."],
    ["CrashLoopBackOff", "Yes, then exited", "logs --previous. The app has something to say."],
    ["Running, 0/1 READY", "Yes, but not serving", "Readiness probe failing. Check the dependency."],
    ["Running, 1/1 READY", "Yes, and healthy", "Look further up the stack — Service, Ingress, DNS."],
    ["Terminating (stuck)", "Shutting down", "Finaliser or a grace period that has not elapsed."],
  ],
  rowH: 0.46,
  obj: "Give students a decision table they can use immediately.",
  time: "6 min",
  script: "Rows 3 and 4 are the pair that matters, and they are the most confused pair in Kubernetes.\n\nImagePullBackOff: the container NEVER started. RESTARTS is 0. There are no logs because there is no container. \n\nCrashLoopBackOff: the container started and exited, repeatedly. RESTARTS climbs. There ARE logs, and --previous is how you read the ones from the run that failed.\n\nThey will use this table in fifteen minutes, and again tomorrow for INC-2 — which is a CrashLoopBackOff caused by an OOM kill, deliberately paired against today's incident.",
  tip: "Teach kubectl get events --sort-by='.lastTimestamp' | tail -20 now. It is often faster than describing pods one at a time, and it shows the ORDER things happened in.",
});

L.sTable(p, {
  chip: "M1.9 · TRIAGE", title: "A node goes NotReady — five conditions and where each one comes from",
  lead: "Node conditions are health signals published by the kubelet, not application errors from one pod. Whether several generic apps fail together or AxisPay loses multiple services on one worker, NotReady or pressure often means many workload symptoms share one host-level cause.",
  head: ["Condition", "What it means", "First move"],
  colW: [3.5, 3.0, 5.6],
  rows: [
    ["Ready=False", "Kubelet cannot report healthy state — often API-server reachability loss or an unresponsive CRI/runtime.", "kubectl get nodes -o wide → describe node <name>. Then SSH / minikube ssh: journalctl -u kubelet -f and systemctl status containerd."],
    ["MemoryPressure", "Node is short on RAM. Kubelet starts evicting pods by QoS and priority, lowest protection first.", "describe node for pressure + evictions. Then find the hog: top, cgroup metrics, or a pod with no limits."],
    ["DiskPressure", "Ephemeral storage or image filesystem is nearly full — commonly container logs or a runaway image cache.", "describe node, then inspect /var/lib/containerd, image usage, and oversized pod logs before scheduling stalls spread."],
    ["PIDPressure", "Node has nearly exhausted process IDs — usually a fork bomb or a leaking process tree inside one workload.", "describe node, then inspect process counts on-host and isolate the pod spawning processes faster than they exit."],
    ["NetworkUnavailable", "Node networking is not configured yet. Rare after CNI settles; mostly seen during bootstrap or plugin failure.", "Check node Conditions and CNI daemonset / events. Treat as node plumbing, not an application bug."],
  ],
  rowH: 0.56,
  obj: "Teach that NotReady is a node-health problem with its own conditions, commands, and failure domains.",
  time: "7 min",
  script: "This is the node-level version of the previous table: when a node goes NotReady, pods are often only the SYMPTOM. In AxisPay production, start with three commands every time: kubectl get nodes -o wide, kubectl describe node <name>, then drill into kubelet logs on the host.\n\nReady=False is the important split: either kubelet cannot reach the API server, or kubelet can run but cannot talk to the container runtime. The pressure conditions are different again: MemoryPressure and DiskPressure change scheduling and trigger evictions; PIDPressure usually means one workload is creating processes faster than the node can reclaim them.\n\nNetworkUnavailable is the odd one out: it usually appears while the node is bootstrapping or the CNI is unhealthy, not because your payment-service image is wrong. The operational lesson is simple: when the node is sick, stop staring at pod YAML and go look at kubelet, runtime, and host resources.",
  ask: "If kubectl get pods shows five different apps failing on one worker at the same time, what do you check before opening five pod investigations?",
  answer: "The node. Run kubectl get nodes -o wide and kubectl describe node <name> first, because one NotReady or pressure condition can explain all five app symptoms at once.",
});

L.sBanner(p, {
  chip: "INCIDENT", kind: "warn",
  big: "SEV-2 · Merchant reports payment API failing.\nApproval rate 98.2% → 0%.",
  sub: "Kalahari Coffee Roasters have a queue at the counter. Two other merchants have confirmed the same thing. There was a deployment fifteen minutes ago. Ops on call needs an update in fifteen minutes.",
  points: [
    "You may use kubectl, the labs, the manual and your notes.",
    "You may ask me about TOOLS. You may not ask me about CAUSES.",
    "Work the loop. Write down what you find at each step.",
    "Scored on METHOD, not speed. Following the method and not finishing beats guessing correctly in thirty seconds.",
  ],
  obj: "Run the first unassisted incident.",
  time: "35 min (25 triage + 10 debrief)",
  script: "Inject with `make incident N=1` during the break, BEFORE this slide goes up. Then show this slide and start the clock.\n\nMost students find it in 8 to 14 minutes. If nobody has it at 15, prompt with: 'compare a failing pod with a healthy one — what is literally different between them?'\n\nDo not let a fast finisher announce the answer. Give them the challenge: write the Prometheus alert that would have paged the platform team at 16:22 instead of a merchant phoning at 16:31. They will deploy it on Day 5.",
  warn: "Watch for students who jump straight to kubectl logs. LET IT FAIL. It is the most valuable failure of the day and it makes the outside-in ordering permanent.",
  ask: "DEBRIEF — why did every replica fail at once, and what would have limited the blast radius?",
  answer: "The rolling update replaced all pods with the bad image. A readiness probe would have stopped the rollout after the first pod failed to become ready, leaving the old replicas serving. That is the strongest possible motivation for tomorrow's probe module — and it comes from an outage they just lived through. End the debrief here and let it hang overnight.",
});

/* ========================= CLOSE ========================= */
L.sAsk(p, {
  chip: "KNOWLEDGE CHECK", 
  q: "Eight questions. Answer out loud. Not scored — this is for both of us.",
  expect: [
    "1. What are the two states every Kubernetes object has, and who writes each?  →  spec (you), status (a controller)",
    "2. What owns a Pod created by a Deployment?  →  the ReplicaSet, not the Deployment",
    "3. A Service has a ClusterIP but requests fail. First command?  →  kubectl get endpointslice",
    "4. Do namespaces isolate the network?  →  No. Names, RBAC and quota only.",
    "5. ImagePullBackOff — will kubectl logs help?  →  No. The container never started.",
    "6. Which component decides WHERE a pod runs, and does it start it?  →  scheduler decides; kubelet starts",
    "7. Why must spec.selector be a subset of the pod template labels?  →  or the controller cannot own the pods it creates",
    "8. What single idea underlies every controller in Kubernetes?  →  the reconciliation loop",
  ],
  obj: "Formative check across all of Day 1.",
  time: "15 min",
  script: "Ask, pause, take an answer from the room, correct gently, move on. Roughly 90 seconds each.\n\nQuestions 3 and 5 are the ones that predict who will struggle tomorrow. If more than a third get either wrong, spend five minutes of tomorrow's recap on it rather than pressing on.",
});

L.sStats(p, {
  chip: "END OF DAY 1", dark: true, title: "What you built today",
  stats: [
    { v: "3", l: "namespaces, labelled as trust\nboundaries that Thursday's\nNetworkPolicies will select on", colour: C.teal },
    { v: "4", l: "Deployments and Services\nrunning, load-balanced,\nself-healing", colour: C.green },
    { v: "9", l: "pods across two namespaces,\ndiscovering each other\nby cluster DNS", colour: C.green },
    { v: "1", l: "real payment processed\nend to end, with correct fees\nand working idempotency", colour: C.amber },
  ],
  kicker: "None of this is thrown away. Every day this week extends exactly what is running now.",
  obj: "Consolidate and give a sense of achievement.",
  time: "3 min",
  script: "Have them run `kubectl get all -A -l app.kubernetes.io/part-of=axispay` and look at it. On day one of a Kubernetes course, they have a working payment platform. That is worth thirty seconds of pride before the assessment.",
});

L.sTable(p, {
  chip: "TOMORROW", title: "Day 2 — and why today made it necessary",
  lead: "Every gap below is one you can already feel.",
  head: ["What is missing right now", "What breaks because of it", "Fixed in"],
  colW: [4.3, 5.4, 2.4],
  rows: [
    ["No resource requests", "The scheduler is guessing. Pods land badly and get OOM-killed.", "L2.1"],
    ["No probes", "Kubernetes cannot tell 'started' from 'able to serve'. Today's incident took out all 3 replicas.", "L2.3"],
    ["No autoscaling", "Black Friday is a manual kubectl scale at 2am.", "L2.4"],
    ["No graceful shutdown", "A rolling update severs in-flight payments.", "L2.6"],
    ["Nothing runs on a schedule", "Settlement at 23:00 is a cron job on someone's laptop.", "L2.5"],
  ],
  obj: "Create demand for tomorrow from today's felt gaps.",
  time: "4 min",
  script: "Row 2 is the callback that matters. This morning's incident took out all three replicas simultaneously because nothing stopped the rollout. A readiness probe would have. They lived it — now they want the fix.\n\nEnd on that. Do not oversell tomorrow; the gap list sells itself.",
  next: "Assessment now — ten items, fifteen minutes. Then questions, then go home.",
});

p.writeFile({ fileName: "/tmp/deck/AxisPay-K8s-Day1.pptx" })
 .then(f => console.log("WROTE", f, "— slides:", p.__n));
