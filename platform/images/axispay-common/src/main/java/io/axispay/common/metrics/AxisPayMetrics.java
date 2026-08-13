package io.axispay.common.metrics;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

/**
 * Prometheus metrics.
 *
 * <p>The series defined here are the golden signals for a payment platform, and
 * they are what students query on Day 5:
 *
 * <pre>
 *   traffic     axispay_http_requests_total
 *   latency     axispay_http_request_duration_seconds
 *   errors      axispay_http_requests_total{status=~"5.."}
 *   saturation  axispay_http_requests_in_flight + container metrics from cAdvisor
 * </pre>
 *
 * <p>{@code axispay_payments_total} is the business metric — the one an
 * operations manager actually cares about. Approval rate per acquirer comes
 * from it.
 *
 * <p>Micrometer's Prometheus registry derives the exposition names from the
 * meter names below: a Counter named {@code axispay.http.requests} is exported
 * as {@code axispay_http_requests_total}, and a Timer named
 * {@code axispay.http.request.duration} as
 * {@code axispay_http_request_duration_seconds_bucket/_count/_sum}.
 */
public class AxisPayMetrics {

    // Buckets chosen around the 300 ms p99 SLO so the histogram is useful
    // exactly where the alert threshold sits.
    private static final Duration[] SLO_BUCKETS = {
            Duration.ofNanos(5_000_000), Duration.ofNanos(10_000_000), Duration.ofNanos(25_000_000),
            Duration.ofNanos(50_000_000), Duration.ofNanos(100_000_000), Duration.ofNanos(150_000_000),
            Duration.ofNanos(200_000_000), Duration.ofNanos(300_000_000), Duration.ofNanos(500_000_000),
            Duration.ofSeconds(1), Duration.ofNanos(2_500_000_000L), Duration.ofSeconds(5),
    };

    private final MeterRegistry registry;
    private final String service;
    private final AtomicInteger inFlight = new AtomicInteger(0);

    public AxisPayMetrics(MeterRegistry registry, String service) {
        this.registry = registry;
        this.service = service;
        io.micrometer.core.instrument.Gauge
                .builder("axispay.http.requests.in.flight", inFlight, AtomicInteger::get)
                .description("In-flight HTTP requests")
                .tag("service", service)
                .register(registry);
    }

    public void incInFlight() {
        inFlight.incrementAndGet();
    }

    public void decInFlight() {
        inFlight.decrementAndGet();
    }

    public void recordRequest(String method, String route, String status, Duration elapsed) {
        Timer.builder("axispay.http.request.duration")
                .description("HTTP request duration")
                .tag("service", service)
                .tag("method", method)
                .tag("path", route)
                .serviceLevelObjectives(SLO_BUCKETS)
                .register(registry)
                .record(elapsed);
        Counter.builder("axispay.http.requests")
                .description("Total HTTP requests")
                .tag("service", service)
                .tag("method", method)
                .tag("path", route)
                .tag("status", status)
                .register(registry)
                .increment();
    }

    /** Business metric: payments by outcome. */
    public void recordPayment(String status, String currency) {
        Counter.builder("axispay.payments")
                .description("Payments by outcome")
                .tag("service", service)
                .tag("status", status)
                .tag("currency", currency)
                .register(registry)
                .increment();
    }

    public void setBuildInfo(String version, String pod, String node) {
        io.micrometer.core.instrument.Gauge
                .builder("axispay.build.info", () -> 1.0)
                .description("Build metadata")
                .tag("service", service)
                .tag("version", version)
                .tag("pod", pod)
                .tag("node", node)
                .register(registry);
    }

    public String service() {
        return service;
    }
}
