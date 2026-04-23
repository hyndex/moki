# Gutu Admin — Backend

Real REST API for the admin panel. Bun + Hono + SQLite. Auth-protected. Seeds
reproducible demo data across every plugin on first boot.

## Run

```bash
cd backend
bun install
bun run dev            # http://127.0.0.1:3333
bun run seed --force   # wipe and reseed (data.db)
bun run typecheck
```

## Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/api/auth/login` | Email + password → bearer token |
| POST | `/api/auth/signup` | Create user + session |
| GET  | `/api/auth/me` | Current user (requires Bearer token) |
| POST | `/api/auth/logout` | Invalidate the current session |
| GET  | `/api/resources/:resource` | List records — supports `page`, `pageSize`, `sort`, `dir`, `search`, `filter[field]` |
| GET  | `/api/resources/:resource/:id` | Get a record |
| POST | `/api/resources/:resource` | Create a record |
| PATCH| `/api/resources/:resource/:id` | Merge-update a record |
| PUT  | `/api/resources/:resource/:id` | Upsert a record |
| DELETE | `/api/resources/:resource/:id` | Delete a record |
| GET  | `/api/audit` | Paginated audit-event log |
| GET  | `/api/health` | Record count + server time |

All `/api/resources/*` and `/api/audit` routes require a valid session.
All mutations append to the audit log.

## Default seed users

| Email | Password | Role |
| ----- | -------- | ---- |
| chinmoy@gutu.dev | password | admin |
| sam@gutu.dev | password | member |
| alex@gutu.dev | password | member |
| taylor@gutu.dev | password | member |
| viewer@gutu.dev | password | viewer |

## Schema

Two real tables (`users`, `sessions`) + a single generic `records` table keyed
by `(resource, id)` with the full record stored as JSON. Audit events live in
`audit_events`. The generic design means adding a new plugin's resource
requires zero backend changes — the client can create any namespaced resource
id and the router will CRUD it.

## Seed data

On first boot:

- 5 auth users
- ~1,200 domain records across ~55 resources (contacts, deals, invoices,
  bookings, tickets, products, inventory, AI models, audit events, …)
- All deterministic — same seed produces the same data every run.

Re-run with `bun run seed --force` to wipe + reseed.
