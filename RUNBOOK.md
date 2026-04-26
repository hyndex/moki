# Runbook

Day-to-day operational tasks for the Gutu admin platform.

## On-call: triaging an incident

### "Plugin X is broken / not loading"

1. `GET /api/_plugins` — find row with `id: "X"`.
2. Check `status`:
   - `loaded` — plugin fine; problem is elsewhere.
   - `quarantined` — `errors[]` lists what failed (migrate, install, start, mount).
   - missing entirely — discovery failed; check `package.json["gutuPlugins"]`
     entry and import path.
3. Read backend logs filtered to `plugin-host`:
   ```bash
   tail -f /var/log/gutu.log | grep plugin-host
   ```
4. If quarantined plugin can be safely disabled per-tenant:
   `POST /api/_plugins/_enablement { pluginId: "X", enabled: false }`.

### "Worker X stopped processing"

1. `GET /api/_plugins/_leases` — find lease with name `X`.
2. If `expiresAt` is in the past: leader crashed, other replicas
   should pick up within TTL. If no replica picks up, all replicas
   are unhealthy — restart the cluster.
3. Common causes: plugin's `start()` threw and quarantined the
   plugin; check `/api/_plugins` status.

### "Audit log looks tampered"

```bash
curl -H "Authorization: Bearer $ADMIN" /api/audit/verify
```

Output:
- `ok: true` → chain is intact.
- `ok: false, firstBreakAt: { id, occurredAt, expected, actual }` →
  rows from `occurredAt` onwards are tampered. Diff `expected` vs
  `actual` to attribute. Restore from backup before the break.

### "User reports rate limited unexpectedly"

```bash
sqlite3 $DB_PATH "SELECT * FROM rate_limit_buckets WHERE bucket_key LIKE 'ip:%' ORDER BY count DESC LIMIT 10;"
```

If their IP is throttled, either raise `RATE_MAX` or wait for the
window to roll over. Reset a single bucket:

```sql
DELETE FROM rate_limit_buckets WHERE bucket_key = 'ip:1.2.3.4';
```

## Day-to-day: fulfilling a GDPR request

### Article 20 (data export)

```bash
curl -X POST -H "Authorization: Bearer $ADMIN" -H "content-type: application/json" \
  -d '{"subjectId":"user-uuid"}' \
  /api/_gdpr/export
```

Returns a JSON bag of every plugin's data about the subject. Audit row
recorded with `action: gdpr.export`.

### Article 17 (right to erasure)

```bash
curl -X POST -H "Authorization: Bearer $ADMIN" -H "content-type: application/json" \
  -d '{"subjectId":"user-uuid","confirm":"permanent"}' \
  /api/_gdpr/delete
```

Permanent. Audit row recorded with `action: gdpr.delete, level: warn`.

## Day-to-day: enabling/disabling a plugin per tenant

UI: Settings → Plugins → toggle "Enable for tenant".

API:
```bash
curl -X POST -H "Authorization: Bearer $ADMIN" -H "content-type: application/json" \
  -d '{"pluginId":"webhooks-core","enabled":false}' \
  /api/_plugins/_enablement
```

Disabled plugins return 404 on their routes for that tenant; data is
preserved. Re-enable any time.

## Day-to-day: deploying a new plugin

### From npm

```bash
cd admin-panel/backend
bun add @acme/gutu-fleet
# Add to package.json["gutuPlugins"]:
#   "@acme/gutu-fleet"
# Add to admin-panel/backend/tsconfig.json paths
# Restart
systemctl restart gutu-admin
# Verify
curl /api/_plugins | jq '.rows | map(select(.id == "fleet-core"))'
```

### Local development

```bash
cd /repo/root
bun run scaffold:plugin fleet-core --ui --worker
# Edit framework/builtin-plugins/fleet-core/src/host-plugin/...
# Add to admin-panel/backend/package.json["gutuPlugins"]
# Restart backend; check /api/_plugins
```

## Common operational tasks

| Task | Command |
|---|---|
| Boot ready check | `curl /api/ready` |
| Plugin overview | `curl /api/_plugins` |
| Worker leases | `curl /api/_plugins/_leases` |
| Per-route metrics | `curl /api/_metrics` |
| Verify audit chain | `curl /api/audit/verify` |
| Trigger plugin uninstall | `curl -X POST /api/_plugins/<id>/uninstall` |
| Disable plugin per tenant | `POST /api/_plugins/_enablement` |
| Run all four test suites | `cd admin-panel && bun run scripts/{e2e-crud,visual-smoke,visual-interactions,bug-hunt}.ts` |
