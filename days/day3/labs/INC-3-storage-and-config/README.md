# INC-3 · Storage and configuration

This lab is an incident exercise. You are fixing a problem that is not just one thing.

In simple words: sometimes the real issue is a mix of config, storage, and secrets.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open the manifest files in this folder.
2. Read the names of the objects they create.
3. Think about what kind of problem you are trying to solve.

Why this matters:
- real problems are often layered
- a storage problem can look like a startup problem
- a config issue can look like a secret issue

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get pods -A
```
This helps you find the workload that is failing.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl describe pod -n axispay-data <pod-name>
```
This gives the first useful clues about the problem.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get configmap -A
kubectl get pvc -A
kubectl get secret -A
```
This checks whether the expected config, storage, or secret is present.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Apply the smallest fix that restores the workload.

Why this matters:
- the first fix should be small and targeted
- you do not want to change many things at once

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=INC-3
```
