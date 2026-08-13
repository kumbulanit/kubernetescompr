package io.axispay.common.ids;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Identifier generation.
 *
 * <p>Formats are fixed in {@code platform/reference/01-ARCHITECTURE.md} §6.2 and
 * are used consistently across every service, manifest, lab and slide. Students
 * learn to recognise an AxisPay identifier on sight, which makes log
 * correlation far easier on Day 5.
 */
public final class Ids {

    // No I/O/0/1 — avoids read-aloud errors.
    private static final char[] MERCHANT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] HEX = "0123456789abcdef".toCharArray();
    private static final DateTimeFormatter DAY =
            DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);

    private Ids() {
    }

    /** MER_7QK2XD9P4A */
    public static String newMerchantId() {
        StringBuilder sb = new StringBuilder("MER_");
        for (int i = 0; i < 10; i++) {
            sb.append(MERCHANT_ALPHABET[RANDOM.nextInt(MERCHANT_ALPHABET.length)]);
        }
        return sb.toString();
    }

    /** pay_9f2c41ab77de0c3518be4d6a */
    public static String newPaymentId() {
        return "pay_" + hex(12);
    }

    /** tok_a71ef4c2900bd5386ff1240e — a card TOKEN. No PAN exists in this platform. */
    public static String newToken() {
        return "tok_" + hex(12);
    }

    /** AXP-20260803-4c9a1f77 — the reference a merchant quotes in a support ticket. */
    public static String newReference(Instant when) {
        Instant w = when == null ? Instant.now() : when;
        return "AXP-" + DAY.format(w) + "-" + hex(4);
    }

    public static String newReference() {
        return newReference(null);
    }

    public static String newCorrelationId() {
        return UUID.randomUUID().toString();
    }

    /** jnl_1a2b3c4d5e6f7a8b9c0d */
    public static String newJournalId() {
        return "jnl_" + hex(10);
    }

    /** Hex string of {@code bytes} random bytes (2 hex chars per byte). */
    private static String hex(int bytes) {
        char[] out = new char[bytes * 2];
        byte[] raw = new byte[bytes];
        RANDOM.nextBytes(raw);
        for (int i = 0; i < bytes; i++) {
            int v = raw[i] & 0xFF;
            out[i * 2] = HEX[v >>> 4];
            out[i * 2 + 1] = HEX[v & 0x0F];
        }
        return new String(out);
    }
}
