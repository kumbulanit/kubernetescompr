package io.axispay.common.errors;

import java.util.Map;

/**
 * A dependency REJECTED the request — 4xx, not 5xx. Very different thing.
 *
 * <p>This exists because of a bug found while testing this platform, and it is
 * worth understanding.
 *
 * <p>When a merchant sends an unsupported currency, payment-service correctly
 * replies 422. If edge-gateway treats every non-2xx from a downstream service
 * as a failure, it converts that 422 into a 502 "downstream unavailable". The
 * consequences are bad in three directions at once:
 *
 * <ul>
 *   <li>The merchant is told AxisPay is broken, when in fact their request was
 *       invalid — so they retry it, forever, and it fails every time.</li>
 *   <li>The 5xx error-rate metric climbs, the availability SLO burns, and
 *       Alertmanager pages the platform team at 03:00 for a customer typo.</li>
 *   <li>The real cause — a validation failure — is invisible on every
 *       dashboard.</li>
 * </ul>
 *
 * <p>Rule: propagate the ORIGINAL status for 4xx. A client error stays a client
 * error no matter how many services it passes through.
 */
public class UpstreamRejectedError extends AxisPayError {

    public UpstreamRejectedError(String message, int statusCode, Map<String, Object> detail, String errorCode) {
        super(message, statusCode, errorCode == null ? "rejected" : errorCode, detail);
    }
}
