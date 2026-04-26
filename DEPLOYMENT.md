# Deployment guide

This guide covers production deployment of the Gutu admin panel + plugin
ecosystem. The system is plugin-driven, stateless, and ready for container
orchestrators (Kubernetes, ECS, Fly.io, Railway).

## 1. Prerequisites

- Bun 1.3+ (or Node 20+ with `bun` installed)
- A persistent volume for SQLite (`DB_PATH`) — or migrate to Postgres
- Object storage for files in production (`STORAGE_BACKENDS_JSON`)
- A reverse proxy / load balancer that terminates TLS

## 2. Required environment variables

```bash
# Production marker — refuses to boot with weak defaults
NODE_ENV=production

# Persistent storage signing key — REQUIRED in production.
# Without this, every restart invalidates issued presigned URLs.
STORAGE_SIGNING_KEY=$(openssl rand -hex 32)

# CORS allowlist — required in production. Without this, all
# cross-origin requests are refused.
CORS_ORIGINS=https://app.example.com,https://admin.example.com

# Database location (defaults to `data.db` next to the backend)
DB_PATH=/var/lib/gutu/data.db

# Files root for the local storage adapter (or use S3 via STORAGE_BACKENDS_JSON)
FILES_ROOT=/var/lib/gutu/files

# Multi-tenant configuration (if applicable)
MULTISITE=1
```

## 3. Optional environment variables

```bash
# Plugin discovery (env overrides package.json["gutuPlugins"]).
# Useful for narrow deploys where you want a subset of the catalog.
GUTU_PLUGINS=@gutu-plugin/accounting-core,@gutu-plugin/sales-core,...

# Permission enforcement mode (default: warn)
#   enforce — throw on plugin permission violations
#   warn    — log on violations, allow
#   off     — disable
GUTU_PERMISSIONS=enforce

# Rate limiting (defaults shown)
RATE_MAX=600                 # requests per window per IP
RATE_WINDOW_MS=60000         # window length

# Body size cap (defaults to 5 MB)
MAX_BODY_BYTES=5242880

# Trust X-Forwarded-For from the proxy
TRUST_PROXY=1

# HSTS max-age (default 1 year)
HSTS_MAX_AGE=31536000

# Graceful drain timeout on SIGTERM (default 25s)
DRAIN_TIMEOUT_MS=25000

# Storage adapters (S3 example)
STORAGE_BACKENDS_JSON='[{"id":"default","kind":"s3","bucket":"my-bucket","region":"us-east-1"}]'
```

## 4. Container deployment

```bash
docker build -t gutu-admin .
docker run -d --name gutu-admin \
  -p 3333:3333 \
  -v gutu-data:/var/lib/gutu \
  -e NODE_ENV=production \
  -e STORAGE_SIGNING_KEY=... \
  -e CORS_ORIGINS=https://app.example.com \
  gutu-admin
```

See `Dockerfile` at the repo root.

## 5. Health probes

| Endpoint | Use as | Expected |
|---|---|---|
| `GET /api/health` | Kubernetes `livenessProbe` | always 200 once the process is up |
| `GET /api/ready` | Kubernetes `readinessProbe` | 503 during boot/drain, 200 when serving |
| `GET /api/_metrics` | Operator dashboards | per-route + per-plugin metrics, leases |

Example k8s probe:
```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3333
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /api/ready
    port: 3333
  periodSeconds: 5
  failureThreshold: 3
```

## 6. Horizontal scaling

The system is designed for multiple replicas behind a load balancer:

- **Schema**: SQLite is single-writer per file. For multiple replicas
  use a shared volume with WAL mode (already configured) — but throughput
  is limited. For real scale, swap the DB layer for Postgres via
  `dbx`. Plugins use `@gutu-host` exclusively, so the swap doesn't
  touch plugin code.
- **Workers**: every cluster-singleton worker is wrapped in
  `withLeadership()` from `@gutu-host/leader`. Multiple replicas elect
  one leader per worker via lease rows in `meta` table. If the leader
  crashes, lease expires and another replica picks up.
- **Rate limiting**: backed by the `rate_limit_buckets` table — shared
  across replicas. No need for a separate Redis.
- **Sessions / auth**: stored in SQLite; every replica authenticates
  the same Bearer token.

## 7. Graceful shutdown

`SIGTERM` triggers:

1. `/api/ready` flips to 503 → load balancer takes the pod out of rotation.
2. `drainMiddleware` refuses NEW requests with 503 + `Retry-After`.
3. In-flight requests complete (up to `DRAIN_TIMEOUT_MS`).
4. `stopPlugins()` runs every plugin's `stop()` hook in reverse-topo order.
5. `process.exit(0)`.

Set the orchestrator's `terminationGracePeriodSeconds` to ≥ `DRAIN_TIMEOUT_MS / 1000 + 5`.

## 8. Backup / restore

SQLite supports online backup. A simple `.backup` to a remote object store
is enough for most workloads:

```bash
# Hourly backup script
sqlite3 $DB_PATH ".backup '/tmp/gutu-$(date +%s).db'"
aws s3 cp /tmp/gutu-*.db s3://my-backups/gutu/
rm /tmp/gutu-*.db
```

Restore: stop the backend, `cp` the backup to `$DB_PATH`, start the backend.
The plugin loader will run idempotent migrations on boot.

## 9. Security checklist

- [ ] `STORAGE_SIGNING_KEY` set with ≥32 hex chars
- [ ] `CORS_ORIGINS` set explicitly (NOT empty in production)
- [ ] TLS terminator in front (HSTS is sent assuming TLS)
- [ ] `TRUST_PROXY=1` if behind a known proxy (so X-Forwarded-For is honored)
- [ ] `GUTU_PERMISSIONS=enforce` after auditing every plugin's manifest
- [ ] Volume snapshots of `$DB_PATH` enabled
- [ ] Audit log integrity verified periodically: `GET /api/audit/verify`
- [ ] Rate limit defaults reviewed against expected traffic

## 10. Verifying the deployment

```bash
# Boot ready
curl https://api.example.com/api/ready
# {"ready":true,"booting":false,"draining":false,"inFlight":1,"uptimeMs":...}

# 25 plugins discovered + healthy
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/api/_plugins
# { rows: [...], counts ... }

# Audit chain integrity
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://api.example.com/api/audit/verify
# {"ok":true,"total":N,"legacyAccepted":M}

# Cluster singletons (one row per leader-elected worker)
curl -H "Authorization: Bearer $TOKEN" https://api.example.com/api/_plugins/_leases
# Six rows. `mine: true` on the replica that holds each lease.
```
