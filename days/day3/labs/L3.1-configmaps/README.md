# L3.1 · ConfigMaps

This lab is about moving settings out of your app definition and into a ConfigMap.

In simple words: if you want to change a setting later, you should not have to edit the deployment each time.

### What this concept means
A ConfigMap is a simple place to keep settings outside the deployment manifest. It is useful when the same values are needed by more than one workload, or when a setting should be changed without rebuilding the application image. Think of it as a safe, separate container for configuration data.

The important point is that ConfigMaps are not code. They are a way to keep runtime values such as feature flags, endpoint URLs, and logging levels outside the application package. This improves flexibility and makes it easier to keep environments consistent.

```mermaid
flowchart LR
  App[Application] --> ConfigMap[ConfigMap]
  ConfigMap --> App
```


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

Expected result:
- The command finishes without errors.
- You should see messages such as `created` or `configured` for the resources.
- A follow-up `kubectl get` command should show the objects you created.
This creates the ConfigMaps in the cluster.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get configmap -n axispay-core
```

Expected result:
- The output lists the resource names or details you expected to inspect.
- You should be able to see the object or the status you are checking.
This shows that the ConfigMaps now exist.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl rollout status deployment/payment-service -n axispay-core
```

Expected result:
- The rollout finishes successfully.
- You should see a message indicating the deployment rolled out cleanly.
This checks that the app picked up the new config correctly.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl patch configmap axispay-platform-config -n axispay-core --type merge -p '{"data":{"DEFAULT_CURRENCY":"USD"}}'
```

Expected result:
- The patch command succeeds.
- The value is updated in the object you changed.
This is the important experiment. You are changing the ConfigMap after the app is already running.

Why this matters:
- values passed in as environment variables are copied once when the container starts
- values mounted as files can be updated later

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L3.1
```

Expected result:
- The validation command finishes successfully.
- You should see a passing message for the lab.
