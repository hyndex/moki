# Multi-stage Dockerfile for the Gutu admin backend + plugin ecosystem.
#
# Stage 1: install deps + build
# Stage 2: minimal runtime image with just bun + the built tree
#
# Build:
#   docker build -t gutu-admin .
# Run:
#   docker run -d -p 3333:3333 \
#     -v gutu-data:/var/lib/gutu \
#     -e NODE_ENV=production \
#     -e STORAGE_SIGNING_KEY=$(openssl rand -hex 32) \
#     -e CORS_ORIGINS=https://app.example.com \
#     gutu-admin

# ---------- Stage 1: build ----------
FROM oven/bun:1.3 AS builder
WORKDIR /app

# Copy lockfile + workspace manifests first for layer caching.
COPY package.json bun.lock bunfig.toml* ./
COPY admin-panel/package.json admin-panel/
COPY admin-panel/backend/package.json admin-panel/backend/
COPY plugins/ plugins/
COPY admin-panel/ admin-panel/

# Install. Bun's workspaces resolve plugin packages from the local tree.
RUN bun install --frozen-lockfile

# Build the frontend (vite produces a static dist/ directory).
RUN cd admin-panel && bun run build || echo "skip frontend build"

# ---------- Stage 2: runtime ----------
FROM oven/bun:1.3-slim
WORKDIR /app

ENV NODE_ENV=production \
    DB_PATH=/var/lib/gutu/data.db \
    FILES_ROOT=/var/lib/gutu/files

# Copy only what we need at runtime: backend src, plugins src, lockfile,
# admin-panel source (for vite to resolve plugin uis at runtime in dev),
# node_modules.
COPY --from=builder /app/admin-panel/backend ./admin-panel/backend
COPY --from=builder /app/admin-panel ./admin-panel
COPY --from=builder /app/plugins ./plugins
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/admin-panel/node_modules ./admin-panel/node_modules

# Persistent data volume.
RUN mkdir -p /var/lib/gutu/files
VOLUME ["/var/lib/gutu"]

# Non-root user.
RUN addgroup --system --gid 1001 gutu && \
    adduser --system --uid 1001 --gid 1001 gutu && \
    chown -R gutu:gutu /var/lib/gutu /app
USER gutu

EXPOSE 3333
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3333/api/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

WORKDIR /app/admin-panel/backend
CMD ["bun", "run", "src/main.ts"]
