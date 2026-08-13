package io.axispay.paymentservice;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.axispay.common.config.Settings;
import io.axispay.common.errors.ConflictError;
import io.axispay.common.errors.NotFoundError;
import io.axispay.common.errors.ValidationError;
import io.axispay.common.ids.Ids;
import io.axispay.common.logging.Log;
import io.axispay.common.metrics.AxisPayMetrics;
import io.axispay.common.money.Money;
import io.axispay.common.seed.Seed;

/**
 * The payment lifecycle:
 *
 * <pre>
 *   created -&gt; risk_checked -&gt; routed -&gt; authorized -&gt; captured -&gt; settled
 *   with refunded / voided / declined / failed as terminal branches.
 * </pre>
 *
 * <p>Day 1 scope: created -&gt; authorized -&gt; captured, with merchant-service as the
 * only downstream dependency and payments held in memory. Fraud, routing and
 * ledger are wired in on Days 2-3, and PostgreSQL replaces the map on Day 3
 * without this class's business logic changing.
 *
 * <p>IDEMPOTENCY is implemented from day one, not bolted on later. In payments,
 * retrying a request must never charge a customer twice. A client that times out
 * and retries with the same Idempotency-Key gets the SAME payment back, not a
 * second one.
 */
@RestController
@RequestMapping("/api/v1")
public class PaymentController {

    private static final Logger log = LoggerFactory.getLogger("payment-service");

    // In-memory stores — replaced by PostgreSQL on Day 3 (L3.5).
    private final Map<String, Map<String, Object>> payments = new ConcurrentHashMap<>();
    private final Map<String, String> idempotency = new ConcurrentHashMap<>();

    private final Settings settings;
    private final Downstreams downstreams;
    private final AxisPayMetrics metrics;

    public PaymentController(Settings settings, Downstreams downstreams, AxisPayMetrics metrics) {
        this.settings = settings;
        this.downstreams = downstreams;
        this.metrics = metrics;
    }

    @PostMapping("/payments")
    public ResponseEntity<Map<String, Object>> createPayment(
            @RequestBody PaymentRequest body,
            @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey) {

        // --- 1. Idempotency -------------------------------------------------
        if (idempotencyKey != null && idempotency.containsKey(idempotencyKey)) {
            Map<String, Object> existing = payments.get(idempotency.get(idempotencyKey));
            Log.info(log, "idempotent replay", Map.of("payment_id", existing.get("payment_id")));
            return ResponseEntity.status(HttpStatus.OK)
                    .header("Idempotent-Replay", "true")
                    .body(existing);
        }

        // --- 2. Validate the request ----------------------------------------
        String currency = body.validatedCurrency(settings.currencies());
        String cardToken = body.validatedCardToken();

        Map<String, Object> card = Seed.TOKENS_BY_ID.get(cardToken);
        if (card == null) {
            throw new ValidationError("unknown card token", Map.of("card_token", cardToken));
        }

        // --- 3. Merchant lookup and pricing (downstream call) ---------------
        Map<String, Object> merchant = downstreams.merchants().get("/api/v1/merchants/" + body.merchantId());
        if (!Boolean.TRUE.equals(merchant.get("active"))) {
            throw new ConflictError("merchant is not active", Map.of("merchant_id", body.merchantId()));
        }
        if (!"verified".equals(merchant.get("kyc_status"))) {
            throw new ConflictError("merchant KYC is not verified — payments are not permitted",
                    Map.of("merchant_id", body.merchantId(), "kyc_status", String.valueOf(merchant.get("kyc_status"))));
        }

        Map<String, Object> pricing = downstreams.merchants().get(
                "/api/v1/merchants/" + body.merchantId() + "/pricing",
                Map.of("amount_minor", body.amountMinor(), "currency", currency));

        // --- 4. Risk and routing (v1.1.0 — added on Day 2) ------------------
        Instant now = Instant.now();
        String paymentId = Ids.newPaymentId();
        Integer riskScore = null;
        String acquirer = null;
        String authCode = null;
        String declineReason = null;
        String status = body.captureRequested() ? "captured" : "authorized";

        if (settings.enableRiskRouting()) {
            Map<String, Object> assessment = downstreams.fraud().post("/api/v1/score", Map.of(
                    "merchant_id", body.merchantId(), "card_token", cardToken,
                    "amount_minor", body.amountMinor(), "currency", currency));
            riskScore = ((Number) assessment.get("score")).intValue();
            if ("decline".equals(assessment.get("decision"))) {
                metrics.recordPayment("declined", currency);
                Log.warn(log, "payment declined by fraud", Map.of(
                        "payment_id", paymentId, "score", riskScore, "reasons", assessment.get("reasons")));
                throw new ConflictError("payment declined by risk assessment",
                        Map.of("score", riskScore, "reasons", assessment.get("reasons")));
            }

            Map<String, Object> decision = downstreams.routing().post("/api/v1/route", Map.of(
                    "merchant_id", body.merchantId(), "card_token", cardToken,
                    "amount_minor", body.amountMinor(), "currency", currency,
                    "payment_id", paymentId));
            acquirer = (String) decision.get("acquirer");
            if (Boolean.TRUE.equals(decision.get("approved"))) {
                authCode = (String) decision.get("auth_code");
            } else {
                status = "declined";
                declineReason = (String) decision.get("decline_reason");
            }
        }

        Map<String, Object> payment = new LinkedHashMap<>();
        payment.put("payment_id", paymentId);
        payment.put("reference", Ids.newReference(now));
        payment.put("merchant_id", body.merchantId());
        payment.put("amount_minor", body.amountMinor());
        payment.put("currency", currency);
        payment.put("status", status);
        payment.put("card_brand", card.get("brand"));
        payment.put("card_last4", card.get("last4"));
        payment.put("fee_minor", pricing.get("total_fee_minor"));
        payment.put("net_minor", pricing.get("net_minor"));
        payment.put("description", body.description());
        payment.put("risk_score", riskScore);
        payment.put("acquirer", acquirer);
        payment.put("auth_code", authCode);
        payment.put("decline_reason", declineReason);
        payment.put("created_at", now.toString());
        payment.put("updated_at", now.toString());
        payment.put("display_amount", Money.formatMinor(body.amountMinor(), currency));

        payments.put(paymentId, payment);
        if (idempotencyKey != null) {
            idempotency.put(idempotencyKey, paymentId);
        }

        metrics.recordPayment(status, currency);
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("payment_id", paymentId);
        f.put("merchant_id", body.merchantId());
        f.put("status", status);
        f.put("amount_minor", body.amountMinor());
        f.put("currency", currency);
        f.put("reference", payment.get("reference"));
        f.put("pod", settings.podName());
        f.put("risk_score", riskScore);
        f.put("acquirer", acquirer);
        Log.info(log, "payment created", f);
        return ResponseEntity.status(HttpStatus.CREATED).body(payment);
    }

    @GetMapping("/payments/{paymentId}")
    public Map<String, Object> getPayment(@PathVariable String paymentId) {
        Map<String, Object> payment = payments.get(paymentId);
        if (payment == null) {
            throw new NotFoundError("payment not found", Map.of("payment_id", paymentId));
        }
        return payment;
    }

    @GetMapping("/payments")
    public List<Map<String, Object>> listPayments(
            @RequestParam(required = false) String merchant_id,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "50") int limit) {
        int capped = Math.max(1, Math.min(200, limit));
        List<Map<String, Object>> rows = new ArrayList<>(payments.values());
        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> p : rows) {
            if (merchant_id != null && !merchant_id.equals(p.get("merchant_id"))) {
                continue;
            }
            if (status != null && !status.equals(p.get("status"))) {
                continue;
            }
            filtered.add(p);
        }
        filtered.sort(Comparator.comparing((Map<String, Object> p) -> String.valueOf(p.get("created_at"))).reversed());
        return filtered.subList(0, Math.min(capped, filtered.size()));
    }

    @PostMapping("/payments/{paymentId}/refund")
    public Map<String, Object> refundPayment(@PathVariable String paymentId) {
        Map<String, Object> payment = payments.get(paymentId);
        if (payment == null) {
            throw new NotFoundError("payment not found", Map.of("payment_id", paymentId));
        }
        if (!"captured".equals(payment.get("status"))) {
            throw new ConflictError("only captured payments can be refunded",
                    Map.of("payment_id", paymentId, "status", String.valueOf(payment.get("status"))));
        }
        payment.put("status", "refunded");
        payment.put("updated_at", Instant.now().toString());
        metrics.recordPayment("refunded", String.valueOf(payment.get("currency")));
        Log.info(log, "payment refunded", Map.of("payment_id", paymentId));
        return payment;
    }

    @GetMapping("/payments-stats")
    public Map<String, Object> stats() {
        Map<String, Integer> byStatus = new LinkedHashMap<>();
        Map<String, Long> byCurrency = new LinkedHashMap<>();
        for (Map<String, Object> p : payments.values()) {
            String st = String.valueOf(p.get("status"));
            byStatus.merge(st, 1, Integer::sum);
            String cur = String.valueOf(p.get("currency"));
            long amount = ((Number) p.get("amount_minor")).longValue();
            byCurrency.merge(cur, amount, Long::sum);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total_payments", payments.size());
        out.put("by_status", byStatus);
        out.put("volume_minor_by_currency", byCurrency);
        out.put("served_by_pod", settings.podName());
        return out;
    }

    /** Payment request body. Field names bind from snake_case JSON. */
    public record PaymentRequest(
            String merchantId,
            Long amountMinor,
            String currency,
            String cardToken,
            String description,
            Boolean capture) {

        public boolean captureRequested() {
            return capture == null || capture;
        }

        String validatedCurrency(List<String> supported) {
            if (currency == null || currency.length() != 3) {
                throw new ValidationError("currency must be a 3-letter ISO-4217 code",
                        Map.of("currency", String.valueOf(currency)));
            }
            String c = currency.toUpperCase();
            if (!supported.contains(c)) {
                throw new ValidationError(
                        "unsupported currency " + c + "; supported: " + String.join(", ", supported),
                        Map.of("currency", c));
            }
            return c;
        }

        String validatedCardToken() {
            if (amountMinor == null || amountMinor <= 0) {
                throw new ValidationError("amount_minor must be a positive integer in minor units",
                        Map.of("amount_minor", String.valueOf(amountMinor)));
            }
            // Defence in depth: refuse anything that looks like a PAN. A card
            // number must never enter this platform, not even to be rejected.
            if (cardToken == null || !cardToken.startsWith("tok_")) {
                throw new ValidationError(
                        "card_token must be a token (tok_...); raw card numbers are never accepted",
                        Map.of("card_token", String.valueOf(cardToken)));
            }
            if (description != null && description.length() > 140) {
                throw new ValidationError("description must be at most 140 characters", Map.of());
            }
            return cardToken;
        }

        public Optional<String> descriptionOpt() {
            return Optional.ofNullable(description);
        }
    }
}
