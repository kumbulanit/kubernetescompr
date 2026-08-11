"""Downstream HTTP client.

Wraps httpx with the three things every inter-service call in a payment
platform needs, and which students would otherwise have to remember by hand:

  1. The correlation ID is propagated automatically.
  2. Timeouts are always set. A call with no timeout is an outage waiting for
     a slow dependency — the caller's threads pile up and it fails too.
  3. Failures are classified correctly. A dependency that is BROKEN (timeout,
     connection refused, 5xx) raises DownstreamError -> 502. A dependency that
     REJECTED the request (4xx) raises UpstreamRejectedError, which preserves
     the ORIGINAL status. Collapsing those two cases into one is a real and
     damaging bug — see errors.py for what it costs.
  4. Proxy environment variables are IGNORED for in-cluster calls.

On point 4 — this is worth understanding, because it bites real platforms.

Many enterprises inject HTTP_PROXY / HTTPS_PROXY / ALL_PROXY into every
container to force egress through a corporate proxy. HTTP clients honour those
variables by default, so a call to

    http://merchant-service.axispay-core.svc.cluster.local:8080

would be sent to the corporate proxy — which has never heard of a cluster-
internal DNS name and cannot route to a pod IP. The symptom is baffling:
the Service exists, the Endpoints are populated, DNS resolves correctly from
inside the pod, and the call still fails.

`trust_env=False` makes east-west traffic ignore proxy configuration entirely,
which is what you almost always want inside a cluster. If a service genuinely
needs to reach the internet through a proxy (an acquirer API, say), that client
is created separately with `trust_env=True` and NO_PROXY set for
`.svc.cluster.local`.
"""
import logging
from typing import Any, Dict, Optional, Tuple

import httpx

from axispay_common.context import HEADER, correlation_id
from axispay_common.errors import DownstreamError, NotFoundError, UpstreamRejectedError

log = logging.getLogger(__name__)


class DownstreamClient:
    def __init__(self, name: str, base_url: str, timeout: float = 5.0, trust_env: bool = False) -> None:
        self.name = name
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=timeout,
            trust_env=trust_env,          # see module docstring, point 4
            # Connection pooling. Without limits, a burst of merchant traffic
            # opens an unbounded number of sockets to a downstream service and
            # exhausts its file descriptors before it exhausts its CPU.
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def get(self, path: str, **kw: Any) -> Dict[str, Any]:
        return await self._request("GET", path, **kw)

    async def post(self, path: str, json: Optional[Dict[str, Any]] = None, **kw: Any) -> Dict[str, Any]:
        return await self._request("POST", path, json=json, **kw)

    async def post_with_response(
        self, path: str, json: Optional[Dict[str, Any]] = None, **kw: Any
    ) -> Tuple[Dict[str, Any], httpx.Response]:
        """POST, returning the parsed body AND the raw response.

        Needed when the caller must see the downstream STATUS, not just the
        body — the idempotent-replay case in edge-gateway is the example.
        """
        return await self._request("POST", path, json=json, _return_response=True, **kw)

    async def _request(self, method: str, path: str, _return_response: bool = False, **kw: Any) -> Any:
        headers = dict(kw.pop("headers", {}))
        headers[HEADER] = correlation_id()
        try:
            response = await self._client.request(method, path, headers=headers, **kw)
        except httpx.TimeoutException as exc:
            raise DownstreamError(
                f"{self.name} timed out",
                {"service": self.name, "url": f"{self.base_url}{path}", "cause": "timeout"},
            ) from exc
        except httpx.HTTPError as exc:
            # Almost always DNS failure or connection refused. On Day 4 students
            # see this exact message when a NetworkPolicy blocks the call.
            raise DownstreamError(
                f"{self.name} unreachable",
                {"service": self.name, "url": f"{self.base_url}{path}", "cause": str(exc)},
            ) from exc

        if response.status_code == 404:
            raise NotFoundError(f"{self.name}: not found", {"path": path})

        # 5xx — the dependency is BROKEN. Report 502 upwards.
        if response.status_code >= 500:
            raise DownstreamError(
                f"{self.name} returned {response.status_code}",
                {"service": self.name, "status": response.status_code},
            )

        # 4xx — the dependency REJECTED the request. Preserve the original
        # status and error body. See UpstreamRejectedError in errors.py for
        # why collapsing this into a 502 is a genuinely damaging bug.
        if response.status_code >= 400:
            body = _safe_json(response)
            # `detail` has two shapes and both must be handled:
            #   * AxisPay services return a dict  -> {"detail": {"currency": "XYZ"}}
            #   * FastAPI's own request validation returns a LIST of errors
            #     -> {"detail": [{"loc": [...], "msg": "...", "type": "..."}]}
            # Assuming a dict and splatting it with ** raises TypeError on the
            # list form, which turns a clean 422 into a 500 — the exact failure
            # this class exists to prevent. Found by testing; kept as a lesson.
            raw_detail = body.get("detail")
            if isinstance(raw_detail, dict):
                detail = {"service": self.name, **raw_detail}
            elif isinstance(raw_detail, list):
                detail = {"service": self.name, "validation_errors": raw_detail}
            else:
                detail = {"service": self.name}

            message = body.get("message") or _first_validation_message(raw_detail) \
                or f"{self.name} rejected the request"
            raise UpstreamRejectedError(
                message=message,
                status_code=response.status_code,
                detail=detail,
                error_code=body.get("error") or ("validation_failed" if response.status_code == 422 else None),
            )

        body = _safe_json(response)
        return (body, response) if _return_response else body

    async def probe(self, path: str = "/healthz") -> bool:
        """Used as a readiness check against a dependency."""
        try:
            r = await self._client.get(path, timeout=2.0)
            return r.status_code < 500
        except Exception:
            return False


def _first_validation_message(detail: Any) -> Optional[str]:
    """Turn FastAPI's validation error list into one readable sentence.

    A merchant should get "currency: unsupported currency XYZ", not a nested
    JSON array describing pydantic's internal error model.
    """
    if isinstance(detail, list) and detail:
        first = detail[0]
        if isinstance(first, dict):
            loc = ".".join(str(p) for p in first.get("loc", []) if p not in ("body",))
            msg = first.get("msg", "invalid value")
            msg = msg.replace("Value error, ", "")
            return f"{loc}: {msg}" if loc else msg
    return None


def _safe_json(response: httpx.Response) -> Dict[str, Any]:
    try:
        body = response.json()
        return body if isinstance(body, dict) else {"data": body}
    except Exception:
        return {"raw": response.text[:500]}
