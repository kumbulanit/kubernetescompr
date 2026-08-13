package io.axispay.common.errors;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import io.axispay.common.context.CorrelationId;

/**
 * Turns every AxisPay error into the one JSON envelope the whole platform
 * shares:
 *
 * <pre>
 *   {"error": ..., "message": ..., "detail": {...}, "correlation_id": ...}
 * </pre>
 *
 * <p>Spring's own bean-validation failure (422) is shaped to match the
 * {@code validation_errors} form the downstream HTTP client expects, so a
 * merchant gets one readable sentence rather than a nested framework object.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AxisPayError.class)
    public ResponseEntity<Map<String, Object>> handleAxisPay(AxisPayError exc) {
        return ResponseEntity.status(exc.statusCode()).body(envelope(exc.errorCode(), exc.getMessage(), exc.detail()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exc) {
        List<Map<String, Object>> errors = new ArrayList<>();
        String firstMessage = null;
        for (FieldError fe : exc.getBindingResult().getFieldErrors()) {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("loc", List.of("body", fe.getField()));
            e.put("msg", fe.getDefaultMessage());
            e.put("type", "value_error");
            errors.add(e);
            if (firstMessage == null) {
                firstMessage = fe.getField() + ": " + fe.getDefaultMessage();
            }
        }
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("validation_errors", errors);
        String message = firstMessage == null ? "validation failed" : firstMessage;
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(envelope("validation_failed", message, detail));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception exc) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(envelope("internal_error", exc.getMessage(), Map.of()));
    }

    private static Map<String, Object> envelope(String error, String message, Map<String, Object> detail) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", error);
        body.put("message", message);
        body.put("detail", detail == null ? Map.of() : detail);
        body.put("correlation_id", CorrelationId.get());
        return body;
    }
}
