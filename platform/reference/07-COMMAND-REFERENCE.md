# Command Reference

*Everything the course uses, in the order you would reach for it. Written to be printed and kept beside the keyboard.*

---

## 0. The five commands that answer most questions

```bash
kubectl get pods -n <ns>                  # is it Ready — not Running. READY.
kubectl describe pod <pod> -n <ns>        # events are at the bottom. Read them first.
kubectl logs <pod> -n <ns> --previous     # --previous is the one that matters after a crash
kubectl get endpointslices -n <ns>        # empty = the selector matches nothing
kubectl get events -n <ns> --sort-by=.lastTimestamp
```

> `--previous` reads the logs of the container that *died*. Without it, after a CrashLoopBackOff you are reading the logs of the container that has not started yet, which are empty — and that emptiness is why people conclude "there are no logs".

---

## 1. The course itself

```bash
make help                      # every target, with descriptions
make preflight                 # check the machine before anything else
make cluster                   # create the Minikube cluster (Calico, 3 nodes)
make build                     # build all 16 images into the cluster's runtime
make deploy-all                # Day 1 through Day 5
make seed                      # schema + 28,000 rows of fictional data
make observability             # Prometheus, Grafana, Loki, Alloy — RUN BEFORE DAY 5

make validate-day3             # is the Day 3 end state correct?
make validate-lab LAB=L4.4     # is this one lab correct?
make health                    # full platform health report

make incident N=2              # instructor: inject a fault
make resolve N=2               # instructor: escape hatch
```

### Offline — no cluster, no network

```bash
bash    platform/admin/validate/verify-course.sh      # everything below, plus an inventory
python3 platform/admin/validate/check-manifests.py    # manifest wiring
python3 platform/admin/validate/check-helm-chart.py   # 94 chart assertions
python3 platform/admin/validate/check-promql.py       # every PromQL expression parsed
python3 platform/admin/validate/check-diagrams.py     # every Mermaid source
python3 platform/admin/validate/simulate-netpol.py    # 46 policy assertions
python3 platform/admin/validate/simulate-rbac.py      # 28 RBAC assertions
```

---

## 2. Orientation

```bash
kubectl cluster-info
kubectl get nodes -o wide
kubectl api-resources | head -40                 # what this cluster can do
kubectl api-versions
kubectl explain deployment.spec.strategy         # the built-in documentation
kubectl explain pod.spec.containers.livenessProbe --recursive

kubectl config get-contexts
kubectl config use-context axispay
kubectl config set-context --current --namespace=axispay-core
```

---

## 3. Workloads

```bash
kubectl get deploy,rs,pods -n axispay-core
kubectl get pods -o wide                                    # which node?
kubectl get pods -w                                         # watch it change
kubectl get pods -l app.kubernetes.io/name=payment-service

kubectl rollout status deployment/payment-service -n axispay-core
kubectl rollout history deployment/payment-service -n axispay-core
kubectl rollout undo deployment/payment-service -n axispay-core
kubectl rollout restart deployment/payment-service -n axispay-core

kubectl scale deployment/payment-service --replicas=5 -n axispay-core
kubectl set image deployment/payment-service payment-service=axispay/payment-service:2.0.0 -n axispay-core
kubectl set env deployment/payment-service LOG_LEVEL=debug -n axispay-core
kubectl set env deployment/payment-service LOG_LEVEL-           # remove it
kubectl set serviceaccount deployment/payment-service payment-service -n axispay-core
```

### Getting inside

```bash
kubectl exec -it <pod> -n <ns> -- sh
kubectl exec <pod> -n <ns> -- printenv | sort
kubectl port-forward -n axispay-edge svc/edge-gateway 8080:8080
kubectl cp <ns>/<pod>:/app/file ./file
kubectl debug -it <pod> --image=busybox:1.37 --target=<container>    # no shell in the image
```

---

## 4. Resources, probes and scaling

```bash
kubectl top nodes
kubectl top pods -n axispay-core --sort-by=cpu

kubectl get pod <pod> -o jsonpath='{.spec.containers[0].resources}' | jq .
kubectl get pod <pod> -o jsonpath='{.status.qosClass}'

kubectl describe pod <pod> | grep -A5 'Last State'          # OOMKilled lives here
kubectl get pod <pod> -o jsonpath='{.status.containerStatuses[0].lastState}' | jq .

kubectl get hpa -n axispay-core
kubectl describe hpa payment-service -n axispay-core         # why it did what it did
kubectl get resourcequota,limitrange -n axispay-core
```

---

## 5. Configuration and storage

```bash
kubectl get cm,secret -n axispay-core
kubectl get secret axispay-db-credentials -n axispay-data -o jsonpath='{.data.DATABASE_URL}' | base64 -d
kubectl create secret generic my-secret --from-literal=KEY=value --dry-run=client -o yaml

kubectl get pv,pvc -A
kubectl describe pvc <pvc> -n <ns>                           # binding failures are here
kubectl get storageclass
kubectl get statefulset -n axispay-data
```

---

## 6. Networking

```bash
kubectl get svc -A
kubectl get endpointslices -n axispay-core                   # the label-typo detector
kubectl get ingress -A
kubectl describe ingress axispay-api -n axispay-edge

# DNS, from inside a pod
kubectl run dnstest --rm -it --image=busybox:1.37 --restart=Never -- \
  nslookup payment-service.axispay-core.svc.cluster.local
kubectl exec <pod> -- cat /etc/resolv.conf                   # look at ndots

# connectivity, from inside a pod
kubectl run nettest --rm -it --image=curlimages/curl:8.11.1 --restart=Never -- \
  curl -sv http://payment-service.axispay-core.svc.cluster.local:8080/healthz

kubectl get netpol -A
kubectl describe netpol default-deny-all -n axispay-core
```

### TLS

```bash
openssl s_client -connect $(minikube ip -p axispay):443 -servername api.axispay.local 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer

kubectl get secret axispay-tls -n axispay-edge -o jsonpath='{.data.tls\.crt}' \
  | base64 -d | openssl x509 -noout -dates
```

> Verify a TLS fix with `openssl s_client`, never with `curl -k`. `-k` disables precisely the check that was failing.

---

## 7. Identity, RBAC and Pod Security

```bash
kubectl get sa -A
kubectl get pods -A -o custom-columns='NS:.metadata.namespace,POD:.metadata.name,SA:.spec.serviceAccountName'
kubectl exec <pod> -n <ns> -- ls /var/run/secrets/kubernetes.io/serviceaccount/

kubectl auth can-i list pods   -n axispay-core --as=auditor@axis.example
kubectl auth can-i get secrets -n axispay-core --as=auditor@axis.example
kubectl auth can-i --list      -n axispay-core --as=auditor@axis.example
kubectl auth can-i list nodes  --as=system:serviceaccount:axispay-ops:node-agent
kubectl auth can-i create deployments -n axispay-core \
  --as=engineer@axis.example --as-group=axispay-platform-team

kubectl get role,rolebinding -n axispay-core
kubectl get clusterrolebinding -o custom-columns='NAME:.metadata.name,ROLE:.roleRef.name,SUBJECTS:.subjects[*].name'

kubectl get ns -L pod-security.kubernetes.io/enforce
kubectl label ns axispay-core pod-security.kubernetes.io/enforce=restricted --overwrite
```

---

## 8. Helm

```bash
helm template axispay ./charts/axispay                       # ALWAYS before installing
helm template axispay ./charts/axispay | grep '^kind:' | sort | uniq -c
helm lint ./charts/axispay -f charts/axispay/values-prod.yaml

helm upgrade --install axispay ./charts/axispay --atomic --timeout 10m
helm upgrade axispay ./charts/axispay --set global.image.tag=2.0.0 --atomic
helm history axispay
helm rollback axispay 3 --wait
helm get values axispay
helm get manifest axispay
helm diff upgrade axispay ./charts/axispay -f charts/axispay/values.yaml

kubectl get secret -n default -l owner=helm                  # what a release actually is
```

---

## 9. Observability

```bash
kubectl -n axispay-observability port-forward svc/kube-prometheus-stack-grafana 3000:80
kubectl -n axispay-observability port-forward svc/kube-prometheus-stack-prometheus 9090
kubectl -n axispay-observability port-forward svc/kube-prometheus-stack-alertmanager 9093
kubectl -n axispay-observability port-forward svc/alert-sink 8080:8080

kubectl get servicemonitor,prometheusrule,alertmanagerconfig -A
kubectl get configmap -n axispay-observability -l grafana_dashboard=1

curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.job) \(.health)"'
curl -s localhost:9090/api/v1/alerts  | jq -r '.data.alerts[] | "\(.labels.alertname) \(.state)"'
curl -s localhost:8080/api/v1/routes  | jq .
```

### PromQL

```promql
sum by (service) (rate(axispay_http_requests_total[5m]))

sum(rate(axispay_http_requests_total{status=~"5.."}[5m]))
  / sum(rate(axispay_http_requests_total[5m]))

histogram_quantile(0.99, sum by (le) (
  rate(axispay_http_request_duration_seconds_bucket{service="payment-service"}[5m])))

sum by (status) (rate(axispay_payments_total[5m]))

sum(rate(axispay_payments_total[10m])) == 0                  # the silence alert

increase(kube_pod_container_status_restarts_total{namespace=~"axispay-.*"}[15m]) > 3
kube_endpoint_address_available{namespace=~"axispay-.*"} == 0
```

### LogQL

```logql
{namespace="axispay-core"}
{namespace=~"axispay-.*"} | json | level="error"
{namespace=~"axispay-.*"} | json | correlation_id="<id>"
{namespace=~"axispay-.*"} | json | duration_ms > 500
sum by (service) (rate({namespace="axispay-core"} |= "error" [5m]))
```

---

## 10. Nodes and upgrades

```bash
kubectl get nodes -o custom-columns='NODE:.metadata.name,KUBELET:.status.nodeInfo.kubeletVersion'
kubectl describe node <node> | grep -A10 'Allocated resources'
kubectl cordon <node>
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
kubectl uncordon <node>

kubectl get --raw /metrics | grep apiserver_requested_deprecated_apis   # what breaks next upgrade

# on a real cluster, control plane FIRST
kubeadm upgrade plan
kubeadm upgrade apply v1.36.2
```

---

## 11. The triage loop

Six steps, in order. Do not skip to the logs.

```bash
# 1. Is it READY — not Running?
kubectl get pods -n <ns>

# 2. What do the events say? (bottom of describe)
kubectl describe pod <pod> -n <ns>

# 3. What do the logs say — including the container that DIED?
kubectl logs <pod> -n <ns> --previous
kubectl logs -n <ns> -l app.kubernetes.io/name=<svc> --tail=50

# 4. Is the config what you think it is?
kubectl exec <pod> -n <ns> -- printenv | sort
kubectl get cm,secret -n <ns>

# 5. Can it reach its dependencies?
kubectl get endpointslices -n <ns>
kubectl exec <pod> -n <ns> -- nslookup <service>.<ns>.svc.cluster.local

# 6. What CHANGED?
kubectl rollout history deployment/<name> -n <ns>
kubectl get events -A --sort-by=.lastTimestamp | tail -30
helm history axispay
```

---

## 12. Symptom → first command

| Symptom | Most likely | First command |
|---|---|---|
| `Pending` | Insufficient resources, unbound PVC, or a taint | `kubectl describe pod <pod>` — read the events |
| `ImagePullBackOff` | Tag does not exist in the runtime | `kubectl describe pod`; on Minikube, `minikube image ls` |
| `CrashLoopBackOff` | The process exits | `kubectl logs <pod> --previous` |
| Exit code **137** | OOMKilled — memory limit | `kubectl describe pod \| grep -A5 'Last State'` |
| `Running` but `0/1` | Readiness probe failing | `kubectl describe pod` — probe section |
| Connection refused between services | No ready endpoints | `kubectl get endpointslices -n <ns>` |
| Name resolution failure | CoreDNS, or a policy blocking port 53 | `kubectl exec -- nslookup ...` |
| Ingress **404** | Path or `pathType` | `kubectl describe ingress` |
| Ingress **502** | Backend unreachable, or wrong port | `kubectl get endpointslices` |
| Ingress **503** | No ready endpoints behind the Service | `kubectl get pods` — readiness |
| TLS handshake fails, cluster green | Certificate expiry | `openssl s_client ... \| openssl x509 -noout -dates` |
| Everything green, no traffic | Upstream of the cluster | `sum(rate(axispay_payments_total[10m]))` |
| Prometheus target **missing** | ServiceMonitor not selected | Check the `release` label |
| Prometheus target **down** | Port name, readiness, or a policy | `kubectl describe svc`; check the port NAME |
| `helm upgrade` — `field is immutable` | A selector label changed | `kubectl get deploy <x> -o jsonpath='{.spec.selector}'` |
| Drain hangs | A PodDisruptionBudget, doing its job | `kubectl get pdb -A` — **do not** `--force` |

---

## 13. Output formatting worth knowing

```bash
-o wide                                       # more columns
-o yaml / -o json
-o jsonpath='{.status.podIP}'
-o custom-columns='NAME:.metadata.name,NODE:.spec.nodeName'
--sort-by=.metadata.creationTimestamp
--show-labels
-l 'app.kubernetes.io/part-of=axispay,app.kubernetes.io/name!=loadgen'
--field-selector=status.phase=Running
kubectl get all -n <ns>                       # NOT everything — no secrets, no PVCs, no netpol
```

> `kubectl get all` is misnamed and reliably misleads. It returns a fixed short list of kinds. When you need everything in a namespace, name the kinds you care about.
