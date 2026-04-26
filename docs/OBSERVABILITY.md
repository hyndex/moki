# Observability

Logs, metrics, tracing, health probes, plugin status, leases, alerting
recipes.

> Pair with `RUNBOOK.md` (what to do when something's wrong) and
> `DEPLOYMENT.md` (how to wire probes into your platform).

---

## 1. Health vs readiness

Two distinct probes:

### `/api/health` — liveness
Always 200 if the process is alive. Doesn't touch dependencies. Use as
Kubernetes `livenessProbe`.

```bash
curl https://api.example.com/api/health
# {"status":"ok","time":"2026-04-26T12:34:56.789Z"}
```

### `/api/ready` — readiness
Returns 503 during boot OR drain. 200 only when fully serving. Use as
Kubernetes `readinessProbe`.

```bash
curl https://api.example.com/api/ready
# {"ready":true,"booting":false,"draining":false,"inFlight":3,"uptimeMs":12345}
# OR
# {"ready":false,"reason":"booting","booting":true,"inFlight":0,"uptimeMs":120}
# 503
```

### k8s example

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3333
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /api/ready
    port: 3333
  periodSeconds: 5
  failureThreshold: 3
  initialDelaySeconds: 5
```

---

## 2. Structured logs

Every request emits exactly one JSON line:

```json
{
  "ts": "2026-04-26T12:34:56.789Z",
  "level": "info",
  "method": "GET",
  "path": "/api/resources/crm.contact",
  "status": 200,
  "dur_ms": 12,
  "traceId": "685803f724954b54",
  "user": "chinmoy@gutu.dev",
  "tenant": "6763edf4-..."
}
```

`level` is derived: `error` for 5xx, `warn` for 4xx, `info` otherwise.
`user` + `tenant` are best-effort — populated after auth + tenant
middleware run.

### Customising the sink

```ts
import { setLogSink } from "@gutu-host";

setLogSink((line) => {
  // ship to Datadog, Loki, etc.
  myDatadogClient.log(line);
});
```

By default the sink is `console.log` — your container runtime's stdout
collector picks it up.

### Trace ID propagation

Every request gets `X-Request-ID` (echoed in the response). Clients
should propagate inbound `X-Request-ID` if they have one (e.g. from a
public-API call originating in a customer's system). The shell honours
inbound `X-Request-ID` and uses it instead of generating one.

---

## 3. Metrics

`GET /api/_metrics` (auth required) returns a JSON snapshot:

```json
{
  "lifecycle": {
    "booting": false,
    "draining": false,
    "inFlight": 2,
    "uptimeMs": 1234567
  },
  "process": {
    "pid": 12345,
    "uptimeMs": 1234567,
    "memory": { "rss": 230076416, "heapTotal": ..., ... }
  },
  "leases": [
    { "name": "notifications:dispatcher", "holderId": "63924:a9fq21m", "mine": true, "expiresAt": "..." },
    ...
  ],
  "plugins": [
    { "id": "fleet-core", "version": "1.0.0", "status": "loaded", "errorCount": 0 },
    ...
  ],
  "routes": [
    { "route": "GET /api/resources/:id", "count": 4231, "errors": 0,
      "durAvgMs": 8, "durMinMs": 1, "durMaxMs": 142 },
    { "route": "POST /api/webhooks", "count": 12, "errors": 0,
      "durAvgMs": 45, "durMinMs": 30, "durMaxMs": 89 },
    ...
  ]
}
```

Cardinality is collapsed: ID-shaped path segments (UUIDs, integers)
become `:id` and `:n` so the route count doesn't explode.

### Scraping into Prometheus

Wrap the JSON in a thin adapter:
```ts
// scripts/metrics-prom.ts
const r = await apiFetch("/api/_metrics");
let out = "";
for (const route of r.routes) {
  out += `# HELP gutu_route_count Total requests by route\n# TYPE gutu_route_count counter\n`;
  out += `gutu_route_count{route="${route.route}"} ${route.count}\n`;
}
console.log(out);
```

Or use a Grafana JSON data source — `/api/_metrics` is already in the
right shape.

---

## 4. Plugin status

`GET /api/_plugins` (auth required) lists every loaded plugin with
manifest, status, errors, ws routes, per-tenant enablement:

```json
{
  "rows": [
    {
      "id": "webhooks-core",
      "version": "1.0.0",
      "manifest": {
        "label": "Webhooks",
        "description": "Outbound HTTP webhooks ...",
        "icon": "Webhook",
        "vendor": "gutu",
        "permissions": ["db.read", "db.write", "audit.write", "events.subscribe", "net.outbound"]
      },
      "status": "loaded",
      "errors": [],
      "installedAt": "2026-04-25T...",
      "startedAt": "2026-04-26T...",
      "enabledForTenant": true,
      "health": { "ok": true },
      "routes": ["/webhooks"],
      "ws": [],
      "provides": [],
      "consumes": [],
      "dependsOn": []
    },
    ...
  ]
}
```

### Status values

| Status | Meaning |
|---|---|
| `loaded` | Healthy. Migrate + start succeeded. |
| `quarantined` | Migrate, install, mount, or start failed. `errors[]` lists what went wrong. |
| `disabled` | Operator-disabled at the tenant level. (Per-row check via `enabledForTenant`.) |
| `unknown` | Edge case — record exists but status not yet computed. |

### Single-plugin detail

`GET /api/_plugins/<id>` returns one row.

### Operator actions

```bash
# Disable for current tenant
curl -X POST -H "Authorization: Bearer $T" \
  -d '{"pluginId":"fleet-core","enabled":false}' \
  /api/_plugins/_enablement

# Trigger uninstall hook
curl -X POST -H "Authorization: Bearer $T" \
  /api/_plugins/fleet-core/uninstall
```

---

## 5. Leases (cluster-singleton workers)

`GET /api/_plugins/_leases` shows every active leader-elected worker:

```json
{
  "rows": [
    { "name": "notifications:dispatcher", "holderId": "63924:a9fq21m", "mine": true, "expiresAt": "2026-04-26T12:35:30Z" },
    { "name": "notifications:scheduler", "holderId": "63924:a9fq21m", "mine": true, "expiresAt": "2026-04-26T12:35:30Z" },
    { "name": "webhooks:dispatcher", "holderId": "63924:a9fq21m", "mine": true, "expiresAt": "2026-04-26T12:35:30Z" },
    { "name": "workflow:engine", "holderId": "63924:a9fq21m", "mine": true, "expiresAt": "2026-04-26T12:35:30Z" },
    { "name": "timeline:writer", "holderId": "63924:a9fq21m", "mine": true, "expiresAt": "2026-04-26T12:35:30Z" },
    { "name": "analytics:auto-email", "holderId": "63924:a9fq21m", "mine": true, "expiresAt": "2026-04-26T12:35:30Z" }
  ]
}
```

`holderId` is `<pid>:<random>` — uniquely identifies a backend
instance. `mine: true` means the responding instance owns the lease.

### Healthy invariants

- 6 lease rows present (one per cluster-singleton worker)
- Every `expiresAt` in the future
- Across N replicas, the same lease name should be held by exactly ONE
  replica (verify by polling each replica's `/api/_plugins/_leases`)

### Failure modes

- **No row for a lease** — plugin's `start()` failed. Check
  `/api/_plugins` for the plugin's status + errors.
- **Stale lease (expired)** — old leader crashed; some other replica
  should pick up within `ttlMs`. If not, all replicas are unhealthy.
- **Two replicas claiming the same lease** — clock skew or DB
  corruption. Investigate immediately.

---

## 6. Audit log integrity

```bash
GET /api/audit/verify       # admin only
```

Returns:
```json
{ "ok": true, "total": 8912, "legacyAccepted": 829 }
```
or
```json
{
  "ok": false,
  "total": 8912,
  "legacyAccepted": 829,
  "firstBreakAt": {
    "id": "...",
    "occurredAt": "2026-04-25T03:14:15Z",
    "expected": "<sha256>",
    "actual": "<sha256>"
  }
}
```

### Recommended cron

Daily verify:
```bash
# /etc/cron.daily/gutu-audit-verify
#!/bin/bash
RESULT=$(curl -s -H "Authorization: Bearer $GUTU_ADMIN_TOKEN" \
  https://api.example.com/api/audit/verify)
OK=$(echo "$RESULT" | jq -r .ok)
if [ "$OK" != "true" ]; then
  echo "$RESULT" | mail -s "Gutu audit chain BROKEN" oncall@example.com
fi
```

---

## 7. The four-suite test harness

The test suites also serve as observability — running them periodically
catches regressions:

```bash
cd admin-panel
bun run scripts/e2e-crud.ts            # 53 CRUD scenarios
bun run scripts/visual-smoke.ts        # 10 page renders
bun run scripts/visual-interactions.ts # 10 dialogs
bun run scripts/bug-hunt.ts            # 76 adversarial probes
```

Recommended: run on every deploy + nightly via cron + on-demand from
the runbook.

---

## 8. Common signals

### "5xx error rate spiking"

1. Check `/api/_metrics` → which routes have `errors > 0`?
2. Check stdout — find the `"level":"error"` lines with that path
3. `traceId` from logs lets you correlate user-side reports
4. If a single plugin's routes are 5xx'ing, check `/api/_plugins` for
   that plugin's `status` + `errors[]`

### "Latency p99 climbing"

1. Check `/api/_metrics` `routes[].durMaxMs` — find the slow route
2. Query SQLite: `EXPLAIN QUERY PLAN SELECT ... FROM ...` for the
   route's main query
3. Check WAL size: `ls -lh data.db-wal` — if huge, run a checkpoint
   (`db.exec("PRAGMA wal_checkpoint(TRUNCATE)")`)

### "Memory growing"

1. Check `/api/_metrics` `process.memory.rss`
2. Heap snapshots: `bun --inspect src/main.ts` then Chrome DevTools
3. Common culprits: unbounded event-bus subscribers, leaked plugin
   workers (forgot to call stop()), accumulated lease attempts after a
   plugin crash

### "Worker stopped firing"

1. Check `/api/_plugins/_leases` — is the lease still held?
2. If yes, check the holder replica's logs for errors
3. If no, check `/api/_plugins` — plugin quarantined?

### "Audit log shows tampering"

1. `/api/audit/verify` reports `ok: false`
2. `firstBreakAt.occurredAt` tells you when
3. Restore from the backup taken just before that timestamp
4. Investigate who had access in that window

---

## 9. Recommended dashboards

If you're using Grafana / similar, these are the panels worth building:

### Per-instance
- RSS memory over time
- Request rate (per minute)
- Latency p50/p95/p99 (from `routes[]`)
- 5xx rate (from `routes[].errors`)
- WAL file size

### Per-tenant
- Request rate by tenant (parse from log lines)
- Plugins enabled vs total
- Audit events per minute
- ACL grants (rare — spike indicates ops activity)

### Per-plugin
- Quarantined plugin count (should be 0)
- Plugin route latency
- Worker leases held (should be exactly N=expected)

---

## 10. Alerts

Sensible defaults:

| Alert | Condition | Severity |
|---|---|---|
| API down | `/api/health` fails 3 consecutive 10s probes | page |
| Not ready | `/api/ready` 503 for > 60s | page |
| 5xx spike | `>1%` 5xx rate over 5min | page |
| Audit chain broken | `audit/verify ok=false` | page |
| Plugin quarantined | `/api/_plugins` row with status=quarantined | warn |
| Lease missing | Expected lease not in `/api/_plugins/_leases` for >2 min | warn |
| Latency p99 | `>1000ms` over 10min | warn |
| Memory | `process.memory.rss` > 80% of container limit | warn |
| Disk | `data.db` > 80% of volume | warn |

---

## 11. Logs to send to your aggregator

The structured JSON log is one line per request. Every log line has:
- `ts`, `level`, `method`, `path`, `status`, `dur_ms`, `traceId`, `user`, `tenant`

For non-request logs (boot, shutdown, plugin status), the format
varies. Things to send:

- `[plugin-host] discovered N plugin(s): ...` — boot
- `[plugin-host] migrate failed for X@Y: ...` — quarantine
- `[plugin-host] start failed for X: ...` — quarantine
- `[storage] ...` — adapter selection
- `[lifecycle] drain begin; in-flight=N` — shutdown
- `[lifecycle] drain done in Nms` — shutdown
- `[rate-limit] check failed; failing open: ...` — anomaly

A grep for `level=error` or `failed` should cover most operational
issues.

---

## 12. Recommended client behaviour

For consumers of the API (mobile apps, integrations):

- Always send `X-Request-ID` (UUID per request) — the server echoes it,
  giving you end-to-end correlation
- Honour `Retry-After` on 429 / 503 responses
- Honour `X-RateLimit-Limit` and `X-RateLimit-Remaining` to throttle
  proactively
- Cache `GET /api/resources/<r>` responses with `ETag` (TODO: not
  implemented yet — coming in v2)
- Reconnect WS upgrades with exponential backoff (start 1s, max 30s)

---

## 13. End-to-end troubleshooting flow

```
User reports problem
  ↓
Have a traceId? → grep logs by traceId → find the failing endpoint
  ↓ no
Hit /api/_plugins → any quarantined plugins?
  ↓ no
Hit /api/_metrics → spike in routes[]?
  ↓ no
Hit /api/_plugins/_leases → all leases healthy?
  ↓ no
Check stdout for ERROR / WARN lines around the timestamp
  ↓ no
Run the 4 test suites against the affected env → reproduce in test
  ↓ ...
```

The test suites are deterministic + fast (~3 minutes total). When in
doubt, run them first.
