const pptxgen = require("pptxgenjs");
const L = require("./lib.js");
const D = require("./diagrams.js");
const { C } = L;

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "AxisPay Curriculum Team";
p.company = "Axis Financial Services (fictional)";
p.title = "AxisPay Kubernetes Comprehensive — Day 4";
p.subject = "Networking, Exposure and Placement";
p.__n = 0;
L.setDay(4);

L.sTitle(p, {
  eyebrow: "KUBERNETES COMPREHENSIVE · AXP-K8S-5D",
  title: "Day 4\nNetworking, Exposure & Placement",
  sub: "Let the world in — and keep it out of the vault. By 17:00 merchants can reach AxisPay over TLS, and the DMZ can no longer touch cardholder data.",
  meta: [["DURATION","7 hours"],["THEORY","250 min"],["HANDS-ON","330 min"],["LABS","6 + 1 incident"]],
  footer: "Yesterday you gave the platform a memory. Today anyone in the cluster can read it.",
  obj: "Open on the finding, demonstrated rather than described.",
  time: "2 min",
  script: "Do not describe the problem — show it. Exec into edge-gateway and connect straight to PostgreSQL. It works.\\n\\nThen say what that means: in a PCI assessment, the DMZ is now inside the cardholder data environment. Every control that applies to the CDE applies to the gateway, to everyone who can deploy it, and to its logs. The audit gets bigger, longer and more expensive.\\n\\nThat thirty-second demo is the whole day.",
  demo: "kubectl exec -n axispay-edge deploy/edge-gateway -- python3 -c \"import socket; socket.create_connection(('postgres-0.postgres.axispay-data.svc.cluster.local',5432),timeout=5); print('CONNECTED')\"",
});

L.sAsk(p, {
  chip: "MORNING RECAP", label: "Answers",
  q: "Five from yesterday. Answer out loud.",
  expect: [
    "Change a ConfigMap — do running pods see it?  →  env: no. volume: yes, ~60s.",
    "Is a Secret encrypted?  →  No. base64. RBAC + etcd encryption at rest protect it.",
    "ReadWriteOnce — once what?  →  one NODE, not one pod",
    "Three things a StatefulSet gives?  →  stable name, stable storage, ordering",
    "What does fsGroup do?  →  chowns the volume so a non-root process can write",
  ],
  obj: "Retrieval practice on Day 3.",
  time: "20 min",
  script: "Then everyone runs `make validate-day3` before anything else. Today's labs assume a healthy data tier and several of them will fail confusingly without one.",
});

L.sTable(p, {
  chip: "TODAY", title: "What is missing, and what it costs",
  lead: "A cluster is not production-ready just because pods run. Day 4 adds the platform controls that keep names stable, expose workloads safely, segment traffic, guide scheduling and preserve availability during routine maintenance.",
  head: ["Missing right now", "What it costs you", "Fixed in"],
  colW: [4.0, 5.8, 2.3],
  rows: [
    ["No route in from outside", "No user or partner system can reach the app. port-forward is a debugging tunnel, not a product edge.", "L4.3"],
    ["No TLS", "Credentials and payloads cross the network in clear text.", "L4.3"],
    ["Flat pod network", "The DMZ can read the payments database. A PCI finding.", "L4.4"],
    ["No placement control", "All three payment replicas can land on one node", "L4.5"],
    ["No disruption budget", "A node drain takes every replica at once", "L4.6"],
    ["DNS still unopened", "You have relied on names like payment-service for three days without seeing the resolver behind them.", "L4.2"],
  ],
  obj: "Derive the agenda from felt gaps.",
  time: "5 min",
  script: "Row 3 is the one you just demonstrated. Everything else today is in service of it.",
});

/* ---------- M4.1/4.2 networking + services ---------- */
L.sSection(p, {
  num: "M4.1 – M4.2", title: "The cluster network and Service types",
  sub: "Four rules, five Service types, and no proxy in the request path",
  objectives: ["State the four Kubernetes networking rules",
               "Choose between ClusterIP, NodePort, LoadBalancer, ExternalName and headless",
               "Explain how EndpointSlices are populated"],
  time: "75 min",
  obj: "Open up what students have used for three days without examining.",
  script: "Keep this brisk — most of it is confirmation of things they have already relied on.",
});

L.sExplain(p, {
  chip: "M4.1 · NETWORKING",
  title: "The four rules Kubernetes demands of any network plugin",
  lead: "Kubernetes assumes a flat, routable pod network in which every pod is a first-class IP endpoint and cluster components can reach pods directly without host-port translation. The API defines that contract; the CNI plugin turns it into real routes and packet handling.",
  question: "Kubernetes does not implement networking. So what does it actually require?",
  steps: [
    ["Every pod gets an IP", "A `web-app` pod and an `api` pod each get their own address, so both can listen on 8080 without colliding on one host port.", C.teal],
    ["Pod-to-pod is direct", "When `web-app` calls `api`, it routes to the pod IP itself. Cross-node traffic should not need port maps or hide the caller's real IP.", C.teal],
    ["Nodes can reach AxisPay pods", "That is how kubelet probes hit AxisPay pods directly, and how node agents can inspect or scrape `payment-service` without inventing extra host ports.", C.green],
    ["Pods see their real address", "If `fraud-service` reports its own pod IP in telemetry or a debug trace, `edge-gateway` and every other consumer must be able to use that exact address unchanged.", C.green],
  ],
  kicker: "Kubernetes defines the contract; Calico, Cilium or Flannel implement it. That is why the CNI choice matters so much on Thursday.",
  obj: "Explain the CNI contract before students depend on one specific behaviour of it.",
  time: "7 min",
  script: "Rule 4 is the one worth dwelling on. Under Docker's default bridge a container sees itself as 172.17.0.x while the outside world reaches it on a mapped host port — so it cannot truthfully tell anyone its own address. Kubernetes forbids that, and it is why service discovery is straightforward here and painful there.\\n\\nThen the punchline: none of this is implemented by Kubernetes. It is a contract, and the plugin fulfils it. Which is exactly why a plugin can fulfil the connectivity rules and NOT implement NetworkPolicy — and everything still appears to work.",
  ask: "Your NetworkPolicies apply cleanly and traffic still flows. What is wrong?",
  answer: "The CNI does not enforce policy. Kubernetes accepts and stores the object regardless — enforcement is the plugin's job. This is why the course insists on --cni=calico, and why L1.1 made you check on Monday.",
});

L.sTable(p, {
  chip: "M4.2 · SERVICES", title: "Five Service types — choose by what you need",
  lead: "A Kubernetes Service gives clients a stable virtual endpoint — DNS name plus, usually, a ClusterIP — while controllers keep its backend set aligned with label-selected ready pods. Clients talk to the Service; kube-proxy or the CNI steers each new connection to one backend.",
  head: ["Type", "What it does", "Use it when"],
  colW: [2.5, 5.0, 4.6],
  rows: [
    ["ClusterIP", "Stable virtual IP, reachable only inside the cluster", "Inside a cluster — for example, `web-app` calling `checkout-api` by DNS."],
    ["NodePort", "Opens the SAME port on EVERY node", "Quick demos or lab access to a `web-app`; in production it widens attack surface."],
    ["LoadBalancer", "Asks the cloud or metal LB for an external VIP", "Publishing AxisPay's `edge-gateway` on a cloud-managed public address."],
    ["ExternalName", "A DNS CNAME only. No proxy, no endpoints.", "Giving an external fraud or banking endpoint a stable in-cluster name for AxisPay callers."],
    ["Headless (clusterIP: None)", "DNS returns pod IPs/SRV records, not one VIP", "Returning individual `postgres` pod addresses when AxisPay needs StatefulSet identity or client-side balancing."],
  ],
  rowH: 0.66,
  obj: "Complete the Service taxonomy started on Day 1.",
  time: "8 min",
  script: "The headless row deserves the time. kube-proxy load-balances CONNECTIONS, not requests — so a single long-lived HTTP/2 connection pins to one pod forever. gRPC multiplexes everything over one connection, so a normal Service gives you no balancing at all. A headless Service hands the client every address and lets it decide.\\n\\nThat is not an edge case; it is the single most common gRPC-on-Kubernetes surprise.",
  ask: "Why is NodePort discouraged in production?",
  answer: "It opens a port on EVERY node in the cluster, including nodes running nothing related. That is a large attack surface for one service, and it bypasses the Ingress where your TLS, rate limiting and routing rules live.",
});

D.dServiceTypes(p, {
  chip: "M4.2 · SERVICES",
  title: "How ClusterIP, NodePort and LoadBalancer differ on the wire",
  obj: "Make the three main exposure patterns visible without YAML.",
  time: "4 min",
  script: "Read left to right: internal VIP only, then the same port opened on every node, then an external load balancer fronting the Service. Stress that the Service abstraction stays the same while only the entry path changes."
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L4.1 + L4.2", title: "Service taxonomy and DNS forensics",
  will: ["Prove the four networking rules from your own cluster",
         "Find the iptables rules kube-proxy wrote",
         "Use all five Service types",
         "Measure what ndots:5 costs in DNS round-trips",
         "Break CoreDNS and learn the SHAPE of a DNS failure"],
  done: ["All five Service types exercised", "You can recognise a DNS failure by its symptom"],
  validate: "make validate-lab LAB=L4.1 && make validate-lab LAB=L4.2",
  time: "65 minutes", file: "labs/day4/L4.1-service-types/, L4.2-dns.md",
  obj: "Open up the network and DNS before they are needed under pressure.",
  script: "L4.2 step 6 — deliberately scaling CoreDNS to zero — is the important one. Students must SEE that a DNS failure looks like a name-resolution error rather than a connection refusal.\\n\\nIn two hours they will block DNS by accident with a default-deny policy, and in four hours INC-4b will break CoreDNS on purpose. Recognising the shape is the whole point.",
});

/* ---------- M4.4 Ingress ---------- */
L.sSection(p, {
  num: "M4.4", title: "Ingress and TLS",
  sub: "The first request that does not need kubectl",
  objectives: ["Distinguish the Ingress resource from the Ingress controller",
               "Route by host and path; explain pathType",
               "Terminate TLS and inspect the certificate"],
  time: "70 min",
  obj: "Make the platform reachable.",
  script: "Frame it as the milestone it is: four days of work, and this is the first request a merchant could actually make.",
});

L.sExplain(p, {
  chip: "M4.4 · INGRESS",
  title: "Two objects, and confusing them is the usual failure",
  lead: "An Ingress is a declarative HTTP(S) routing resource that stores host, path and TLS rules, but it never accepts traffic by itself. A separate controller watches those rules, programs a real reverse proxy and publishes the edge address clients actually connect to.",
  question: "You apply an Ingress. Nothing happens. Why?",
  steps: [
    ["Generic rule document", "A vanilla Ingress might send `frontend.example.com` to `web-app`, while `/api` on the same host goes to `checkout-api`. It is desired routing state stored in the API.", C.teal],
    ["Generic controller process", "An ingress-nginx or Traefik deployment watches those rules, opens the listening socket, terminates TLS and forwards matching requests to the right Service.", C.green],
    ["AxisPay symptom", "If `api.axispay.local` or `merchant.axispay.local` never gets an ADDRESS, the rules exist but no controller is publishing the AxisPay edge.", C.red],
    ["AxisPay class binding", "When AxisPay sets `ingressClassName`, only the intended controller should claim `edge-gateway`. Omit it and the public route may stay idle or be claimed twice.", C.amberD],
  ],
  kicker: "An empty ADDRESS column is the tell. Check it before you debug anything else.",
  obj: "Prevent the most common Ingress dead-end.",
  time: "7 min",
  script: "On Minikube the controller comes from an addon, so students may never have installed one deliberately and will not think to check.\\n\\nAlso flag pathType. Prefix matches /api and everything below it; Exact matches ONLY the literal path. Changing one word turns a working API into a 404 on every endpoint but one — and that is INC-4a this afternoon.",
  ask: "Your Ingress exists, ADDRESS is populated, and you get a 503. Where is the fault?",
  answer: "Not the Ingress. 503 means the controller found the backend Service and it has no ready endpoints — so the problem is the Service selector or the pods' readiness. A 404 would be the routing rules; a 502 would be the wrong backend port. Those three codes point at three different layers, and knowing which saves ten minutes.",
});

D.dIngressController(p, {
  chip: "M4.4 · INGRESS",
  title: "Ingress rules are data; the controller is the proxy",
  obj: "Separate the routing resource from the process that handles traffic.",
  time: "4 min",
  script: "Point at the pending ADDRESS first. An Ingress without a controller is just stored configuration. Then follow the traffic arrow to show which component listens on 80/443, terminates TLS and forwards to Services."
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L4.3", title: "Ingress and TLS at the edge",
  will: ["Generate certificates and inspect them with openssl",
         "Route two hostnames with path-based rules",
         "Take a real payment from OUTSIDE the cluster over HTTPS",
         "Change pathType to Exact and watch everything 404"],
  done: ["curl -k https://api.axispay.local returns a payment", "HTTP redirects to HTTPS"],
  validate: "make validate-lab LAB=L4.3",
  time: "55 minutes", file: "labs/day4/L4.3-ingress-tls/",
  obj: "Expose the platform properly.",
  script: "Step 6 is the milestone — the first request in four days that did not need kubectl. Let them enjoy it.\\n\\nStep 8 (pathType Exact) is deliberate practice for INC-4a. Make sure everyone runs it and sees the 404.",
});

/* ---------- M4.5 NetworkPolicy — the core ---------- */
L.sSection(p, {
  num: "M4.5", title: "NetworkPolicy",
  sub: "The control that keeps the DMZ out of the cardholder data environment",
  objectives: ["Explain that policy is additive and default-allow until a selector matches",
               "Apply default-deny, then allow-list precisely",
               "Verify enforcement empirically rather than by reading YAML"],
  time: "80 min",
  obj: "Deliver the security core of the week.",
  script: "This is the most important module of Day 4 and one of the most important of the course. It is also the one where the whole platform breaks in the middle, on purpose.",
});

L.sExplain(p, {
  chip: "M4.5 · NETWORKPOLICY",
  title: "Three properties that decide everything",
  lead: "A NetworkPolicy selects pods and declares which ingress and egress connections are allowed to them at Layer 3 and Layer 4 using selectors, CIDRs and ports. It does not create routes or proxies; it constrains traffic that the cluster network would otherwise permit.",
  question: "Why does adding one policy break things you never mentioned in it?",
  steps: [
    ["One selected pod changes mode", "In a simple `frontend` → `backend` app, `backend` is wide open until some policy selects it. After that, only the sources and ports named in policy may still connect.", C.amberD],
    ["Permission is only additive", "You never write `deny frontend`. To block it, select `backend` and omit `frontend` from the allow-list. A default-deny is simply an empty rule set on `podSelector: {}`.", C.teal],
    ["AxisPay flow needs both sides", "For `edge-gateway` to call `payment-service`, egress from `axispay-edge` and ingress to `payment-service` must both allow the flow. The same is true again for `payment-service` → `fraud-service`.", C.green],
    ["AxisPay depends on enforcement", "AxisPay uses Calico to turn these YAML objects into packet filters. If the plugin were present but non-enforcing, every policy would apply cleanly and the DMZ could still reach PostgreSQL.", C.red],
  ],
  kicker: "Deny first, then allow back exactly what you can justify. Building the allow-list first is how you end up with a policy set that looks strict and enforces nothing.",
  obj: "Give the mental model before the lab breaks the platform.",
  time: "9 min",
  script: "Property 1 explains the confusion students are about to have: they add ONE narrow policy to fraud-service and payment-service stops working, even though payment-service is not mentioned anywhere in it. That is INC-4c.\\n\\nProperty 3 is why L4.4 has them fix DNS and then STILL find connections failing. Two separate problems; fixing one does not fix the other.",
  ask: "You want to stop reporting-service reaching the ledger. Which policy do you write?",
  answer: "You do not write a deny. You ensure some policy selects ledger-service and that none of them permit ingress from reporting-service. Absence of permission IS the denial. People look for a deny rule for a long time before this lands.",
});

D.dNetworkPolicyMode(p, {
  chip: "M4.5 · NETWORKPOLICY",
  title: "A selected pod flips from open to allow-listed",
  obj: "Show default-allow-until-selected with a before/after contrast.",
  time: "4 min",
  script: "Use the left half to remind them that namespaces are not firewalls. Then show that the first selecting policy changes the target pod into an allow-list model, which is why one narrow rule can appear to break unrelated callers."
});

L.sCode(p, {
  chip: "M4.5 · WORKED EXAMPLE", title: "The control, demonstrated",
  lead: "Same command, before and after. This is what you show a QSA.",
  lines: [
    { k: "cmd", t: "$ kubectl exec -n axispay-edge deploy/edge-gateway -- python3 -c \\" },
    { k: "cmd", t: "    \"import socket; socket.create_connection(" },
    { k: "cmd", t: "     ('postgres-0.postgres.axispay-data...',5432),timeout=5)\"" },
    "",
    { k: "dim", t: "# BEFORE — L4.4 step 1" },
    { k: "err", t: "CONNECTED to PostgreSQL from the DMZ  <- this is the finding" },
    "",
    { k: "dim", t: "# AFTER — L4.4 step 6, same command" },
    { k: "ok",  t: "BLOCKED — the DMZ can no longer reach the vault: TimeoutError" },
    "",
    { k: "cmd", t: "$ python3 platform/admin/validate/simulate-netpol.py" },
    { k: "ok",  t: "All 39 policy assertions hold." },
    { k: "dim", t: "  19 calls the platform makes: ALLOWED" },
    { k: "dim", t: "   8 controls that matter:      BLOCKED" },
  ],
  size: 11.5,
  note: "A TIMEOUT, not a refusal. Dropped packets look like a slow network, which is why an over-broad policy is so hard to diagnose — that is INC-4c.",
  obj: "Show the control as evidence rather than assertion.",
  time: "7 min",
  demo: "Run both halves live if the platform is up. The before/after with an identical command is far more convincing than any diagram.",
  script: "Point at the failure mode. BLOCKED means the packet was DROPPED — no connection-refused, no log line, no Kubernetes event. From the application's side it is indistinguishable from a slow network.\\n\\nThat is why the repository ships simulate-netpol.py: it evaluates every policy the way Kubernetes does and checks it against a list of calls that must work and controls that must hold. Run it in CI. A policy that silently stops enforcing is otherwise invisible until an auditor finds it.",
  callout: "22 policies across four namespaces. The one that matters most is the one that ISN'T there — nothing grants axispay-edge access to axispay-data. That omission is the control.",
});

L.sBanner(p, {
  chip: "WARNING", kind: "warn",
  big: "Apply default-deny and the entire platform stops working.\nThat is correct.",
  sub: "In L4.4 step 2 everything breaks — including calls you explicitly allowed. Before you apply the next file, work out WHY.",
  points: [
    "Every service call begins with a DNS lookup to CoreDNS in kube-system.",
    "That lookup is EGRESS TRAFFIC, and default-deny blocked it.",
    "The symptom is a NAME RESOLUTION failure, not a connection refusal — so it looks like a DNS outage, not a policy problem.",
    "You saw this exact shape in L4.2 step 6. That was not an accident.",
  ],
  obj: "Prepare students to derive the DNS rule rather than copy it.",
  time: "5 min",
  script: "Do NOT give them the answer on this slide. The lab has them run a DNS lookup from inside a pod and discover it themselves.\\n\\nStudents who learned DNS properly yesterday morning derive this in two minutes. Students who skimmed it lose twenty. That is the whole reason L4.2 comes before L4.4 — the dependency map calls it out explicitly.",
  warn: "Allow BOTH UDP and TCP on port 53. DNS falls back to TCP for large responses; allowing only UDP produces INTERMITTENT failures that are far harder to diagnose than a total one.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L4.4", title: "Zero-trust segmentation",
  will: ["PROVE the finding: connect to PostgreSQL from the DMZ",
         "Apply default-deny and watch the platform stop",
         "Derive the DNS egress rule from a broken cluster",
         "Allow-list every real call path",
         "Run the SAME command from step 1 and get the opposite result"],
  done: ["22 policies applied", "edge-gateway CANNOT reach PostgreSQL", "simulate-netpol.py: 39/39"],
  validate: "make validate-lab LAB=L4.4",
  time: "50 minutes", file: "labs/day4/L4.4-networkpolicy/",
  obj: "Build the segmentation and verify it empirically.",
  script: "The lab is deliberately structured as prove-the-problem, break-everything, derive-the-fix, prove-the-fix. Step 1 and step 6 run the IDENTICAL command with opposite results.\\n\\nIf a student's cluster lacks Calico, they will apply all 22 policies and step 6 will still say CONNECTED. Deal with that immediately — it is the worst possible outcome and it is silent.",
  warn: "Check `kubectl get ds -n kube-system calico-node` for every student BEFORE this lab. Without it the policies enforce nothing.",
});

/* ---------- M4.6/4.7 placement ---------- */
L.sSection(p, {
  num: "M4.6 – M4.7", title: "Placement and disruption",
  sub: "Affinity, spread, taints, drains and the budgets that make Friday survivable",
  objectives: ["Distinguish required from preferred and predict each consequence",
               "Spread payment replicas across nodes deliberately",
               "Write a PodDisruptionBudget and prove it under live traffic"],
  time: "110 min",
  obj: "Deliver the objects Friday's capstone depends on.",
  script: "Frame the whole block as preparation for tomorrow. Everything written here is what makes the capstone's node drain a non-event.",
});

L.sExplain(p, {
  chip: "M4.6 · PLACEMENT",
  title: "required vs preferred — and the HPA it silently caps",
  lead: "Scheduler affinity rules come in hard and soft forms. `requiredDuringSchedulingIgnoredDuringExecution` is a gate that must pass before placement, while `preferredDuringSchedulingIgnoredDuringExecution` is a weighted hint the scheduler tries to honor without blocking the pod if capacity is tight.",
  question: "Both spread your pods. Why does AxisPay use one for payment-service and the other for fraud-service?",
  steps: [
    ["required is a gate", "A generic `web-app` with required anti-affinity stays Pending if every node already has a matching replica. Hard rules protect spread by refusing to schedule.", C.red],
    ["payment-service uses required", "For a critical replicated workload, sharing one failure domain is worse than leaving one replica unscheduled. AxisPay applies that to `payment-service`: three replicas on one node look redundant but fail together.", C.green],
    ["AxisPay hits a hard limit", "With required anti-affinity on hostname, `payment-service` can never have more replicas than nodes. Scale to 4 on a 3-node cluster and the fourth stays Pending.", C.amberD],
    ["fraud-service uses preferred", "For autoscaled or bursty workloads, a soft anti-affinity rule preserves spread when possible without turning node count into a hidden ceiling. AxisPay uses that for `fraud-service` because its HPA scales to 6 and must keep scheduling during spikes.", C.teal],
  ],
  kicker: "Same intent, different failure mode. For an autoscaled service, preferred is the only safe choice.",
  obj: "Explain a choice students will otherwise make by coin-flip.",
  time: "8 min",
  script: "In L4.5 step 4 they scale payment-service to 4 on a 3-node cluster and watch the fourth pod sit Pending with 'didn't match pod anti-affinity rules'. Doing it once means they never debug it blind.\\n\\nThe combination that bites in production: required anti-affinity plus an HPA. Autoscaling appears to work until the replica count reaches the node count, then silently stops — during exactly the spike it exists to absorb.",
  ask: "Your HPA is set to max 10, you have 4 nodes, and it never scales past 4. Where do you look?",
  answer: "kubectl describe on a Pending pod. If it says 'didn't match pod anti-affinity rules', a required rule is the cap. Change it to preferred, or add topology spread with ScheduleAnyway. The HPA is working perfectly; the scheduler is refusing.",
});

L.sTable(p, {
  chip: "M4.6 · PLACEMENT",
  title: "Three ways to influence WHERE a pod lands — in order of power",
  lead: "Pod placement can be influenced from the pod spec in three distinct ways: by matching node labels directly, by expressing richer node rules, or by placing relative to other pods already running. All three answer 'which node?' from the pod's side; the next slide covers the node's side.",
  head: ["Mechanism", "What it matches", "When to reach for it"],
  colW: [2.5, 4.75, 4.85],
  rows: [
    ["nodeSelector", "Exact-match key/value labels on the node, for example `accelerator: nvidia`. The simplest mechanism: a flat map, AND-ed together, with no operators. If no node matches every key, the pod stays Pending.", "Simple, fixed constraints — for example, run `gpu-workload` only on nodes labelled `accelerator: nvidia`."],
    ["nodeAffinity", "The expressive successor to nodeSelector. Supports operators such as `In`, `NotIn`, `Exists`, `Gt`, `Lt` and the same hard-versus-soft split: `required...` blocks placement; `preferred...` biases it.", "Richer node rules or soft preferences — for example, prefer SSD nodes for `checkout-api` without blocking placement elsewhere."],
    ["podAffinity / podAntiAffinity", "Matches LABELS ON OTHER PODS already running, not node labels. AxisPay uses pod anti-affinity so two `payment-service` replicas do not share one node.", "Co-location or spread relative to other workloads — for example, keeping AxisPay replicas apart or placing helpers beside the workload they serve."],
  ],
  rowH: 0.88,
  obj: "Separate the three placement tools so students stop using the names interchangeably.",
  time: "7 min",
  script: "Teach these as a ladder, not as synonyms. nodeSelector is the blunt instrument: exact labels only. nodeAffinity is the grown-up version: operators plus hard-versus-soft behavior. podAffinity and podAntiAffinity are a different category entirely because they reason about other pods, not the node's labels.\\n\\nThe production mistake is reaching for pod anti-affinity when the real requirement is about node hardware, or reaching for required node affinity when a soft preference was safer.",
  ask: "Your pod needs `disktype: ssd` — do you reach for nodeSelector or nodeAffinity?",
  answer: "Either works for that simple case. Use nodeSelector when exact-match AND logic is enough and you do not need preferences. Reach for nodeAffinity when you need operators like NotIn or Exists, or a soft preference instead of a hard requirement.",
});

D.dAffinityTypes(p, {
  chip: "M4.6 · PLACEMENT",
  title: "NodeAffinity matches node labels; PodAntiAffinity matches other pods",
  obj: "Separate node facts from workload-relative placement.",
  time: "4 min",
  script: "On the left, the scheduler is reading labels on candidate nodes. On the right, it is reading labels on pods that already exist and then inferring which nodes are acceptable. Those are different questions with different failure modes."
});

L.sExplain(p, {
  chip: "M4.6 · PLACEMENT",
  title: "Taints and tolerations — the node's side of the conversation",
  lead: "Taints and tolerations invert the normal placement model: a node advertises a repelling rule, and only pods that explicitly tolerate it remain eligible to stay or land there. Kubernetes uses them to reserve special hardware, protect control-plane nodes and coordinate maintenance.",
  question: "Affinity is the pod asking for a node. How does a NODE refuse pods it doesn't want?",
  steps: [
    ["A taint marks the node", "A node tainted `accelerator=nvidia:NoSchedule` tells the scheduler that ordinary pods should stay away. The refusal lives on the node, not in the workload spec.", C.red],
    ["A toleration is a pass", "A `gpu-job` pod with the matching toleration becomes eligible to land there, but it is not pulled there automatically; an untainted node may still win.", C.teal],
    ["AxisPay still sees three effects", "On AxisPay nodes, `NoSchedule` keeps ordinary apps off the control plane, `PreferNoSchedule` is a soft nudge, and `NoExecute` is the maintenance lever that also evicts running pods.", C.amberD],
    ["Why your Day 2 DaemonSet needed one", "A common example is the control-plane taint `node-role.kubernetes.io/control-plane:NoSchedule`, which keeps ordinary app pods off that node by default. Your `node-agent` DaemonSet needed a matching toleration because it was meant to run everywhere, including the tainted control-plane node.", C.green],
  ],
  kicker: "Affinity is attraction from the pod. A taint is refusal from the node. A toleration does not attract — it only lifts the refusal.",
  obj: "Teach taints and tolerations as a distinct mechanism, not a mysterious YAML line copied from examples.",
  time: "7 min",
  script: "Students often think a toleration is a placement preference. Kill that idea explicitly: a toleration only removes a 'no' from the node; it does not create a 'yes'. You still need normal scheduling logic to make the node attractive.\\n\\nTie it back to the control-plane node because they already saw it in practice on Day 2. The reason regular apps avoid the control-plane is not magic and not a hidden role — it is a taint. The reason the node-agent could run there is not privilege — it is a toleration.",
  ask: "A node is tainted with `NoExecute` for maintenance. What happens to pods already running there that have no matching toleration?",
  answer: "They are evicted. `NoExecute` affects both future scheduling and pods already on the node. If a pod does tolerate it with `tolerationSeconds`, it can stay only for that grace period before eviction.",
});

D.dTaintsTolerations(p, {
  chip: "M4.6 · PLACEMENT",
  title: "A taint repels by default; a toleration only lifts the block",
  obj: "Make the direction of control explicit.",
  time: "4 min",
  script: "Show the blocked pod first. Then show that the tolerated pod is merely eligible, not attracted. Finish on NoExecute: it is the only effect that also pushes existing pods off the node."
});

L.sTable(p, {
  chip: "M4.7 · DISRUPTION", title: "PodDisruptionBudget — what it does and does not do",
  lead: "A PodDisruptionBudget tells the eviction API how many replicas of a selected workload must remain available during voluntary operations such as drain or a rolling node upgrade. It does not keep pods alive; it only throttles Kubernetes-initiated evictions.",
  head: ["Event", "PDB applies?", "Why"],
  colW: [4.2, 2.2, 5.7],
  rows: [
    ["kubectl drain", "YES", "Voluntary. A generic `web-app` PDB is checked before each eviction and drain pauses when the budget is exhausted."],
    ["Cluster / node-pool upgrade", "YES", "Voluntary. AxisPay's Friday upgrade uses the same eviction path under the hood."],
    ["Node crashes", "No", "Involuntary. If the node hosting a `payment-service` replica disappears, the budget cannot save the pod that vanished with it."],
    ["OOM kill", "No", "Involuntary. If a `fraud-service` container exhausts memory, the kernel kills it locally without asking the eviction API."],
    ["Liveness probe failure", "No", "An `edge-gateway` restart happens in place on the node; it is not a drain-time eviction."],
    ["kubectl delete pod", "No", "`kubectl delete pod payment-service-...` bypasses the eviction API entirely."],
  ],
  rowH: 0.56,
  obj: "Set the boundary of what a PDB can promise.",
  time: "7 min",
  script: "The last row surprises people: `kubectl delete pod` is NOT gated by a PDB. Only the eviction API is, and `drain` uses it. A careless delete bypasses your budget entirely.\\n\\nAlso flag the minAvailable trap: with an HPA, an absolute minAvailable can equal the current replica count at minReplicas, making ALLOWED DISRUPTIONS zero and the node undrainable. A node that cannot be drained cannot be patched. Prefer maxUnavailable.",
  ask: "Your PDB says minAvailable: 3 and the HPA has scaled down to 3. What happens when you drain?",
  answer: "Nothing — forever. Zero disruptions are allowed, so the drain hangs and the node can never be maintained. This is a real production trap and the reason AxisPay uses maxUnavailable everywhere.",
});

D.dPdbDrain(p, {
  chip: "M4.7 · DISRUPTION",
  title: "During drain, the PDB allows one eviction and then blocks the next",
  obj: "Visualise allowed disruptions as a moving budget.",
  time: "4 min",
  script: "Walk the sequence slowly: with three ready replicas and `minAvailable: 2`, the first eviction is fine, the second is blocked until a replacement becomes Ready elsewhere. That is what turns a drain into a rolling movement instead of a cliff."
});

L.sLab(p, {
  type: "INDEPENDENT LAB", id: "L4.5 + L4.6", title: "Placement, drains and disruption budgets",
  will: ["Spread payment replicas one per node — by instruction, not luck",
         "Find the hard limit of required anti-affinity",
         "Drain a node under 40 rps WITHOUT a PDB and measure the failures",
         "Apply the budgets and drain again — measure zero",
         "Read the postgres PDB and explain why it documents having no budget"],
  done: ["Replicas on distinct nodes", "6 PDBs applied", "A drain under load with ZERO failed payments"],
  validate: "make validate-lab LAB=L4.5 && make validate-lab LAB=L4.6",
  time: "110 minutes", file: "labs/day4/L4.5-placement/, L4.6-pdb-drain.md",
  obj: "Build the objects that make Friday survivable.",
  script: "L4.6 Task 1 then Task 3 is the whole lab: the same drain, with and without budgets, measured. Typically ~60 failed payments versus zero.\\n\\nSay it out loud when they finish: the objects you just wrote are what stop tomorrow's capstone upgrade taking the platform down. Thursday protects Friday.",
});

/* ---------- incident ---------- */
L.sBanner(p, {
  chip: "INCIDENT", kind: "warn",
  big: "SEV-1 · THREE alerts in two minutes.\nAnd one of them logs nothing at all.",
  sub: "404 on the merchant API. Intermittent name resolution. Approval rate 96% → 61% with no errors anywhere. Three changes merged this afternoon, three teams, none of them believes theirs is the problem.",
  points: [
    "Three faults. Fixing the loud ones does not fix the quiet one.",
    "Alert 3 is the discriminator: down but not to zero, and NOTHING is logged.",
    "Before you type: which do you work FIRST, and why?",
    "Scored on method, prioritisation — and NOT MAKING IT WORSE.",
  ],
  obj: "Run the hardest incident so far.",
  time: "35 min triage + 10 min debrief",
  script: "Inject with `make incident N=4` during the break.\\n\\nThe trap that matters: a student who deletes a default-deny policy or a legitimate allow-rule 'to see if that fixes it'. It does. Let them. Then in the debrief ask them to run the DMZ-to-PostgreSQL check and explain the result to a QSA.\\n\\nThat exact temptation returns in tomorrow's capstone, under more pressure, and taking it costs the Secure competency.",
  ask: "DEBRIEF — deleting a NetworkPolicy fixed it. When would that have been the WRONG fix?",
  answer: "Here the policy was newly added and wrong, so deleting it is correct. Deleting a default-deny, or a legitimate allow-rule, to restore service would remove the segmentation that keeps the DMZ out of the CDE — trading a thirty-minute outage for a PCI finding. The fastest fix and the correct fix are frequently different, and knowing which is which is the job.",
});

/* ---------- close ---------- */
L.sAsk(p, {
  chip: "KNOWLEDGE CHECK", label: "Answers",
  q: "Eight questions. Answer out loud. Not scored.",
  expect: [
    "1. Is there a proxy process in a ClusterIP request path?  →  No. Kernel rules written by kube-proxy.",
    "2. Ingress resource vs controller?  →  rules vs the program that reads them. Empty ADDRESS = no controller.",
    "3. pathType Prefix vs Exact?  →  Exact matches ONLY the literal path. That is INC-4a.",
    "4. Is NetworkPolicy default-allow or default-deny?  →  default-ALLOW until a policy selects the pod",
    "5. How do you write a 'deny' rule?  →  You cannot. Select the pod and permit nothing.",
    "6. What breaks first after default-deny?  →  DNS. Every call starts with a lookup — that is egress.",
    "7. required vs preferred anti-affinity?  →  required can never exceed the node count; it caps an HPA",
    "8. Does a PDB protect against a node crash?  →  No. Voluntary disruption only.",
  ],
  obj: "Formative check across Day 4.",
  time: "15 min",
  script: "Questions 4, 5 and 6 are load-bearing. If a third of the room misses any of them, recap before Friday — the capstone has a NetworkPolicy incident.",
});

L.sStats(p, {
  chip: "END OF DAY 4", dark: true, title: "What you built today",
  stats: [
    { v: "22", l: "NetworkPolicies enforcing\nzero trust across\nfour namespaces", colour: C.green },
    { v: "0", l: "failed payments while\ndraining a node under\n40 requests per second", colour: C.green },
    { v: "2", l: "hostnames reachable over TLS.\nA merchant could integrate\ntoday.", colour: C.amber },
    { v: "39", l: "policy assertions verified —\n19 calls allowed,\n8 controls enforced", colour: C.teal },
  ],
  kicker: "The DMZ can no longer read the payments database. That is the finding closed, demonstrated with the same command that opened it.",
  obj: "Consolidate and hand over to Day 5.",
  time: "3 min",
  script: "Re-run the step 1 / step 6 command one final time in front of the room. Opening the day with CONNECTED and closing it with BLOCKED is the cleanest possible demonstration that the day did something.",
});

L.sTable(p, {
  chip: "TOMORROW", title: "Day 5 — hand it to the on-call team",
  lead: "Running workloads is only the middle of operating Kubernetes. After discovery, exposure, segmentation, placement and safe disruption control come the platform capabilities that make access least-privilege, changes repeatable and failures observable.",
  head: ["What is missing", "What it costs", "Fixed in"],
  colW: [4.2, 5.6, 2.3],
  rows: [
    ["No RBAC", "Any ServiceAccount can read or change what it should not. Least privilege does not exist.", "L5.2"],
    ["Pod Security not enforced", "A pod that forgets safe defaults is still admitted.", "L5.1"],
    ["Deploying means 40 kubectl applies", "No packaging, no versioning, no one-command rollback", "L5.3"],
    ["No metrics, no dashboards", "You cannot operate what you cannot see", "L5.5"],
    ["No log aggregation", "Tracing one payment means kubectl logs across 15 services", "L5.6"],
    ["No alerts", "A merchant tells you before your monitoring does — every time this week", "L5.6"],
  ],
  obj: "Create demand for Day 5.",
  time: "4 min",
  script: "Row 6 is the callback that lands. Every single incident this week — INC-1 through INC-4 — was reported by a merchant or an alert someone wished existed. Tomorrow they build the alerts.\\n\\nAnd the correlation ID they implemented on Monday without knowing why finally pays off in Loki.",
  next: "Assessment now — ten items, fifteen minutes.",
});

p.writeFile({ fileName: "/tmp/deck/AxisPay-K8s-Day4.pptx" })
 .then(f => console.log("WROTE", f, "— slides:", p.__n));
