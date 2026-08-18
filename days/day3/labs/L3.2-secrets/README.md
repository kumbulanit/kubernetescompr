# L3.2 · Secrets

This lab is about moving passwords and keys out of the deployment and into a Secret.

In simple words: do not put important secrets directly into your YAML if you can avoid it.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open `manifests/01-secrets.yaml`.
2. Notice that the file contains database and JWT values.
3. Think about who should be allowed to read them.

Why this matters:
- secrets are sensitive
- you want them in a separate object
- you want to control who can read them

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```
This creates the Secrets in the cluster.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get secret -n axispay-data
kubectl get secret -n axispay-edge
```
This shows that the Secrets now exist.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get secret axispay-db-credentials -n axispay-data -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
```
This shows the stored value. It is a good reminder that base64 is not encryption.

Why this matters:
- base64 only encodes data
- it does not protect the value on its own
- RBAC and careful use still matter a lot

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L3.2
```
