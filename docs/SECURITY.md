# Security

Auth flow, permissions, audit log, GDPR, secrets, threat model.

> Pair with `OBSERVABILITY.md` (how to detect attacks) and `DEPLOYMENT.md`
> (how to harden the perimeter).

---

## 1. Threat model

The shell's threat model assumes:

| Trust | Trusted | Notes |
|---|---|---|
| Plugin code (first-party) | ✅ | Reviewed before adding to gutuPlugins |
| Plugin code (third-party) | ⚠️ | Permissions enforced; sandbox is future work |
| Tenant operators | ⚠️ | Can read all tenant data; can't escalate to other tenants |
| Tenant members | ❌ | RBAC + ACL enforced on every record |
| Public links | ❌ | Token-scoped, no other access |
| Anonymous traffic | ❌ | Refused unless route is explicitly public |

**Out of scope for v1:** plugin sandboxing (full DB + FS access for
loaded plugins), encrypted-at-rest databases (deferred to deployment
storage), formally-verified crypto.

---

## 2. Auth flow

### 2.1 Sign-in

```
POST /api/auth/sign-in
  body: { email, password }
  → 200 { token, user, tenants }
  → 401 if creds bad
  → 403 if email-verify required
  → 412 if MFA required (returns mfaToken)
```

The token is a 32-byte URL-safe random session token, stored in
`sessions` table with expiry.

### 2.2 MFA

If the user has `mfa_enabled = 1`:
```
POST /api/auth/sign-in        → 412 { mfaToken }
POST /api/auth/sign-in/mfa    body: { mfaToken, code }
                              → 200 { token, user, tenants }
```

Codes are 6-digit TOTP, validated against the user's `mfa_secret` with
±1 step tolerance.

### 2.3 Sessions

Every authenticated request sends `Authorization: Bearer <token>`.
`requireAuth` middleware:
1. Looks up the token in `sessions`
2. Checks expiry
3. Loads the user
4. Stashes `c.var.user` + `c.var.session`
5. Calls next

Sessions live 30 days by default. Expired tokens auto-clear from
client-side localStorage on first 401.

### 2.4 API tokens (long-lived)

For Zapier-style integrations: `auth-core` plugin owns
`/api/api-tokens`. Tokens:
- Plaintext shown once on creation
- Hashed (SHA-256) at rest
- Scoped to specific resources + verbs
- Can be revoked any time

### 2.5 Password reset

```
POST /api/auth/password-reset/request   body: { email }
  → always 200 (no enumeration leak)
  → emails a token if account exists
POST /api/auth/password-reset/confirm   body: { token, password }
  → 200 { token, user }
  → 400 if token expired/used/invalid
```

Tokens are one-shot, expire in 1 hour.

### 2.6 Email verification

```
POST /api/auth/email-verify/request
  → always 200
POST /api/auth/email-verify/confirm     body: { token }
  → 200, sets users.email_verified_at
```

---

## 3. Authorization

Two-layer model:

### 3.1 RBAC (role-based)

- `users.role`: `admin` | `member`
- Admins can: manage users, manage tenants, install plugins, run GDPR
  fan-outs, see audit log, see metrics
- Members can: do everything else (subject to ACL)

Every operator-only endpoint checks `currentUser(c).role !== "admin"`.

### 3.2 Per-record ACL

`editor_acl` table grants subjects roles on specific records. Roles
are `owner > editor > viewer`. Subjects are `user`, `tenant`,
`public-link`, `public`.

**Default grants on record create:**
- `(record, user:creator, owner)` — creator owns it
- `(record, tenant:<tid>, editor)` — every tenant member can edit by default

The resource router pipes `accessibleRecordIds` into SQL `IN` clauses
so list pagination + total count are correct against the user's
filtered universe.

### 3.3 Per-tenant plugin gate

`plugin_enablement` table can disable a plugin for a specific tenant.
`pluginGate` middleware short-circuits 404 with `code: "plugin-disabled"`.

---

## 4. GDPR / data protection

### 4.1 Article 20 — data portability

`POST /api/_gdpr/export` (admin only):
```json
{ "subjectId": "user-uuid" }
```
Fans out to every plugin's `exportSubjectData({ tenantId, subjectId })`.
Returns:
```json
{
  "subjectId": "...",
  "tenantId": "...",
  "exportedAt": "...",
  "sections": {
    "fleet-core": { "vehicles": [...], "trips": [...] },
    "crm-core": { "contacts": [...] },
    "...": {}
  },
  "failed": [{ "pluginId": "...", "error": "..." }]
}
```

Audit row recorded with `action: gdpr.export`.

### 4.2 Article 17 — right to erasure

`POST /api/_gdpr/delete` (admin only, requires confirmation):
```json
{ "subjectId": "user-uuid", "confirm": "permanent" }
```
Fans out to every plugin's `deleteSubjectData({ tenantId, subjectId })`.
Returns counts:
```json
{
  "subjectId": "...",
  "totalDeleted": 42,
  "results": [
    { "pluginId": "fleet-core", "deleted": 12 },
    { "pluginId": "crm-core", "deleted": 30 }
  ]
}
```

Audit row recorded with `action: gdpr.delete, level: warn`.

### 4.3 Plugin author obligations

If your plugin stores PII (any field that could identify a natural
person), you MUST implement both `exportSubjectData` and
`deleteSubjectData`. The fan-out endpoints don't fail if your plugin
doesn't implement them, but compliance does.

PII includes: email, phone, address, name, IP, biometrics, ID numbers,
free-text notes that may mention people.

---

## 5. Audit log

### 5.1 What gets audited

Every mutation: create, update, delete, restore, hard-delete, role
change, ACL grant, password reset, sign-in (success + failure), MFA
enable/disable, GDPR export/delete, plugin install/uninstall.

Plugins audit their own actions via `recordAudit()`.

### 5.2 Tamper-evident hash chain

`audit_events.hash` is SHA-256 of:
```
prev_hash + id + actor + action + resource + record_id + level + ip + occurred_at + payload
```

Every new row chains to the previous via `prev_hash`. Genesis row has
`prev_hash = "GENESIS"`.

### 5.3 Verifying integrity

```bash
GET /api/audit/verify
  → { ok: true, total: N, legacyAccepted: M }
  → { ok: false, firstBreakAt: { id, occurredAt, expected, actual } }
```

Walks the chain end-to-end. The first row whose recomputed hash doesn't
match the stored hash is the tamper point — restore from backup before
that timestamp.

Legacy rows (pre-chain migration) are accepted with `hash: "LEGACY-<id>"`
so the chain reports them but doesn't fail.

### 5.4 Recommended monitoring

Run `GET /api/audit/verify` from a daily cron. Alert on `ok: false`.

---

## 6. Secrets management

### 6.1 What needs to be a secret

| Value | How |
|---|---|
| Database file | Filesystem permissions |
| Storage signing key | `STORAGE_SIGNING_KEY` env (refused at boot if missing in prod) |
| API tokens (user) | Hashed before storage |
| Webhook secrets | Stored plaintext in `webhooks.secret` (consider moving to KMS) |
| Connected account tokens (OAuth) | Stored plaintext in `connected_accounts` (consider KMS) |
| MFA TOTP secrets | Stored plaintext in `users.mfa_secret` (consider KMS) |
| Session tokens | Stored plaintext in `sessions.token` (server-side only) |
| Password hashes | bcrypt (12 rounds) |

### 6.2 Recommendations

- Never log passwords, raw tokens, or secret keys
- The structured logger redacts `Authorization` headers automatically
- For production with KMS, swap the in-process secret reads for KMS
  reads — current code reads `db.users.mfa_secret` directly, which is
  fine for SQLite-on-disk but should change for cloud DB

---

## 7. Plugin permissions enforcement

Manifests declare `permissions[]`. Loader records them. When
`GUTU_PERMISSIONS=enforce`, host SDK call sites validate before allowing:

```ts
import { enforce } from "@gutu-host/permissions";

// Inside a host SDK function called by a plugin
enforce(callerPluginId, "db.write");
// → throws PermissionDeniedError if the plugin didn't declare db.write
```

Modes:
- `enforce` — production. Throw on violation.
- `warn` — gradual rollout. Log on violation, allow.
- `off` — legacy compatibility.

The current implementation logs in `warn` mode. Production deploys
should run `enforce` after auditing every plugin's manifest is correct.

---

## 8. Network perimeter

### 8.1 CORS

`CORS_ORIGINS` env is a comma-separated allowlist. Production refuses
all cross-origin requests when the list is empty.

In dev, an empty `CORS_ORIGINS` echoes any Origin (so localhost works).

### 8.2 Security headers

`securityHeaders` middleware sends on every response:
- `Strict-Transport-Security: max-age=<HSTS_MAX_AGE>; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-DNS-Prefetch-Control: off`
- `Permissions-Policy: interest-cohort=()` — disables FLoC tracking
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
  (only on `/api/*` — the static frontend has its own CSP)

### 8.3 Rate limiting

`rateLimit` middleware: sliding window per IP, default 600 req/min.
Backed by `rate_limit_buckets` table — survives instance restarts +
shares across replicas.

Skips `/api/health` and `/api/ready` so probes don't trip it.

Tunables:
- `RATE_MAX` — max req per window (default 600)
- `RATE_WINDOW_MS` — window length (default 60_000)
- `TRUST_PROXY=1` — honour X-Forwarded-For

### 8.4 Body size limit

`bodySizeLimit` middleware: refuses requests with `Content-Length >
MAX_BODY_BYTES` (default 5 MB) with 413.

### 8.5 Request size + response size

The shell doesn't gzip — that's the job of the TLS terminator (CDN /
load balancer). Response sizes can be large for list endpoints; clients
should always paginate.

---

## 9. Tenancy isolation

### 9.1 Hard guarantees

- Every mutation goes through `getTenantContext()` for the current request
- The resource router pipes `tenantId` into SQL WHERE clauses at the
  query level (not the JS post-filter)
- ACL rows are tenant-scoped via the tenant subject
- Plugins' own tables have `tenant_id` indexed and filtered

### 9.2 Failure modes

- A plugin that forgets to filter by `tenant_id` could leak across
  tenants. **MUST be caught in code review.**
- A test that signs in as one tenant + reads ids from another would
  401/404 (not 403) so existence isn't leaked
- Cross-tenant ACL grants are NOT supported in v1

### 9.3 Multi-tenant strategies

The shell's `tenantMiddleware` resolves the tenant from one of:
- subdomain (`acme.example.com` → `acme`)
- header (`X-Tenant: acme`)
- path (`/t/acme/api/...`)
- single-site default (everyone is `default` tenant)

Configure via `cfg.tenantResolution = "subdomain" | "header" | "path"`
in `src/config.ts`.

---

## 10. Webhooks security

### 10.1 Outbound

Webhooks are signed with HMAC-SHA256. Subscriber receives:
```
X-Gutu-Signature: sha256=<hex>
X-Gutu-Event: record.updated
X-Gutu-Tenant: <tenant-id>
X-Gutu-Delivery: <delivery-id>
Content-Type: application/json
```

Verifier:
```ts
const expected = crypto
  .createHmac("sha256", webhookSecret)
  .update(body)
  .digest("hex");
const ok = expected === signature.slice("sha256=".length);
```

### 10.2 Retry policy

Default: 3 attempts with exponential backoff (1s, 5s, 25s). Permanent
failures (4xx) stop retrying; 5xx + network errors retry.

### 10.3 Delivery log

Every delivery (attempt) appends to `webhook_deliveries`. Includes
the HTTP status, response body (capped), error message.

---

## 11. Editor / file storage security

### 11.1 Local filesystem

`local` adapter stores files under `FILES_ROOT` with tenant-prefixed
keys: `<tenantId>/<key>`. The signing key (`STORAGE_SIGNING_KEY`)
HMACs presigned URLs.

Risks:
- Symlink attacks if `FILES_ROOT` is user-writeable — set 700
  permissions
- Path traversal — adapter rejects `..` in keys
- Disk fill — set quota in deployment

### 11.2 S3 / R2 / MinIO

`s3` adapter uses AWS SDK v3 with explicit `Bucket` + tenant prefix.
Presigned URLs use SDK's `getSignedUrl` with 5-minute expiry default.

Risks:
- Bucket policy must deny ListBucket to anon — adapter doesn't manage
  bucket policies
- IAM creds in env: never log, rotate quarterly

---

## 12. WebSocket security

`/api/ws/*` upgrades go through plugin-contributed handlers. Every
handler MUST:
1. `authorize(req)` — return `{ userId, tenantId }` or null
2. `null` → upgrade refused with 401
3. After upgrade, all messages are tenant-scoped via the stored data

Yjs editor sync: extra layer — checks `effectiveRole` against the
specific document being opened. No role → 403.

---

## 13. Boot-time hardening

`main.ts` refuses to boot in production if:
- `STORAGE_SIGNING_KEY` is missing or < 32 chars
- `CORS_ORIGINS` is empty
- (recommended) `GUTU_PERMISSIONS != "enforce"`

In development, defaults are tolerant — local iteration isn't blocked.

---

## 14. Defense-in-depth checklist

For each plugin author:

- [ ] All endpoints behind `requireAuth`
- [ ] All queries scoped by `tenant_id`
- [ ] All input validated with Zod (no JSON-injection)
- [ ] All mutations call `recordAudit()`
- [ ] PII fields → both `exportSubjectData` + `deleteSubjectData`
- [ ] No raw user input in SQL — always parameterised
- [ ] No raw user input in HTML — React handles this; never `dangerouslySetInnerHTML`
- [ ] Outbound HTTP from workers respects `net.outbound` permission
- [ ] Webhooks signed + retry-policy declared
- [ ] Permission manifest matches actual usage

For each operator:

- [ ] `STORAGE_SIGNING_KEY` set to ≥32 hex chars in production
- [ ] `CORS_ORIGINS` is the real frontend origin (not `*`)
- [ ] `GUTU_PERMISSIONS=enforce` after audit
- [ ] TLS terminator in front (HSTS only meaningful with TLS)
- [ ] Backups snapshotted hourly, restore tested quarterly
- [ ] `GET /api/audit/verify` running daily, alerts on `ok: false`
- [ ] Rate-limit defaults reviewed against expected traffic
- [ ] Periodic `GET /api/_plugins` review — no quarantined plugins
- [ ] OAuth provider secrets rotated quarterly

---

## 15. Reporting a vulnerability

If you find a security issue, **don't** open a public GitHub issue.
Email security@gutula.dev with:
- A description of the issue
- Steps to reproduce
- Affected versions
- Your contact info for follow-up

We commit to:
- Acknowledging within 48 hours
- A fix or mitigation timeline within 7 days
- Public disclosure after the fix ships, with credit (unless you want
  anonymity)
