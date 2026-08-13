package io.axispay.common.autoconfig;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.axispay.common.config.Settings;
import io.axispay.common.readiness.ReadinessRegistry;
import jakarta.annotation.PreDestroy;
import net.logstash.logback.argument.StructuredArguments;

/**
 * On shutdown, mark this instance unready BEFORE in-flight work drains, so the
 * endpoint controller removes the pod from the Service first. Runs during the
 * Spring context close triggered by SIGTERM.
 */
public class GracefulDrain {

    private static final Logger log = LoggerFactory.getLogger("axispay.common");

    private final Settings settings;
    private final ReadinessRegistry readiness;

    public GracefulDrain(Settings settings, ReadinessRegistry readiness) {
        this.settings = settings;
        this.readiness = readiness;
    }

    @PreDestroy
    public void drain() {
        log.info("SIGTERM received — draining",
                StructuredArguments.kv("uptime", readiness.uptimeSeconds()),
                StructuredArguments.kv("pod", settings.podName()));
        readiness.forceUnready(true);
    }
}
