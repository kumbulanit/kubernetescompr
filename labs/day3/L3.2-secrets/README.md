# L3.2 · Secrets — Base64 Is Not Encryption

| | |
|---|---|
| **Time** | 35 minutes |
| **Difficulty** | Uncomfortable, on purpose |
| **You need first** | [L3.1](../L3.1-configmaps/) finished |
| **You will create** | 2 Secrets |
| **Check you are done** | `make validate-lab LAB=L3.2` |

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

You will move the database password and the JWT signing key out of the Deployments and into **Secrets**.

Then you will decode one in a single command, and spend the rest of the lab working out what a Secret actually protects you against — because it is much less than the name implies, and believing otherwise is how credentials leak.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl get cm -n axispay-core` | The ConfigMaps from L3.1 |

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | The Secrets, and the Deployments that consume them |

---

## Step 1 — See the current exposure

```bash
kubectl get deploy auth-service -n axispay-edge -o yaml | grep -A3 'JWT_SIGNING_KEY'
```

The signing key is sitting in a Deployment, in plain text, readable by anyone who can read Deployments — which is a much larger group than the people who should hold a signing key.

---

## Step 2 — Apply the Secrets

```bash
cat manifests/01-secrets.yaml | head -20
kubectl apply -f manifests/
kubectl get secrets -n axispay-core -n axispay-edge 2>/dev/null || kubectl get secrets -A | grep axispay
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: axispay-db-credentials
type: Opaque                 # ① just bytes; there are typed kinds too
stringData:                  # ② you write plain text
  POSTGRES_PASSWORD: "..."
```

| | What it means |
|---|---|
| ① | `Opaque` means arbitrary data. Other types exist (`kubernetes.io/tls`, `kubernetes.io/dockerconfigjson`) and are validated differently. |
| ② | `stringData` lets you write plain text; Kubernetes base64-encodes it for you. `data` expects you to encode it yourself. **Neither encrypts anything.** |

---

## Step 3 — Decode it. This is the point of the lab.

```bash
kubectl get secret axispay-db-credentials -n axispay-data \
  -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d; echo
```

**There is the password.** One command, no privilege escalation, no cleverness.

**What that means.** Base64 is an **encoding**, not encryption. It exists so binary data can travel in JSON. It is trivially reversible and provides no protection whatsoever.

**So what does a Secret actually give you?**

| A Secret **does** | A Secret **does not** |
|---|---|
| Give RBAC something separate to control — you can grant `configmaps` without `secrets` | Encrypt anything, anywhere, by default |
| Get mounted as `tmpfs` — memory, not disk | Hide the value from anyone who can read Secrets |
| Get redacted in `kubectl describe` output | Stop `kubectl exec` reading it from the container |
| Support encryption at rest in etcd — **if the cluster operator enabled it** | Protect against a compromised node |

**The value is that it is a separate object RBAC can talk about.** That is real and worth having. It is not confidentiality.

---

## Step 4 — Consume as environment variables

```bash
grep -B2 -A6 'secretKeyRef' manifests/*deployment*.yaml | head -14
kubectl rollout status deployment/payment-service -n axispay-core --timeout=120s
```

**Now see the first real weakness:**

```bash
POD=$(kubectl get pod -n axispay-core -l app.kubernetes.io/name=payment-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-core $POD -- printenv | grep -i database
```

**Anyone with `kubectl exec` on that pod reads the credential** — with no `secrets` permission at all. Remember this; it is the centre of Friday's RBAC lab.

---

## Step 5 — Mount as a volume, which is better

```bash
grep -B4 -A8 'jwt-signing' manifests/*auth*.yaml | head -18
AUTHPOD=$(kubectl get pod -n axispay-edge -l app.kubernetes.io/name=auth-service -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n axispay-edge $AUTHPOD -- ls -la /etc/axispay/secrets/
kubectl exec -n axispay-edge $AUTHPOD -- df -h /etc/axispay/secrets | tail -1
```

```
tmpfs   3.8G  4.0K  3.8G   1% /etc/axispay/secrets
```

**`tmpfs` — memory, never written to disk.** When the pod dies it is gone.

**Why a volume beats an environment variable:**

- Environment variables appear in `kubectl describe pod`, in crash dumps, and are inherited by every child process.
- A mounted file is read when needed and can be re-read after rotation without a restart.
- Anything that dumps the environment on error — many frameworks do — leaks an env var and not a file.

---

## Step 6 — Where the Secret actually lives

```bash
kubectl get secret axispay-db-credentials -n axispay-data -o yaml | head -12
```

Stored in etcd. **Base64, and by default not encrypted.** Anyone with an etcd backup has every Secret in your cluster.

**Check your own cluster:**

```bash
kubectl get pod -n kube-system -l component=kube-apiserver \
  -o jsonpath='{.items[0].spec.containers[0].command}' | tr ',' '\n' | grep -i encryption || \
  echo "no --encryption-provider-config: Secrets are NOT encrypted at rest here"
```

Most training clusters, and a surprising number of real ones, print the second line. Enabling encryption at rest is a cluster-operator decision made once — and worth asking about wherever you work.

---

## Step 7 — Rotate a key with no downtime

```bash
kubectl patch secret axispay-jwt-signing -n axispay-edge --type merge \
  -p "{\"stringData\":{\"JWT_SIGNING_KEY\":\"rotated-$(date +%s)-key\"}}"
kubectl exec -n axispay-edge $AUTHPOD -- cat /etc/axispay/secrets/JWT_SIGNING_KEY 2>/dev/null | head -c 20; echo
```

Mounted Secrets update in place, exactly like ConfigMaps — around 60 seconds, same mechanism.

**But rotation is harder than replacing a value.** A JWT signed with the old key must still validate until it expires, so a real rotation needs both keys accepted for an overlap period. Kubernetes gives you the delivery mechanism; the application has to provide the overlap. That gap is where most rotation projects actually fail.

---

## Did it work?

```bash
make validate-lab LAB=L3.2
```

---

## Clean up

Nothing — the platform uses these now.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `CreateContainerConfigError` | Secret or key missing | `kubectl describe pod <name>` names it |
| `illegal base64 data` | You used `data` with plain text | Use `stringData`, or encode it yourself |
| Mounted secret not updating | Under 60s, or `subPath` | Same rules as ConfigMaps |
| Secret visible in `describe` | Env var names show; **values are redacted** | Check what you are actually seeing |
| App still uses the old key | It read the file once at startup | The app must re-read, or you roll the workload |

---

## Try this yourself

Answers in [`solutions.md`](../../../topics/03-storage-and-configuration/solutions.md).

**1.** List **every** way the database password could be read by someone who should not have it, given your cluster as it is. Propose a control for each. Aim for at least six.

**2.** `axispay-db-credentials` exists in **both** `axispay-data` and `axispay-core`, with the same password. Explain why the duplication is necessary, what problem it creates at rotation time, and how an external secret manager removes it.

**3.** Without changing any RBAC — that is Friday — describe exactly which Kubernetes permission a person needs to read the JWT signing key now, versus what they needed on Day 1.

---

## What you built

- **Credentials moved out of workload definitions** into objects RBAC can govern separately
- **A Secret decoded in one command** — the uncomfortable, necessary demonstration
- **Volume mounts on `tmpfs`**, and why they beat environment variables
- **A check on whether your own cluster encrypts etcd** — and the likely answer
- **A rotation performed**, and an honest account of why real rotation is harder

**Next:** [L3.3 — Persistent volumes](../L3.3-persistent-volumes/) — because everything you have stored so far dies with the pod.
