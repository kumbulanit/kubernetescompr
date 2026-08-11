# L5.2 · Least Privilege You Can Prove

| | |
|---|---|
| **Time** | 50 minutes |
| **Difficulty** | Easy to write, hard to prove — the proving is the lab |
| **You need first** | [L5.1](../L5.1-identity-and-pod-security/) finished |
| **You will create** | 4 roles, 7 bindings |
| **Check you are done** | `make validate-lab LAB=L5.2` |

---

<details>
<summary><b>First time in a terminal? Open this.</b></summary>

- Copy/paste in the Ubuntu terminal: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> — **with Shift**.
- <kbd>Ctrl</kbd>+<kbd>C</kbd> stops whatever is running. <kbd>↑</kbd> repeats the last command. <kbd>Tab</kbd> completes filenames.
- Every command assumes you are in `~/kubernetes`. Check with `pwd`; fix with `cd ~/kubernetes`.
- Full version: [`labs/GETTING-STARTED.md`](../../../GETTING-STARTED.md).
</details>

---

## What you are going to do

An external auditor needs read access to the AxisPay namespaces for six weeks. Two requirements that look contradictory:

1. They must read **everything** — "we could not see it" invalidates an audit.
2. They must **never** read a Secret. Those hold the database password and the JWT signing key.

You will build that, prove every grant and every denial with `kubectl auth can-i`, and then find the hole that most access reviews miss entirely.

---

## What you need before you start

| # | Run this | You should see |
|---|---|---|
| 1 | `cd ~/kubernetes && pwd` | `/home/<your-name>/kubernetes` |
| 2 | `kubectl auth can-i --list -n axispay-core \| head -3` | A list, not an error |

> **`--as` needs impersonation rights.** On Minikube you are cluster-admin, so it works. On a locked-down cluster it will not — which is itself a control worth knowing about.

---

## What is in this folder

| File | What it is |
|---|---|
| `README.md` | This lab. |
| `manifests/` | The roles and bindings |

---

## Four rules that decide every RBAC question

```
  1. PURELY ADDITIVE       There is no deny rule. A permission is absent,
                           never revoked. This is how requirement 2 is met.

  2. THE UNION WINS        Two bindings granting different things grant both.

  3. ClusterRole + RoleBinding is the useful pair.
                           The ClusterRole says WHAT; the RoleBinding says WHERE.

  4. SUBRESOURCES ARE SEPARATE
                           pods, pods/log and pods/exec are three grants.
```

---

## Step 1 — Find the word that is not in the file

```bash
grep -c 'secrets' manifests/02-roles.yaml
```

```
0
```

**That absence is the control.** There is no deny rule anywhere in Kubernetes RBAC — the security property comes entirely from a resource never being named.

---

## Step 2 — Apply

```bash
kubectl apply -f manifests/
kubectl get clusterrole | grep axispay
kubectl get role,rolebinding -n axispay-core
```

Notice the auditor is a **ClusterRole** bound by three **RoleBindings**, one per namespace. One permission set, bound three times — so the three cannot drift apart.

---

## Step 3 — Prove the auditor can do the job

```bash
A="--as=auditor@axis.example"
kubectl auth can-i list pods            -n axispay-core $A
kubectl auth can-i get  deployments     -n axispay-core $A
kubectl auth can-i list events          -n axispay-core $A
kubectl auth can-i get  pods/log        -n axispay-core $A
kubectl auth can-i list networkpolicies -n axispay-core $A
kubectl auth can-i list rolebindings    -n axispay-core $A
```

Six `yes`. The last one matters: an auditor who cannot audit your RBAC cannot audit your RBAC.

---

## Step 4 — Prove the restriction

```bash
A="--as=auditor@axis.example"
kubectl auth can-i get    secrets -n axispay-core $A
kubectl auth can-i list   secrets -n axispay-data $A
kubectl auth can-i get    secrets -n kube-system  $A
kubectl auth can-i create pods    -n axispay-core $A
kubectl auth can-i delete pods    -n axispay-core $A
kubectl auth can-i create pods/exec -n axispay-core $A
```

**Six `no`. Print that block — it is the compliance evidence.**

```bash
kubectl get secrets -n axispay-core $A
```

```
Error from server (Forbidden): secrets is forbidden: User "auditor@axis.example"
cannot list resource "secrets" in API group "" in the namespace "axispay-core"
```

**Why `kubectl auth can-i` is credible evidence:** it issues a SubjectAccessReview to the API server — the same authorisation path a real request takes, with the same rules and the same cache. It is not a simulation of your policy; it **is** your policy.

---

## Step 5 — The hole most access reviews miss

That last `no` — `create pods/exec` — matters more than it looks.

**Every Secret a workload consumes is present inside the container.**

```bash
kubectl exec -n axispay-edge deploy/auth-service -- printenv JWT_SIGNING_KEY
```

**You just read the signing key with no `secrets` permission at all.**

**The paths to a Secret**, in the order they are missed:

| Grant | How it works |
|---|---|
| `get`/`list` on `secrets` | The obvious one |
| `create` on **`pods/exec`** | Exec in and read the environment |
| `create` on **`pods`** | Mount any Secret into a pod you create |
| `create` on `pods/portforward` | Reach a service that exposes it |
| `escalate` / `bind` on roles | Grant yourself the first one |
| `impersonate` | Become someone who has it |

**An RBAC review that checks the `secrets` resource and stops there has audited a resource, not a path.** A useful reformulation: treat any grant that yields code execution in a namespace as equivalent to reading every Secret used there.

---

## Step 6 — The deployer, scoped and without `delete`

```bash
D="--as-group=axispay-platform-team --as=engineer@axis.example"
kubectl auth can-i update deployments       -n axispay-core $D
kubectl auth can-i patch  deployments/scale -n axispay-core $D
kubectl auth can-i delete deployments       -n axispay-core $D
kubectl auth can-i delete pods              -n axispay-core $D
kubectl auth can-i update deployments       -n axispay-data $D
kubectl auth can-i update deployments       -n kube-system  $D
```

**Two decisions worth defending:**

- **No `delete` on Deployments, but `delete` on Pods.** Deleting a pod is routine — it comes back. Deleting a Deployment removes the workload and its rollout history, and should be a separately authorised act.
- **Namespace-scoped.** It is a RoleBinding in `axispay-core`. Make it a ClusterRoleBinding and the same person can redeploy `kube-system`.

---

## Step 7 — The role that admits what it grants

```bash
O="--as-group=axispay-oncall --as=oncall@axis.example"
kubectl auth can-i create pods/exec     -n axispay-core $O
kubectl auth can-i create pods/eviction -n axispay-core $O
kubectl auth can-i get    secrets       -n axispay-core $O

kubectl get role axispay-oncall -n axispay-core -o jsonpath='{.metadata.annotations}' | jq .
```

The annotation says, in effect: *this role grants `pods/exec`, which is equivalent to reading every Secret in the namespace; that is accepted because you cannot debug a production incident without a shell, and it is why on-call access is time-boxed and logged rather than permanent.*

**That annotation is the deliverable.** A role that quietly grants more than it appears to is a finding. A role that says so, and explains the trade, is a decision.

---

## Step 8 — Audit the whole thing

```bash
kubectl auth can-i --list -n axispay-core --as=auditor@axis.example

kubectl get clusterrole -o json | jq -r '
  .items[] | select(.rules[]? | select(
    (.resources[]? == "secrets" or .resources[]? == "*") and
    (.verbs[]? == "get" or .verbs[]? == "list" or .verbs[]? == "*")))
  | .metadata.name' | sort | head -20

python3 scripts/validate/simulate-rbac.py
```

28 assertions, offline, no cluster required — which means this can run in CI on every change.

---

## Did it work?

```bash
make validate-lab LAB=L5.2
```

---

## Clean up

Nothing — the capstone assumes these roles.

---

## If something went wrong

| What you saw | What it means | What to do |
|---|---|---|
| `can-i` says yes to everything | You forgot `--as` | You are cluster-admin |
| `cannot impersonate` | No impersonation rights | Expected on a real cluster |
| Auditor cannot read one namespace | A RoleBinding is missing there | There are three — `kubectl get rolebinding -A \| grep auditor` |
| A grant appears from nowhere | Another binding grants it | RBAC is a union. `kubectl auth can-i --list` shows the total |
| `pods/log` denied, `pods` allowed | Subresources are separate | Grant `pods/log` explicitly |

---

## Try this yourself

Answers in [`solutions.md`](../../solutions.md).

**1.** The auditor's access must expire in six weeks. RBAC has no expiry field. Design the mechanism you would actually use, and say what breaks if someone forgets.

**2.** Write RBAC for a CI pipeline that may deploy **only** `payment-service` in `axispay-core`. Then explain why `resourceNames` makes this partly possible and why `list` and `watch` cannot be restricted that way.

---

## What you built

- **Four roles and seven bindings**, each with printable proof
- **Six denials** that constitute the access-review evidence
- **The signing key read with no `secrets` grant**, and the list of paths that make it possible
- **A role that documents what it over-grants**, rather than hiding it
- **28 assertions runnable in CI**

**Next:** [L5.3 — Helm](../L5.3-helm-packaging/) — replace 107 files with one command.
