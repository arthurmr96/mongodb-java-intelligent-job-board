# ── Stage 1: Build the Spring Boot fat-jar ────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app
COPY pom.xml .
COPY src ./src

# Download dependencies first (cached layer if pom.xml hasn't changed)
RUN apk add --no-cache maven && mvn dependency:go-offline -q

# Build the fat jar, skipping tests in the Docker build
RUN mvn package -DskipTests -q

# ── Stage 2: Runtime image ─────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar

# Expose the Spring Boot default port
EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
