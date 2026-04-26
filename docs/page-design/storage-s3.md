---
plugin: gutu-plugin-storage-s3
design-system: 1.0
tier: support
last-updated: 2026-04-27
---

# Storage S3 — Page Design Brief

S3-compatible object storage adapter for `storage-core`.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/storage/s3` | Workspace Hub | S3 adapter config |

## Highlights

**Config tabs:** Endpoint · Region · Access keys (write-only) · Bucket layout · Encryption · Lifecycle · Audit.

**Health:** ping, list-bucket probe, write/read smoke test.

## Cross-plugin

- `storage-core` — registers as adapter
- `audit-core` — config audited
- `notifications-core` — degradation alerts

## Open

- Multi-bucket per tenant — yes; configurable.
- Pre-signed URL TTL default 5min.
