package io.axispay.common.logging;

import java.util.Map;

import org.slf4j.Logger;

import net.logstash.logback.argument.StructuredArguments;

/**
 * Structured business-event logging helper — the Java equivalent of the Python
 * platform's {@code log_with(logger, level, msg, **fields)}.
 *
 * <p>Each field becomes a top-level key in the JSON log line (via logstash
 * {@link StructuredArguments}), alongside the correlation ID carried in the MDC.
 */
public final class Log {

    private Log() {
    }

    public static void info(Logger logger, String msg, Map<String, ?> fields) {
        logger.info(msg, args(fields));
    }

    public static void warn(Logger logger, String msg, Map<String, ?> fields) {
        logger.warn(msg, args(fields));
    }

    public static void error(Logger logger, String msg, Map<String, ?> fields) {
        logger.error(msg, args(fields));
    }

    private static Object[] args(Map<String, ?> fields) {
        if (fields == null || fields.isEmpty()) {
            return new Object[0];
        }
        Object[] args = new Object[fields.size()];
        int i = 0;
        for (var e : fields.entrySet()) {
            args[i++] = StructuredArguments.kv(e.getKey(), e.getValue());
        }
        return args;
    }
}
