# L3.3 · Persistent volumes

This lab is about keeping data even after a pod is deleted or restarted.

In simple words: a container file system is temporary. If you want data to survive, you need a persistent volume.

### What this concept means
A persistent volume is storage that lives outside the container filesystem. Containers are temporary by design, but databases and other stateful applications need storage that survives restarts, rescheduling, or pod replacements.

The relationship is simple: a pod asks for storage through a PVC, and Kubernetes maps that request to a persistent volume that can satisfy it. In other words, the PVC is the request, and the PV is the actual piece of storage that backs it.

```mermaid
flowchart LR
  Pod[Pod] --> PVC[PersistentVolumeClaim]
  PVC --> PV[PersistentVolume]
  PV --> Disk[Storage Backend]
```


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

Expected result:
- The command finishes without errors.
- You should see messages such as `created` or `configured` for the resources.
- A follow-up `kubectl get` command should show the objects you created.
This creates the storage objects.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get storageclass
kubectl get pv
kubectl get pvc -A
```

Expected result:
- The output lists the resource names or details you expected to inspect.
- You should be able to see the object or the status you are checking.
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

Expected result:
- The validation command finishes successfully.
- You should see a passing message for the lab.
