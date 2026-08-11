"""Structured JSON logging.

Logs go to stdout as one JSON object per line. Nothing is written to a file.

That is not a style preference — it is the contract a container has with its
platform. The kubelet captures stdout; `kubectl logs` reads it; on Day 5, Alloy
ships it to Loki. A service that writes to /var/log/app.log inside its own
container produces logs nobody can read and that vanish when the pod restarts.
Students meet this rule on Day 1 and see the payoff on Day 5.
"""
import json
import logging
import sys
from typing import Any, Dict

from axispay_common.context import correlation_id


class JsonFormatter(logging.Formatter):
    def __init__(self, service: str, version: str, pod: str, environment: str) -> None:
        super().__init__()
        self.base: Dict[str, Any] = {
            "service": service, "version": version, "pod": pod, "env": environment,
        }

    def format(self, record: logging.LogRecord) -> str:
        payload: Dict[str, Any] = dict(self.base)
        payload.update({
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
            "correlation_id": correlation_id(),
        })
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        for key, value in getattr(record, "extra_fields", {}).items():
            payload[key] = value
        return json.dumps(payload, default=str)


def configure_logging(service: str, version: str, pod: str, environment: str, level: str = "info") -> logging.Logger:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(service, version, pod, environment))

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # uvicorn's own access log duplicates ours and is not JSON — silence it.
    logging.getLogger("uvicorn.access").handlers.clear()
    logging.getLogger("uvicorn.access").propagate = False

    # httpx logs every outbound call at INFO ("HTTP Request: POST ... 200 OK").
    # That is one extra line per downstream hop, for no information we do not
    # already record ourselves — and on Day 5 it would roughly double Loki
    # ingest for nothing. Raise it to WARNING so failures still surface.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    return logging.getLogger(service)


def log_with(logger: logging.Logger, level: str, msg: str, **fields: Any) -> None:
    logger.log(getattr(logging, level.upper(), logging.INFO), msg, extra={"extra_fields": fields})
