# L3.1 · ConfigMaps

This lab is about moving settings out of your app definition and into a ConfigMap.

In simple words: if you want to change a setting later, you should not have to edit the deployment each time.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open the file `manifests/01-configmap-platform.yaml`.
2. Read the names of the ConfigMaps and the keys inside them.
3. Ask yourself: what part of the app is configuration, and what part is code?

Why this matters:
- config changes are common
- you want one place to change them
- your deployment stays simpler

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```
This creates the ConfigMaps in the cluster.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get configmap -n axispay-core
```
This shows that the ConfigMaps now exist.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl rollout status deployment/payment-service -n axispay-core
```
This checks that the app picked up the new config correctly.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl patch configmap axispay-platform-config -n axispay-core --type merge -p '{"data":{"DEFAULT_CURRENCY":"USD"}}'
```
This is the important experiment. You are changing the ConfigMap after the app is already running.

Why this matters:
- values passed in as environment variables are copied once when the container starts
- values mounted as files can be updated later

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L3.1
```
