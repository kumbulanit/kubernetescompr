# L5.2 · RBAC

This lab is about giving users only the access they need.

In simple words: do not give broad access just because it is easy.

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
This creates the RBAC objects.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl auth can-i get pods -n axispay-core --as=auditor@axis.example
kubectl auth can-i get secrets -n axispay-core --as=auditor@axis.example
```
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
