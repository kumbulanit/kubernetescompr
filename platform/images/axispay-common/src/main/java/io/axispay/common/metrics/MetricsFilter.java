package io.axispay.common.metrics;

import java.io.IOException;
import java.time.Duration;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

import net.logstash.logback.argument.StructuredArguments;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Records the golden signals AND emits one structured access log per request.
 *
 * <p>The access log is not decoration. On Day 5 students take a latency spike in
 * Grafana and pull back every log line for that one payment across all seven
 * services it touched. That only works if EVERY service logs every request with
 * the correlation ID — including services like merchant-service that have no
 * business-event log of their own.
 *
 * <p>Probe endpoints are excluded. The kubelet hits /healthz and /readyz every
 * few seconds per pod; logging those would bury real traffic and, on Day 5,
 * would be the single largest contributor to Loki storage.
 *
 * <p>The route TEMPLATE is used as the metric label, not the raw path —
 * otherwise every payment ID becomes its own label value and Prometheus
 * cardinality explodes. This is a real production failure mode, called out in
 * the Day 5 slides as a "common mistake".
 */
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class MetricsFilter extends OncePerRequestFilter {

    private static final Set<String> SILENT_PATHS =
            Set.of("/healthz", "/readyz", "/startupz", "/metrics");

    private final AxisPayMetrics metrics;
    private final Logger accessLog;

    public MetricsFilter(AxisPayMetrics metrics) {
        this.metrics = metrics;
        this.accessLog = LoggerFactory.getLogger(metrics.service() + ".access");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI();
        metrics.incInFlight();
        long started = System.nanoTime();
        String status = "500";
        try {
            chain.doFilter(request, response);
            status = String.valueOf(response.getStatus());
        } finally {
            Duration elapsed = Duration.ofNanos(System.nanoTime() - started);
            String route = routeTemplate(request, path);
            metrics.recordRequest(request.getMethod(), route, status, elapsed);
            metrics.decInFlight();

            if (!SILENT_PATHS.contains(path)) {
                double durationMs = elapsed.toNanos() / 1_000_000.0;
                accessLog.info("request",
                        StructuredArguments.kv("method", request.getMethod()),
                        StructuredArguments.kv("path", path),
                        StructuredArguments.kv("route", route),
                        StructuredArguments.kv("status", Integer.parseInt(status)),
                        StructuredArguments.kv("duration_ms", Math.round(durationMs * 100.0) / 100.0));
            }
        }
    }

    private static String routeTemplate(HttpServletRequest request, String fallback) {
        Object best = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        return best != null ? best.toString() : fallback;
    }
}
