# L5.2 · RBAC

This lab is about giving users only the access they need.

In simple words: do not give broad access just because it is easy.

### What this concept means
RBAC is the mechanism that decides who can do what in the cluster. It is a way to prevent users or services from getting broad access just because it is convenient. In a real platform, RBAC is one of the main controls for reducing risk.

The key lesson is least privilege. The idea is not to give everyone all rights. It is to give the minimum set of rights required for the job, and to be able to prove that the access is limited.

```mermaid
flowchart LR
  User[User] --> Role[Role or ClusterRole]
  Role --> Binding[Binding]
  Binding --> Resource[Resource Access]
```


Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open `manifests/01-serviceaccounts.yaml`.
2. Open `manifests/02-roles.yaml`.
3. Open `manifests/03-bindings.yaml`.
4. Notice that the roles and bindings are separate from the workloads.

Why this matters:
- RBAC controls access in the cluster
- the goal is least privilege
- one user should not automatically get everything

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```

Expected result:
- The command finishes without errors.
- You should see messages such as `created` or `configured` for the resources.
- A follow-up `kubectl get` command should show the objects you created.
This creates the RBAC objects.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl auth can-i get pods -n axispay-core --as=auditor@axis.example
kubectl auth can-i get secrets -n axispay-core --as=auditor@axis.example
```

Expected result:
- The command prints `yes` or `no`.
- This shows whether the action is allowed for that user.
These commands show what is allowed and what is blocked.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Read the result carefully.

Why this matters:
- RBAC is not magic
- you should be able to prove what a user can and cannot do

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L5.2
```

Expected result:
- The validation command finishes successfully.
- You should see a passing message for the lab.
