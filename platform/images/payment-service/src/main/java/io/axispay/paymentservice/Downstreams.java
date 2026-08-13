package io.axispay.paymentservice;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import io.axispay.common.config.Settings;
import io.axispay.common.http.DownstreamClient;
import io.axispay.common.logging.Log;
import io.axispay.common.readiness.ReadinessRegistry;
import jakarta.annotation.PostConstruct;

/**
 * Wires the downstream clients and registers their readiness checks — the Java
 * equivalent of the Python service's {@code _startup} hook.
 */
@Component
public class Downstreams {

    private static final Logger log = LoggerFactory.getLogger("payment-service");

    private final Settings settings;
    private final ReadinessRegistry readiness;

    private DownstreamClient merchants;
    private DownstreamClient fraud;
    private DownstreamClient routing;

    public Downstreams(Settings settings, ReadinessRegistry readiness) {
        this.settings = settings;
        this.readiness = readiness;
    }

    @PostConstruct
    void wire() {
        double t = settings.downstreamTimeoutSeconds();
        merchants = new DownstreamClient("merchant-service", settings.merchantServiceUrl(), t);
        // merchant-service is on the payment path, so it is a CRITICAL readiness
        // check: if it is unreachable, this pod cannot serve payments and must be
        // taken out of the Service. It must NOT affect liveness.
        readiness.register("merchant-service", merchants::probe, true);

        if (settings.enableRiskRouting()) {
            fraud = new DownstreamClient("fraud-service", settings.fraudServiceUrl(), t);
            routing = new DownstreamClient("routing-service", settings.routingServiceUrl(), t);
            // Both are on the payment path from v1.1.0, so both are CRITICAL.
            readiness.register("fraud-service", fraud::probe, true);
            readiness.register("routing-service", routing::probe, true);
        }
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("risk_routing", settings.enableRiskRouting());
        Log.info(log, "downstreams wired", f);
    }

    public DownstreamClient merchants() {
        return merchants;
    }

    public DownstreamClient fraud() {
        return fraud;
    }

    public DownstreamClient routing() {
        return routing;
    }
}
