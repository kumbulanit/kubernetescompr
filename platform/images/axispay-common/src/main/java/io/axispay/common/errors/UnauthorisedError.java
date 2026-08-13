package io.axispay.common.errors;

import java.util.Map;

/** Caller is not authorised — 401. */
public class UnauthorisedError extends AxisPayError {
    public UnauthorisedError(String message) {
        this(message, null);
    }

    public UnauthorisedError(String message, Map<String, Object> detail) {
        super(message, 401, "unauthorised", detail);
    }
}
