package io.axispay.merchantservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * AxisPay merchant-service — merchant master data and pricing.
 *
 * <p>payment-service calls this on every authorisation to work out what to
 * charge the merchant, which makes it a hard dependency of the payment path.
 */
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
