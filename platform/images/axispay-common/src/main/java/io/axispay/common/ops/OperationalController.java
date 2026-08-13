package io.axispay.common.ops;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.axispay.common.config.Settings;
import io.axispay.common.readiness.ReadinessRegistry;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;

/**
 * The identical operational surface every AxisPay service exposes:
 *
 * <pre>
 *   /healthz    liveness   — never checks dependencies
 *   /readyz     readiness  — checks dependencies
 *   /startupz   startup    — has initialisation finished?
 *   /metrics    Prometheus exposition
 *   /api/v1/_info          — which pod answered this request?
 *   /api/v1/_admin/unready — lab control: force this pod out of Endpoints
 * </pre>
 *
 * <p>The paths are deliberately NOT the Actuator defaults ({@code /actuator/*}):
 * the Kubernetes manifests, probes, Day-5 dashboards and PromQL all target these
 * exact paths, so they are kept stable across the Python-to-Java migration.
 */
@RestController
public class OperationalController {

    private final Settings settings;
    private final ReadinessRegistry readiness;
    private final PrometheusMeterRegistry prometheus;

    public OperationalController(Settings settings, ReadinessRegistry readiness,
                                 PrometheusMeterRegistry prometheus) {
        this.settings = settings;
        this.readiness = readiness;
        this.prometheus = prometheus;
    }

    @GetMapping("/healthz")
    public Map<String, Object> healthz() {
        return Map.of("status", "alive", "service", settings.serviceName());
    }

    @GetMapping("/readyz")
    public ResponseEntity<Map<String, Object>> readyz() {
        ReadinessRegistry.ReadyResult result = readiness.ready();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", result.ok() ? "ready" : "not_ready");
        body.put("service", settings.serviceName());
        body.put("checks", result.detail());
        return ResponseEntity.status(result.ok() ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    @GetMapping("/startupz")
    public ResponseEntity<Map<String, Object>> startupz() {
        boolean started = readiness.startup();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", started ? "started" : "starting");
        body.put("service", settings.serviceName());
        return ResponseEntity.status(started ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    @GetMapping(value = "/metrics", produces = "text/plain; version=0.0.4; charset=utf-8")
    public String metrics() {
        return prometheus.scrape();
    }

    @GetMapping(value = "/api/v1/_info", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> info() {
        // THE most useful endpoint in the course. It is how students prove load
        // balancing (D1 L1.5), rollout progress (D2 L2.6) and anti-affinity
        // spread (D4 L4.6) — with nothing but curl.
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("service", settings.serviceName());
        body.put("version", settings.serviceVersion());
        body.put("environment", settings.environment());
        body.put("pod_name", settings.podName());
        body.put("pod_ip", settings.podIp());
        body.put("node_name", settings.nodeName());
        body.put("namespace", settings.namespace());
        body.put("uptime_seconds", Math.round(readiness.uptimeSeconds() * 10.0) / 10.0);
        return body;
    }

    @PostMapping("/api/v1/_admin/unready")
    public Map<String, Object> setUnready(@RequestParam(name = "value", defaultValue = "true") boolean value) {
        readiness.forceUnready(value);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("forced_unready", value);
        body.put("pod", settings.podName());
        return body;
    }
}
