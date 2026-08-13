package io.axispay.common.http;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import io.axispay.common.context.CorrelationId;
import io.axispay.common.errors.DownstreamError;
import io.axispay.common.errors.NotFoundError;
import io.axispay.common.errors.UpstreamRejectedError;

/**
 * Downstream HTTP client.
 *
 * <p>Wraps a Spring {@link RestClient} with the things every inter-service call
 * in a payment platform needs, and which students would otherwise have to
 * remember by hand:
 *
 * <ol>
 *   <li>The correlation ID is propagated automatically.</li>
 *   <li>Timeouts are always set. A call with no timeout is an outage waiting for
 *       a slow dependency — the caller's threads pile up and it fails too.</li>
 *   <li>Failures are classified correctly. A dependency that is BROKEN (timeout,
 *       connection refused, 5xx) raises {@link DownstreamError} =&gt; 502. A
 *       dependency that REJECTED the request (4xx) raises
 *       {@link UpstreamRejectedError}, which preserves the ORIGINAL status.
 *       Collapsing those two cases into one is a real and damaging bug.</li>
 *   <li>Proxy environment variables are ignored for in-cluster calls. Java's
 *       HttpClient does not honour HTTP_PROXY/HTTPS_PROXY env vars by default,
 *       so east-west traffic already behaves as the Python client's
 *       {@code trust_env=False} did — no corporate proxy hijacks a call to a
 *       {@code .svc.cluster.local} name.</li>
 * </ol>
 */
public class DownstreamClient {

    /** Parsed body plus the raw HTTP status — needed when the caller must see
     *  the downstream STATUS, not just the body (the idempotent-replay case in
     *  edge-gateway is the example). */
    public record DownstreamResponse(Map<String, Object> body, int status) {
    }

    private final String name;
    private final String baseUrl;
    private final RestClient client;

    @SuppressWarnings("unchecked")
    private static final Class<Map<String, Object>> MAP_TYPE = (Class<Map<String, Object>>) (Class<?>) Map.class;

    public DownstreamClient(String name, String baseUrl, double timeoutSeconds) {
        this.name = name;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        Duration timeout = Duration.ofMillis((long) (timeoutSeconds * 1000));
        HttpClient jdk = HttpClient.newBuilder()
                .connectTimeout(timeout)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(jdk);
        factory.setReadTimeout(timeout);
        this.client = RestClient.builder()
                .baseUrl(this.baseUrl)
                .requestFactory(factory)
                .build();
    }

    public Map<String, Object> get(String path) {
        return get(path, null);
    }

    public Map<String, Object> get(String path, Map<String, ?> params) {
        String uri = withParams(path, params);
        return request("GET", uri, null).body();
    }

    public Map<String, Object> post(String path, Map<String, ?> body) {
        return request("POST", path, body).body();
    }

    public DownstreamResponse postWithResponse(String path, Map<String, ?> body) {
        return request("POST", path, body);
    }

    @SuppressWarnings("unchecked")
    private DownstreamResponse request(String method, String path, Map<String, ?> body) {
        try {
            RestClient.RequestBodySpec spec = client.method(org.springframework.http.HttpMethod.valueOf(method))
                    .uri(path)
                    .header(CorrelationId.HEADER, CorrelationId.get());
            if (body != null) {
                spec = spec.contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(body);
            }
            return spec.exchange((request, response) -> {
                int status = response.getStatusCode().value();
                Map<String, Object> parsed = safeJson(response.bodyTo(MAP_TYPE));

                if (status == 404) {
                    throw new NotFoundError(name + ": not found", Map.of("path", path));
                }
                // 5xx — the dependency is BROKEN. Report 502 upwards.
                if (status >= 500) {
                    throw new DownstreamError(name + " returned " + status,
                            Map.of("service", name, "status", status));
                }
                // 4xx — the dependency REJECTED the request. Preserve the
                // original status and error body.
                if (status >= 400) {
                    throw rejected(status, parsed);
                }
                return new DownstreamResponse(parsed, status);
            });
        } catch (ResourceAccessException exc) {
            boolean timeout = isTimeout(exc);
            throw new DownstreamError(
                    timeout ? name + " timed out" : name + " unreachable",
                    Map.of("service", name, "url", baseUrl + path,
                            "cause", timeout ? "timeout" : String.valueOf(exc.getMessage())));
        }
    }

    private UpstreamRejectedError rejected(int status, Map<String, Object> body) {
        Object rawDetail = body.get("detail");
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("service", name);
        if (rawDetail instanceof Map<?, ?> m) {
            for (var e : m.entrySet()) {
                detail.put(String.valueOf(e.getKey()), e.getValue());
            }
        } else if (rawDetail instanceof List<?> list) {
            detail.put("validation_errors", list);
        }
        String message = firstString(body.get("message"));
        if (message == null) {
            message = firstValidationMessage(rawDetail);
        }
        if (message == null) {
            message = name + " rejected the request";
        }
        String errorCode = firstString(body.get("error"));
        if (errorCode == null && status == 422) {
            errorCode = "validation_failed";
        }
        return new UpstreamRejectedError(message, status, detail, errorCode);
    }

    public boolean probe(String path) {
        try {
            return client.get().uri(path).exchange((req, res) -> res.getStatusCode().value() < 500);
        } catch (Exception e) {
            return false;
        }
    }

    public boolean probe() {
        return probe("/healthz");
    }

    // -- helpers -------------------------------------------------------------

    private static String withParams(String path, Map<String, ?> params) {
        if (params == null || params.isEmpty()) {
            return path;
        }
        UriComponentsBuilder b = UriComponentsBuilder.fromPath(path);
        params.forEach((k, v) -> b.queryParam(k, v));
        return b.build().toUriString();
    }

    private static Map<String, Object> safeJson(Map<String, Object> parsed) {
        return parsed == null ? new LinkedHashMap<>() : parsed;
    }

    private static boolean isTimeout(Throwable exc) {
        Throwable t = exc;
        while (t != null) {
            String n = t.getClass().getSimpleName().toLowerCase();
            if (n.contains("timeout")) {
                return true;
            }
            t = t.getCause();
        }
        return false;
    }

    private static String firstString(Object value) {
        return value == null ? null : value.toString();
    }

    /** Turn a validation error list into one readable sentence. */
    @SuppressWarnings("unchecked")
    private static String firstValidationMessage(Object detail) {
        if (detail instanceof List<?> list && !list.isEmpty() && list.get(0) instanceof Map<?, ?> first) {
            Object locObj = ((Map<String, Object>) first).get("loc");
            String loc = "";
            if (locObj instanceof List<?> parts) {
                StringBuilder sb = new StringBuilder();
                for (Object p : parts) {
                    if ("body".equals(p)) {
                        continue;
                    }
                    if (sb.length() > 0) {
                        sb.append('.');
                    }
                    sb.append(p);
                }
                loc = sb.toString();
            }
            Object msgObj = ((Map<String, Object>) first).get("msg");
            String msg = msgObj == null ? "invalid value" : msgObj.toString().replace("Value error, ", "");
            return loc.isEmpty() ? msg : loc + ": " + msg;
        }
        return null;
    }
}
