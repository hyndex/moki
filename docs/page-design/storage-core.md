---
plugin: gutu-plugin-storage-core
design-system: 1.0
tier: support
last-updated: 2026-04-27
---

# Storage Core — Page Design Brief

Storage adapter contract + registry. Adapters (`storage-local`, `storage-s3`, …) implement it; `files-core` is the user surface.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/admin/storage` | Intelligent Dashboard | Storage health |
| `/admin/storage/buckets` | Smart List | Buckets |
| `/admin/storage/policies` | Smart List | Lifecycle policies |

## Highlights

**Dashboard KPIs:** Storage used · Object count · Egress (24h) · Errors · Cache hit rate · Avg latency.

**Buckets:** per-tenant storage namespaces; per-bucket quota; per-bucket adapter binding (local/S3/etc.); encryption status.

**Policies:** retention, lifecycle (archive after N days), virus scan toggles.

## Cross-plugin

- `files-core` — user surface
- `storage-local`, `storage-s3` — adapters
- `audit-core` — bucket / policy changes audited

## Open

- Multi-region replication — phase 2.
