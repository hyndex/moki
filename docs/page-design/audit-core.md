---
plugin: gutu-plugin-audit-core
design-system: 1.0
tier: standard
last-updated: 2026-04-27
---

# Audit — Page Design Brief

The hash-chained audit log. Every plugin emits to it; this surfaces
it for review and verification.

## Pages

| Path | Archetype | Purpose |
|---|---|---|
| `/audit` | Timeline / Log | Live audit feed |
| `/audit/verify` | Detail-Rich | Chain verification |
| `/audit/policies` | Smart List | Retention + masking policies |
| `/audit/exports` | Smart List | Past exports (for legal/regulator) |

## Highlights

**`/audit` live feed:** filter chips (action, user, plugin, entity, severity, date), live tail toggle, JSONL export, hash ✓ column per row, expand to full payload diff.

**`/audit/verify`:** runs chain validation; status: ok · broken at row N · in-progress; per-row recompute; downloadable signed report.

**Retention policies:** per-plugin and per-action TTLs; immutable rules; auto-archive to cold storage.

## Cross-plugin

- Every plugin emits via the SDK `recordAudit()`
- `notifications-core` — alerts on chain break
- `analytics-bi-core` — audit warehouse
- `ai-assist-core` — natural language audit queries (read-only)

## Open

- Per-tenant signing keys — phase 2 (HSM integration optional).
- Right-to-erase under GDPR — already designed: erase places "REDACTED" with new hash; chain stays valid.
