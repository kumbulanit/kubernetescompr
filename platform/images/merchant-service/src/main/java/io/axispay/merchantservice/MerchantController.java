package io.axispay.merchantservice;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.axispay.common.errors.NotFoundError;
import io.axispay.common.money.Money;
import io.axispay.common.seed.Seed;

/**
 * Merchant master data: legal entity, KYC status, MCC, pricing (MDR in basis
 * points plus a fixed fee), settlement currency and webhook endpoint.
 */
@RestController
@RequestMapping("/api/v1")
public class MerchantController {

    @GetMapping("/merchants")
    public List<Map<String, Object>> listMerchants(
            @RequestParam(required = false) String country,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "50") int limit) {
        int capped = Math.max(1, Math.min(100, limit));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> m : Seed.MERCHANTS) {
            if (country != null && !country.toUpperCase().equals(m.get("country"))) {
                continue;
            }
            if (active != null && !active.equals(m.get("active"))) {
                continue;
            }
            rows.add(m);
        }
        return rows.subList(0, Math.min(capped, rows.size()));
    }

    @GetMapping("/merchants/{merchantId}")
    public Map<String, Object> getMerchant(@PathVariable String merchantId) {
        Map<String, Object> merchant = Seed.MERCHANTS_BY_ID.get(merchantId);
        if (merchant == null) {
            throw new NotFoundError("merchant not found", Map.of("merchant_id", merchantId));
        }
        return merchant;
    }

    /**
     * Fee = (amount x MDR bps) + fixed fee. Integer arithmetic throughout.
     *
     * <p>Students see this on Day 1 and it becomes the settlement calculation on
     * Day 4 — the same function, moved into a batch job.
     */
    @GetMapping("/merchants/{merchantId}/pricing")
    public Map<String, Object> quotePricing(
            @PathVariable String merchantId,
            @RequestParam("amount_minor") long amountMinor,
            @RequestParam String currency) {
        Map<String, Object> merchant = Seed.MERCHANTS_BY_ID.get(merchantId);
        if (merchant == null) {
            throw new NotFoundError("merchant not found", Map.of("merchant_id", merchantId));
        }
        String cur = currency.toUpperCase();
        int mdrBps = ((Number) merchant.get("mdr_bps")).intValue();
        long fixedFee = ((Number) merchant.get("fixed_fee_minor")).longValue();

        Money gross = new Money(amountMinor, cur);
        Money variable = gross.basisPoints(mdrBps);
        Money fixed = new Money(fixedFee, cur);
        Money fee = variable.add(fixed);
        Money net = gross.subtract(fee);

        Map<String, Object> display = new LinkedHashMap<>();
        display.put("gross", gross.toString());
        display.put("fee", fee.toString());
        display.put("net", net.toString());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("merchant_id", merchantId);
        out.put("currency", cur);
        out.put("gross_minor", gross.amountMinor());
        out.put("mdr_bps", mdrBps);
        out.put("variable_fee_minor", variable.amountMinor());
        out.put("fixed_fee_minor", fixed.amountMinor());
        out.put("total_fee_minor", fee.amountMinor());
        out.put("net_minor", net.amountMinor());
        out.put("display", display);
        return out;
    }
}
