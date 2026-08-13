# ==============================================================================
# AxisPay — auth-service
# Java / Spring Boot service image
# ==============================================================================
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY platform/images/pom.xml platform/images/pom.xml
COPY platform/images/axispay-common platform/images/axispay-common
COPY platform/images/auth-service platform/images/auth-service
RUN mvn -f platform/images/pom.xml -pl auth-service -am -DskipTests package

FROM eclipse-temurin:21-jre
LABEL org.opencontainers.image.title="axispay-auth-service"       org.opencontainers.image.description="AxisPay auth-service (Java / Spring Boot)"       org.opencontainers.image.vendor="Axis Financial Services (fictional)"       org.opencontainers.image.version="1.0.0"       org.opencontainers.image.licenses="MIT"       axispay.io/zone="core"

RUN groupadd --gid 10001 axispay   && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin axispay

WORKDIR /app
COPY --from=build /workspace/platform/images/auth-service/target/app.jar /app/app.jar
RUN chown -R 10001:10001 /app
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3   CMD curl -fsS http://127.0.0.1:8080/healthz >/dev/null || exit 1
ENTRYPOINT ["java","-jar","/app/app.jar"]
