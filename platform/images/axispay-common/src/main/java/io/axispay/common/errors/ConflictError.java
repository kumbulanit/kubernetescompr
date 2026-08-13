package io.axispay.common.errors;

import java.util.Map;

/** Request conflicts with current state — 409. */
public class ConflictError extends AxisPayError {
    public ConflictError(String message) {
        this(message, null);
    }

    public ConflictError(String message, Map<String, Object> detail) {
        super(message, 409, "conflict", detail);
    }
}
