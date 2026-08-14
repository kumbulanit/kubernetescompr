# ==============================================================================
# AxisPay — routing-service
# Java / Spring Boot service image
# ==============================================================================
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY platform/images platform/images
RUN mvn -f platform/images/pom.xml -pl routing-service -am -DskipTests package

FROM eclipse-temurin:21-jre
LABEL org.opencontainers.image.title="axispay-routing-service"       org.opencontainers.image.description="AxisPay routing-service (Java / Spring Boot)"       org.opencontainers.image.vendor="Axis Financial Services (fictional)"       org.opencontainers.image.version="1.0.0"       org.opencontainers.image.licenses="MIT"       axispay.io/zone="core"

RUN groupadd --gid 10001 axispay   && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin axispay

WORKDIR /app
COPY --from=build /workspace/platform/images/routing-service/target/app.jar /app/app.jar
RUN chown -R 10001:10001 /app
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3   CMD curl -fsS http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["java","-jar","/app/app.jar"]
