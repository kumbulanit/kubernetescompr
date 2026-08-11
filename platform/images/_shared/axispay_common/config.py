"""Environment-driven configuration.

Every AxisPay service reads the same variable names. On Day 1 these come from
the pod spec; from Day 3 they come from ConfigMaps and Secrets. The service
code does not change — that is the point of externalised configuration, and
students see it happen without a single line of Python being edited.
"""
from functools import lru_cache
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # --- identity -------------------------------------------------------
    service_name: str = Field(default="axispay-service")
    service_version: str = Field(default="1.0.0")
    environment: str = Field(default="dev")
    log_level: str = Field(default="info")
    port: int = Field(default=8080)

    # --- Downward API: injected by Kubernetes from the pod spec ----------
    # Introduced on Day 1 so that /api/v1/_info can report which pod answered.
    # That single field is how students PROVE load balancing (D1), rollout
    # progress (D2) and anti-affinity spread (D4).
    pod_name: str = Field(default="local")
    pod_ip: str = Field(default="127.0.0.1")
    node_name: str = Field(default="local")
    namespace: str = Field(default="local")

    # --- downstream services (cluster DNS names from Day 1) -------------
    auth_service_url: str = Field(default="http://auth-service.axispay-edge.svc.cluster.local:8080")
    merchant_service_url: str = Field(default="http://merchant-service.axispay-core.svc.cluster.local:8080")
    payment_service_url: str = Field(default="http://payment-service.axispay-core.svc.cluster.local:8080")
    customer_service_url: str = Field(default="http://customer-service.axispay-core.svc.cluster.local:8080")
    fraud_service_url: str = Field(default="http://fraud-service.axispay-core.svc.cluster.local:8080")
    routing_service_url: str = Field(default="http://routing-service.axispay-core.svc.cluster.local:8080")
    ledger_service_url: str = Field(default="http://ledger-service.axispay-core.svc.cluster.local:8080")

    # --- behaviour ------------------------------------------------------
    downstream_timeout_seconds: float = Field(default=5.0)
    startup_delay_seconds: float = Field(default=0.0)   # simulates slow start for the startup-probe lab

    # Feature flag introduced on Day 2. When false, payment-service uses the
    # Day 1 flow (merchant lookup only). When true it also calls fraud-service
    # and routing-service. L2.6 rolls out 1.0.0 -> 1.1.0 with this enabled.
    enable_risk_routing: bool = Field(default=False)
    jwt_signing_key: str = Field(default="dev-only-not-a-real-key")
    token_ttl_seconds: int = Field(default=900)

    default_currency: str = Field(default="ZAR")
    supported_currencies: str = Field(default="ZAR,USD,EUR,GBP,NGN,KES,BWP")

    @property
    def currencies(self) -> List[str]:
        return [c.strip().upper() for c in self.supported_currencies.split(",") if c.strip()]

    def downstream(self, name: str) -> Optional[str]:
        return getattr(self, f"{name.replace('-', '_')}_url", None)


@lru_cache
def get_settings() -> Settings:
    return Settings()
