# Use official Bun image
FROM oven/bun:1-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

# Install dependencies
RUN bun install

# Copy source code
COPY packages/shared packages/shared/
COPY apps/api apps/api/

# Set working directory to API
WORKDIR /app/apps/api

# Build shared package if needed
RUN cd /app/packages/shared && bun run build || true

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Default environment variables for smoke tests
ENV NODE_ENV=test \
    CACHE_DRIVER=memory \
    DATABASE_URL=postgresql://smoke:test@localhost:5432/smoke \
    KEYCLOAK_URL=http://localhost:8080 \
    KEYCLOAK_REALM=smoke-test \
    JWT_SECRET=smoke-test-jwt-secret-not-for-production \
    BMAC_WEBHOOK_SECRET=smoke-test-webhook

# Run the application directly
CMD ["bun", "run", "start:dev"]
