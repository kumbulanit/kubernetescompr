# L3.7 · Security Context — Stop Running As Root

| | |
|---|---|
| **Time** | 40 minutes |
| **Difficulty** | Five settings, each with a reason |
| **You need first** | [L3.6](../L3.6-statefulsets/) finished |
| **You will change** | Every workload gets a hardened security context |
| **Check you are done** | `make validate-lab LAB=L3.7` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command. <kbd>Tab</kbd> completes filenames.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../../GETTING-STARTED.md).
</details>

---

## What you are going to do

By default a container runs as **root**, with a **writable filesystem** and **all default Linux capabilities**. If an attacker gets code execution inside your payment service, they get all of that.

You will lock every AxisPay workload down: non-root, read-only root filesystem, every capability dropped, no privilege escalation, and a seccomp profile. Then you will find out what breaks — because things do break, and knowing which and why is the difference between hardening a platform and giving up halfway.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get pods -n axispay-core` | All `1/1 Running` |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | The hardened Deployments |

---

## Step 1 — See what you have

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $POD -- id
kubectl exec -n axispay-core $POD -- touch /root-write-test 2>&1 | head -2
kubectl exec -n axispay-core $POD -- sh -c 'grep CapEff /proc/1/status'
```

The AxisPay images already set `USER 10001`, so `id` shows a non-root user — that came from the Dockerfile. **But the filesystem is writable and capabilities are still present.** Image hygiene and pod hardening are different work, and only the pod spec can do the second.

---

## Step 2 — Read the hardened spec

```bash
grep -B2 -A18 'securityContext' manifests/*payment*.yaml | head -32
```

```yaml
securityContext:                    # POD level
  runAsNonRoot: true                # ①
  runAsUser: 10001
  runAsGroup: 10001
  fsGroup: 10001                    # ②
  seccompProfile:
    type: RuntimeDefault            # ③
containers:
  - name: payment-service
    securityContext:                # CONTAINER level
      allowPrivilegeEscalation: false   # ④
      readOnlyRootFilesystem: true      # ⑤
      capabilities:
        drop: ["ALL"]                   # ⑥
```

| | What it means |
|---|---|
| ① | **Refuse to start if the image would run as root.** A guarantee, not a hope — it catches a base-image change that quietly reverts to root. |
| ② | Set group ownership on mounted volumes so a non-root process can write to them. Without this, a fresh volume is root-owned and your container gets `permission denied`. |
| ③ | Apply the container runtime's default seccomp profile, blocking around 300 rarely-used syscalls. Not applied by default, for historical compatibility. |
| ④ | Sets `no_new_privs`. **This matters even when you are already non-root** — see Step 5. |
| ⑤ | The container filesystem is read-only. Anything that must be written needs an explicit mount. |
| ⑥ | Drop every Linux capability. AxisPay needs none — it binds port 8080, which is above 1024. |

**Pod-level applies to everything in the pod; container-level applies to one container and wins on conflict.**

---

## Step 3 — Apply, and find what breaks

```bash
kubectl apply -f manifests/
kubectl rollout status deployment/payment-service -n axispay-core --timeout=180s
kubectl get pods -n axispay-core
```

If a pod crashes, that is the lab working:

```bash
kubectl logs -n axispay-core -l app.kubernetes.io/name=payment-service --tail=20 --previous 2>/dev/null | head
```

**The usual culprit is `readOnlyRootFilesystem`.** Python writes temp files; `httpx` buffers large responses to disk. The fix is not to turn it off — it is to mount exactly what is needed:

```bash
grep -B2 -A8 'emptyDir' manifests/*payment*.yaml | head -14
```

```yaml
volumeMounts:
  - name: tmp
    mountPath: /tmp
volumes:
  - name: tmp
    emptyDir:
      sizeLimit: 64Mi          # <- always set this
```

**Always set `sizeLimit`.** An unbounded `emptyDir` fills the node's disk, and node disk pressure evicts pods — including ones that had nothing to do with it.

---

## Step 4 — Verify each control

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n axispay-core $POD -- id
kubectl exec -n axispay-core $POD -- touch /nope 2>&1 | head -1
kubectl exec -n axispay-core $POD -- touch /tmp/fine && echo "/tmp writable — correct"
kubectl exec -n axispay-core $POD -- sh -c 'grep -E "CapEff|NoNewPrivs|Seccomp" /proc/1/status'
```

```
uid=10001 gid=10001
touch: /nope: Read-only file system
/tmp writable — correct
CapEff:  0000000000000000        <- no capabilities at all
NoNewPrivs:     1                <- privilege escalation blocked
Seccomp:        2                <- filtered
```

**`CapEff: 0000000000000000`** is the one to look at. Zero capabilities. Compare with Step 1.

---

## Step 5 — Why `allowPrivilegeEscalation: false` matters even when non-root

**Why we are doing this.** It looks redundant. It is not.

A **setuid** binary runs with the privileges of the file's *owner*, not the caller's. If a setuid-root binary is present in the image — and base images contain several, `ping` and `mount` among them — a non-root process that executes one becomes root.

`allowPrivilegeEscalation: false` sets the kernel's `no_new_privs` bit, and the kernel then ignores setuid entirely for that process **and all its children**.

```bash
kubectl exec -n axispay-core $POD -- sh -c 'find / -perm -4000 -type f 2>/dev/null | head -5'
```

Whatever that lists, it can no longer escalate. **This is defence against something already in your image** — which is exactly the case you cannot audit away.

---

## Step 6 — The exceptions, and why they are exceptions

Not everything can meet this standard.

```bash
kubectl get daemonset node-agent -n axispay-ops -o jsonpath='{.spec.template.spec.containers[0].securityContext}' | jq . 2>/dev/null
```

`node-agent` reads host `/proc`, which needs a hostPath mount. **Note what it does *not* relax:** still non-root, still every capability dropped, still a read-only root filesystem, and `/proc` mounted **read-only**.

**That is the shape of a defensible exception:** relax exactly one thing, keep everything else, and write down why. On Day 5 you will find the exception recorded in the namespace's Pod Security label with the reason next to it.

---

## Did it work?

```bash
make validate-lab LAB=L3.7
make validate-day3
```

---

## Clean up

Nothing. This is the Day 3 end state.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `CreateContainerConfigError: runAsNonRoot` | The image has no `USER` and would run as root | Fix the Dockerfile, or set `runAsUser` explicitly |
| `Read-only file system` in logs | Something writes outside a mount | Find the path and mount an `emptyDir` there — do not disable the setting |
| `permission denied` on a volume | Volume owned by root, process is not | `fsGroup` on the pod security context |
| `operation not permitted` on a syscall | A dropped capability was needed | Find which, and add back **only** that one |
| Pod will not start after hardening | Several of the above at once | Apply one setting at a time to isolate it |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/03-storage-and-configuration/solutions.md).

**1.** Find **every** path AxisPay services write to, and mount the minimum set of `emptyDir` volumes. Justify each one.

**2.** `node-agent` must read host `/proc`. Write its security context granting the least privilege that still works. Which controls can you keep, and which must you relax?

**3.** Explain why `allowPrivilegeEscalation: false` matters even when already running as non-root. *(What does a setuid binary do?)*

---

## What you built

- **Every workload non-root, read-only, with no capabilities**
- **`CapEff: 0000000000000000`** — verified, not assumed
- **The `/tmp` mount pattern** for a read-only filesystem, with a size limit
- **`no_new_privs`**, and the setuid attack it closes
- **One documented exception**, relaxing exactly one control and no more

**Next:** [INC-3 — Two faults at once](../INC-3-storage-and-config/). This time there is more than one thing wrong.
