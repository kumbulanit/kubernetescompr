package io.axispay.common.context;

import java.io.IOException;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Accepts an inbound correlation ID or mints one, binds it to the MDC for the
 * duration of the request, and always echoes it back on the response.
 *
 * <p>Ordered as the OUTERMOST filter so the metrics and error layers can both
 * see the correlation ID — the same middleware ordering the Python platform
 * used.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String cid = CorrelationId.set(request.getHeader(CorrelationId.HEADER));
        response.setHeader(CorrelationId.HEADER, cid);
        try {
            chain.doFilter(request, response);
        } finally {
            CorrelationId.clear();
        }
    }
}
