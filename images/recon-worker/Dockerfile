# ==============================================================================
# AxisPay — recon-worker
# Batch reconciliation - a Job, not a server
# ==============================================================================
# Built locally into the Minikube container runtime. No registry, no push, no
# pull-rate limits, works on a locked-down corporate network:
#
#     eval $(minikube -p axispay docker-env)
#     docker build -t axispay/recon-worker:1.0.0 -f images/recon-worker/Dockerfile .
#
# NOTE the build context is the REPOSITORY ROOT, not this directory, because
# the shared library lives in images/_shared and Docker cannot COPY from a
# parent of its context.
# ==============================================================================

# ---- stage 1: dependencies ---------------------------------------------------
FROM python:3.13-slim-bookworm AS deps
ENV PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /install
COPY images/_shared/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install/deps -r requirements.txt

# ---- stage 2: runtime --------------------------------------------------------
FROM python:3.13-slim-bookworm AS runtime

LABEL org.opencontainers.image.title="axispay-recon-worker" \
      org.opencontainers.image.description="Batch reconciliation - a Job, not a server" \
      org.opencontainers.image.vendor="Axis Financial Services (fictional)" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="MIT" \
      axispay.io/zone="async"

RUN groupadd --gid 10001 axispay \
 && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin axispay

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    SERVICE_NAME=recon-worker \
    SERVICE_VERSION=1.0.0 \
    PORT=8080

# Only the installed packages come across from the build stage — pip, wheels,
# build tools and caches are left behind. Every binary absent from the final
# image is one a compromised container cannot use.
COPY --from=deps /install/deps /usr/local

WORKDIR /app
COPY --chown=10001:10001 images/_shared/axispay_common /app/axispay_common
COPY --chown=10001:10001 images/recon-worker/app /app/app

USER 10001:10001

# A Job container. It runs, prints a report and EXITS — and that exit code is
# how Kubernetes decides whether the Job succeeded. No server, no port, and
# deliberately no HEALTHCHECK: there is nothing long-running to check.
ENTRYPOINT ["python3", "/app/app/main.py"]
