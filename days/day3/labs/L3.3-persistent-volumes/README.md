# L3.3 · Persistent volumes

This lab is about keeping data even after a pod is deleted or restarted.

In simple words: a container file system is temporary. If you want data to survive, you need a persistent volume.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open `manifests/01-storageclass.yaml`.
2. Open `manifests/02-pv-ledger-archive.yaml`.
3. Notice that the storage objects are separate from the app pod.

Why this matters:
- pods can disappear
- your data should not disappear with them
- storage needs a stable home

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```
This creates the storage objects.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get storageclass
kubectl get pv
kubectl get pvc -A
```
This shows the storage class, the volume, and the claim.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Think about how a pod would mount that volume and write files into it.

Why this matters:
- the volume is not the app
- the volume is the place where the app data lives
- the app can be replaced, but the data can stay

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L3.3
```
