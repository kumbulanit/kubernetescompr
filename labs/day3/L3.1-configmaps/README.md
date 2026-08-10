# L3.1 · ConfigMaps — Configuration Without Rebuilding

| | |
|---|---|
| **Time** | 35 minutes |
| **Difficulty** | One idea, two behaviours, one trap |
| **You need first** | Day 2 finished — `make validate-day2` passes |
| **You will create** | 2 ConfigMaps |
| **Check you are done** | `make validate-lab LAB=L3.1` |

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

Your services are configured by environment variables written directly into the Deployment. Change a fee percentage and you edit a Deployment, roll every pod, and hope you did not fat-finger a different field on the way past.

You will move that configuration into **ConfigMaps** — separate objects, versioned separately, editable without touching a workload.

Then you will find out the thing that surprises everyone: **how you consume a ConfigMap decides whether changes ever reach a running pod.** As environment variables, they never do. As a mounted file, they do — about a minute later. And there is one option that looks like a file but silently never updates.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `make validate-day2` | `DAY 2 CHECKPOINT PASSED` |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | The ConfigMaps, and the Deployments that consume them |

---

## Step 1 — See the problem

```bash
kubectl get deploy payment-service -n axispay-core \
  -o jsonpath='{.spec.template.spec.containers[0].env[*].name}' | tr ' ' '\n'
```

Every setting is baked into the Deployment. To change one you edit a workload definition — which means the risk of the change is the risk of editing a Deployment, not the risk of changing a number.

---

## Step 2 — Read the ConfigMaps

```bash
cat manifests/01-configmap-platform.yaml
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: axispay-platform-config
  namespace: axispay-core
data:                                  # ① plain key/value strings
  DEFAULT_CURRENCY: "ZAR"
  SUPPORTED_CURRENCIES: "ZAR,USD,EUR,GBP,NGN,KES,BWP"
  fraud-rules.json: |                  # ② a whole file, as one value
    { "velocity_window_seconds": 3600, "max_attempts": 5 }
```

| | What it means |
|---|---|
| ① | Every value is a **string**. `3600` must be `"3600"`. This bites everyone once. |
| ② | A key can hold an entire file. When mounted as a volume, the key becomes the filename. |

> **The 1 MiB limit.** A ConfigMap is stored in etcd and cannot exceed 1 MiB. That is why AxisPay's 8 MB seed data is piped into the database in L3.5 rather than mounted — a real constraint that catches people out.

---

## Step 3 — Apply, and consume as environment variables

```bash
kubectl apply -f manifests/
kubectl get configmap -n axispay-core
```

```bash
grep -A6 'envFrom' manifests/*deployment*.yaml | head -12
```

```yaml
envFrom:
  - configMapRef:
      name: axispay-platform-config
```

`envFrom` pulls in **every** key as an environment variable. `env` with a `configMapKeyRef` picks one. Use `envFrom` when you want the lot; use `env` when you want to rename or select.

```bash
kubectl rollout status deployment/payment-service -n axispay-core --timeout=120s
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $POD -- printenv | grep -E 'CURRENCY|CURRENCIES'
```

---

## Step 4 — Prove environment variables do NOT update

**Why we are doing this.** This is the single most common ConfigMap misunderstanding.

```bash
kubectl patch configmap axispay-platform-config -n axispay-core \
  --type merge -p '{"data":{"DEFAULT_CURRENCY":"USD"}}'

kubectl get configmap axispay-platform-config -n axispay-core -o jsonpath='{.data.DEFAULT_CURRENCY}'; echo
kubectl exec -n axispay-core $POD -- printenv DEFAULT_CURRENCY
```

```
USD          <- the ConfigMap changed
ZAR          <- the running pod did not
```

**Wait two minutes and check again. Still `ZAR`.**

**What that means.** Environment variables are set **once**, when the container starts. The value was copied in at that moment. Nothing in Linux can change a running process's environment from outside — this is not a Kubernetes limitation, it is how processes work.

**A ConfigMap consumed as an env var is a snapshot, not a link.**

```bash
kubectl patch configmap axispay-platform-config -n axispay-core \
  --type merge -p '{"data":{"DEFAULT_CURRENCY":"ZAR"}}'
```

---

## Step 5 — Mount as a volume and watch it update in place

```bash
grep -B4 -A8 'volumeMounts' manifests/*deployment-fraud*.yaml | head -20
```

```yaml
volumeMounts:
  - name: fraud-rules
    mountPath: /etc/axispay          # ① a DIRECTORY, not a file
volumes:
  - name: fraud-rules
    configMap:
      name: axispay-fraud-rules
```

```bash
FPOD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=fraud-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $FPOD -- cat /etc/axispay/fraud-rules.json
```

**Now change it and watch:**

```bash
kubectl patch configmap axispay-fraud-rules -n axispay-core --type merge \
  -p '{"data":{"fraud-rules.json":"{\"velocity_window_seconds\": 7200, \"max_attempts\": 3}"}}'

for i in $(seq 1 12); do
  echo -n "$((i*10))s: "
  kubectl exec -n axispay-core $FPOD -- cat /etc/axispay/fraud-rules.json 2>/dev/null | head -c 60; echo
  sleep 10
done
```

**Somewhere around 60 seconds the file changes — in a pod that never restarted.**

**What that means.** Kubernetes maintains the mounted directory as a set of symlinks and swaps them atomically. The kubelet refreshes it on its sync interval, which defaults to about a minute.

**But note carefully what did *not* happen:** the application did not reload. Kubernetes updated the *file*; re-reading it is the application's job. "Supports hot reload" means the application watches the file — and most do not.

---

## Step 6 — The trap: `subPath` never updates

```bash
kubectl exec -n axispay-core $FPOD -- ls -la /etc/axispay/
```

You will see `..data` and symlinks. **That structure is the update mechanism.**

`subPath` mounts a single file directly, bypassing the symlink tree:

```yaml
volumeMounts:
  - name: fraud-rules
    mountPath: /etc/axispay/fraud-rules.json
    subPath: fraud-rules.json          # <- placed once, NEVER updated
```

**When to use it anyway:** when you must put one file into a directory that already has other content — mounting the whole ConfigMap there would hide everything else.

**The rule:** every `subPath` deserves a comment saying you know it will not update.

---

## Step 7 — Force a rollout when config changes

**Why we are doing this.** Sometimes you *want* every pod restarted on a config change — because the app cannot reload.

```bash
grep -A3 'checksum/config' manifests/*deployment*.yaml | head -6
```

An annotation holding a hash of the ConfigMap. Change the config, the hash changes, the pod template changes, and Kubernetes rolls the workload. Without it, a config edit applies only to pods created *afterwards* — so you end up with a fleet where half have the old value and half the new, which is the worst of both.

```bash
kubectl rollout restart deployment/payment-service -n axispay-core
kubectl rollout status deployment/payment-service -n axispay-core
```

`rollout restart` is the manual version, and it is worth knowing.

---

## Did it work?

```bash
make validate-lab LAB=L3.1
```

---

## Clean up

```bash
kubectl apply -f manifests/
```

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `CreateContainerConfigError` | The ConfigMap or a key does not exist | `kubectl describe pod <name>` names the missing key |
| Env var not updating | Expected — see Step 4 | Roll the workload |
| Mounted file not updating | `subPath`, or under 60s | Check for `subPath`; wait longer |
| `cannot unmarshal number` | An unquoted number in `data` | Every value must be a string |
| Mount hides existing files | A directory mount replaces the directory | Use `subPath`, and accept it will not update |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/03-storage-and-configuration/solutions.md).

**1.** Make `fraud-service` pick up a changed threshold with **no restart at all**, end to end — including the application re-reading the file. What would the code need to do, and what is the total propagation delay?

**2.** Mount one key with `subPath`, change the ConfigMap, and confirm the file does not update. Then explain when you would still choose it.

**3.** Set `immutable: true` on a ConfigMap. What breaks, what improves, and why does Kubernetes offer it? *(Think about kubelet watch load at 10,000 pods.)*

---

## What you built

- **Configuration separated from workloads**
- **Proof that env vars are a snapshot** — the most common misunderstanding, seen rather than read
- **A file updating inside a running pod**, and the ~60 second delay
- **The `subPath` trap**, and when it is still the right choice
- **The checksum annotation** that turns a config change into a rollout

**Next:** [L3.2 — Secrets](../L3.2-secrets/) — which are ConfigMaps with a reputation they have not earned.
