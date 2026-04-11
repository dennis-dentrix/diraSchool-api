# ─────────────────────────────────────────────────────────────────────────────
# Diraschool API — Dockerfile
# Multi-stage build: keeps the final image small (no devDependencies)
#
# Build:  docker build -t diraschool-api .
# Run:    docker run -p 5000:5000 --env-file apps/api/.env diraschool-api
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
# --cache /tmp/.npm-cache avoids EBUSY conflicts when Railway mounts
# a cache volume at /app/node_modules/.cache
RUN npm ci --omit=dev --cache /tmp/.npm-cache

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Non-root user for security
RUN addgroup -S diraschool && adduser -S diraschool -G diraschool

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true

# Copy application source
COPY apps/api/src ./apps/api/src
COPY apps/api/package.json ./apps/api/

# Copy root package.json (needed for workspace resolution)
COPY package.json ./

# Create logs directory with correct ownership
RUN mkdir -p apps/api/logs && chown -R diraschool:diraschool apps/api/logs

USER diraschool

# Render / Railway auto-sets PORT — default to 5000 for Docker
ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "apps/api/src/server.js"]
