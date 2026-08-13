package io.axispay.paymentservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * AxisPay payment-service — the orchestrator.
 *
 * <p>Owns the payment lifecycle and is the service everything else in the
 * platform exists to support. The operational surface (probes, metrics,
 * logging, error handling) is supplied by axispay-common, so this module only
 * describes payment behaviour.
 */
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
