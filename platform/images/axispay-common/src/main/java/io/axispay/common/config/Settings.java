package io.axispay.common.config;

import java.util.ArrayList;
import java.util.List;

/**
 * Environment-driven configuration.
 *
 * <p>Every AxisPay service reads the same variable names. On Day 1 these come
 * from the pod spec; from Day 3 they come from ConfigMaps and Secrets. The
 * service code does not change — that is the point of externalised
 * configuration, and students see it happen without a single line of Java being
 * edited.
 *
 * <p>Values are read straight from the process environment by their exact
 * names (POD_NAME, LOG_LEVEL, MERCHANT_SERVICE_URL, ...) so the Kubernetes
 * manifests written for the previous platform keep working unchanged.
 */
public final class Settings {

    // --- identity -----------------------------------------------------------
    private String serviceName;
    private final String serviceVersion;
    private final String environment;
    private final String logLevel;
    private final int port;

    // --- Downward API: injected by Kubernetes from the pod spec --------------
    private final String podName;
    private final String podIp;
    private final String nodeName;
    private final String namespace;

    // --- downstream services (cluster DNS names from Day 1) -----------------
    private final String authServiceUrl;
    private final String merchantServiceUrl;
    private final String paymentServiceUrl;
    private final String customerServiceUrl;
    private final String fraudServiceUrl;
    private final String routingServiceUrl;
    private final String ledgerServiceUrl;

    // --- behaviour ----------------------------------------------------------
    private final double downstreamTimeoutSeconds;
    private final double startupDelaySeconds;
    private final boolean enableRiskRouting;
    private final String jwtSigningKey;
    private final int tokenTtlSeconds;
    private final String defaultCurrency;
    private final String supportedCurrencies;

    public Settings() {
        this.serviceName = env("SERVICE_NAME", "axispay-service");
        this.serviceVersion = env("SERVICE_VERSION", "1.0.0");
        this.environment = env("ENVIRONMENT", "dev");
        this.logLevel = env("LOG_LEVEL", "info");
        this.port = intEnv("PORT", 8080);

        this.podName = env("POD_NAME", "local");
        this.podIp = env("POD_IP", "127.0.0.1");
        this.nodeName = env("NODE_NAME", "local");
        this.namespace = env("NAMESPACE", "local");

        this.authServiceUrl = env("AUTH_SERVICE_URL",
                "http://auth-service.axispay-edge.svc.cluster.local:8080");
        this.merchantServiceUrl = env("MERCHANT_SERVICE_URL",
                "http://merchant-service.axispay-core.svc.cluster.local:8080");
        this.paymentServiceUrl = env("PAYMENT_SERVICE_URL",
                "http://payment-service.axispay-core.svc.cluster.local:8080");
        this.customerServiceUrl = env("CUSTOMER_SERVICE_URL",
                "http://customer-service.axispay-core.svc.cluster.local:8080");
        this.fraudServiceUrl = env("FRAUD_SERVICE_URL",
                "http://fraud-service.axispay-core.svc.cluster.local:8080");
        this.routingServiceUrl = env("ROUTING_SERVICE_URL",
                "http://routing-service.axispay-core.svc.cluster.local:8080");
        this.ledgerServiceUrl = env("LEDGER_SERVICE_URL",
                "http://ledger-service.axispay-core.svc.cluster.local:8080");

        this.downstreamTimeoutSeconds = doubleEnv("DOWNSTREAM_TIMEOUT_SECONDS", 5.0);
        this.startupDelaySeconds = doubleEnv("STARTUP_DELAY_SECONDS", 0.0);
        this.enableRiskRouting = boolEnv("ENABLE_RISK_ROUTING", false);
        this.jwtSigningKey = env("JWT_SIGNING_KEY", "dev-only-not-a-real-key");
        this.tokenTtlSeconds = intEnv("TOKEN_TTL_SECONDS", 900);
        this.defaultCurrency = env("DEFAULT_CURRENCY", "ZAR");
        this.supportedCurrencies = env("SUPPORTED_CURRENCIES", "ZAR,USD,EUR,GBP,NGN,KES,BWP");
    }

    // -- env helpers ---------------------------------------------------------
    private static String env(String key, String fallback) {
        String v = System.getenv(key);
        return (v == null || v.isBlank()) ? fallback : v;
    }

    private static int intEnv(String key, int fallback) {
        String v = System.getenv(key);
        return (v == null || v.isBlank()) ? fallback : Integer.parseInt(v.trim());
    }

    private static double doubleEnv(String key, double fallback) {
        String v = System.getenv(key);
        return (v == null || v.isBlank()) ? fallback : Double.parseDouble(v.trim());
    }

    private static boolean boolEnv(String key, boolean fallback) {
        String v = System.getenv(key);
        if (v == null || v.isBlank()) {
            return fallback;
        }
        return switch (v.trim().toLowerCase()) {
            case "1", "true", "yes", "on" -> true;
            default -> false;
        };
    }

    // -- derived -------------------------------------------------------------
    public List<String> currencies() {
        List<String> out = new ArrayList<>();
        for (String c : supportedCurrencies.split(",")) {
            if (!c.isBlank()) {
                out.add(c.trim().toUpperCase());
            }
        }
        return out;
    }

    /** Resolve a downstream URL by service name, e.g. "merchant-service". */
    public String downstream(String name) {
        return switch (name) {
            case "auth-service" -> authServiceUrl;
            case "merchant-service" -> merchantServiceUrl;
            case "payment-service" -> paymentServiceUrl;
            case "customer-service" -> customerServiceUrl;
            case "fraud-service" -> fraudServiceUrl;
            case "routing-service" -> routingServiceUrl;
            case "ledger-service" -> ledgerServiceUrl;
            default -> null;
        };
    }

    // -- accessors -----------------------------------------------------------
    public String serviceName() { return serviceName; }
    public void setServiceName(String v) { this.serviceName = v; }
    public String serviceVersion() { return serviceVersion; }
    public String environment() { return environment; }
    public String logLevel() { return logLevel; }
    public int port() { return port; }
    public String podName() { return podName; }
    public String podIp() { return podIp; }
    public String nodeName() { return nodeName; }
    public String namespace() { return namespace; }
    public String authServiceUrl() { return authServiceUrl; }
    public String merchantServiceUrl() { return merchantServiceUrl; }
    public String paymentServiceUrl() { return paymentServiceUrl; }
    public String customerServiceUrl() { return customerServiceUrl; }
    public String fraudServiceUrl() { return fraudServiceUrl; }
    public String routingServiceUrl() { return routingServiceUrl; }
    public String ledgerServiceUrl() { return ledgerServiceUrl; }
    public double downstreamTimeoutSeconds() { return downstreamTimeoutSeconds; }
    public double startupDelaySeconds() { return startupDelaySeconds; }
    public boolean enableRiskRouting() { return enableRiskRouting; }
    public String jwtSigningKey() { return jwtSigningKey; }
    public int tokenTtlSeconds() { return tokenTtlSeconds; }
    public String defaultCurrency() { return defaultCurrency; }
    public String supportedCurrencies() { return supportedCurrencies; }
}
