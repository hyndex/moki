---
plugin: gutu-plugin-storage-local
design-system: 1.0
tier: support
last-updated: 2026-04-27
---

# Storage Local — Page Design Brief

Local-disk adapter for `storage-core`. No top-level user pages; surfaces under `/admin/storage` belong to `storage-core`.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/storage/local` | Workspace Hub | Local adapter config |

## Highlights

**Config tabs:** Mount points · Quota · Backup · Permissions · Audit.

**Quotas:** per-tenant disk limit; alert thresholds.

## Cross-plugin

- `storage-core` — registers as adapter
- `audit-core` — config changes audited
- `notifications-core` — quota alerts

## Open

- Snapshot-friendly mode (LVM/ZFS aware) — phase 2.
