package io.axispay.common.context;

import java.util.UUID;

import org.slf4j.MDC;

/**
 * Correlation IDs.
 *
 * <p>edge-gateway mints an X-Correlation-Id for every inbound merchant request
 * and every downstream call carries it forward. On Day 1 students implement
 * this without being told why.
 *
 * <p>On Day 5, in Loki, they take a single latency spike in Grafana and pull
 * back every log line from all seven services involved in that one payment —
 * because of this. The callback to Monday is deliberate and it lands hard.
 *
 * <p>The value lives in SLF4J's MDC so the logback JSON encoder emits it on
 * every line automatically, on whichever thread is handling the request.
 */
public final class CorrelationId {

    public static final String HEADER = "X-Correlation-Id";
    public static final String MDC_KEY = "correlation_id";

    private CorrelationId() {
    }

    /** The correlation ID for the current thread, or "-" if none is set. */
    public static String get() {
        String cid = MDC.get(MDC_KEY);
        return cid == null ? "-" : cid;
    }

    /** Accept an inbound correlation ID or mint a fresh one, and bind it. */
    public static String set(String value) {
        String cid = (value == null || value.isBlank()) ? UUID.randomUUID().toString() : value;
        MDC.put(MDC_KEY, cid);
        return cid;
    }

    public static void clear() {
        MDC.remove(MDC_KEY);
    }
}
