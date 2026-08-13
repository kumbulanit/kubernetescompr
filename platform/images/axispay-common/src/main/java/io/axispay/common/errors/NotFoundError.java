package io.axispay.common.errors;

import java.util.Map;

/** Resource not found — 404. */
public class NotFoundError extends AxisPayError {
    public NotFoundError(String message) {
        this(message, null);
    }

    public NotFoundError(String message, Map<String, Object> detail) {
        super(message, 404, "not_found", detail);
    }
}
