package io.axispay.common.errors;

import java.util.Map;

/** Request failed validation — 422. */
public class ValidationError extends AxisPayError {
    public ValidationError(String message) {
        this(message, null);
    }

    public ValidationError(String message, Map<String, Object> detail) {
        super(message, 422, "validation_failed", detail);
    }
}
