# ==============================================================================
# AxisPay — customer-service
# AxisPay customer-service
# ==============================================================================
# Built locally into the Minikube container runtime. No registry, no push, no
# pull-rate limits, works on a locked-down corporate network:
#
#     eval $(minikube -p axispay docker-env)
#     docker build -t axispay/customer-service:1.0.0 -f images/customer-service/Dockerfile .
#
# NOTE the build context is the REPOSITORY ROOT, not this directory, because
# the shared library lives in images/_shared and Docker cannot COPY from a
# parent of its context. This is a real constraint students hit the first time
# they containerise a service that shares code.
# ==============================================================================

# ---- stage 1: dependencies ---------------------------------------------------
FROM python:3.13-slim-bookworm AS deps

ENV PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /install
COPY images/_shared/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install/deps -r requirements.txt

# ---- stage 2: runtime --------------------------------------------------------
FROM python:3.13-slim-bookworm AS runtime

LABEL org.opencontainers.image.title="axispay-customer-service" \
      org.opencontainers.image.description="AxisPay customer-service" \
      org.opencontainers.image.vendor="Axis Financial Services (fictional)" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="MIT" \
      axispay.io/zone="core"

RUN groupadd --gid 10001 axispay \
 && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin axispay

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    SERVICE_NAME=customer-service \
    SERVICE_VERSION=1.0.0 \
    PORT=8080

# Only the installed packages come across from the build stage — pip itself,
# wheels, build tools and caches are left behind. Multi-stage is not just about
# size: every binary absent from the final image is one a compromised container
# cannot use.
COPY --from=deps /install/deps /usr/local

WORKDIR /app
COPY --chown=10001:10001 images/_shared/axispay_common /app/axispay_common
COPY --chown=10001:10001 images/customer-service/app /app/app

USER 10001:10001
EXPOSE 8080

# Kubernetes probes supersede HEALTHCHECK — the kubelet ignores it entirely.
# It is kept so that `docker run` and Docker Compose behave sensibly during
# local development, which is where students will first run this image.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD python3 -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/healthz',timeout=2).status==200 else 1)"

# exec form, no shell. With the shell form, PID 1 is /bin/sh, which does NOT
# forward SIGTERM to the Python process. Kubernetes would then wait the full
# terminationGracePeriodSeconds and SIGKILL the container — turning every
# rolling update on Day 2 into dropped payments. This single line is the
# difference between graceful shutdown working and silently not working.
ENTRYPOINT ["python3", "-m", "uvicorn", "app.main:app", \
            "--host", "0.0.0.0", "--port", "8080", \
            "--no-access-log", "--proxy-headers", "--timeout-graceful-shutdown", "25"]
