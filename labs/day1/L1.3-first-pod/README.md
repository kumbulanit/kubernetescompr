# L1.3 · Your First Pod — And Why You Must Never Ship One

| | |
|---|---|
| **Time** | 40 minutes |
| **Difficulty** | You run real software for the first time |
| **You need first** | [L1.1](../L1.1-cluster-recon/) and [L1.2](../L1.2-namespaces/) |
| **You will create** | 1 pod (and then break it on purpose) |
| **Check you are done** | `make validate-lab LAB=L1.3` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. Step 3 asks you to use it.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`.
- Full version: [`labs/GETTING-STARTED.md`](../../GETTING-STARTED.md).
</details>

---

## What you are going to do

You are going to run the AxisPay payment service for the first time — as a single **pod**, which is the simplest thing Kubernetes can run.

It will work. You will send it a request and get a real response. Then you will **delete it**, and discover that nothing brings it back. That is the lesson: a bare pod is a thing you ran once, not a thing that stays running.

You will also meet something that catches almost everyone: the pod will report **not ready**, and that will be *correct behaviour*. Understanding why is worth more than getting a green tick.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get ns axispay-core` | `axispay-core   Active` |
| 3 | `minikube -p axispay image ls \| grep payment-service` | `axispay/payment-service:1.0.0` |

**If #3 prints nothing**, the container image has not been built. Build it now — it takes a few minutes:

```bash
eval $(minikube -p axispay docker-env)
make build
```

> **What that first line does.** `minikube docker-env` prints some settings; `eval` applies them to your terminal. It points your `docker` command at the cluster's own container store instead of your laptop's, so images you build are immediately visible to Kubernetes — no uploading anywhere. It only affects the terminal you run it in.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/01-pod-payment-service.yaml` | The pod you are about to create. |

---

## First — what *is* a pod?

A pod is **one or more containers that always travel together**. Same machine, same IP address, same `localhost`, able to share files.

The obvious question is: why not just run a container?

Because some things only work if they share a network and a filesystem. An application and its log shipper. An application and a proxy that handles its TLS. An application and a small helper that prepares its data before it starts. If Kubernetes only scheduled single containers, you could not express "these two must be on the same machine, sharing an address".

So the pod is the smallest thing Kubernetes will schedule. Most of the time it holds exactly one container — but the wrapper is there when you need it.

```
┌─ Pod ─────────────────────────────────────┐
│  one IP address · one localhost           │
│                                           │
│   ┌──────────┐   ┌──────────────────┐     │
│   │  pause   │   │ payment-service  │     │
│   │ (hidden) │   │      :8080       │     │
│   └──────────┘   └──────────────────┘     │
└───────────────────────────────────────────┘
              runs on one node
```

The `pause` container is a trick you will never interact with: it starts first and does nothing but hold the network address open, so your real container can be restarted without the pod losing its IP.

---

## Step 1 — Read the file first

**Why we are doing this.** Same habit as L1.2, and this file has more in it.

**Run this:**

```bash
cat manifests/01-pod-payment-service.yaml
```

Here it is with the parts that matter explained:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: payment-service-bare              # ① the pod's name
  namespace: axispay-core                 # ② which room it goes in
  labels:                                 # ③ tags — L1.5 depends on these
    app.kubernetes.io/name: payment-service
    app.kubernetes.io/part-of: axispay
spec:                                     # ④ what you WANT
  terminationGracePeriodSeconds: 5        # ⑤
  containers:
    - name: payment-service
      image: axispay/payment-service:1.0.0     # ⑥
      imagePullPolicy: IfNotPresent            # ⑦
      ports:
        - name: http
          containerPort: 8080                  # ⑧
      env:                                     # ⑨
        - name: ENVIRONMENT
          value: "training"
        - name: POD_NAME                       # ⑩
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
```

| | What it means |
|---|---|
| ① | The name. Unique within the namespace. `-bare` is a reminder that this is the version you should never ship. |
| ② | Which namespace it lives in. You could leave it out and use `-n` on the command line; writing it in the file is safer. |
| ③ | **Labels.** In L1.5 a Service will find this pod by searching for `app.kubernetes.io/name: payment-service`. That is the only connection between them — no wiring, no configuration, just a label match. |
| ④ | **`spec` is what you want.** Kubernetes will add a `status` section later describing what is actually true. Every object works this way. |
| ⑤ | When you delete this pod, wait 5 seconds for it to shut down cleanly before killing it. The default is 30, shortened here because you will delete it several times. |
| ⑥ | Which container image to run. `1.0.0` is a fixed version — never use `latest`, because then you cannot say what is running. |
| ⑦ | `IfNotPresent` = "use the local copy if there is one, do not go looking online". Correct here because you built it locally. |
| ⑧ | The application listens on port 8080 inside the container. |
| ⑨ | Environment variables — how you configure a container without rebuilding it. |
| ⑩ | This one is clever: it copies the pod's own name **into** the pod as an environment variable. The application can then tell you which pod answered your request. You will use that in L1.5 to prove load balancing is real. |

---

## Step 2 — Create it and watch it start

**Run this:**

```bash
kubectl apply -f manifests/01-pod-payment-service.yaml
```

```
pod/payment-service-bare created
```

**Now watch it come up:**

```bash
kubectl get pod payment-service-bare -n axispay-core -w
```

`-w` means watch — keep printing as things change.

**What you should see, over about fifteen seconds:**

```
NAME                   READY   STATUS              RESTARTS   AGE
payment-service-bare   0/1     Pending             0          0s
payment-service-bare   0/1     ContainerCreating   0          1s
payment-service-bare   0/1     Running             0          4s
payment-service-bare   1/1     Running             0          12s
```

**Stop watching** with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

**What that means.** You just watched four states:

| Status | What is happening |
|---|---|
| `Pending` | Accepted, but no node chosen yet. The scheduler is deciding. |
| `ContainerCreating` | A node was chosen. Its kubelet is unpacking the image and starting the container. |
| `Running` | The container process has started. |
| `1/1 Running` | The container has also declared itself **ready**. |

### `READY` and `STATUS` are different things, and this trips up everyone

Look at the difference between `0/1 Running` and `1/1 Running`.

- **`STATUS: Running`** means the process started.
- **`READY: 1/1`** means it also said *"I can handle requests now"*.

A pod can sit at `0/1 Running` indefinitely — alive, and refusing traffic on purpose. That is not a bug; it is a service being honest about not being ready. Half of Day 2 is about this distinction.

**Whenever you look at a pod list this week, read the READY column first.** Not STATUS.

---

## Step 3 — Look at it properly

**Why we are doing this.** `describe` is the command you will reach for every time something is wrong. Learn it now, while nothing is wrong.

**Run this:**

```bash
kubectl describe pod payment-service-bare -n axispay-core
```

It prints about eighty lines. You do not need all of them. Three parts matter:

**Near the top** — where it landed and what address it got:

```
Node:         axispay-m02/192.168.49.3
Status:       Running
IP:           10.244.1.7
```

**In the middle** — the container's own state:

```
Containers:
  payment-service:
    State:          Running
      Started:      Mon, 10 Aug 2026 09:31:14 +0200
    Ready:          True
    Restart Count:  0
```

**At the very bottom** — the events:

```
Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  45s   default-scheduler  Successfully assigned axispay-core/payment-service-bare to axispay-m02
  Normal  Pulled     44s   kubelet            Container image "axispay/payment-service:1.0.0" already present on machine
  Normal  Created    44s   kubelet            Created container payment-service
  Normal  Started    44s   kubelet            Started container payment-service
```

**What that means.** That events list is the pod's life story: scheduled → image found → container created → started. When a pod is broken, **this is where the reason is**, and it is at the bottom of the output where people forget to scroll.

> **Remember this shape.** In L1.4's incident, and in every incident this week, `describe` and its events are step 2 of the method.

---

## Step 4 — Read its logs

**Why we are doing this.** Logs are the application's own account of what happened. `describe` tells you what *Kubernetes* did; logs tell you what your *code* did.

**Run this:**

```bash
kubectl logs payment-service-bare -n axispay-core
```

**What you should see** (one JSON object per line):

```json
{"service":"payment-service","level":"info","msg":"starting","version":"1.0.0","pod":"payment-service-bare"}
{"service":"payment-service","level":"info","msg":"ready to serve","port":8080}
```

**What that means.** The application logs to standard output — the terminal — and Kubernetes captures it. It writes no log files.

That is deliberate and it is a rule worth learning now: **a container should log to stdout, never to a file inside itself.** A file inside a container cannot be read from outside and disappears when the pod restarts. On Friday, a collector will scoop up these exact lines from every pod and make them searchable — and it can only do that because they go to stdout.

**Two flags worth knowing now:**

```bash
kubectl logs payment-service-bare -n axispay-core -f          # follow — keep printing (Ctrl+C to stop)
kubectl logs payment-service-bare -n axispay-core --tail=20   # just the last 20 lines
```

---

## Step 5 — Talk to it

**Why we are doing this.** The pod has an IP address, but it is on the cluster's private network — your laptop cannot reach it. `port-forward` builds a temporary tunnel.

You need **two terminals** again.

**Terminal 1 — open the tunnel:**

```bash
kubectl port-forward pod/payment-service-bare 8080:8080 -n axispay-core
```

```
Forwarding from 127.0.0.1:8080 -> 8080
Forwarding from [::1]:8080 -> 8080
```

It will sit there. That is correct — leave it running.

**Terminal 2 — send it a request:**

```bash
curl -s http://localhost:8080/api/v1/_info | jq .
```

`curl` fetches a URL. `jq .` formats the JSON so a human can read it.

**What you should see:**

```json
{
  "service": "payment-service",
  "version": "1.0.0",
  "pod": "payment-service-bare",
  "node": "axispay-m02",
  "namespace": "axispay-core",
  "environment": "training"
}
```

**What that means.** Real software, running on your cluster, answering a real HTTP request. Notice `"pod"` and `"node"` — that is the Downward API from ⑩ in Step 1, reporting its own identity back to you.

**Now ask it whether it is healthy:**

```bash
curl -s http://localhost:8080/healthz | jq .
curl -s http://localhost:8080/readyz  | jq .
```

```json
{ "status": "ok" }
```

```json
{
  "ready": false,
  "checks": { "merchant-service": "unreachable" }
}
```

### Read that again — `ready: false`

**This is correct, and it is the most useful thing in this lab.**

`payment-service` needs `merchant-service` to do its job. `merchant-service` does not exist yet — you have not created it. So the service is telling you the truth: *I am alive, but I cannot serve requests properly.*

Two different questions, two different answers:

| Endpoint | Question | Answer now |
|---|---|---|
| `/healthz` | Am I alive? Should you restart me? | Yes, I am alive. Restarting would not help. |
| `/readyz` | Can I serve requests? Should you send me traffic? | No. Send it elsewhere. |

Restarting this pod would achieve nothing — the missing dependency would still be missing. Sending it traffic would produce errors. **Alive and ready are different, and conflating them is one of the most expensive mistakes in Kubernetes.** You will build on this all day Tuesday.

**Close the tunnel** in terminal 1 with <kbd>Ctrl</kbd>+<kbd>C</kbd>.

---

## Step 6 — Look inside the running container

**Why we are doing this.** Sometimes you need to be inside. `exec` gives you a shell in a running container.

**Run this:**

```bash
kubectl exec -it payment-service-bare -n axispay-core -- sh
```

`-it` connects your keyboard to it; everything after `--` is the command to run inside — here, a shell.

**Your prompt changes.** You are now inside the container:

```sh
$ ls /app
app  axispay_common
$ env | grep POD
POD_NAME=payment-service-bare
POD_IP=10.244.1.7
$ whoami
axispay
$ exit
```

**What that means.** Three things worth noticing:

- The filesystem is the container's own, not your laptop's.
- The environment variables from the manifest are really there.
- **`whoami` says `axispay`, not `root`.** The image was deliberately built to run as an ordinary user. If someone breaks into this container, they do not get root. You will harden this much further on Day 3.

> **Remember `exec` exists, and remember it is powerful.** On Day 5 you will discover that permission to run `kubectl exec` is effectively permission to read every password the pod uses — which makes it one of the most important things to control.

---

## Step 7 — Delete it, and see what a bare pod really is

**Why we are doing this.** This is the point of the lab.

**First, prove it exists:**

```bash
kubectl get pods -n axispay-core
```

```
NAME                   READY   STATUS    RESTARTS   AGE
payment-service-bare   1/1     Running   0          6m
```

**Now delete it:**

```bash
kubectl delete pod payment-service-bare -n axispay-core
```

```
pod "payment-service-bare" deleted
```

**Wait ten seconds, then look again:**

```bash
kubectl get pods -n axispay-core
```

```
No resources found in axispay-core namespace.
```

**Gone. Nothing brought it back.**

**Now think about what that means in production.** That was not you typing `delete`. That is:

- a node running out of memory and evicting it
- a machine being restarted for a security patch
- a cloud provider reclaiming a spot instance
- the process crashing

In every one of those cases, your payment service is simply **gone**, and it stays gone until a human notices and types a command.

**A bare pod has nobody watching it.** Nothing in Kubernetes has been told "there should always be one of these". You created an object; you did not create an intention.

That is what a **Deployment** is for, and it is the next lab.

---

## Did it work?

Recreate the pod first — the validator expects it:

```bash
kubectl apply -f manifests/01-pod-payment-service.yaml
kubectl wait --for=condition=Ready pod/payment-service-bare -n axispay-core --timeout=60s
make validate-lab LAB=L1.3
```

> `kubectl wait` blocks until the condition is true, so the next command does not run too early. It is much better than guessing with `sleep`.

**What you should see:**

```
✓ L1.3 PASSED — 9/9 checks
```

---

## Clean up

Delete the bare pod. L1.4 creates the proper version.

```bash
kubectl delete pod payment-service-bare -n axispay-core --ignore-not-found
```

`--ignore-not-found` means "do not complain if it is already gone" — useful in scripts, and it saves you worrying about whether you already deleted it.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `ErrImagePull` or `ImagePullBackOff` | The image is not in the cluster's store | `eval $(minikube -p axispay docker-env)` then `make build`. See "What you need before you start". |
| Stuck at `Pending` for over a minute | No node can fit it | `kubectl describe pod payment-service-bare -n axispay-core` and read the events at the bottom |
| `CrashLoopBackOff` | It starts, then exits, repeatedly | `kubectl logs payment-service-bare -n axispay-core --previous` — `--previous` shows the *dead* container's logs. Without it you get the new one's, which are empty |
| Stuck at `0/1 Running` | Failing its readiness check | Expected here — see Step 5. Confirm with `kubectl describe pod` |
| `port-forward` says `address already in use` | Something else has port 8080 | Use a different local port: `kubectl port-forward ... 18080:8080` and curl `localhost:18080` |
| `curl: (7) Failed to connect` | The tunnel is not running | Check terminal 1. It must still be open and printing `Forwarding from ...` |
| `jq: command not found` | Not installed | `sudo apt install -y jq` |
| `exec` says `unable to upgrade connection` | The pod is not running | `kubectl get pods -n axispay-core` |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/01-foundations-and-core-objects/solutions.md).

**1.** Recreate the pod, then find its IP address and, from a *different* pod, fetch `/api/v1/_info` using that IP instead of port-forward. Then explain why relying on that IP would be a bad idea in production.

**2.** Add a second container to the pod — `busybox:1.37` running `sleep 3600`. Then from inside that second container, `curl` the payment service on `localhost:8080`. Why does `localhost` work between two containers in the same pod, when it would not work between two pods?

**3.** Delete the pod while `kubectl get pods -w` is running in another terminal, and write down every state it passes through on the way out.

### Bonus

```bash
kubectl get pod payment-service-bare -n axispay-core -o yaml | head -60
```

Compare with the file you wrote. Kubernetes has added a great deal: a `uid`, a `nodeName`, a `status` block with conditions and timestamps, default values you never set, and a `serviceAccountName` you did not ask for.

That last one — `serviceAccountName: default` — is a credential that was mounted into your container without you asking. It does nothing today. On Day 5 you will find out why it matters, and take it away.

---

## What you built

- **A running pod** serving real HTTP traffic
- **The four commands you will use most this week**: `describe`, `logs`, `port-forward`, `exec`
- **The difference between `Running` and `Ready`** — and why a service can be correctly unready
- **The difference between `/healthz` and `/readyz`** — alive versus able to serve
- **Proof that a bare pod has nobody watching it**, which is the reason the next lab exists

**Next:** [L1.4 — Deployments](../L1.4-deployments/) — where you tell Kubernetes what you *want*, and let it worry about keeping it true.
