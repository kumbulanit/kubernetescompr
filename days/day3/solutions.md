# Day 3 — Solutions

> Read the lab first. Use this to check yourself, or when genuinely stuck after ten minutes.

---

## L3.1 ConfigMaps

**C1 — No restart at all, end to end.** Mount the ConfigMap as a **volume** (not `envFrom`), and have the application watch the file:

```python
# the missing half — Kubernetes updates the file; only the app can re-read it
import os, threading, time
def watch(path, on_change):
    last = os.stat(path).st_mtime
    while True:
        time.sleep(5)
        now = os.stat(path).st_mtime
        if now != last:
            last = now; on_change(open(path).read())
```

**Propagation delay:** kubelet sync period (default 60s) + the file-system update + your poll interval. Budget **60–90 seconds**, and know that it is not instant. Kubernetes updates the *file*; nothing re-reads it for you. Most services that "support hot reload" implement exactly this.

**C2 — `subPath` never updates.** The file does **not** change. `subPath` resolves to a single file at mount time and is not part of the atomically-swapped symlink tree Kubernetes maintains for volume-mounted ConfigMaps. You would still choose it when you must place one file into a directory that already has other content — mounting the whole ConfigMap there would hide everything else. The trade is: you get placement, you lose updates. Say so in a comment next to every `subPath`.

**C3 — `immutable: true`.** Breaks: you can no longer edit it; you must create a new ConfigMap and update the reference. Improves: the kubelet stops watching it, which at 10,000 pods is a measurable reduction in API server load — a watch per pod per ConfigMap is not free. Kubernetes offers it because config-heavy clusters were spending real API server capacity watching objects nobody ever changed. Use it for config you version rather than edit.

**Bonus — the 1 MiB limit.** `envFrom` on a large ConfigMap produces one env var per key. The ConfigMap object itself is capped at **1 MiB** by etcd's value size limit, and the API server rejects anything larger. Separately, the total environment size is bounded by the kernel's `ARG_MAX` (usually ~2 MB). This is why seed data lives in a Job or object storage, never in a ConfigMap — and why `data/seed/02-seed.sql` at 8 MB is piped into psql instead.

---

## L3.2 Secrets

**C1 — Enumerate the leaks.** At least eight, each with a control:

| Leak | Control |
|---|---|
| etcd stores it base64, not encrypted | Encryption at rest (`EncryptionConfiguration`) |
| `kubectl get secret -o yaml` | RBAC — do not grant `get`/`list` on secrets |
| Env var visible in `kubectl describe pod` | Prefer volume mounts over `env` for secrets |
| A crash dump or stack trace containing the environment | Scrub in the logging formatter; never log `os.environ` |
| A child process inherits the environment | Volume mounts are not inherited the same way |
| `kubectl exec` into a pod that consumes it | RBAC on `pods/exec` — **the one people miss** |
| Node compromise reading the tmpfs mount | Node hardening; secrets are in memory, not on disk |
| The manifest committed to Git | Sealed Secrets, SOPS, or an external secret manager |

**C2 — Two namespaces, one credential.** Secrets are namespaced; a pod can only reference a Secret in its own namespace. So the same password exists twice. At rotation time you must update both **atomically enough** that no pod is left with the old value while the database has the new one — and there is no transaction across two namespaces. An external secret manager removes the duplication: both namespaces reference the same upstream secret, and the operator syncs it. Rotation becomes one write.

**C3 — What changed.** On Day 1, nothing protected the signing key: anyone who could reach the cluster could read it. Now they need `get` on `secrets` in `axispay-edge` — **or** `create` on `pods/exec` there, which is the same thing by a different route. That equivalence is the Day 5 lesson, previewed here.

---

## L3.3 PersistentVolumes

**C1 — 5Gi against a 2Gi PV.** `kubectl apply` **succeeds** — the object is valid. The failure is asynchronous:

```bash
kubectl describe pvc <name>
# Events:  ProvisioningFailed / no persistent volumes available for this claim
# and the PVC sits in Pending forever
```

This is the shape of most storage problems: the API accepts it, and the truth is in the events. It is also why "kubectl applied cleanly" is never evidence of anything.

**C2 — `ReadWriteOnce` and two pods.** RWO permits mounting by **one node**. Two pods on the *same* node can share it. Two pods on *different* nodes cannot. The mode that genuinely guarantees a single writer is **`ReadWriteOncePod`** (v1.27+), which is what you want for a database and what most people assume RWO already means.

**C3 — Deleting a PVC under `Retain`.** The PVC goes; the PV moves to `Released`, **not** `Available`, and the data is untouched on disk. It will not bind to a new claim while it holds a `claimRef` to the deleted PVC. To recover:

```bash
kubectl patch pv <pv> -p '{"spec":{"claimRef":null}}'   # clear the stale binding
kubectl get pv <pv>                                      # now Available
kubectl apply -f new-pvc.yaml                            # binds, data intact
```

`Retain` exists precisely so that a `kubectl delete pvc` typo is recoverable. `Delete` would have removed the volume.

---

## L3.4 StorageClass

**C1 — `Immediate` and a node affinity conflict.** The PV is provisioned on whichever node the provisioner chooses, immediately, before any pod exists. Schedule a pod with a `nodeSelector` for a different node and:

```
0/3 nodes are available: 1 node(s) had volume node affinity conflict
```

The sequence: volume bound to node A → pod required on node B → the scheduler cannot satisfy both → `Pending` forever. `WaitForFirstConsumer` exists to invert the order: schedule the pod first, then provision the volume where the pod landed.

**C2 — Expanding 512Mi to 1Gi.** Edit `spec.resources.requests.storage` on the **PVC** (not the PV), and only if the StorageClass has `allowVolumeExpansion: true`. During the resize `status.conditions` shows `FileSystemResizePending`, and on some drivers the pod must restart for the filesystem to grow. Shrinking is not supported by any driver.

**C3 — Where `Delete` is better.** Any volume whose contents are reproducible: a Prometheus TSDB with six hours of retention, a build cache, a scratch volume. `Retain` on those leaves orphaned PVs accumulating after every reinstall, and someone eventually deletes them by hand — which is a worse process than automating it. The rule: `Retain` for anything you would be sorry to lose; `Delete` for anything you would regenerate.

---

## L3.5 / L3.6 The data tier and StatefulSets

**C1 (L3.5) — Top three merchants by net settled value.**

```sql
SELECT m.trading_name,
       SUM(s.net_minor)/100.0                        AS net_settled_zar,
       COUNT(DISTINCT s.settlement_id)               AS batches,
       ROUND(100.0 * SUM(CASE WHEN p.status IN ('captured','authorized') THEN 1 ELSE 0 END)
                   / NULLIF(COUNT(p.payment_id), 0), 1) AS approval_rate_pct
  FROM settlements s
  JOIN merchants   m ON m.merchant_id = s.merchant_id
  LEFT JOIN payments p ON p.merchant_id = s.merchant_id
 WHERE s.currency = 'ZAR'
   AND s.batch_date >= CURRENT_DATE - INTERVAL '7 days'
 GROUP BY m.trading_name
 ORDER BY net_settled_zar DESC
 LIMIT 3;
```

**C2 / C1 (L3.6) — Three replicas, three empty databases.**

`volumeClaimTemplates` gives each pod its **own** PVC. `postgres-1` and `postgres-2` start with empty data directories and initialise fresh databases. A StatefulSet gives you stable identity and stable storage — it does **not** give you replication, leader election, failover, or connection routing. Nothing in Kubernetes knows what PostgreSQL replication is.

A real cluster needs: streaming replication configured between the instances, a leader election mechanism, automated failover, a connection router that follows the leader, and backup/PITR. That is an **Operator** — CloudNativePG, Zalando, Crunchy — and the reason everyone uses one is that the list above is a product, not a configuration.

**C2 (L3.6) — Deleting the StatefulSet.** The PVCs **survive**. Kubernetes chose that default because deleting a workload and deleting its data are different decisions with very different consequences, and it will not infer the second from the first. Recreate the StatefulSet and the pods re-bind to the same claims by name — `data-postgres-0` — with the data intact.

**C3 (L3.6) — An idempotent migration init container.** Ordered after `wait-for-postgres`, running `psql -f migrate.sql` where every statement is `IF NOT EXISTS` / `ON CONFLICT DO NOTHING`, wrapped in a transaction with `pg_advisory_xact_lock`. All three replicas run it; the lock serialises them and the idempotency makes runs two and three no-ops. The capstone migration in `capstone/manifests/` is the worked version of exactly this.

---

## L3.7 securityContext

**C1 — Every path AxisPay writes to.** With `readOnlyRootFilesystem: true`, mount an `emptyDir` at each, and justify each:

| Path | Why | Size |
|---|---|---|
| `/tmp` | Python writes temp files; httpx buffers large responses | 64Mi |
| `/home/axispay/.cache` | only if pip or a library caches at runtime — check before adding | 32Mi |

Find them empirically rather than guessing:

```bash
kubectl exec <pod> -- sh -c 'find / -xdev -newer /etc/hostname -type f 2>/dev/null | head -30'
```

The discipline: mount the **minimum**, and each mount gets a `sizeLimit` — an unbounded `emptyDir` is a node disk-pressure incident waiting to happen.

**C2 — `node-agent` reading host `/proc`.** Keep: `runAsNonRoot`, `allowPrivilegeEscalation: false`, `capabilities: drop: [ALL]`, `readOnlyRootFilesystem: true`. Relax: it needs a `hostPath` mount of `/proc` (read-only) and therefore cannot meet `restricted` — which is why `axispay-ops` enforces `baseline`. Note what you did **not** relax: it still runs as a non-root user, still drops every capability, and mounts `/proc` **read-only**. That is the shape of a defensible exception.

**C3 — Why `allowPrivilegeEscalation: false` matters when already non-root.** A setuid binary runs with the *file owner's* privileges rather than the caller's. Without this flag, a non-root process that executes a setuid-root binary present in the image becomes root. Setting it false sets the `no_new_privs` bit on the process, and the kernel then ignores setuid entirely for it and all its children. It is defence against something already in your image, which is precisely the case you cannot audit away.
