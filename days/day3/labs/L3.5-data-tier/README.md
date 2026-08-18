# L3.5 · Data tier

This lab is about creating the services that the platform needs to store and move data.

In simple words: your app usually needs a database, a cache, and a message broker.

Do this first:
What you should expect to see: you understand the goal of the lab and the files involved.

1. Open the files in `manifests/`.
2. Look for the files for PostgreSQL, Redis, RabbitMQ, config, and secrets.
3. Notice that these are separate services with separate jobs.

Why this matters:
- the app depends on these services
- they need their own config and storage
- they should be started in a controlled way

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl apply -f manifests/
```
This creates the data-tier resources in the cluster.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

```bash
kubectl get pods -n axispay-data
kubectl get svc -n axispay-data
```
This shows whether the data services are starting up and becoming ready.

Then do this:
What you should expect to see: the command runs without errors and the result matches the explanation above.

Think about the role of each service:
- PostgreSQL stores structured data
- Redis helps with fast cache access
- RabbitMQ moves messages between services

Why this matters:
- the app is not just one process
- it depends on supporting services behind the scenes

Check your work:
What you should expect to see: the validation command finishes successfully.
```bash
make validate-lab LAB=L3.5
```
