package io.axispay.common.errors;

import java.util.Map;

/**
 * A dependency is BROKEN — unreachable, timed out, or returned 5xx.
 *
 * <p>502, not 500: the fault is on the other side of the boundary. That
 * distinction is what tells an on-call engineer which team to page.
 */
public class DownstreamError extends AxisPayError {
    public DownstreamError(String message) {
        this(message, null);
    }

    public DownstreamError(String message, Map<String, Object> detail) {
        super(message, 502, "downstream_unavailable", detail);
    }
}
