const pptxgen = require("pptxgenjs");
const L = require("./lib.js");
const { C } = L;

const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "AxisPay Curriculum Team";
p.company = "Axis Financial Services (fictional)";
p.title = "AxisPay Kubernetes Comprehensive — Day 3";
p.subject = "State, Configuration and Data";
p.__n = 0;
L.setDay(3);

/* ===================== OPENING ===================== */
L.sTitle(p, {
  eyebrow: "KUBERNETES COMPREHENSIVE · AXP-K8S-5D",
  title: "Day 3\nState, Configuration & Data",
  sub: "Give it a memory. By 17:00 the platform has a real database with 5,000 transactions, a ledger that balances to zero, and every credential out of your manifests.",
  meta: [["DURATION","7 hours"],["THEORY","240 min"],["HANDS-ON","345 min"],["LABS","7 + 1 incident"]],
  footer: "Everything you processed yesterday vanished when a pod restarted. Today that stops.",
  obj: "Open on the gap the students felt at the end of Day 2.",
  time: "2 min",
  script: "Open by doing it, not describing it. Delete a payment-service pod, then try to fetch a payment created this morning. It is gone.\\n\\nThat fifteen-second demo sells the whole day. Everything today exists because a Python dictionary is not a system of record.",
  demo: "kubectl delete pod -n axispay-core -l app.kubernetes.io/name=payment-service --wait=false, then curl for an earlier payment_id. 404.",
});

L.sAsk(p, {
  chip: "MORNING RECAP", label: "Answers",
  q: "Five from yesterday. Answer out loud.",
  expect: [
    "Which does the scheduler use — requests or limits?  →  requests only",
    "CPU over limit vs memory over limit?  →  throttled (silent) vs OOMKilled (137)",
    "Which probe restarts the container?  →  liveness. Readiness only removes it from endpoints.",
    "HPA shows TARGETS <unknown>. Why?  →  no CPU request, so no denominator",
    "What makes a rolling update zero-downtime?  →  readiness probe + maxUnavailable: 0",
  ],
  obj: "Retrieval practice on the load-bearing Day 2 concepts.",
  time: "20 min",
  script: "Question 3 matters most today — StatefulSet readiness probes check a real query, not just a port, and students who blurred liveness and readiness yesterday will struggle in L3.5.\\n\\nThen everyone runs `make validate-day2` before anything else.",
});

L.sTable(p, {
  chip: "TODAY", title: "What is missing, and what it costs",
  lead: "Every row is something you could already feel yesterday.",
  head: ["Missing right now", "What it costs you", "Fixed in"],
  colW: [4.0, 5.8, 2.3],
  rows: [
    ["Config baked into 11 manifests", "A log-level change at 03:00 means eleven edits under pressure", "L3.1"],
    ["JWT signing key in a plain env var", "Anyone with `get pods` can mint tokens for any merchant", "L3.2"],
    ["No persistent storage at all", "Delete a pod and every payment is gone", "L3.3, L3.4"],
    ["No database", "Nothing to reconcile against. No seven-year retention.", "L3.5"],
    ["Fraud counters in memory", "The control weakens as you scale — you found this yourself", "L3.5"],
    ["A database would be a Deployment", "Random names, no stable storage, no ordering", "L3.6"],
    ["Containers run as root", "A container escape becomes a host compromise", "L3.7"],
  ],
  obj: "Derive today's agenda from yesterday's felt gaps.",
  time: "5 min",
  script: "Row 5 is the callback that lands: several of them found the velocity bug themselves in L2.4's challenge, and today they fix it.\\n\\nRow 3 is the one to demo rather than describe.",
});

/* ===================== M3.1 CONFIGMAPS ===================== */
L.sSection(p, {
  num: "M3.1", title: "ConfigMaps",
  sub: "Configuration does not belong in a workload definition",
  objectives: ["Externalise configuration from manifests",
               "Consume config as env vars AND as volumes — and know the difference",
               "Trigger a rollout on config change with a checksum annotation"],
  time: "70 min",
  obj: "Separate configuration from the workload.",
  script: "Short module, but the env-vs-volume distinction causes real confusion later, so make it concrete.",
});

L.sExplain(p, {
  chip: "M3.1 · CONFIGMAPS",
  title: "Two ways to consume a ConfigMap — and they behave completely differently",
  question: "You change a ConfigMap. What happens to the pods already running?",
  steps: [
    ["env / envFrom", "The kubelet reads the ConfigMap ONCE, when it creates the container, and copies the values into the process environment. It is a SNAPSHOT. Change the ConfigMap afterwards and the running pod never sees it — no error, no warning, no event.", C.amberD],
    ["Why that is often right", "Most config is read once at startup anyway: URLs, timeouts, feature flags. A snapshot is honest about that, and it means a config change is a deliberate release rather than a surprise mid-request.", C.teal],
    ["volumeMount", "The kubelet projects each key as a file and UPDATES IT IN PLACE when the ConfigMap changes — typically within about 60 seconds, on its sync loop. No restart, no rollout.", C.green],
    ["The catch", "Kubernetes updated the FILE. It did not tell your process. The application must watch or re-read the file to notice. And a subPath mount NEVER updates — that is a documented exception people trip over constantly.", C.red],
  ],
  kicker: "AxisPay uses env for startup values and a volume for fraud thresholds — so operations can retune risk without redeploying the payment path.",
  obj: "Make the propagation difference concrete before students meet it in the lab.",
  time: "8 min",
  script: "In L3.1 step 5 students patch the ConfigMap, wait twenty seconds, and find the env var unchanged. Several will assume something is broken. This slide is what stops that becoming twenty minutes of confusion.\\n\\nThe subPath exception in step 4 is worth stating explicitly — it is the single most common 'why is my mounted config not updating' question.",
  ask: "Which mode would you use for a database connection string, and which for a feature flag operations must toggle at 2am?",
  answer: "Connection string: env — it is read once when the pool is built, and changing it mid-flight would be worse than a restart. Feature flag: volume — you want it live without a rollout. The choice is about WHEN the value is read, not about preference.",
});

L.sCode(p, {
  chip: "M3.1 · WORKED EXAMPLE", title: "The env-var snapshot, demonstrated",
  lead: "Real sequence from L3.1 step 5. Nothing is broken — this is the design.",
  lines: [
    { k: "cmd", t: "$ kubectl patch configmap axispay-platform-config -n axispay-core \\\\" },
    { k: "cmd", t: "    --type merge -p '{\"data\":{\"LOG_LEVEL\":\"debug\"}}'" },
    { k: "ok",  t: "configmap/axispay-platform-config patched" },
    "",
    { k: "cmd", t: "$ sleep 20 && kubectl exec -n axispay-core $POD -- printenv | grep LOG_LEVEL" },
    { k: "err", t: "LOG_LEVEL=info                     <- STILL info. No error. No warning." },
    "",
    { k: "cmd", t: "$ kubectl rollout restart deployment/payment-service -n axispay-core" },
    { k: "cmd", t: "$ kubectl exec -n axispay-core $POD -- printenv | grep LOG_LEVEL" },
    { k: "ok",  t: "LOG_LEVEL=debug" },
  ],
  note: "The env var was copied into the process when the container started. Changing the source afterwards changes nothing — and nothing tells you so.",
  obj: "Show the snapshot behaviour before students hit it.",
  time: "5 min",
  demo: "Run it live. The twenty-second pause with nothing happening is the point — let it sit.",
  script: "Then show the fix: a checksum annotation on the pod template containing a hash of the ConfigMap. Any config change alters the template, which creates a new ReplicaSet, which rolls the pods.\\n\\nThat turns config changes into proper releases — visible in rollout history, and rollback-able. Helm does this for you on Day 5.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L3.1", title: "Externalising configuration",
  will: ["Move config out of eleven manifests into two ConfigMaps",
         "Consume as env vars, then prove they do NOT update live",
         "Mount as a volume and watch the file change with no restart",
         "Wire a checksum annotation so config changes become releases"],
  done: ["Both ConfigMaps applied", "You can explain env vs volume propagation"],
  validate: "make validate-lab LAB=L3.1",
  time: "40 minutes", file: "labs/day3/L3.1-configmaps/",
  obj: "Externalise configuration and prove both consumption modes.",
  script: "Step 5 is the one that matters. Do not let anyone skip it.",
});

/* ===================== M3.2 SECRETS ===================== */
L.sSection(p, {
  num: "M3.2", title: "Secrets",
  sub: "And an honest account of what they do not protect",
  objectives: ["Create and consume Secrets as env vars and volumes",
               "State plainly that base64 is not encryption — having decoded one",
               "Name what actually protects a Secret"],
  time: "75 min",
  obj: "Teach Secrets without overclaiming.",
  script: "The single most important thing today: nobody leaves this room believing a Kubernetes Secret is encrypted. Overclaiming here is how people build insecure platforms while believing they are secure.",
});

L.sBanner(p, {
  chip: "WARNING", kind: "warn",
  big: "A Kubernetes Secret is base64-ENCODED.\nIt is not encrypted.",
  sub: "There is no key, no algorithm, and nothing to break. `base64 -d` is a formatting change, not an attack. Anyone who can read the Secret object can read every value in it.",
  points: [
    "In L3.2 step 3 you will decode the database password in ONE command.",
    "This is not a flaw you discovered. It is the documented design.",
    "What actually protects it: RBAC (who may `get secrets`), etcd encryption at rest, not mounting what you do not need, and an external secret manager.",
    "`kubectl describe secret` hides the values. That is a nicety, not a control.",
  ],
  obj: "Kill the most dangerous misconception in Kubernetes security.",
  time: "6 min",
  script: "Say this slowly and let it land. A large fraction of engineers using Kubernetes in production believe Secrets are encrypted.\\n\\nThen make it concrete: if someone takes a backup of etcd and encryption at rest is not configured, they have every credential in your cluster in plaintext. Ask how many of them know whether their production cluster has it enabled. Usually nobody does — which is the point.",
  ask: "So what IS the security boundary for a Secret?",
  answer: "RBAC — who is allowed to `get` the Secret object — plus encryption at rest so an etcd backup is not a credential dump. Both are Day 5. Today's improvement is real but modest: moving the JWT key from a plain env var into a Secret means someone now needs `get secrets` as well as `get pods`.",
});

L.sExplain(p, {
  chip: "M3.2 · SECRETS",
  title: "Why a volume beats an environment variable",
  question: "Both work. Why does AxisPay mount database credentials as a file?",
  steps: [
    ["Env vars are inherited", "Every child process the container spawns gets a copy. A shell-out, a subprocess, a debugging tool — all of them can read the credential without asking.", C.red],
    ["Env vars leak into diagnostics", "They appear in /proc/<pid>/environ, and crash handlers and error-tracking SDKs routinely capture the full environment and ship it off the machine. That is how credentials end up in a third-party bug tracker.", C.red],
    ["Env vars show up in describe", "If you use a plain `value:` rather than a `secretKeyRef`, `kubectl describe pod` prints it to anyone with `get pods`. That is the Day 1 mistake we are fixing today.", C.red],
    ["A file is read once, by the code that needs it", "No inheritance, no /proc exposure, no accidental capture. And Kubernetes mounts Secret volumes as tmpfs — in RAM, never written to the node's disk.", C.green],
  ],
  kicker: "Mount mode 0400. Read-only, owner only. It still is not encrypted — but far fewer things can accidentally read it.",
  obj: "Give a concrete reason to prefer volumes, rather than a style rule.",
  time: "7 min",
  script: "Point 2 is the one that surprises people. Error-tracking tools capturing the environment is an extremely common real-world credential leak, and it has nothing to do with Kubernetes — but the env-var pattern is what exposes you to it.\\n\\nIn L3.2 step 6 students run `mount | grep secrets` and see tmpfs. That is worth doing: it means a compromised node's disk does not contain the credential.",
  ask: "You mount a Secret as a volume. The pod is compromised. What has the attacker got?",
  answer: "That credential, from that file — the same as with an env var. A volume reduces the ways it leaks ACCIDENTALLY; it does not stop a deliberate attacker inside the container. Only short-lived, rotatable credentials from an external manager meaningfully limit that, which is why production platforms use one.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L3.2", title: "Secrets, honestly",
  will: ["Move the JWT signing key out of a plaintext env var",
         "DECODE a Secret in one command — the point of the lab",
         "Mount credentials as a read-only tmpfs volume",
         "Rotate a signing key and reason about the rotation window"],
  done: ["JWT key no longer visible in describe", "You have decoded a Secret yourself"],
  validate: "make validate-lab LAB=L3.2",
  time: "40 minutes", file: "labs/day3/L3.2-secrets/",
  obj: "Teach Secrets with their limitations demonstrated rather than described.",
  script: "Challenge C1 — enumerate every way the password could leak — is the best discussion of the day. Aim for six or more: etcd without encryption, get secret, describe with a plain env var, a crash dump, a child process, kubectl exec, node compromise reading tmpfs, and a manifest committed to Git.",
});

/* ===================== M3.3/3.4 STORAGE ===================== */
L.sSection(p, {
  num: "M3.3 – M3.4", title: "The storage model",
  sub: "Volumes, PersistentVolumes, Claims, StorageClasses and CSI",
  objectives: ["Distinguish ephemeral from persistent storage",
               "Explain the PV/PVC claim-binding contract",
               "Explain WaitForFirstConsumer by describing the failure it prevents"],
  time: "95 min",
  obj: "Deliver the storage model that StatefulSets depend on.",
  script: "This is the module StatefulSets are impossible without, which is exactly why the source syllabus's ordering (StatefulSets on day one) does not work.",
});

L.sExplain(p, {
  chip: "M3.3 · STORAGE",
  title: "Access modes — the most misread field in Kubernetes",
  question: "ReadWriteOnce. Once what?",
  steps: [
    ["ReadWriteOnce (RWO)", "One NODE may mount it read-write. NOT one pod — several pods scheduled onto the SAME node can share an RWO volume quite happily. This surprises almost everyone.", C.amberD],
    ["ReadOnlyMany (ROX)", "Many nodes, read-only. Useful for shared static content; useless for a database.", C.teal],
    ["ReadWriteMany (RWX)", "Many nodes, read-write. Requires a filesystem that supports it — NFS, CephFS, Azure Files. Most BLOCK storage (EBS, GCE PD) physically cannot do this, and asking for it just leaves the claim Pending.", C.red],
    ["ReadWriteOncePod", "Genuinely one pod. This is what people usually meant when they wrote RWO. Added because the misreading above was so common.", C.green],
  ],
  kicker: "The mode is a property of the STORAGE, not a wish. Ask for RWX on block storage and your PVC stays Pending with no obvious reason.",
  obj: "Correct a misconception that causes real production incidents.",
  time: "6 min",
  script: "The existence of ReadWriteOncePod is the giveaway — it was added because so many people read ReadWriteOnce as 'one pod' and built on that assumption.\\n\\nThe practical consequence: if you need several pods writing to one volume, check whether your storage class can actually do RWX before you design around it. On most cloud block storage it cannot, and you will find out via a Pending PVC with a terse event.",
});

L.sExplain(p, {
  chip: "M3.4 · STORAGE",
  title: "WaitForFirstConsumer — explained by the failure it prevents",
  question: "Why would you deliberately delay binding a volume?",
  steps: [
    ["With Immediate binding", "The PVC is created and the provisioner immediately makes a volume — on whichever node it chooses. Nothing has considered where the pod will run, because the pod does not exist yet.", C.amberD],
    ["The scheduler then decides separately", "Later the pod is created and the scheduler places it using CPU, memory, affinity, taints and spread constraints. It may well pick a different node.", C.amberD],
    ["The pod can never start", "0/3 nodes are available: 3 node(s) had volume node affinity conflict. The volume is on node A; the pod must run on node B; neither will move. It is stuck permanently.", C.red],
    ["WaitForFirstConsumer", "The PVC stays Pending until a pod actually needs it. The scheduler decides FIRST, then the volume is provisioned on the node that was chosen. Storage and scheduling agree by construction.", C.green],
  ],
  kicker: "On a multi-node cluster with node-local storage this is not an optimisation. It is the difference between working and not.",
  obj: "Teach a setting by the incident it prevents rather than by its definition.",
  time: "8 min",
  script: "Students see a Pending PVC in L3.4 step 3 and several will think it is broken. This slide is what makes them read the event rather than panic.\\n\\nChallenge C1 has them deliberately construct the Immediate-binding failure and capture the error. Doing it once means they recognise 'volume node affinity conflict' instantly for the rest of their careers.",
  ask: "Your PVC has been Pending for five minutes. Broken or working as intended?",
  answer: "Read the event. 'waiting for first consumer to be created before binding' is WaitForFirstConsumer working correctly — create a pod. 'storageclass not found' or 'no persistent volumes available' is genuinely broken. The status is identical; the event is everything. That distinction is INC-3.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L3.3 + L3.4", title: "Storage: claims, binding and dynamic provisioning",
  will: ["Watch ephemeral data vanish, then persist it",
         "Bind a static PV to a PVC and survive pod deletion",
         "Provision dynamically with no PV written by hand",
         "See WaitForFirstConsumer keep a PVC Pending — correctly"],
  done: ["PVC Bound", "Data survives pod deletion", "A PV exists that nobody wrote"],
  validate: "make validate-lab LAB=L3.3 && make validate-lab LAB=L3.4",
  time: "65 minutes", file: "labs/day3/L3.3-persistent-volumes/, L3.4-storageclass.md",
  obj: "Build both static and dynamic storage.",
  script: "Emphasise the reclaim policy discussion. Retain versus Delete is a decision a platform team makes ONCE in the StorageClass, and it is the difference between a recoverable mistake and a destroyed ledger.",
});

/* ===================== M3.5/3.6 DATA TIER + STATEFULSETS ===================== */
L.sSection(p, {
  num: "M3.5 – M3.6", title: "The data tier and StatefulSets",
  sub: "PostgreSQL, Redis, RabbitMQ — and why a database cannot be a Deployment",
  objectives: ["Deploy the data tier with persistent storage and real seeded data",
               "Explain stable identity and stable storage from evidence",
               "Implement init containers for ordered startup"],
  time: "110 min",
  obj: "Give the platform a system of record.",
  script: "The biggest block of the day. The payoff is a database students can actually query with 5,000 of their own transactions in it.",
});

L.sExplain(p, {
  chip: "M3.6 · STATEFULSETS",
  title: "Three guarantees a Deployment cannot give a database",
  question: "In L3.6 step 1 you deploy PostgreSQL as a Deployment. Exactly what breaks?",
  steps: [
    ["Stable NAME", "A Deployment gives random suffixes: postgres-7d4f-x7k2p. Delete it and the replacement has a different name. A replica cannot be told 'your primary is X' because X changes. A StatefulSet gives postgres-0, forever.", C.amberD],
    ["Stable STORAGE", "volumeClaimTemplates create ONE PVC PER REPLICA — data-postgres-0, data-postgres-1 — and re-attach the same claim to the same ordinal on every reschedule. A Deployment's pods either share one volume or have none.", C.green],
    ["Stable ORDER", "OrderedReady starts 0, then 1, then 2, and terminates in reverse. A replica never starts before its primary. A Deployment replaces pods in any order it likes.", C.teal],
    ["The headless Service", "clusterIP: None makes DNS return POD IPs rather than one virtual IP — so postgres-0.postgres.axispay-data resolves to that specific pod. You cannot address a single replica through a normal Service.", C.purple],
  ],
  kicker: "In the lab you build the Deployment version first, watch it lose its data and its identity, then contrast. That contrast is the lesson.",
  obj: "Justify StatefulSets from a failure students produce themselves.",
  time: "9 min",
  script: "Do not just assert this. In L3.6 step 1 they create bad-postgres as a Deployment with two replicas and an emptyDir, insert a row, delete the pod, and find a new name and no data.\\n\\nThen ask the three questions on the slide: which one is the primary, how do you address one specific replica, what happened to the data. Nobody can answer them for a Deployment, and that is the point.\\n\\nAlso flag: the PVCs are NOT deleted when a StatefulSet is deleted. Deliberate — deleting a workload must never silently destroy its data.",
  ask: "You scale postgres to 3 replicas. Do you now have a PostgreSQL cluster?",
  answer: "No. You have three independent empty databases that happen to share a name prefix. Kubernetes gives identity, storage and ordering — it knows nothing about replication, leader election or WAL shipping. A real cluster needs an Operator that understands PostgreSQL. This is challenge C1 and it is the most important misconception to clear.",
});

L.sCode(p, {
  chip: "M3.5 · WORKED EXAMPLE", title: "The invariant that matters",
  lead: "Real query against the seeded database. 5,000 payments, 14,865 ledger entries.",
  lines: [
    { k: "cmd", t: "axispay=> SELECT * FROM v_ledger_balance;" },
    "",
    { k: "dim", t: " currency | total_debits | total_credits | imbalance" },
    { k: "dim", t: "----------+--------------+---------------+-----------" },
    { k: "ok",  t: " ZAR      |    855556745 |     855556745 |         0" },
    { k: "ok",  t: " BWP      |     41203890 |      41203890 |         0" },
    { k: "ok",  t: " KES      |    180445100 |     180445100 |         0" },
    { k: "hi",  t: " (7 rows — every currency, imbalance ZERO)" },
    "",
    { k: "cmd", t: "axispay=> SELECT COUNT(*) FROM payments WHERE amount_minor <> fee_minor + net_minor;" },
    { k: "ok",  t: " 0" },
    { k: "dim", t: " -- and it CANNOT be otherwise: CONSTRAINT payments_balance" },
    { k: "dim", t: " -- makes an unbalanced row impossible to insert." },
  ],
  size: 11.5,
  note: "Debits equal credits across 4,955 journals. That is the double-entry invariant, and a non-zero value is something a human must explain before close of business.",
  obj: "Show that the seeded data is real, not decorative.",
  time: "7 min",
  demo: "Run it live against the students' own databases. They will get identical numbers — the generator is deterministic, which is deliberate so a lab can say 'you should see exactly this'.",
  script: "Two things worth pausing on.\\n\\nFirst, the constraint is in the SCHEMA, not in the application. Several services write to this table; enforcing the invariant in code means enforcing it in several places and hoping. Enforcing it in the database means an unbalanced row cannot exist, whoever writes it.\\n\\nSecond, this is why money is an integer in minor units. Floating point cannot represent 0.1 exactly; across ten thousand entries that is not a rounding curiosity, it is an audit finding.",
  ask: "Why enforce amount = fee + net in the database rather than in payment-service?",
  answer: "Because payment-service is not the only writer — settlement, recon and any future service touch this data, plus a human with psql during an incident. A CHECK constraint holds for all of them. Application-level validation only holds for the applications that remember to do it.",
});

L.sLab(p, {
  type: "GUIDED LAB", id: "L3.5 + L3.6", title: "Data tier and StatefulSets",
  will: ["Deploy PostgreSQL, Redis and RabbitMQ with persistent storage",
         "Load 5,000 payments and verify the ledger balances to ZERO",
         "Build a database as a Deployment and watch it fail",
         "Hit the node-local storage trap and recover from it",
         "Fix the fraud velocity bug with shared Redis counters"],
  done: ["3 StatefulSets ready", "ledger imbalance = 0", "velocity counters shared across replicas"],
  validate: "make validate-lab LAB=L3.5 && make validate-lab LAB=L3.6",
  time: "110 minutes", file: "labs/day3/L3.5-data-tier/, L3.6-statefulsets.md",
  obj: "Build the system of record.",
  script: "L3.6 step 5 — the node-local storage trap — is scripted and expected. Students cordon the node, delete the pod, and get 'volume node affinity conflict'. Do NOT rescue them quickly; the failure IS the lesson, and Kubernetes refusing to start the database somewhere its data is not is the CORRECT behaviour.",
  warn: "L3.5 seeding takes 30-60 seconds and pipes ~28,000 statements. If a student's psql fails midway, re-run with --regenerate rather than debugging partial state.",
});

/* ===================== M3.7 SECURITY ===================== */
L.sSection(p, {
  num: "M3.7", title: "securityContext",
  sub: "Non-root, read-only, no capabilities",
  objectives: ["Apply runAsNonRoot, readOnlyRootFilesystem and dropped capabilities",
               "Explain fsGroup and diagnose a volume permission error",
               "Justify defence in depth: image AND pod spec"],
  time: "55 min",
  obj: "Harden every workload before Day 5 makes it mandatory.",
  script: "Short module; the lab is independent. The key idea is defence in depth.",
});

L.sMistakes(p, {
  chip: "COMMON MISTAKES", title: "Storage, config and security mistakes",
  rows: [
    ["PGDATA set to the mount root", "initdb: directory not empty", "PGDATA must be a SUBdirectory of the mount"],
    ["No fsGroup on a StatefulSet", "permission denied on a fresh volume", "fsGroup = the container's runtime GID"],
    ["reclaimPolicy Delete on a ledger", "delete the PVC, lose the data", "Retain for anything you cannot recreate"],
    ["Editing a ConfigMap and expecting live env", "Nothing changes, no error", "Restart, or mount as a volume"],
    ["Believing a Secret is encrypted", "Credentials exposed in an etcd backup", "base64 is encoding. RBAC + encryption at rest."],
    ["Database as a Deployment", "Random names, lost data, no ordering", "StatefulSet + headless Service"],
    ["readOnlyRootFilesystem with no /tmp", "App crashes writing a temp file", "Mount an emptyDir at /tmp"],
  ],
  obj: "Pre-empt the seven errors students are about to make today.",
  time: "6 min",
  script: "Row 1 and row 2 are the two that will actually bite them in L3.5, within the hour. Row 2 in particular — fsGroup — is the single most common cause of a failed first StatefulSet, and the error message points at a directory that looks perfectly fine.",
});

L.sLab(p, {
  type: "INDEPENDENT LAB", id: "L3.7", title: "Non-root, read-only, no capabilities",
  will: ["Find which pods still run as root",
         "Apply the hardening baseline across the platform",
         "Watch the kubelet REFUSE a root container",
         "Build the fsGroup permission failure, then fix it",
         "Decode CapEff and see what a default container could do"],
  done: ["Every app pod runs as uid 10001", "CapEff = 0000000000000000", "read-only root filesystem"],
  validate: "make validate-lab LAB=L3.7",
  time: "30 minutes", file: "labs/day3/L3.7-security-context/",
  obj: "Harden the platform independently.",
  script: "Task 5 — the table of what each control prevents — is the debrief question. Make them write it in their own words rather than copying the manual.",
});

/* ===================== INCIDENT ===================== */
L.sBanner(p, {
  chip: "INCIDENT", kind: "warn",
  big: "SEV-1 · TWO alerts, 90 seconds apart.\nAnd they are NOT related.",
  sub: "ledger-service readiness failing, 0/2 endpoints. postgres-0 not Ready for 4 minutes. A storage change and a config change were both merged this afternoon, by different teams, and neither thinks it is theirs.",
  points: [
    "Two faults. Fixing the loud one does not fix the quiet one.",
    "Before you type anything: which do you work FIRST, and why?",
    "One is LOUD — Pending, and the events name the cause exactly.",
    "One is QUIET — Running, valid object, wrong value. Only a readiness probe makes it visible.",
    "Scored on METHOD and on PRIORITISATION.",
  ],
  obj: "Run the third incident, with prioritisation as the graded skill.",
  time: "35 min triage + 10 min debrief",
  script: "Inject with `make incident N=3` during the break, before this slide.\\n\\nThe trap: almost everyone fixes the LOUD fault first because it looks worse. Let them. In the debrief ask what a merchant experienced during the extra four minutes.\\n\\nThe correct order is the quiet one first — ledger-service is on the payment path, so while it is unready payments fail outright. And it is a one-line fix. Fix the cheap thing on the customer path first, then the expensive one.",
  ask: "DEBRIEF — why was fault B silent when it was applied?",
  answer: "A ConfigMap has no schema. Kubernetes cannot know which keys an application reads, so renaming one produces a perfectly valid object that happens to break a consumer. Nothing could have errored at apply time. What made it VISIBLE was the readiness probe they wrote yesterday — without it the pod would have stayed in the Service and silently failed every payment.",
});

/* ===================== CLOSE ===================== */
L.sAsk(p, {
  chip: "KNOWLEDGE CHECK", label: "Answers",
  q: "Eight questions. Answer out loud. Not scored.",
  expect: [
    "1. Change a ConfigMap — do running pods see it?  →  env: no. volume: yes, ~60s.",
    "2. Is a Secret encrypted?  →  No. base64-encoded. RBAC + etcd encryption protect it.",
    "3. ReadWriteOnce — once what?  →  one NODE, not one pod",
    "4. Why WaitForFirstConsumer?  →  so storage is provisioned where the scheduler put the pod",
    "5. Retain vs Delete?  →  Retain keeps the volume when the PVC goes. Use it for data you cannot recreate.",
    "6. Three things a StatefulSet gives that a Deployment cannot?  →  stable name, stable storage, ordering",
    "7. What does fsGroup do?  →  chowns the mounted volume so a non-root process can write to it",
    "8. Scale postgres to 3 — do you have a cluster?  →  No. Three independent empty databases.",
  ],
  obj: "Formative check across Day 3.",
  time: "15 min",
  script: "Questions 2 and 6 are the load-bearing ones. If a third of the room gets 2 wrong, re-teach it — believing Secrets are encrypted is actively dangerous.",
});

L.sStats(p, {
  chip: "END OF DAY 3", dark: true, title: "What you built today",
  stats: [
    { v: "5,000", l: "payments in PostgreSQL,\nsurviving pod deletion,\nqueryable by you", colour: C.green },
    { v: "0", l: "ledger imbalance across\n4,955 journals and\nseven currencies", colour: C.green },
    { v: "3", l: "StatefulSets with stable\nidentity and their own\npersistent volumes", colour: C.amber },
    { v: "10001", l: "the UID every application\npod now runs as —\nzero capabilities", colour: C.teal },
  ],
  kicker: "The platform has a memory, a system of record, and no credentials in its manifests. It is still unreachable from outside the cluster.",
  obj: "Consolidate and hand over to Day 4.",
  time: "3 min",
  script: "Have them run the ledger balance query one more time and look at it. On day three of a Kubernetes course they have a payments database with a double-entry ledger that balances. That is worth thirty seconds.",
});

L.sTable(p, {
  chip: "TOMORROW", title: "Day 4 — let the world in, and keep it out of the vault",
  lead: "The platform works. No merchant can reach it, and the DMZ can reach the database.",
  head: ["What is missing", "What it costs", "Fixed in"],
  colW: [4.2, 5.6, 2.3],
  rows: [
    ["No route in from outside", "No merchant can integrate. port-forward is not a product.", "L4.3"],
    ["No TLS", "Card data over plaintext HTTP", "L4.3"],
    ["Flat pod network", "axispay-edge can reach PostgreSQL directly — a PCI finding", "L4.4"],
    ["No control over placement", "All three payment replicas can land on one node", "L4.5"],
    ["No disruption budget", "A node drain takes every replica at once", "L4.6"],
    ["DNS is still a black box", "You have used it for three days without opening it", "L4.2"],
  ],
  obj: "Create demand for Day 4.",
  time: "4 min",
  script: "Row 3 is the one to dwell on. Have someone exec into an edge-gateway pod and connect to postgres directly. It works — and in a PCI audit that single fact would put the DMZ inside the cardholder data environment.\\n\\nThat demo takes thirty seconds and it sells Thursday completely.",
  next: "Assessment now — ten items, fifteen minutes.",
});

p.writeFile({ fileName: "/tmp/deck/AxisPay-K8s-Day3.pptx" })
 .then(f => console.log("WROTE", f, "— slides:", p.__n));
