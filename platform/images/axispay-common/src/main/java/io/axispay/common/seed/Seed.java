package io.axispay.common.seed;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * In-memory seed data for Day 1 and Day 2.
 *
 * <p>Everything here is FICTIONAL. No real merchant, customer, bank or card is
 * represented. Card data does not exist in this platform at all — only tokens
 * of the form {@code tok_…}. There is no PAN field, not even in fixtures.
 *
 * <p>On Day 3 this is replaced by PostgreSQL with the same shape, so the service
 * code does not change. Students see the data move from memory to a database
 * without the business logic being touched.
 */
public final class Seed {

    private Seed() {
    }

    public static final List<Map<String, Object>> MERCHANTS = new ArrayList<>();
    public static final Map<String, String> API_KEYS = new LinkedHashMap<>();
    public static final List<Map<String, Object>> CARD_TOKENS = new ArrayList<>();
    public static final Map<String, Map<String, Object>> MERCHANTS_BY_ID = new LinkedHashMap<>();
    public static final Map<String, Map<String, Object>> TOKENS_BY_ID = new LinkedHashMap<>();

    private static Map<String, Object> merchant(String id, String legal, String trading, String country,
                                                String mcc, String kyc, int mdrBps, int fixedFee,
                                                String currency, String webhook, boolean active) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("merchant_id", id);
        m.put("legal_name", legal);
        m.put("trading_name", trading);
        m.put("country", country);
        m.put("mcc", mcc);
        m.put("kyc_status", kyc);
        m.put("mdr_bps", mdrBps);
        m.put("fixed_fee_minor", fixedFee);
        m.put("settlement_currency", currency);
        m.put("webhook_url", webhook);
        m.put("active", active);
        return m;
    }

    private static Map<String, Object> card(String token, String brand, String last4,
                                            int expMonth, int expYear, String issuer) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("card_token", token);
        c.put("brand", brand);
        c.put("last4", last4);
        c.put("exp_month", expMonth);
        c.put("exp_year", expYear);
        c.put("issuer_country", issuer);
        return c;
    }

    static {
        MERCHANTS.add(merchant("MER_7QK2XD9P4A", "Kalahari Coffee Roasters (Pty) Ltd", "Kalahari Coffee Roasters", "ZA", "5499", "verified", 180, 150, "ZAR", "https://hooks.kalaharicoffee.example/axispay", true));
        MERCHANTS.add(merchant("MER_3HN8VB2M6C", "Zambezi Logistics Limited", "Zambezi Logistics", "ZA", "4214", "verified", 145, 200, "ZAR", "https://api.zambezilog.example/webhooks/payments", true));
        MERCHANTS.add(merchant("MER_9PL4KD7T2X", "Table Bay Outfitters CC", "Table Bay Outfitters", "ZA", "5651", "verified", 210, 150, "ZAR", "https://tablebay.example/pay/callback", true));
        MERCHANTS.add(merchant("MER_5RT2WQ8N3J", "Sahara Digital Media FZ-LLC", "Sahara Digital Media", "AE", "7311", "verified", 250, 100, "USD", "https://saharadigital.example/hooks", true));
        MERCHANTS.add(merchant("MER_8DF6JH4V9B", "Ubuntu Health Supplies (Pty) Ltd", "Ubuntu Health Supplies", "ZA", "5912", "verified", 165, 150, "ZAR", "https://ubuntuhealth.example/axispay/events", true));
        MERCHANTS.add(merchant("MER_2XC7MN5K8L", "Lagos Fresh Foods Ltd", "Lagos Fresh Foods", "NG", "5411", "verified", 195, 5000, "NGN", "https://lagosfresh.example/payments/webhook", true));
        MERCHANTS.add(merchant("MER_6BV3ZQ9W4H", "Nairobi Cloud Services Ltd", "Nairobi Cloud Services", "KE", "7372", "verified", 220, 2000, "KES", "https://nairobicloud.example/api/hooks", true));
        MERCHANTS.add(merchant("MER_4KJ9PT6R2D", "Okavango Safari Company (Pty) Ltd", "Okavango Safari Co", "BW", "4722", "verified", 275, 300, "BWP", "https://okavangosafari.example/hooks/pay", true));
        MERCHANTS.add(merchant("MER_7WS5WD3F8G", "Drakensberg Wine Estate (Pty) Ltd", "Drakensberg Wines", "ZA", "5921", "verified", 230, 150, "ZAR", "https://drakensbergwines.example/callback", true));
        MERCHANTS.add(merchant("MER_3QA8HK5Y7N", "Gaborone Auto Parts (Pty) Ltd", "Gaborone Auto Parts", "BW", "5533", "verified", 175, 300, "BWP", "https://gaboroneauto.example/axispay", true));
        MERCHANTS.add(merchant("MER_9ZX4CV2B6M", "Cape Fold Analytics (Pty) Ltd", "Cape Fold Analytics", "ZA", "7372", "verified", 240, 150, "ZAR", "https://capefold.example/webhooks/axispay", true));
        MERCHANTS.add(merchant("MER_5NM7BG4T9K", "Serengeti Textiles Ltd", "Serengeti Textiles", "KE", "5691", "verified", 185, 2000, "KES", "https://serengetitextiles.example/pay", true));
        MERCHANTS.add(merchant("MER_8LK2JH6D3S", "Winelands Boutique Hotels (Pty) Ltd", "Winelands Hotels", "ZA", "7011", "verified", 260, 150, "ZAR", "https://winelandshotels.example/hooks", true));
        MERCHANTS.add(merchant("MER_2VF9RD5X7C", "Atlantic Seaboard Fitness CC", "Atlantic Fitness", "ZA", "7997", "verified", 200, 150, "ZAR", "https://atlanticfitness.example/axispay", true));
        MERCHANTS.add(merchant("MER_6TY3WQ8Z4P", "Kilimanjaro Trekking Ltd", "Kilimanjaro Trekking", "KE", "4722", "verified", 290, 2000, "KES", "https://kilitrek.example/webhook", true));
        MERCHANTS.add(merchant("MER_4HG7NB2M9V", "Highveld Electronics (Pty) Ltd", "Highveld Electronics", "ZA", "5732", "verified", 155, 150, "ZAR", "https://highveldelec.example/pay/hook", true));
        MERCHANTS.add(merchant("MER_9CD5XS3K7L", "Victoria Falls Adventures Ltd", "Vic Falls Adventures", "ZA", "7999", "pending", 300, 150, "ZAR", "https://vicfallsadv.example/hooks", false));
        MERCHANTS.add(merchant("MER_7JN4KP6W2R", "Karoo Organic Farms (Pty) Ltd", "Karoo Organic", "ZA", "5499", "verified", 170, 150, "ZAR", "https://karooorganic.example/axispay", true));
        MERCHANTS.add(merchant("MER_3BM8VC5T4X", "Accra Mobile Money Agents Ltd", "Accra Mobile Agents", "NG", "6012", "review", 320, 5000, "NGN", "https://accramobile.example/hooks", true));
        MERCHANTS.add(merchant("MER_5WQ2ZN9H6D", "Durban Port Services (Pty) Ltd", "Durban Port Services", "ZA", "4214", "verified", 135, 200, "ZAR", "https://durbanport.example/api/webhook", true));
        MERCHANTS.add(merchant("MER_8RT6YU3J5N", "Sandton Legal Partners Inc", "Sandton Legal", "ZA", "8111", "verified", 250, 150, "ZAR", "https://sandtonlegal.example/pay", true));
        MERCHANTS.add(merchant("MER_2KL9PD4F7B", "Thames Valley Imports Ltd", "Thames Valley Imports", "GB", "5199", "verified", 125, 20, "GBP", "https://thamesvalley.example/hooks/axispay", true));
        MERCHANTS.add(merchant("MER_6HN3MV8Q2W", "Rhine Digital Commerce GmbH", "Rhine Digital", "DE", "5817", "verified", 140, 25, "EUR", "https://rhinedigital.example/webhook", true));
        MERCHANTS.add(merchant("MER_4XZ7CB5R9T", "Namib Desert Lodges (Pty) Ltd", "Namib Desert Lodges", "BW", "7011", "verified", 280, 300, "BWP", "https://namiblodges.example/axispay/hook", true));
        MERCHANTS.add(merchant("MER_9GF2JK6L3M", "Soweto Community Pharmacy CC", "Soweto Pharmacy", "ZA", "5912", "verified", 160, 150, "ZAR", "https://sowetopharm.example/hooks", true));

        // Merchant API keys. Fictional. In a real platform these are hashed at
        // rest and never logged; that limitation is discussed on Day 3 (M3.2).
        API_KEYS.put("ak_live_kalahari_7QK2XD9P4A", "MER_7QK2XD9P4A");
        API_KEYS.put("ak_live_zambezi_3HN8VB2M6C", "MER_3HN8VB2M6C");
        API_KEYS.put("ak_live_tablebay_9PL4KD7T2X", "MER_9PL4KD7T2X");
        API_KEYS.put("ak_live_sahara_5RT2WQ8N3J", "MER_5RT2WQ8N3J");
        API_KEYS.put("ak_test_sandbox_0000000000", "MER_7QK2XD9P4A");

        CARD_TOKENS.add(card("tok_a71ef4c2900bd5386ff1240e", "visa", "4242", 11, 2029, "ZA"));
        CARD_TOKENS.add(card("tok_5d3b8e1f47a90c26db55f083", "mastercard", "8210", 3, 2028, "ZA"));
        CARD_TOKENS.add(card("tok_c92f60ab3d17e8459cb2740d", "visa", "1881", 7, 2027, "GB"));
        CARD_TOKENS.add(card("tok_1e845fd60b93ac72510ef3b6", "amex", "0005", 1, 2030, "US"));
        CARD_TOKENS.add(card("tok_7b02cd94e5fa138067ad4192", "mastercard", "5544", 9, 2028, "NG"));
        CARD_TOKENS.add(card("tok_3f6a91e0c48db275ae30165c", "visa", "9316", 5, 2029, "KE"));

        for (Map<String, Object> m : MERCHANTS) {
            MERCHANTS_BY_ID.put((String) m.get("merchant_id"), m);
        }
        for (Map<String, Object> c : CARD_TOKENS) {
            TOKENS_BY_ID.put((String) c.get("card_token"), c);
        }
    }
}
