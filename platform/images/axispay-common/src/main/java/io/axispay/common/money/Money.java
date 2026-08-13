package io.axispay.common.money;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;
import java.util.Map;

/**
 * Money handling.
 *
 * <p>RULE, stated once on Day 1 and never broken: money is an integer in MINOR
 * units plus an ISO-4217 currency code. There is no floating point anywhere in
 * the money path, in any service, in any fixture.
 *
 * <pre>amount_minor=129900, currency="ZAR"  ->  R1,299.00</pre>
 *
 * <p>Floating point cannot represent 0.1 exactly. In a ledger that must balance
 * to zero across ten thousand entries, that is not a rounding curiosity — it is
 * an audit finding. All arithmetic here is integer / {@link BigDecimal}.
 */
public final class Money {

    /** ISO-4217 minor-unit exponents for the currencies AxisPay supports. */
    public static final Map<String, Integer> EXPONENTS = Map.of(
            "ZAR", 2, "USD", 2, "EUR", 2, "GBP", 2, "NGN", 2, "KES", 2, "BWP", 2,
            // Included deliberately: a zero-decimal currency breaks naive code.
            "JPY", 0);

    public static final Map<String, String> SYMBOLS = Map.of(
            "ZAR", "R", "USD", "$", "EUR", "\u20ac", "GBP", "\u00a3",
            "NGN", "\u20a6", "KES", "KSh", "BWP", "P", "JPY", "\u00a5");

    private final long amountMinor;
    private final String currency;

    public Money(long amountMinor, String currency) {
        String cur = currency.toUpperCase(Locale.ROOT);
        if (!EXPONENTS.containsKey(cur)) {
            throw new IllegalArgumentException("unsupported currency: " + currency);
        }
        this.amountMinor = amountMinor;
        this.currency = cur;
    }

    public long amountMinor() {
        return amountMinor;
    }

    public String currency() {
        return currency;
    }

    public int exponent() {
        return EXPONENTS.get(currency);
    }

    /** Fee calculation. Integer maths, banker-safe HALF_UP rounding, no float. */
    public Money basisPoints(int bps) {
        BigDecimal fee = BigDecimal.valueOf(amountMinor)
                .multiply(BigDecimal.valueOf(bps))
                .divide(BigDecimal.valueOf(10_000), 0, RoundingMode.HALF_UP);
        return new Money(fee.longValueExact(), currency);
    }

    public Money add(Money other) {
        requireSameCurrency(other, "add");
        return new Money(amountMinor + other.amountMinor, currency);
    }

    public Money subtract(Money other) {
        requireSameCurrency(other, "subtract");
        return new Money(amountMinor - other.amountMinor, currency);
    }

    private void requireSameCurrency(Money other, String op) {
        if (!currency.equals(other.currency)) {
            throw new IllegalArgumentException(
                    "cannot " + op + " " + other.currency + " and " + currency);
        }
    }

    @Override
    public String toString() {
        return formatMinor(amountMinor, currency);
    }

    /** 129900, "ZAR" -> "R1,299.00" */
    public static String formatMinor(long amountMinor, String currency) {
        String cur = currency.toUpperCase(Locale.ROOT);
        int exp = EXPONENTS.getOrDefault(cur, 2);
        String sym = SYMBOLS.getOrDefault(cur, cur + " ");
        DecimalFormatSymbols dfs = new DecimalFormatSymbols(Locale.ROOT);
        dfs.setGroupingSeparator(',');
        dfs.setDecimalSeparator('.');
        if (exp == 0) {
            DecimalFormat fmt = new DecimalFormat("#,##0", dfs);
            return sym + fmt.format(amountMinor);
        }
        long scale = (long) Math.pow(10, exp);
        long abs = Math.abs(amountMinor);
        long major = abs / scale;
        long minor = abs % scale;
        String sign = amountMinor < 0 ? "-" : "";
        DecimalFormat majorFmt = new DecimalFormat("#,##0", dfs);
        return sign + sym + majorFmt.format(major) + "." + padMinor(minor, exp);
    }

    /** "1299.00", "ZAR" -> 129900. Accepts a string, never a float. */
    public static long parseMajorToMinor(String amountMajor, String currency) {
        int exp = EXPONENTS.getOrDefault(currency.toUpperCase(Locale.ROOT), 2);
        BigDecimal scaled = new BigDecimal(amountMajor)
                .multiply(BigDecimal.TEN.pow(exp))
                .setScale(0, RoundingMode.HALF_UP);
        return scaled.longValueExact();
    }

    private static String padMinor(long minor, int exp) {
        String s = Long.toString(minor);
        while (s.length() < exp) {
            s = "0" + s;
        }
        return s;
    }

    // Kept for parity with the Python API which exposed BigInteger-safe helpers.
    public static BigInteger toBigInteger(long amountMinor) {
        return BigInteger.valueOf(amountMinor);
    }
}
