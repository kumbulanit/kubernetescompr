package io.axispay.common.autoconfig;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import io.axispay.common.config.Settings;
import io.axispay.common.context.CorrelationIdFilter;
import io.axispay.common.errors.GlobalExceptionHandler;
import io.axispay.common.metrics.AxisPayMetrics;
import io.axispay.common.metrics.MetricsFilter;
import io.axispay.common.ops.OperationalController;
import io.axispay.common.readiness.ReadinessRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import net.logstash.logback.argument.StructuredArguments;

/**
 * Wires the identical operational surface onto every AxisPay service:
 * correlation IDs, JSON logging, metrics, error handling, the three probes,
 * /metrics and /api/v1/_info.
 *
 * <p>A service module then only has to describe its business behaviour — which
 * is why {@code payment-service} is short enough to read on a slide.
 */
@AutoConfiguration
@Import({OperationalController.class, GlobalExceptionHandler.class})
public class AxisPayAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger("axispay.common");

    @Bean
    public Settings axisPaySettings() {
        return new Settings();
    }

    @Bean
    public ReadinessRegistry axisPayReadinessRegistry(Settings settings) {
        return new ReadinessRegistry(settings.startupDelaySeconds());
    }

    @Bean
    public AxisPayMetrics axisPayMetrics(MeterRegistry registry, Settings settings) {
        return new AxisPayMetrics(registry, settings.serviceName());
    }

    @Bean
    public CorrelationIdFilter axisPayCorrelationIdFilter() {
        return new CorrelationIdFilter();
    }

    @Bean
    public MetricsFilter axisPayMetricsFilter(AxisPayMetrics metrics) {
        return new MetricsFilter(metrics);
    }

    /** Startup banner + build-info gauge, mirroring the Python lifespan. */
    @Bean
    public ApplicationRunner axisPayStartupRunner(Settings settings, AxisPayMetrics metrics) {
        return args -> {
            metrics.setBuildInfo(settings.serviceVersion(), settings.podName(), settings.nodeName());
            log.info("starting",
                    StructuredArguments.kv("version", settings.serviceVersion()),
                    StructuredArguments.kv("node", settings.nodeName()),
                    StructuredArguments.kv("namespace", settings.namespace()),
                    StructuredArguments.kv("startup_delay", settings.startupDelaySeconds()));
            log.info("ready to serve", StructuredArguments.kv("port", settings.port()));
        };
    }

    /**
     * Graceful shutdown (taught in D2 M2.6).
     *
     * <p>Kubernetes sends SIGTERM, waits terminationGracePeriodSeconds, then
     * SIGKILL. On SIGTERM we FIRST mark ourselves unready so the endpoint
     * controller removes this pod from the Service, THEN in-flight work finishes
     * (Spring's graceful shutdown). Reversing that order severs live payments
     * mid-authorisation.
     */
    @Bean
    public GracefulDrain axisPayGracefulDrain(Settings settings, ReadinessRegistry readiness) {
        return new GracefulDrain(settings, readiness);
    }
}
