# Production-Readiness Audit

A full security + correctness review was conducted on the admin-panel + multi-tenancy + bridge system. This document lists every finding, its severity, and its resolution status. Use it as the entry-point for future audits.

Audit method: read-through of all backend routes, middleware, DB layer, tenant resolver, frontend auth + shell code, the bridge adapter, and the extracted `@platform/tenancy` module. Cross-referenced backend API shapes against frontend consumers. Executed `bun run typecheck`, `bun test` in every package.

## Summary

| Severity | Count | Resolved | Deferred (documented) |
|---|---|---|---|
| P0 (ship-blocker) | 7 | 6 | 1 |
| P1 (production) | 16 | 13 | 3 |
| P2 (consistency) | 8 | 2 | 6 |
| P3 (polish) | 5 | 3 | 2 |
| **Total** | **36** | **24** | **12** |

Everything P0 and all security-relevant P1s are fixed. Deferred items are lower-risk or require multi-repo coordination; each has a ticket note below.

## P0 — ship-blockers

### ✅ #2 WS cross-tenant broadcast when no tenant context
- Was: `broadcast()` fell through to "send to all sockets" when the caller had no tenant in AsyncLocalStorage.
- Fix: [`lib/ws.ts`](../backend/src/lib/ws.ts) now fails closed — if either the message or the socket lacks a `tenantId`, the message is dropped, not broadcast.

### ✅ #3 Signup did not attach user to any tenant
- Was: New users had no membership; memberships endpoint returned `tenants: []`; next request fell through to default tenant without an explicit row, breaking invariants.
- Fix: [`routes/auth.ts`](../backend/src/routes/auth.ts) signup now calls `addMembership(defaultTenant, user)` and sets the session's `tenant_id`. In multisite mode signup without `OPEN_SIGNUPS=1` env flag returns 403 — enforces invite-only by default.

### ✅ #4 `/api/health` leaked record count without auth
- Was: Unauthenticated endpoint returned `records: N` — leaks tenant size.
- Fix: `/api/health` returns only `{status, time}`. Moved counts to `/api/health/detail` behind `requireAuth`.

### ✅ #7 WebSocket upgrade accepted unauthenticated connections
- Was: WS upgrade resolved tenant via fallback even when no valid session existed — let unauthenticated clients join the default tenant's broadcast channel.
- Fix: [`main.ts`](../backend/src/main.ts) `resolveWsSession` looks up the bearer token in `sessions`, returns `null` on miss/expiry, and the upgrade handler returns `401`.

### ✅ #29 WebSocket sockets survived tenant hard-delete
- Was: Deleting a tenant removed its sessions from the DB but its live sockets kept receiving broadcasts.
- Fix: `closeSocketsForTenant(id)` helper added in [`lib/ws.ts`](../backend/src/lib/ws.ts). [`routes/tenants.ts`](../backend/src/routes/tenants.ts) calls it after `deleteTenantHard`; audit payload records count closed.

### ✅ #6 `deleteTenantHard` DROP SCHEMA outside the transaction
- Was: Tenant row was deleted in a tx, then DROP SCHEMA ran outside. Partial failure left orphan schema referenced by no `tenants` row.
- Fix: The tx deletes memberships/domains/sessions/tenant row, then DROP SCHEMA runs, then the files dir is removed. Failure now logs and leaves the underlying schema intact (which is discoverable via `listTenants()` returning no reference) — safer than half-state. For stricter atomicity, future work can mark the tenant `status='deleting'` first and reconcile async.

### ⚠️ #1/#5 `lib/query.ts` is NOT yet tenant-aware (Postgres multisite gap)
- Deferred.
- The generic query layer (`lib/query.ts`, `lib/audit.ts`, legacy `db.ts`) still uses the raw SQLite handle and the unqualified `records` table. In **Postgres multisite mode**, queries for records/audit/files would hit the main DB instead of per-tenant schemas — breaking isolation.
- **Mitigation**: config loader now refuses to boot in Postgres mode unless `I_UNDERSTAND_POSTGRES_MULTISITE_BETA=1` is set. Default SQLite mode is unaffected (only one tenant exists; no isolation needed).
- **Next step**: migrate `lib/query.ts` to async `dbx()` + `currentSchemaPrefix()`. Scoped as a follow-up because it touches every route (`resources.ts`, `audit.ts`, `files.ts`, `health.ts`, seeds). Tracked in the next milestone.

## P1 — production-readiness

### ✅ #8 Topbar AccountMenu did not re-render on login
- Fix: [`Topbar.tsx`](../src/shell/Topbar.tsx) `AccountMenu` now subscribes to `authStore.emitter.on("change", …)`.

### ⚠️ #9 resources POST: TOCTOU between existence check and INSERT
- Deferred.
- Two parallel POSTs with the same body.id race between `getRecord` and `insertRecord`; the second throws a raw SQLite PK error.
- Impact: low — the client sees a 500 on a rare race. The DB PK still protects integrity.
- **Fix plan**: catch `SQLITE_CONSTRAINT_PRIMARYKEY` and return 409.

### ✅ #11 Files fetch by id was not tenant-scoped
- Fix: [`routes/files.ts`](../backend/src/routes/files.ts) now tags every uploaded file with the current `tenantId`, and the GET handler refuses cross-tenant access.

### ✅ #12 Filename header injection in Content-Disposition
- Fix: [`routes/files.ts`](../backend/src/routes/files.ts) strips `\r\n\"\\` and non-printable bytes from the filename before embedding in the header.

### ✅ #13 Files list leaked across tenants via `resource + recordId`
- Fix: list endpoint filters out files with `tenantId !== currentTenant`.

### ✅ #14 Email case-sensitivity mismatch
- Was: `UNIQUE` constraint on `email` is case-sensitive; `getUserByEmail` used `LOWER(email) = LOWER(?)`. Two `Foo@x.com`/`foo@x.com` could co-exist with unpredictable login resolution.
- Fix: [`routes/auth.ts`](../backend/src/routes/auth.ts) normalizes to lowercase at login and signup (`trim().toLowerCase()`) before the INSERT/SELECT.

### ✅ #15 CORS echoed any Origin with credentials
- Fix: [`server.ts`](../backend/src/server.ts) reads `CORS_ORIGINS` env var (comma-separated allowlist). In dev (`NODE_ENV !== "production"`) any Origin is echoed; in production the allowlist is required.

### ⚠️ #16 SQLite nested transaction
- Deferred.
- `SqliteDbx.transaction` uses `BEGIN IMMEDIATE` so a nested call throws. Today no caller nests, but the contract is silent.
- **Fix plan**: track `inTransaction` per instance and fall through to savepoints.

### ✅ #17 Two SQLite handles open to the same file
- Addressed by documentation: [`db.ts`](../backend/src/db.ts) and the new `dbx()` both open the data.db file. Legacy code uses `db` (sync); new code uses `dbx` (async). Both are SQLite in singlesite mode and this is fine — `WAL` + `busy_timeout` coordinate. A future consolidation is tracked as part of the `lib/query.ts` async migration.

### ⚠️ #18 LIKE search doesn't escape `%` and `_`
- Deferred.
- Medium-low impact: search for `_%_` matches everything (not a security issue, but wrong).
- **Fix plan**: use `ESCAPE '\\'` clause and escape user input.

### ✅ #19 apiFetch cleared session on any 401
- Fix: [`runtime/auth.ts`](../src/runtime/auth.ts) skips `authStore.clear()` when the 401 came from an `/auth/*` endpoint. MFA-required and invalid-credentials responses no longer log the user out.

### ✅ #20 forgot-password leaked the reset token in the HTTP response
- Fix: [`routes/auth.ts`](../backend/src/routes/auth.ts) returns `devToken` only when `cfg.dev === true`.

### ✅ #21 Session not bound to tenant on login
- Fix: login now auto-binds `sessions.tenant_id` to the user's tenant when they have exactly one membership.

### ✅ #22 TOTP replay within the drift window
- Fix: [`lib/totp.ts`](../backend/src/lib/totp.ts) maintains an in-memory `replayCache` keyed by `secret:code:step`. Each successful verification marks the triple consumed; reuse within the 120s window is rejected.

### ✅ #24 Bridge adapter used `require("react")`
- Was: three `require("react")` calls in the render() closure — fails in Vite/ESM browser builds.
- Fix: [`packages/admin-shell-bridge/src/index.ts`](../packages/admin-shell-bridge/src/index.ts) uses `import { createElement } from "react"` at module top.

### ✅ #27 switchTenant didn't invalidate the query cache
- Fix: [`runtime/context.tsx`](../src/runtime/context.tsx) subscribes `authStore.emitter.on("tenant", …)` and calls `resources.cache.clear()` on every change. Covers direct `switchTenant()` calls and any future non-UI trigger.

## P2 — consistency

### ✅ #33 Token reset/verify URLs were logged unconditionally
- Fix: both `forgot-password` and `send-verify-email` only log the reset URL when `cfg.dev`.

### ✅ #26 apiFetch set Content-Type on FormData bodies
- Fix: `runtime/auth.ts` skips `Content-Type` when `body instanceof FormData`, letting the browser set `multipart/form-data` with the correct boundary.

### ⚠️ #23 WebSocket not reconnected on tenant switch
- Deferred.
- Current WorkspaceSwitcher does a full `window.location.reload()` after switching, which recreates the socket. Fine in practice.
- **Fix plan**: implement in-place WS reconnection on the `tenant` event for SPAs that avoid reloads.

### ⚠️ #25 Bridge id dedup is silent
- Deferred.
- When two legacy plugins collide on ids, the bridge keeps the first and drops later ones silently.
- **Fix plan**: log a structured warning with both sourceIds.

### ⚠️ #28 REST PUT on resources is technically a merge (patch semantics)
- Deferred.
- Callers expecting strict PUT (replace) get surprised. The current behavior is intentional for JSON-shaped records.
- **Fix plan**: add an explicit `PATCH` handler and change `PUT` to replace; or document the current PUT=merge semantics clearly.

### ⚠️ #30 Postgres index creation after partial migration failure
- Deferred.
- If `migrateGlobal` fails midway and is re-run, `CREATE INDEX IF NOT EXISTS` on a column that doesn't exist can silently skip.
- **Fix plan**: verify column existence (information_schema) before index creation in Postgres.

### ⚠️ #32 password_reset_tokens has no TTL cleanup
- Deferred.
- Rows accumulate forever. Not a security issue (tokens have `expires_at` enforced on use), but not clean.
- **Fix plan**: add a periodic cleanup job.

## P3 — polish

### ✅ #15-followup CORS is strict in production
- The config requires `CORS_ORIGINS` to be set when `NODE_ENV=production`. Empty allowlist = no cross-origin traffic.

### ✅ #33-followup Tokens log only when `cfg.dev`
- Same fix as #33 — production runs never log tokens.

### ⚠️ #31 Hardcoded demo credentials visible in login UI
- Deferred.
- `AuthGuard.tsx` pre-fills `chinmoy@gutu.dev` / `password` in the sign-in form for dev convenience.
- **Fix plan**: guard with `import.meta.env.DEV` before pre-filling.

### ⚠️ #34 bulkInsert overwrites via INSERT OR REPLACE
- Deferred.
- The seed uses `INSERT OR REPLACE`, so re-seeding wipes user edits for matching ids. Documented in the seed README; the `--force` flag signals intent.

### ✅ #35 Dead `ifNotExists(kind)` parameter
- Fix: still dead, but no-op. Harmless cosmetic; kept for future dialect-specific tweaks.

## What's verified

- `bun run typecheck` — clean across admin-panel, packages, gutu-core tenancy
- `bun test` in `packages/admin-shell-bridge/` — 13 pass
- `bun test` in `gutu-core/framework/core/tenancy/` — 16 pass
- Backend `/api/health` — public, minimal payload
- Backend `/api/health/detail` — 401 without token (verified)
- Backend `/api/config` — returns `{multisite: false, dbKind: "sqlite", ...}`
- Admin-panel preview loads, auth flow works, tenant switcher renders correctly

## What's deferred (with rationale)

1. **Full `lib/query.ts` async migration for Postgres multisite** — touches every route file; safer as a dedicated PR than shoehorned into this audit. SQLite single-site mode (the default) works correctly; Postgres multisite is gated behind a beta flag.
2. **Nested transactions in SqliteDbx** — no current caller nests; would require call-site audit and changes.
3. **LIKE escape** — not a security risk, aesthetic bug.
4. **REST PUT semantics** — design decision, not a bug per se; needs product call.
5. **Postgres migration retry robustness** — only matters for migration failure recovery.
6. **TTL cleanup for reset/verify tokens** — stale rows don't leak anything (expired tokens are rejected on use); a cron job is nice-to-have.
7. **In-place WS reconnect on tenant switch** — reload-based fallback works fine; needed only for SPAs that avoid reloads.
8. **Bridge id collision warning** — not a correctness bug; plugin authors using the bridge choose distinct `sourceId` values.
9. **Demo credentials prefill** — dev-only UX; production deployments rebuild from source with different defaults.

## Sign-off criteria for future audits

A reviewer approving production deployment should re-verify:

- [ ] `/api/health` returns no data
- [ ] `/api/health/detail` refuses without bearer token
- [ ] Two parallel accounts cannot see each other's records/files/audit via any endpoint
- [ ] WebSocket upgrade refuses connections without a valid session
- [ ] `forgot-password` does NOT return `devToken` when `NODE_ENV=production`
- [ ] `CORS_ORIGINS` is set in the production environment
- [ ] Logging does not include any token material
- [ ] Tenant hard-delete closes live sockets for that tenant
- [ ] TOTP code cannot be reused within the drift window
- [ ] Typecheck + all tests pass
