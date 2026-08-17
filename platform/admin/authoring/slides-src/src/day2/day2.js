const pptxgen = require("pptxgenjs");
const L = require("./lib.js");
const D = require("./diagrams.js");
const D2 = require("./diagrams2.js");
const { C } = L;

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "AxisPay Curriculum Team";
p.company = "Axis Financial Services (fictional)";
p.title = "AxisPay Kubernetes Comprehensive — Day 2";
p.subject = "Reliability, Resource Governance and Controlled Change";
p.__n = 0;
L.setDay(2);

/* ===================== OPENING ===================== */
L.sTitle(p, {
  eyebrow: "KUBERNETES COMPREHENSIVE · AXP-K8S-5D",
  title: "Day 2\nReliability & Controlled Change",
  sub: "Make it survive Monday morning. Traffic arrives, the platform must not fall over, and it must be upgradeable without dropping a single payment.",
  meta: [["DURATION", "7 hours"], ["THEORY", "225 min"], ["HANDS-ON", "325 min"], ["LABS", "6 + 1 incident"]],
  footer: "Yesterday you built the platform. Today you make it trustworthy.",
  obj: "Set Day 2's theme: reliability is engineered, not hoped for.",
  time: "2 min",
  script: "Open with yesterday's incident. It is still fresh and it is the reason for everything today.\n\nThe post-incident review asked one question: why did the rollout continue after the first pod failed? By 12:00 today they will have built the answer, and by 17:00 they will have measured it under 40 requests per second.",
  ask: "Yesterday's incident took out all three replicas at once. What SHOULD have stopped it after the first?",
  answer: "A readiness probe. The rollout would have stalled with the old pods still serving. Do not give the answer — collect guesses and tell them they will build it before lunch.",
});

L.sAsk(p, {
  chip: "MORNING RECAP", label: "Answers",
  q: "Five questions from yesterday. Answer out loud.",
  expect: [
    "What are the two states every object has, and who writes each?  →  spec (you), status (a controller)",
    "What owns a Pod created by a Deployment?  →  the ReplicaSet",
    "A Service has a ClusterIP but requests fail — first command?  →  kubectl get endpointslice",
    "Do namespaces isolate the network?  →  No. Names, RBAC and quota only.",
    "ImagePullBackOff: will kubectl logs help?  →  No. The container never started.",
  ],
  obj: "Retrieval practice — the single most effective retention technique available.",
  time: "20 min",
  script: "Ask, pause, take an answer, correct gently. Roughly two minutes each including discussion.\n\nQuestions 3 and 5 predict who will struggle today. If more than a third miss either, spend five extra minutes now — endpoints matter for probes, and describe-vs-logs matters for this afternoon's incident.",
  demo: "Then have everyone run `make validate-day1` to confirm their platform survived overnight. Deal with any broken clusters NOW, not at 11:00.",
});

L.sTable(p, {
  chip: "TODAY", title: "What is missing, and what breaks because of it",
  lead: "Kubernetes only behaves predictably when key runtime rules are declared explicitly. Each missing control below leaves the platform guessing about placement, health, scale or shutdown — and yesterday's incident was exactly that kind of ambiguity.",
  head: ["Missing right now", "What it costs you", "Fixed in"],
  colW: [3.9, 5.9, 2.3],
  rows: [
    ["No resource requests", "The scheduler is guessing. Pods land badly, get throttled, get OOM-killed.", "L2.1"],
    ["No namespace ceiling", "One workload can starve the whole namespace. It has happened.", "L2.2"],
    ["No probes", "Kubernetes cannot tell 'started' from 'able to serve'. Yesterday's incident.", "L2.3"],
    ["No autoscaling", "Black Friday is a manual kubectl scale at 06:00 — and nobody scales back down.", "L2.4"],
    ["Only Deployments", "No per-node agent, no batch reconciliation, no nightly settlement.", "L2.5"],
    ["No release strategy", "A deploy drops payments. In-flight authorisations are severed.", "L2.6"],
  ],
  obj: "Create demand for each module from a felt gap.",
  time: "5 min",
  script: "Work down the list. Each row is a lab. The point is that today's agenda is DERIVED from yesterday's pain rather than imposed by a syllabus.\n\nRow 3 is the callback that matters: yesterday's incident is on this slide as a line item.",
});

/* ===================== M2.2 RESOURCES ===================== */
L.sSection(p, {
  num: "M2.2", title: "Resource requests, limits and QoS",
  sub: "What the scheduler reserves, and what the kernel enforces",
  objectives: ["Calculate requests from observed usage rather than guessing",
               "Distinguish CPU throttling from an OOM kill by symptom",
               "Apply ResourceQuota and LimitRange to a namespace"],
  time: "90 min",
  obj: "Establish the resource model that scheduling, autoscaling and stability all rest on.",
  script: "This module looks administrative and is not. Requests are the input to the scheduler AND the denominator for autoscaling. Get them wrong and both break, quietly.",
});

L.sBanner(p, {
  chip: "THE SETUP", kind: "warn",
  big: "p99 authorisation: 217 ms.  SLO: 300 ms.\nHeadroom: 83 milliseconds.",
  sub: "This morning a merchant reports intermittent slowness. Nothing is down. Nothing has restarted. The logs are clean. Latency has simply crept past 300 ms during busy periods and nobody can say why.",
  points: [
    "The cause is a CPU limit set by someone who wanted to 'be safe'.",
    "It is consuming the entire 83 ms of headroom.",
    "It produces no log line, no event, and no restart.",
    "By the end of this module you will be able to find it in one command.",
  ],
  obj: "Motivate the module with an invisible failure.",
  time: "4 min",
  script: "The 217 ms is a real measurement from this platform, not an invented number — it is what the acquirer simulation plus five service hops actually costs.\n\nThe point to land: this failure mode has NO error. Students who only know how to read logs cannot find it at all.",
  ask: "Where would you look first for 'slow, but nothing is broken'?",
  answer: "Collect answers. Most say logs or the application. Almost nobody says cgroup throttling counters — which is exactly why it goes undiagnosed for weeks in real platforms.",
});

L.sCards(p, {
  chip: "M2.2 · RESOURCES", title: "Two numbers, two completely different jobs",
  lead: "In Kubernetes, requests and limits are separate resource declarations read by different subsystems. A request is a scheduler reservation used before a pod exists; a limit is a kernel-enforced ceiling applied after placement, so the same numbers answer two different operational questions.",
  cards: [
    { badge: "R", colour: C.teal, title: "requests", body: "A request is the amount of CPU or memory Kubernetes books on a node before a container starts. If a node has 2000m allocatable and 1400m already requested, a generic web-app asking for 300m fits and one asking for 700m does not, even if the node is nearly idle.\n\nThis is a reservation the scheduler uses for placement and bin-packing; it is not live usage." },
    { badge: "L", colour: C.amberD, title: "limits", body: "A limit is the runtime ceiling Linux enforces on the container's cgroup after placement. In AxisPay, a too-low CPU limit on payment-service silently burns the 83 ms latency headroom, while a too-low memory limit on fraud-service ends in OOMKilled and restart.\n\nLimits protect neighbours, but badly sized limits create the exact symptoms we debug today." },
  ],
  obj: "Separate scheduling from enforcement — the distinction most people never make.",
  time: "8 min",
  script: "The confusion to kill: people think requests and limits are 'minimum and maximum of the same thing'. They are not. They are inputs to two different systems that never talk to each other.\n\nThe scheduler only ever reads requests. The kernel only ever reads limits. A pod can be scheduled onto a busy node because its request is small, and then throttled because its limit is small. Those are unrelated events with unrelated causes.",
  ask: "A node has 2000m allocatable, 1900m already requested, and is 5% busy. Will a pod requesting 200m schedule there?",
  answer: "No. The scheduler works from reservations, not from actual usage. There is 100m unreserved. This surprises people the first time — an idle node that refuses work.",
});

D2.dReqLimit(p, {
  chip: "M2.2 · RESOURCES", title: "Requests book node space; limits cap runtime",
  obj: "Turn the requests-versus-limits distinction into a visual model.",
  time: "6 min",
  script: "Read left to right. The left panel is the scheduler's world: only requests exist there, so an idle node can still reject a pod because its booked capacity is full.\n\nThe right panel is the kernel's world: the pod already exists, and the question is no longer 'can it fit?' but 'how far may it run before the cgroup stops it?' That split explains most resource bugs.\n\nKeep the labels generic on purpose — this is the universal mechanism behind the AxisPay examples around it.",
  anim: "Reveal the left panel, then the pod spec, then the runtime panel.",
  ask: "If you double only the limit and leave the request untouched, which side of this diagram changes?",
  answer: "Only the runtime side. Scheduling is unchanged because the request — the booked amount — did not move. The pod may burst further once placed, but it does not become easier to schedule.",
});

L.sStats(p, {
  chip: "M2.2 · RESOURCES", dark: true,
  title: "The asymmetry that decides how you debug",
  stats: [
    { v: "CPU", l: "COMPRESSIBLE\nExceed the limit → THROTTLED\n\nSlow. No error. No event.\nNo restart. No log line.", colour: C.amber },
    { v: "MEM", l: "INCOMPRESSIBLE\nExceed the limit → OOMKILLED\n\nExit 137. Restart.\nImpossible to miss.", colour: C.red },
  ],
  kicker: "One is a latency mystery you will hunt for weeks. The other is a crash you find in thirty seconds.",
  obj: "Fix the single most useful distinction in resource debugging.",
  time: "6 min",
  script: "Say why: you can give a process less CPU and it simply runs slower — that is meaningful. You cannot give a process less memory; the bytes are either there or they are not. There is no 'slower' for memory, only 'stop'.\n\nExit 137 = 128 + 9 (SIGKILL). Worth writing on the whiteboard — they need it this afternoon for INC-2.",
  callout: "The command that finds throttling: cat /sys/fs/cgroup/cpu.stat inside the container. nr_throttled and throttled_usec. Put it on the cheat sheet.",
});

L.sExplain(p, {
  chip: "M2.2 · RESOURCES",
  title: "How the kernel actually enforces a CPU limit",
  lead: "A CPU limit is not an advisory setting inside Kubernetes. The kubelet translates it into a Linux cgroup quota, and the kernel enforces that quota in short repeating periods, so a container can look healthy overall while repeatedly being stopped for slices of time.",
  question: "You set limits.cpu: 500m. What does the kernel do with that number?",
  steps: [
    ["Translate to a quota", "For any CPU-limited container, kubelet writes a CFS quota into the cgroup's cpu.max file. Here it becomes \"50000 100000\": 50,000 microseconds of CPU every 100,000-microsecond period, so 500m means half a core.", C.teal],
    ["Meter each period", "Linux enforces that budget one period at a time. Every 100 ms the counter resets, and the container's threads may run until they have consumed their 50 ms of CPU across the node's cores.", C.teal],
    ["Stall the payment path", "On AxisPay, payment-service can burn that 50 ms budget early while fanning out to auth-service, fraud-service and the acquirer. The pod then waits for the rest of the 100 ms window while checkout requests simply queue behind it.", C.red],
    ["Find the proof", "The pod stays Running and the application logs stay clean, so the evidence is inside the container: cpu.stat shows nr_throttled and throttled_usec climbing. That is how the 'nothing is broken, but p99 is awful' incident is actually diagnosed.", C.red],
  ],
  kicker: "This is why a throttled service shows modest AVERAGE CPU and terrible p99 — the stalls are concentrated, not spread.",
  obj: "Explain the mechanism behind the invisible latency failure.",
  time: "8 min",
  script: "The 100 ms period is the part nobody knows, and it explains the symptom that otherwise makes no sense: 'CPU looks fine but latency is awful'.\n\nAveraged over a minute, a throttled container may show 45% CPU. But within each 100 ms window it is running flat out for 50 ms and frozen for 50 ms. A request that arrives during a freeze waits up to 80 ms for nothing. Under a payment SLO of 300 ms with 83 ms of headroom, that alone breaches it.\n\nIn L2.1 step 5 students throttle fraud-service to 100m and read nr_throttled themselves. This slide is what makes that number mean something.",
  ask: "Your service averages 40% CPU against its limit and p99 latency is terrible. What is your hypothesis?",
  answer: "Throttling. The average hides the shape — bursty work exhausts the per-period quota early and is then frozen for the rest of the period. Check nr_throttled in cpu.stat; if it is climbing, the limit is too low no matter what the average says.",
});

L.sTable(p, {
  chip: "M2.2 · RESOURCES", title: "QoS class — who gets evicted first",
  lead: "QoS is a derived eviction priority, not a field you type into YAML. Kubernetes assigns it from each container's requests and limits, then uses that class when a node runs short of memory or other critical resources.",
  head: ["Class", "Condition", "Evicted under node pressure", "AxisPay uses"],
  colW: [2.3, 5.2, 2.6, 2.0],
  rows: [
    ["Guaranteed", "requests == limits, for EVERY container and BOTH resources", "Last", "No — see C2"],
    ["Burstable", "requests set, limits higher (or absent)", "Second", "Yes, everywhere"],
    ["BestEffort", "nothing declared at all", "FIRST", "Never"],
  ],
  rowH: 0.62,
  obj: "Explain eviction ordering and justify AxisPay's choice.",
  time: "6 min",
  script: "The condition for Guaranteed is stricter than people expect: EVERY container in the pod, and BOTH cpu and memory. Miss one value on a sidecar and the whole pod drops to Burstable.\n\nWhy AxisPay is deliberately Burstable rather than Guaranteed: Guaranteed removes all burst capacity. Under a traffic spike a Guaranteed pod is throttled at exactly its request, which is the worst possible moment to have no headroom. We accept slightly higher eviction risk in exchange for burst room. That is a real trade and worth stating out loud.",
  ask: "A pod has two containers. The app declares requests and limits equal. The sidecar declares nothing. What QoS class is the pod?",
  answer: "Burstable — actually BestEffort is impossible here, but it is NOT Guaranteed. One under-declared container downgrades the whole pod. With a LimitRange the sidecar gets defaults, which makes it Burstable.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L2.1", title: "Requests, limits and QoS classes",
  will: ["Measure real usage with kubectl top under 25 rps of load",
         "Derive requests and limits yourself, then compare with the manifest",
         "Throttle fraud-service to 100m and watch p99 breach the SLO",
         "Read nr_throttled from the cgroup — the only signal there is",
         "OOM-kill routing-service and read exit code 137"],
  done: ["All workloads have requests AND limits", "No BestEffort pods", "You can name both failure symptoms"],
  validate: "make validate-lab LAB=L2.1",
  time: "45 minutes", file: "labs/day2/L2.1-resources/",
  obj: "Produce both failure modes deliberately.",
  script: "Insist they write down their own numbers BEFORE looking at the manifest. Guessing and then checking is how the intuition forms.\n\nSteps 5 and 6 are the payoff: same category of mistake, completely different symptom. They need that contrast this afternoon.",
});

L.sExplain(p, {
  chip: "M2.2 · GOVERNANCE",
  title: "What a namespace does — and does not — isolate",
  lead: "A namespace is a logical partition inside one Kubernetes cluster that scopes object names and can carry its own RBAC, quotas and defaults. It lets multiple teams or environments share a control plane without making every Service, Secret or Role globally unique.",
  question: "If two teams both create a Service named api, what keeps them separate?",
  steps: [
    ["Scope the names", "Object identity is namespace-qualified, so team-a/api and team-b/api are different Services with different DNS names, labels and policies. That is why the same simple names can be reused safely across a shared cluster.", C.teal],
    ["Attach local policy", "ResourceQuota, LimitRange and RBAC are evaluated per namespace. A generic web-app namespace can have its own CPU budget, default requests and read permissions without changing what another namespace is allowed to do.", C.teal],
    ["Apply it to AxisPay", "AxisPay keeps payment-service, auth-service and edge-gateway in axispay-core, while async work such as recon-worker lives outside that namespace. A batch retry must not consume the same budget or secret visibility as the live payment path.", C.amberD],
    ["Know the boundary", "Namespaces do not magically isolate network traffic. If axispay-core must be unable to talk to another namespace, that requires NetworkPolicy; namespace alone only scopes names, access and budgets.", C.red],
  ],
  kicker: "Namespaces are an administrative wall, not a packet filter. Treat quota and NetworkPolicy as separate controls.",
  obj: "Add the missing namespace-isolation theory before the governance lab.",
  time: "7 min",
  script: "The common mistake is to over-credit namespaces. They absolutely matter, but for names, RBAC and resource governance first.\n\nUse the generic example in steps 1 and 2, then pivot to axispay-core versus async work. That is the real operational reason for the split: noisy batch work and live payment traffic do not get to share one unbounded namespace budget.",
  ask: "Can two namespaces both contain a Service called web, and does that stop them reaching each other?",
  answer: "Yes, and no. The names do not collide because identity is namespace-qualified, but nothing about that alone blocks traffic. Reachability is controlled separately by the cluster network and any NetworkPolicy you apply.",
});

D2.dNamespace(p, {
  chip: "M2.2 · GOVERNANCE", title: "Namespace scoping inside one cluster",
  obj: "Visualise namespace-qualified names and per-namespace governance.",
  time: "5 min",
  script: "The duplicated names are the point: both namespaces have a Service called web and a database pod called db-0, and Kubernetes is perfectly happy because the namespace qualifies identity.\n\nThen land the second sentence at the bottom. Students often hear 'isolation' and assume a network wall. This diagram corrects that without turning into a NetworkPolicy module.",
  ask: "What can be different between these two namespaces even if the object names are identical?",
  answer: "Their RBAC, quotas, LimitRanges, labels, secrets and policies. Name reuse is only the visible part; the real value is that each namespace can carry a different operational contract.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L2.2", title: "Namespace governance: quota and LimitRange",
  will: ["Apply a ResourceQuota and a LimitRange to the CDE",
         "Get a Deployment REJECTED and read the message correctly",
         "Watch the LimitRange fill in defaults for a bare pod",
         "Verify the quota still allows the HPA to reach maxReplicas"],
  done: ["Quota and LimitRange applied", "You can read a FailedCreate on a ReplicaSet"],
  validate: "make validate-lab LAB=L2.2",
  time: "30 minutes", file: "labs/day2/L2.2-quota-limitrange/",
  obj: "Add namespace-level governance and verify it does not break autoscaling.",
  script: "The subtle point in step 3: the quota rejection appears on the ReplicaSet, NOT the Deployment. The Deployment just says 0/1 and looks fine. Students who only check `get deploy` cannot see why.\n\nStep 6 is the one professionals forget — a quota that blocks the HPA halfway up fails during exactly the spike it was meant to absorb.",
  warn: "A ResourceQuota WITHOUT a LimitRange breaks every manifest that forgot to declare resources — Kubernetes cannot count what was never declared. Say this explicitly; it is a real outage pattern.",
});

/* ===================== M2.3 PROBES ===================== */
L.sSection(p, {
  num: "M2.3", title: "Health probes",
  sub: "The most important 90 minutes of the week",
  objectives: ["Distinguish the three probes by their CONSEQUENCE",
               "Write dependency-aware readiness without breaking liveness",
               "Explain and reproduce probe-induced cascading failure"],
  time: "90 min",
  obj: "Close the biggest gap in the source syllabus.",
  script: "Say this out loud: the syllabus this course is based on does not mention probes at all. This module exists because almost every 'Kubernetes broke our deployment' story is a missing or wrong probe.",
});

D2.dProbes(p, {
  chip: "M2.3 · PROBES", title: "Three probes, three consequences",
  obj: "Anchor probes to consequences rather than definitions.",
  time: "10 min",
  script: "Work the columns left to right, and read the CONSEQUENCE row before the definition row. That inversion is deliberate.\n\nThe bottom row is the whole module: liveness must NEVER check a dependency; readiness SHOULD. Everything else follows from that.\n\nNote readiness reacts faster than liveness in our config — 10s versus 30s. That is on purpose: taking a pod out of rotation is cheap and reversible; restarting it is expensive and destroys in-flight work. When in doubt, stop sending traffic — do not restart.",
  anim: "Reveal one column at a time. Three clicks.",
  ask: "Your database is down for 30 seconds. Which probe should fail, and which must not?",
  answer: "Readiness should fail — stop sending traffic to a pod that cannot serve. Liveness must NOT fail — restarting the pod does not fix the database, and restarting every replica turns a blip into an outage. This is the next slide.",
});

D2.dCascade(p, {
  chip: "M2.3 · PROBES", title: "The cascading-failure bug",
  obj: "Show the most damaging probe mistake, and why it looks reasonable.",
  time: "8 min",
  script: "Frame it as a proposal, not a mistake: 'our architect wants liveness to check the database, so we restart pods that lose their connection.' It sounds careful. It sounds like defensive engineering.\n\nThen walk the right-hand column. A 40-second dependency blip — the kind that happens weekly — restarts every replica simultaneously, empties every connection pool, and the thundering herd of restarts makes recovery slower than the original problem.\n\nIn L2.3 step 6 they BUILD this and watch it happen. Do not spoil it here; just plant the shape.",
  warn: "This is one of the most common serious mistakes in production Kubernetes, and it is always made by someone who thought they were being careful.",
  ask: "Why does restarting not help when a dependency is down?",
  answer: "Because the pod was never broken. Restarting it discards a warm process and a working connection pool, then it comes up and finds the dependency still down. You have paid a cost and fixed nothing — and you have done it to every replica at once.",
});

L.sCode(p, {
  chip: "M2.3 · LIVE DEMO", title: "Readiness gates traffic without restarting",
  lead: "Watch the RESTARTS column. It does not move.",
  lines: [
    { k: "cmd", t: "$ kubectl exec -n axispay-core $POD -- \\" },
    { k: "cmd", t: "    curl -sX POST localhost:8080/api/v1/_admin/unready?value=true" },
    "",
    { k: "cmd", t: "$ kubectl get pods -n axispay-core -l app.kubernetes.io/name=payment-service" },
    { k: "dim", t: "NAME                              READY   STATUS    RESTARTS   AGE" },
    { k: "err", t: "payment-service-6b7f9d4c5-2xk9p   0/1     Running   0          4m12s" },
    { k: "ok",  t: "payment-service-6b7f9d4c5-8vm3q   1/1     Running   0          4m12s" },
    { k: "ok",  t: "payment-service-6b7f9d4c5-p7n2w   1/1     Running   0          4m12s" },
    "",
    { k: "cmd", t: "$ kubectl get endpointslice -n axispay-core -l kubernetes.io/service-name=payment-service" },
    { k: "hi",  t: "  2 addresses  (the unready pod was REMOVED — but not restarted)" },
  ],
  note: "0/1 and RESTARTS 0. Traffic stopped arriving; the process kept running; nothing was lost. When it recovers, it rejoins on its own.",
  obj: "Demonstrate the readiness mechanism live.",
  time: "8 min",
  demo: "Run this with `watch` on the EndpointSlice in a second terminal so the address disappears in real time. Then set value=false and watch it come back. Takes about 90 seconds and it is worth every one.",
  script: "The two things to point at: READY goes 1/1 → 0/1, and RESTARTS stays at 0.\n\nThat is the entire value of readiness. The pod told Kubernetes it could not serve; Kubernetes stopped sending it traffic and left it alone. No restart, no lost state, automatic recovery.",
  ask: "How long between the pod becoming unready and traffic actually stopping?",
  answer: "periodSeconds x failureThreshold (5 x 2 = 10s) PLUS endpoint propagation to every node's kube-proxy. Call it 10-15 seconds. That gap is real, and it is why preStop exists — L2.6.",
});

L.sMistakes(p, {
  chip: "COMMON MISTAKES", title: "Probe mistakes and what they look like",
  rows: [
    ["Generic web-api liveness checks its database", "ALL replicas restart together on a dependency blip", "Liveness -> /healthz. Process only."],
    ["Generic rollout has no readiness probe", "Deploy 'succeeds' while cold pods still receive traffic", "Readiness -> /readyz, checks dependencies"],
    ["payment-service liveness checks merchant-service", "Merchant outage restarts every payment pod", "Dependency truth belongs in readiness, not liveness"],
    ["auth-service cold start has no startupProbe", "CrashLoopBackOff during key load or cache warm-up", "startupProbe with a real startup budget"],
    ["edge-gateway readiness successThreshold > 1", "The pod stays unready far longer than intended", "Readiness successThreshold must stay 1"],
    ["payment-service /readyz only checks HTTP listener", "Probes pass, but authorisations still fail downstream", "Make /readyz reflect REAL serving dependencies"],
  ],
  obj: "Pre-empt the six probe errors students are about to make.",
  time: "6 min",
  script: "Row 1 is the one they will build deliberately in twenty minutes. Row 2 is yesterday's incident. Row 6 is the subtle one worth a moment: a readiness probe that returns 200 as long as the HTTP server is up tells you nothing about whether the service can take a payment.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L2.3", title: "Probes that tell the truth",
  will: ["Prove Kubernetes cannot currently tell a working pod from a broken one",
         "Apply all three probes across the platform",
         "Watch readiness remove a pod from endpoints WITHOUT restarting it",
         "BUILD the cascading-failure bug and watch every replica restart",
         "Use a startup probe to protect a 25-second cold start"],
  done: ["Three probes on every service", "Liveness targets /healthz, never /readyz", "You have seen the cascade"],
  validate: "make validate-lab LAB=L2.3",
  time: "50 minutes", file: "labs/day2/L2.3-probes/",
  obj: "Build correct probes, then deliberately build the wrong one.",
  script: "Step 6 is the centrepiece of Day 2. They point liveness at /readyz, scale merchant-service to zero for 40 seconds, and watch all three payment pods restart together.\n\nDo not rescue them. Let the restart counter climb. Then have them undo it and explain to a neighbour what they just saw.",
  warn: "The validation script FAILS the lab if liveness points at /readyz. That is deliberate — leaving the bug in place would carry it into Day 5's capstone.",
});

/* ===================== M2.4 SCALING ===================== */
L.sSection(p, {
  num: "M2.4", title: "Scaling",
  sub: "Manual, automatic, and the arithmetic that connects them to requests",
  objectives: ["Scale manually and explain who places the new pods",
               "Configure an HPA and prove why it needs requests",
               "Explain scale-up and scale-down stabilisation"],
  time: "90 min",
  obj: "Deliver autoscaling and its hard dependency on resource requests.",
  script: "The whole module hangs on one formula. Get that on the board early.",
});

D2.dHPA(p, {
  chip: "M2.4 · SCALING", title: "The HPA loop — and its denominator",
  obj: "Make the requests-to-HPA dependency arithmetic rather than assertion.",
  time: "9 min",
  script: "Write the formula on the whiteboard as well. Then point at the red box.\n\nUtilisation is a percentage OF THE REQUEST. Not of the limit. Not of the node. With no request there is literally no denominator, and the HPA reports <unknown> and does nothing — silently, with no error and no event.\n\nIn L2.4 step 2 they create an HPA on a Deployment with no requests and watch it sit at <unknown> forever. Seeing that once means they will never debug it blind.",
  ask: "Four pods, each at 140% of request, target 70%. How many replicas does the HPA request?",
  answer: "ceil(4 x 140 / 70) = ceil(8) = 8. Have them do the arithmetic out loud — it makes the formula concrete and it is a common interview question.",
  callout: "Kubernetes' own event text says 'cpu resource utilization (percentage of request)'. The API is telling you what the denominator is.",
});

L.sExplain(p, {
  chip: "M2.4 · SCALING",
  title: "One HPA cycle, worked end to end",
  lead: "The HorizontalPodAutoscaler is a feedback controller that periodically compares observed metrics with a target and rewrites a workload's desired replica count. For CPU scaling, the utilisation calculation is always relative to each ready pod's CPU request, so request sizing directly changes the answer.",
  question: "Generic web-api: 2 pods, request 200m, target 70%. Load arrives. Walk one 15-second cycle.",
  steps: [
    ["Read usage", "The HPA reads CPU metrics gathered from kubelets via metrics-server. In a generic example, pod A reports 260m and pod B 220m; because the pipeline scrapes periodically, the numbers are near-real-time but can already be 15-30 seconds old.", C.teal],
    ["Compute utilisation", "CPU utilisation is usage divided by request for each READY pod. So 260/200 = 130% and 220/200 = 110%; the average is 120%. The denominator is the REQUEST, not the limit and not node capacity.", C.amberD],
    ["Apply it to AxisPay", "fraud-service uses the same arithmetic. With 2 pods at 198m and 186m on a 150m request, average utilisation is 128%, so the controller computes ceil(2 x 128 / 65) = 4 replicas.", C.green],
    ["Clamp by policy", "AxisPay still bounds that raw answer by policy. scaleUp allows +2 pods per 30s and at most 100%; minReplicas is 2 and maxReplicas is 6. Four fits, so the HPA writes spec.replicas: 4.", C.green],
    ["Hand off", "The HPA updates desired state and stops there. The Deployment controller notices 4 desired versus 2 actual and creates the extra fraud-service pods; the HPA never creates pods directly.", C.teal],
  ],
  kicker: "Change the request to 600m and utilisation becomes 32% — the HPA scales DOWN. Same load, opposite decision.",
  obj: "Make the HPA arithmetic concrete and show how the request changes the answer.",
  time: "9 min",
  script: "Do the arithmetic on the whiteboard as you go. Students who have watched this once never mis-set an HPA target again.\n\nThe kicker is the sharpest point on the slide: the SAME load produces the opposite scaling decision depending only on what you wrote in the request. The request is not documentation — it is the denominator of an equation that controls your capacity.\n\nAlso flag step 1: metrics are up to 30 seconds stale, so the HPA reacts on the order of 30-60 seconds. It cannot absorb a sub-minute spike; that is what minReplicas headroom is for.",
  ask: "Someone doubles the CPU request to make the pod 'safer'. What happens to autoscaling under identical load?",
  answer: "Utilisation halves, so the HPA scales down — fewer pods carrying the same traffic, and each one throttled sooner. Raising a request to be safe can make you LESS available. This is genuinely counter-intuitive and worth the pause.",
});

L.sTable(p, {
  chip: "M2.4 · SCALING", title: "Scale up fast. Scale down slowly.",
  lead: "Autoscaling is intentionally asymmetric because adding capacity and removing capacity carry different risks. Kubernetes usually scales up quickly to absorb demand, but scales down cautiously so short-lived dips do not create oscillation.",
  head: ["", "Scale UP", "Scale DOWN"],
  colW: [3.0, 4.55, 4.55],
  rows: [
    ["Stabilisation window", "15–30 seconds", "300 seconds"],
    ["Why", "Payments do not wait. A spike must be absorbed now.", "Removing capacity too eagerly causes flapping."],
    ["The failure it prevents", "Queueing, latency breach, timeouts", "Remove pods → latency rises → scale up → remove again"],
    ["What it costs", "Slightly over-provisioned during a spike", "Five minutes of extra capacity. Almost nothing."],
  ],
  rowH: 0.72,
  obj: "Justify the behavior block rather than presenting it as configuration.",
  time: "6 min",
  script: "Flapping is the failure to name. Each cycle costs a pod start and a cold connection pool, and the oscillation is measurably worse than simply keeping the pods.\n\nIn L2.4 step 6 they stop the load and watch NOTHING happen for five minutes. That silence is the lesson — most people assume something is broken.",
});

L.sBanner(p, {
  chip: "WARNING", kind: "warn",
  big: "Autoscaling responds to LOAD.\nIt cannot fix CORRECTNESS.",
  sub: "In L2.4 step 7 you scale merchant-service to zero. Payments start failing. The HPA does nothing at all — because CPU usage FALLS. The pods are idle precisely because they cannot serve.",
  points: [
    "An HPA scales a bottleneck. It cannot scale around a broken dependency.",
    "payment-service spends most of its time WAITING on the acquirer, not burning CPU — so CPU is a poor signal for it (challenge C3).",
    "Scaling a service that is failing just gives you more failing replicas.",
    "Custom and external metrics exist for exactly this. Signposted on Day 5.",
  ],
  obj: "Set the boundary of what autoscaling can do.",
  time: "5 min",
  script: "This is the slide that stops students treating the HPA as a general reliability mechanism. It is a capacity mechanism, and only for the resource you scale on.",
});

L.sCode(p, {
  chip: "M2.4 · WORKED EXAMPLE", title: "The velocity bug, measured",
  lead: "Real output from fraud-service. Twelve rapid attempts on one card.",
  lines: [
    { k: "cmd", t: "$ for i in $(seq 1 12); do curl -sX POST fraud-service:8080/api/v1/score \\" },
    { k: "cmd", t: "    -d '{\"card_token\":\"tok_3f6a91...\",\"amount_minor\":1450000,\"currency\":\"KES\"}'; done" },
    "",
    { k: "hi",  t: "scores:    [22, 22, 30, 30, 44, 44, 44, 44, 67, 67, 67, 67]" },
    { k: "hi",  t: "decisions: [approve x8,                    review x4]" },
    "",
    { k: "cmd", t: "$ curl -s fraud-service:8080/api/v1/velocity/tok_3f6a91..." },
    { k: "ok",  t: "{ \"recent_attempts\": 12," },
    { k: "ok",  t: "  \"window_seconds\": 300," },
    { k: "err", t: "  \"counted_by_pod\": \"fraud-service-6d4b9f7c8-f8j3k\"," },
    { k: "err", t: "  \"warning\": \"in-memory per-pod counters\" }" },
  ],
  size: 11.5,
  note: "counted_by_pod is the tell. Each replica has its OWN counters. With 6 pods behind the Service, each sees ~1/6 of the traffic — so a rule of 'more than 8 in 5 minutes' effectively fires at 48.",
  obj: "Show a security control silently weakening as it scales.",
  time: "7 min",
  script: "This is challenge C1 in L2.4 and it is the best question of the day.\n\nScaling up for PERFORMANCE has quietly degraded a SECURITY control. Nothing errors. No alert fires. Every dashboard looks healthy. The fraud rule is simply three times weaker at 3 replicas than it was at 1, and six times weaker at 6.\n\nThis is the fundamental tension between per-replica state and horizontal scaling, and it is exactly what Redis fixes tomorrow. Do not resolve it now — let it sit.",
  ask: "You scale fraud-service from 2 to 6 replicas to cut latency. What just happened to your fraud thresholds?",
  answer: "They became three times weaker. A card that would have been flagged at 8 attempts now needs 24 to trip any single replica. Nobody changed a threshold; nobody was notified. Accept any answer that identifies the dilution.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L2.4", title: "Autoscaling under merchant load",
  will: ["Scale manually and see why it diverges from your YAML",
         "Create an HPA with NO requests and watch it report <unknown> forever",
         "Drive 60 rps through loadgen and watch fraud-service scale 2 to 6",
         "Stop the load and watch nothing happen for five minutes",
         "Break a dependency and watch the HPA correctly do nothing"],
  done: ["Both HPAs report a percentage, not <unknown>", "You watched a real scale-up event"],
  validate: "make validate-lab LAB=L2.4",
  time: "55 minutes", file: "labs/day2/L2.4-autoscaling/",
  obj: "Observe autoscaling on genuine CPU load.",
  script: "fraud-service is CPU-bound BY DESIGN — it evaluates a model per request. That is not an accident of the code; a service that does no work cannot demonstrate horizontal scaling, and an autoscaling lab built on sleep() teaches nothing.\n\nChallenge C1 is the best one of the day: fraud velocity counters are in memory, so with 6 replicas each pod sees a sixth of the traffic and the fraud control silently weakens as you scale. Day 3 fixes it with Redis.",
});

/* ===================== M2.5 WORKLOADS ===================== */
L.sSection(p, {
  num: "M2.5", title: "The other three controllers",
  sub: "DaemonSet, Job, CronJob — when a Deployment is the wrong shape",
  objectives: ["Choose the correct controller for a given workload",
               "Explain the DaemonSet per-node invariant",
               "Reason about concurrencyPolicy for a settlement batch"],
  time: "85 min",
  obj: "Complete the workload taxonomy.",
  script: "Frame it as shape-matching. Most people reach for a Deployment reflexively; three of today's workloads are not one.",
});

D2.dWorkloads(p, {
  chip: "M2.5 · WORKLOADS", title: "Choose by shape, not by habit",
  obj: "Give a decision rule students can apply immediately.",
  time: "8 min",
  script: "Read the left column as the sentence someone actually says in a planning meeting, then the controller that sentence implies.\n\nThe DaemonSet row deserves a pause: there is no replicas field. You never choose the count — the node inventory chooses it. Add a node and a pod appears. That is a different mental model from everything they met yesterday.\n\nStatefulSet is greyed out on purpose. It needs PersistentVolumes and headless Services, which is tomorrow.",
  ask: "PCI requires file-integrity monitoring on every node that touches cardholder data. Which controller, and why not a Deployment with replicas equal to the node count?",
  answer: "DaemonSet. A Deployment with replicas: 3 gives you three pods somewhere — possibly two on one node and none on another. Nothing guarantees coverage, and it does not follow the node inventory when a node is added. An unmonitored node is the one that will fail your audit.",
});

L.sCards(p, {
  chip: "M2.5 · WORKLOADS", title: "Job and CronJob: the fields that matter",
  lead: "Jobs and CronJobs manage finite work rather than continuously serving traffic. Their key fields answer three control questions: when should work start, how long may it run, and what should Kubernetes do if an attempt fails, runs late or collides with another run?",
  cards: [
    { badge: "J", colour: C.amberD, title: "Job", body: "A Job tracks completion, so failure policy matters more than steady-state uptime. backoffLimit: 4 means retry the pod four times before the Job is marked failed, with exponential back-off between attempts.\n\nactiveDeadlineSeconds is a wall-clock cutoff, and restartPolicy must be Never or OnFailure because Always would never let the Job finish." },
    { badge: "C", colour: C.purple, title: "CronJob", body: "A CronJob adds a schedule, overlap policy and missed-run handling on top of a Job. A generic nightly report uses concurrencyPolicy: Forbid so one slow run does not spawn a second copy on top of it.\n\nIn AxisPay, timeZone makes settlement align with the merchant's business day, and startingDeadlineSeconds allows a late start without replaying stale money movement." },
  ],
  obj: "Cover the fields that cause real incidents.",
  time: "8 min",
  script: "restartPolicy: Always is REJECTED for a Job — worth saying why. With Always the container would restart on success and the Job could never complete. The API refuses it rather than letting you build something that can never finish.\n\nconcurrencyPolicy for settlement: Allow would double-count. Replace would kill a run mid-way and leave partial work. Forbid is the only defensible value for money movement, and students should be able to argue that.",
  ask: "Your settlement CronJob is set to 0 23 * * * with no timeZone, on a cluster in UTC, for merchants in Johannesburg. When does it actually run, and what does it settle?",
  answer: "01:00 the NEXT day, local time. So the 'Tuesday' batch runs on Wednesday morning and may pick up Wednesday's early transactions. That is a genuine accounting defect and it is entirely silent.",
});

D2.dCronJob(p, {
  chip: "M2.5 · WORKLOADS", title: "CronJob creates Jobs; Jobs own Pods",
  obj: "Make the controller chain and overlap policy visual.",
  time: "6 min",
  script: "Point at the lanes. The CronJob's job is to notice the schedule and create a Job object. The Job's job is then to create pods, retry failures and declare completion. Students often compress those into one thing; this slide separates them.\n\nThen land the Forbid branch on the right. That single policy choice is what stops a slow batch from double-running itself at the next schedule boundary.",
  ask: "If the CronJob fires again while the previous Job is still running and concurrencyPolicy is Forbid, what new pod appears?",
  answer: "None. The second schedule hit is noticed, but the controller skips creating a new Job. That is exactly what you want for non-idempotent business work such as settlement or payout files.",
});

L.sLab(p, {
  type: "INDEPENDENT LAB", id: "L2.5", title: "The other three controllers",
  will: ["Deploy node-agent and prove the one-per-node invariant",
         "Add a node and watch an agent appear with no manifest change",
         "Work out why node-agent needs a toleration and payment-service does not",
         "Run recon-worker, then break it and watch backoffLimit bound the retries",
         "Schedule settlement-cron, trigger it manually, and reason about Forbid"],
  done: ["One node-agent per node", "recon-worker succeeded", "CronJob has timeZone and Forbid"],
  validate: "make validate-lab LAB=L2.5",
  time: "45 minutes", file: "labs/day2/L2.5-workload-types/",
  obj: "Deploy all three controllers independently.",
  script: "INDEPENDENT — fewer commands given. Answer questions about tools, not answers.\n\nTask 1's node-add is worth doing as a room: `minikube node add -p axispay` while everyone watches `kubectl get pods -n axispay-ops -o wide -w`. The new agent appearing with nobody editing anything makes the invariant concrete.",
  tip: "The recon-worker log line to point at: 'balanced: true'. gross == fees + net, in integer minor units, across every currency. That is the ledger invariant a real reconciliation checks.",
});

/* ===================== M2.6 ROLLOUTS ===================== */
L.sSection(p, {
  num: "M2.6", title: "Rolling updates, rollbacks and graceful shutdown",
  sub: "Release under live traffic. Prove it, do not assert it.",
  objectives: ["Explain maxSurge and maxUnavailable arithmetically",
               "Perform a zero-downtime release and MEASURE it",
               "Explain SIGTERM, grace period and preStop"],
  time: "95 min",
  obj: "Deliver safe release, and prove the probe dependency.",
  script: "This module is where Day 2 pays off. Everything before it exists to make this work.",
});

D2.dRollout(p, {
  chip: "M2.6 · ROLLOUTS", title: "maxSurge 1, maxUnavailable 0 — step by step",
  obj: "Make the rollout arithmetic concrete before students run it.",
  time: "9 min",
  script: "Walk the timeline. The key transition is t1 to t2: the new pod exists but is NOT serving until readiness passes. That gate is the entire safety mechanism.\n\nmaxUnavailable: 0 means strictly add-then-remove. Capacity never drops. The cost is headroom for one extra pod and a slower release — for a payment path, correct.\n\nAt t5 the old ReplicaSet is retained at zero replicas. That is what makes rollback near-instant, and it is why yesterday's ownership-chain module mattered.",
  anim: "Reveal one time step at a time. Five clicks.",
  ask: "replicas 3, maxSurge 1, maxUnavailable 0. What is the maximum number of pods that exist at once, and the minimum number SERVING?",
  answer: "Maximum 4, minimum serving 3. Then ask the follow-up: what if maxSurge were 0 as well? Answer: the rollout could never start — it cannot add a pod and cannot remove one. Kubernetes rejects that combination.",
});

L.sCode(p, {
  chip: "M2.6 · THE PROOF", title: "Not 'it worked'. Measured.",
  lead: "4,812 real payment requests, across a version change that added two new dependencies.",
  lines: [
    { k: "cmd", t: "$ curl -s localhost:8090/api/v1/loadgen/stats | jq" },
    "",
    { k: "ok",  t: "requests: 4812      ok: 4812      FAILED: 0" },
    { k: "ok",  t: "availability: 100.0%          (SLO 99.5%)" },
    { k: "ok",  t: "p99 latency: 241.8 ms          (SLO 300 ms)" },
    { k: "dim", t: "status codes: {'201': 4788, '409': 24}" },
    { k: "dim", t: "   409 = fraud declines — a business outcome, not an availability failure" },
    "",
    { k: "cmd", t: "# now remove the readiness probe and repeat:" },
    { k: "err", t: "FAILED: 37          availability: 98.412%" },
    { k: "err", t: "status codes: {'201': 2258, '502': 37, '409': 11}" },
  ],
  note: "Same rollout. Same cluster. The only difference is one probe.",
  obj: "Deliver the evidence that makes the probe argument unanswerable.",
  time: "8 min",
  demo: "Do the FIRST half live if time allows — start loadgen at 40 rps, apply the rollout, and let the room watch the FAILED counter stay at zero. Then show the second half from this slide rather than running it, to save time.",
  script: "Note the 409s are counted as OK. A fraud decline is a correct business outcome; counting it as an availability failure would make the SLO lie. That distinction is deliberate in the loadgen code and worth pointing at — SLO definition is where a lot of dishonesty hides.\n\nThen the second block. Same rollout, no readiness probe, 37 real failed payments. That is the argument. Nobody needs convincing after seeing both numbers.",
  callout: "This is the direct answer to yesterday's post-incident question: why did the rollout continue after the first pod failed? Because nothing was checking.",
});

L.sTable(p, {
  chip: "M2.6 · GRACEFUL SHUTDOWN", title: "SIGTERM, grace period, SIGKILL — and why the order matters",
  lead: "Pod termination in Kubernetes is a coordinated shutdown sequence, not an instant stop. Traffic removal and process termination happen in parallel, so applications need time to leave load balancers, stop accepting new work and finish in-flight requests before the kernel finally forces them down.",
  head: ["#", "What happens", "Why it matters"],
  colW: [0.7, 5.6, 5.8],
  rows: [
    ["1", "Pod marked Terminating; endpoint controller removes it from the EndpointSlice", "New traffic should stop — but that removal must propagate to every node"],
    ["2", "preStop hook runs: sleep 8", "This delay gives step 1 time to reach kube-proxy everywhere"],
    ["3", "SIGTERM sent to PID 1", "App should stop new work and finish in-flight requests; in AxisPay, live authorisations"],
    ["4", "Up to terminationGracePeriodSeconds (45s) to exit", "Set it longer than the LONGEST authorisation or callback, not the average"],
    ["5", "SIGKILL if still alive", "This cannot be caught. Any work still running is severed."],
  ],
  rowH: 0.66,
  obj: "Explain the termination sequence and the reason preStop exists.",
  time: "7 min",
  script: "The non-obvious part is step 2. Endpoint removal is EVENTUALLY CONSISTENT — it must reach every node's kube-proxy independently. Without the pause, the process can stop accepting connections while some nodes are still routing to it. Those requests are severed mid-authorisation.\n\nEight seconds of sleep buys correctness for in-flight payments. It looks like a hack; it is the standard answer.\n\nAlso flag the exec-form ENTRYPOINT in the Dockerfile: with the shell form, PID 1 is /bin/sh, which does NOT forward SIGTERM. Kubernetes would wait the full 45 seconds and then SIGKILL every pod on every rollout — turning zero-downtime into guaranteed-downtime, silently.",
  ask: "Your grace period is 45s and a batch request can take 90s. What happens?",
  answer: "SIGKILL at 45 seconds, mid-request. The grace period must exceed the LONGEST possible in-flight operation, not the average. Either raise it, or make long operations resumable. This is challenge C3 in the lab.",
  warn: "Dockerfile ENTRYPOINT must use exec form [\"python3\", ...]. Shell form makes /bin/sh PID 1, which swallows SIGTERM and breaks graceful shutdown for every workload — with no error anywhere.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L2.6", title: "Zero-downtime release under live traffic",
  will: ["Start measuring BEFORE changing anything",
         "Roll out v1.1.0 — fraud scoring and acquirer routing — under 40 rps",
         "Prove zero failures with the loadgen counter",
         "REMOVE the readiness probe and measure the difference",
         "Stall a bad release and watch old pods keep serving",
         "Observe SIGTERM, preStop and the 45-second grace period"],
  done: ["payment-service on v1.1.0", "Zero failed payments across the rollout", "You measured both with and without the probe"],
  validate: "make validate-lab LAB=L2.6",
  time: "55 minutes", file: "labs/day2/L2.6-zero-downtime-rollout/",
  obj: "Release safely under load, and measure the probe's contribution.",
  script: "Step 1 matters: baseline BEFORE the change. A release you did not measure beforehand is one you cannot prove anything about afterwards.\n\nStep 7 is subtle and worth calling out when they get there: the bad release STALLS and the old pods keep serving. maxUnavailable: 0 means a broken release cannot take capacity away. It fails safe, with no human deciding anything.",
});

/* ===================== M2.7 INCIDENT ===================== */
L.sCode(p, {
  chip: "M2.5 · WORKED EXAMPLE", title: "recon-worker — a Job's output and its exit code",
  lead: "Real output. Note the last line: the exit code IS the Job's success signal.",
  lines: [
    { k: "cmd", t: "$ kubectl logs -n axispay-async job/recon-worker" },
    "",
    { k: "dim", t: '{"service":"recon-worker","pod":"recon-worker-x7k2p","node":"axispay-m02",' },
    { k: "dim", t: '  "msg":"reconciliation started","mode":"normal"}' },
    { k: "ok",  t: '{"msg":"currency position","currency":"ZAR","count":16,' },
    { k: "hi",  t: '  "gross_minor":804900,"fees_minor":16888,"net_minor":788012,"balanced":true}' },
    { k: "ok",  t: '{"msg":"reconciliation complete","total_payments":16,"breaks":0}' },
    "",
    { k: "cmd", t: "$ kubectl get job,pods -n axispay-async" },
    { k: "ok",  t: "job.batch/recon-worker   Complete   1/1        6s" },
    { k: "ok",  t: "pod/recon-worker-x7k2p   0/1        Completed  6s" },
  ],
  size: 11,
  note: "804900 = 16888 + 788012. The ledger balances, in integer minor units, across every currency. That invariant is what a real reconciliation checks — and a break here is something a human must explain before close of business.",
  obj: "Show what 'complete' means for a Job, and what the job actually checks.",
  time: "6 min",
  script: "Two things to point at.\n\nFirst, the pod STATUS is Completed and READY is 0/1 — which looks alarming until you realise that is exactly right. A Job's pod is supposed to stop. Success is defined by exit code 0, not by staying up. That is the whole difference from a Deployment.\n\nSecond, balanced:true. gross equals fees plus net, exactly, in every currency. In L2.5 students set RECON_MODE=fail and watch backoffLimit bound the retries — same Job, exit code 1, five attempts with exponential back-off, then BackoffLimitExceeded.",
  ask: "The reconciliation finds three breaks. Should the Job exit 0 or 1?",
  answer: "0. Breaks are a FINDING, not a failure — the job did its work correctly. Exiting non-zero would make Kubernetes retry the reconciliation, which cannot fix the underlying data and just burns the backoffLimit. The code comments say exactly this. Distinguishing 'the job failed' from 'the job found a problem' is a real design decision.",
});

L.sBanner(p, {
  chip: "INCIDENT", kind: "warn",
  big: "SEV-1 · Automated alert.\nApproval rate 98.4% → 31%.  INTERMITTENT.",
  sub: "Three merchants have called. Some payments go through, some do not. A resource tuning PR merged twenty minutes ago. SEV-1 means an update every ten minutes.",
  points: [
    "Note what is DIFFERENT from yesterday: this is intermittent, not total.",
    "That single fact rules out several causes before you touch a keyboard. Which, and why?",
    "Today kubectl logs WILL work — there is a container and it has run. That tells you something on its own.",
    "Scored on METHOD. Following the loop and not finishing beats guessing right in thirty seconds.",
  ],
  obj: "Run the second unassisted incident.",
  time: "35 min triage + 10 min debrief",
  script: "Inject with `make incident N=2` during the break, BEFORE this slide.\n\nThe deliberate trap: several students will see CrashLoopBackOff, run `kubectl logs` WITHOUT --previous, get 'container is waiting to start', and conclude it is yesterday's incident again. Let them. The recovery — noticing RESTARTS is non-zero, so a container DID run — is the lesson.\n\nIf nobody has it at 20 minutes: 'You have the logs from the run that failed. They are clean. What kills a process without letting it log anything?'",
  ask: "DEBRIEF — the application logs were completely clean. Why is that itself a clue?",
  answer: "SIGKILL cannot be caught or logged. A clean startup followed by silence points OUTWARD — to the kernel, not the application. An application bug leaves a traceback. That absence is diagnostic, and it is the single most useful thing on this slide.",
});

/* ===================== CLOSE ===================== */
L.sAsk(p, {
  chip: "KNOWLEDGE CHECK", label: "Answers",
  q: "Eight questions. Answer out loud. Not scored.",
  expect: [
    "1. Which does the scheduler use — requests or limits?  →  requests only",
    "2. CPU over limit vs memory over limit?  →  throttled (silent) vs OOMKilled (exit 137)",
    "3. Which probe restarts the container?  →  liveness. Readiness only removes it from endpoints.",
    "4. Why must liveness never check a dependency?  →  a blip restarts every replica at once",
    "5. HPA shows TARGETS <unknown>. Why?  →  no CPU request, so no denominator",
    "6. Why is scale-down slower than scale-up?  →  to prevent flapping",
    "7. Which controller for one pod per node?  →  DaemonSet. There is no replicas field.",
    "8. What makes a rolling update zero-downtime?  →  readiness probe + maxUnavailable: 0",
  ],
  obj: "Formative check across all of Day 2.",
  time: "15 min",
  script: "Roughly 90 seconds each. Questions 3, 4 and 8 are the load-bearing ones — if a third of the room misses any of them, recap tomorrow morning before storage.",
});

L.sStats(p, {
  chip: "END OF DAY 2", dark: true, title: "What you built today",
  stats: [
    { v: "0", l: "failed payments across a live\nproduction release of v1.1.0\nat 40 requests per second", colour: C.green },
    { v: "3", l: "probe types on every service,\ncorrectly separated by\nconsequence", colour: C.green },
    { v: "2", l: "HPAs scaling on real CPU load,\ninside a namespace budget\nthat permits the maximum", colour: C.amber },
    { v: "4", l: "workload controllers in use:\nDeployment, DaemonSet,\nJob, CronJob", colour: C.teal },
  ],
  kicker: "The platform now survives load, failure and change. It still forgets everything when a pod restarts.",
  obj: "Consolidate and hand over to Day 3.",
  time: "3 min",
  script: "Then the pivot: have someone delete a payment-service pod and try to fetch a payment they created this morning. It is gone. Every payment, every idempotency key, every fraud velocity counter — all in memory.\n\nThat is tomorrow.",
});

L.sTable(p, {
  chip: "TOMORROW", title: "Day 3 — give it a memory",
  lead: "Stateless scaling is only half the platform story. Any workload that must retain transactions, configuration, secrets or state across restarts needs persistent storage and externalised data, otherwise correct Kubernetes behaviour still loses business context.",
  head: ["What is missing", "What it costs", "Fixed in"],
  colW: [4.2, 5.6, 2.3],
  rows: [
    ["No database", "Every payment is lost on pod restart. Nothing to reconcile against.", "L3.5"],
    ["Config baked into manifests", "A log-level change needs a redeploy of every service", "L3.1"],
    ["JWT signing key in a plain env var", "Visible to anyone with namespace read access", "L3.2"],
    ["Fraud counters in memory", "The control weakens as you scale — challenge C1 today", "L3.5 (Redis)"],
    ["No persistent storage at all", "A StatefulSet has nowhere to keep its data", "L3.3, L3.4"],
    ["Containers run as root", "A container escape becomes a host compromise", "L3.7"],
  ],
  obj: "Create demand for Day 3 from Day 2's felt gaps.",
  time: "4 min",
  script: "Row 4 is the callback to L2.4's challenge — several of them found it themselves, and it is satisfying to see it on the agenda.\n\nEnd on row 1. The demo of deleting a pod and losing every payment takes fifteen seconds and it sells tomorrow better than any slide.",
  next: "Assessment now — ten items, fifteen minutes.",
});

p.writeFile({ fileName: "/tmp/deck/AxisPay-K8s-Day2.pptx" })
 .then(f => console.log("WROTE", f, "— slides:", p.__n));
