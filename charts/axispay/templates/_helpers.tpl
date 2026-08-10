{{/*
================================================================================
AxisPay chart helpers
================================================================================
Named templates exist for one reason: to make a rule true in every rendered
object without relying on anyone remembering it. If a label selector is built
in fifteen places it will be wrong in at least one of them.
================================================================================
*/}}

{{/* Chart name, overridable, truncated to the 63-char label limit. */}}
{{- define "axispay.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Fully-qualified release name. */}}
{{- define "axispay.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "axispay.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/*
Common labels — attached to every object.
app.kubernetes.io/* are the standard set; tooling (kubectl, Lens, Prometheus
operator, ArgoCD) reads them. axispay.io/* are ours.
*/}}
{{- define "axispay.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/part-of: axispay
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
axispay.io/environment: {{ .Values.global.environment }}
{{- end -}}

{{/*
Selector labels — the SMALL, IMMUTABLE set.
A Deployment's .spec.selector cannot be changed after creation. Putting the
chart version or app version in here would make every `helm upgrade` that
bumps a version fail with "field is immutable". This is the single most
common Helm chart defect. Keep this template to identity only.
*/}}
{{- define "axispay.selectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end -}}

{{/* Full image reference, honouring an optional private registry. */}}
{{- define "axispay.image" -}}
{{- $g := .root.Values.global.image -}}
{{- $tag := .tag | default $g.tag -}}
{{- if $g.registry -}}
{{ printf "%s/%s/%s:%s" $g.registry $g.repository .name $tag }}
{{- else -}}
{{ printf "%s/%s:%s" $g.repository .name $tag }}
{{- end -}}
{{- end -}}

{{/* Namespace for a trust zone, with a clear failure if the zone is unknown. */}}
{{- define "axispay.namespace" -}}
{{- $ns := index .root.Values.namespaces .zone -}}
{{- if not $ns -}}
{{- fail (printf "unknown trust zone %q for %q — valid zones: edge core async data ops observability" .zone .name) -}}
{{- end -}}
{{- $ns -}}
{{- end -}}

{{/* Pod-level security context — identical for every workload. */}}
{{- define "axispay.podSecurityContext" -}}
{{- toYaml .Values.securityContext.pod -}}
{{- end -}}

{{/* Container-level security context. */}}
{{- define "axispay.containerSecurityContext" -}}
{{- toYaml .Values.securityContext.container -}}
{{- end -}}

{{/*
The three probes.
Liveness points at /healthz and never at /readyz. A readiness endpoint that
checks a dependency, wired to liveness, converts one slow database into a
cluster-wide restart storm.
*/}}
{{- define "axispay.probes" -}}
{{- $p := .Values.probes }}
startupProbe:
  httpGet:
    path: {{ $p.startup.path }}
    port: http
  periodSeconds: {{ $p.startup.periodSeconds }}
  failureThreshold: {{ $p.startup.failureThreshold }}
livenessProbe:
  httpGet:
    path: {{ $p.liveness.path }}
    port: http
  periodSeconds: {{ $p.liveness.periodSeconds }}
  timeoutSeconds: {{ $p.liveness.timeoutSeconds }}
  failureThreshold: {{ $p.liveness.failureThreshold }}
readinessProbe:
  httpGet:
    path: {{ $p.readiness.path }}
    port: http
  periodSeconds: {{ $p.readiness.periodSeconds }}
  timeoutSeconds: {{ $p.readiness.timeoutSeconds }}
  failureThreshold: {{ $p.readiness.failureThreshold }}
{{- end -}}

{{/* Writable scratch space, because the root filesystem is read-only. */}}
{{- define "axispay.tmpVolumeMounts" -}}
- name: tmp
  mountPath: /tmp
{{- end -}}

{{- define "axispay.tmpVolumes" -}}
- name: tmp
  emptyDir:
    sizeLimit: 64Mi
{{- end -}}

{{/* Environment shared by every AxisPay container. */}}
{{- define "axispay.commonEnv" -}}
- name: SERVICE_NAME
  value: {{ .name }}
- name: LOG_LEVEL
  value: {{ .root.Values.global.logLevel | quote }}
- name: ENVIRONMENT
  value: {{ .root.Values.global.environment | quote }}
- name: DEFAULT_CURRENCY
  value: {{ .root.Values.global.defaultCurrency | quote }}
- name: SUPPORTED_CURRENCIES
  value: {{ .root.Values.global.supportedCurrencies | quote }}
- name: DOWNSTREAM_TIMEOUT_SECONDS
  value: {{ .root.Values.global.downstreamTimeoutSeconds | quote }}
- name: POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
- name: NODE_NAME
  valueFrom:
    fieldRef:
      fieldPath: spec.nodeName
{{- end -}}
