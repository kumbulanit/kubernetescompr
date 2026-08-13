package io.axispay.common.errors;

import java.util.HashMap;
import java.util.Map;

/**
 * Error types and RFC-7807-shaped problem responses.
 *
 * <p>Every service returns errors in the same envelope, so the gateway can pass
 * them through unchanged and a merchant sees one consistent contract.
 */
public class AxisPayError extends RuntimeException {

    private final int statusCode;
    private final String errorCode;
    private final Map<String, Object> detail;

    public AxisPayError(String message) {
        this(message, null);
    }

    public AxisPayError(String message, Map<String, Object> detail) {
        this(message, 500, "internal_error", detail);
    }

    protected AxisPayError(String message, int statusCode, String errorCode, Map<String, Object> detail) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.detail = detail == null ? new HashMap<>() : detail;
    }

    public int statusCode() {
        return statusCode;
    }

    public String errorCode() {
        return errorCode;
    }

    public Map<String, Object> detail() {
        return detail;
    }
}
