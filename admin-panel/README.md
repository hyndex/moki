# Gutu Admin Panel — Universal, Contract-Driven, End-to-End

A full-stack example project: a universal admin panel that hosts **every
first-party Gutu plugin** and talks to a **real backend** with a SQLite
database, auth, and audit logging. Designed so plugins declare schemas and
custom views; the shell renders them and the API persists them.

## What's in this repo

| Path | What it is |
| ---- | ---------- |
| `src/` | The React admin frontend — tiers 0–7, ~60 components, 22 rich hand-crafted pages, 55+ plugin configs |
| `backend/` | Bun + Hono + SQLite REST API — auth, sessions, generic CRUD, audit log |
| `scripts/dev.ts` | One-command dev — starts API (3333) + Vite (5173) side by side |
| `.claude/launch.json` | Preview config for the Claude Code preview panel |

## Run everything

```bash
cd admin-panel
bun install
bun install --cwd backend
bun run dev                   # starts API on :3333 and Vite on :5173
```

Then open **http://localhost:5173** and sign in with **chinmoy@gutu.dev / password**.

To reseed the database from scratch:

```bash
cd backend && bun run seed -- --force
```

## Demo accounts (pre-seeded)

| Email | Password | Role |
| ----- | -------- | ---- |
| chinmoy@gutu.dev | password | admin |
| sam@gutu.dev | password | member |
| alex@gutu.dev | password | member |
| taylor@gutu.dev | password | member |
| viewer@gutu.dev | password | viewer |

## End-to-end data flow

```
 ┌────────────────┐   fetch /api/...        ┌──────────────────┐
 │ React shell    │ ───────────────────▶    │ Hono + Bun       │
 │ (Vite, 5173)   │ ◀─── JSON records ───── │ (3333)           │
 │  - AuthGuard   │                          │  - JWT sessions │
 │  - RestAdapter │                          │  - CRUD router  │
 │  - useAllRecs  │                          │  - audit logger │
 │  - 55 plugins  │                          │  - SQLite (WAL) │
 └────────────────┘                          └──────────────────┘
```

Every mutation (create/update/delete) writes to `records` and appends an
`audit_events` row tagged with the actor's email. The admin's Audit plugin
lists those events live.

## Stack choices

- **Zero native deps** — Bun's built-in SQLite means no better-sqlite3, no
  libpq, no Docker for the DB. `data.db` is a single file.
- **Generic records table** — every plugin's resources share a
  `(resource, id, JSON data)` schema. Adding a new plugin's CRUD requires zero
  backend changes.
- **Stateless auth** — bearer tokens in `sessions` table. No third-party IdP
  yet; SSO buttons on the sign-in screen are placeholders.
- **Vite proxy** — `/api/*` is proxied to the backend during dev, so the
  frontend can use same-origin fetches.

## Plugins included (mounts every one listed in WORKSPACE_REPOS.md)

**Signature plugins** — hand-crafted pages:

| Plugin | Rich pages |
| ------ | ---------- |
| `crm` | Overview, Contacts (enriched list), Pipeline, Activity (composer), Segments, Contact detail |
| `sales` | Overview, Deals, Pipeline, Forecast, Leaderboard, Revenue, Funnel, Quotes, Deal detail |
| `community` | Feed, Spaces, Space detail, Moderation queue |
| `party-relationships` | Graph, Relationships, Entity detail |
| `booking` | Dashboard + list/form/detail + Calendar |
| `audit` | Log + About + Event detail |
| `platform-core` | Home, Settings, Profile, Search, Notifications, Onboarding, Release notes, Sign-in/up previews |

**Factory plugins** — auto-generated list/form/detail from config, many with
add-on custom pages:

accounting · ai-core · ai-evals · ai-rag · ai-skills · ai-assist · assets · automation · auth ·
company-builder · content · contracts · dashboard · document · e-invoicing · execution-workspaces ·
field-service · files · forms · hr-payroll · inventory · integration · issues · jobs · knowledge ·
manufacturing · maintenance-cmms · notifications · org-tenant · payments · page-builder ·
business-portals · pos · portal · pricing-tax · procurement · product-catalog · projects · quality ·
role-policy · runtime-bridge · search · subscriptions · support-service · template · treasury ·
traceability · user-directory · workflow · analytics-bi

**95+ nav entries in 12 sections** once every plugin is mounted.

## Key routes

| Route | Plugin |
| ----- | ------ |
| `/home` | Cross-plugin operations overview |
| `/contacts` | CRM enriched list |
| `/contacts/overview` | CRM dashboard w/ KPIs + recent contacts + stage donut |
| `/contacts/:id` | Rich contact profile |
| `/sales` | Sales overview |
| `/sales/pipeline` | Weighted pipeline kanban |
| `/sales/leaderboard` | Quota attainment podium |
| `/sales/deals/:id` | Deal detail w/ stage progress + tabs |
| `/community/feed` | Social feed (composer works) |
| `/community/spaces/:id` | Space detail |
| `/party-relationships/graph` | Interactive SVG relationship network |
| `/accounting/invoices` | Factory-generated CRUD |
| `/audit` | Live audit stream (every API mutation) |
| `/settings` | Global settings hub |

## Observable end-to-end

- Sign in hits `POST /api/auth/login`, persists the token, reloads the shell.
- Rich pages call `useAllRecords("<resource>")` which goes through the `ResourceClient` → `RestAdapter` → `/api/resources/:resource`.
- Creating a record via a form renders `POST /api/resources/...`, invalidates the cache, and appends an `audit_events` row. The newly-created row appears in Recent Contacts, Overview KPIs bump, and the Audit log shows the action.

## Config

| Env var | Default | Effect |
| ------- | ------- | ------ |
| `VITE_USE_MOCK_BACKEND` | unset | Set to `1` to use the in-memory mock adapter (offline demo mode) |
| `VITE_API_TARGET` | `http://127.0.0.1:3333` | Proxy target for `/api` in dev |
| `VITE_API_BASE` | `/api` | Base path used by the frontend fetch wrapper |
| `API_PORT` | `3333` | Backend port |
| `PORT` | `5173` | Vite port |

## Architecture — 7 tiers

The folder layout mirrors the tier boundaries so extraction into standalone
packages is a mechanical step (one folder → one repo).

(Original tier content below.)

## Run individual pieces

```bash
cd admin-panel
bun install
bun run dev          # http://localhost:5173
bun run typecheck    # no-output = clean
bun run build        # production build
```

## Architecture — 7 tiers

The folder layout mirrors the tier boundaries so extraction into standalone
packages is a mechanical step (one folder → one repo).

| Tier | Folder | Role |
| ---- | ------ | ---- |
| 0 | `src/tokens/` | CSS variables, theme (light/dark), density (comfortable/compact/dense) |
| 1 | `src/primitives/` | Headless a11y components over Radix + CVA — Button, Dialog, Menu, Popover, Toast, Tooltip, Tabs, Switch, Select, Checkbox, Input, Textarea, Label, Badge, Spinner |
| 2 | `src/admin-primitives/` | Composite surfaces — PageHeader, DataTable, FilterBar, FormField, Card, KPI, EmptyState, ErrorState, Skeleton, Toolbar, Breadcrumbs |
| 3 | `src/views/` | Schema → full-screen renderers: ListView, FormView, DetailView, DashboardView, FieldInput, plus the cell renderer |
| 4 | `src/shell/` | AppShell, Sidebar, Topbar, CommandPalette, Toaster, ConfirmHost, ErrorBoundary, router, registry |
| 5 | `src/contracts/` | TypeScript types plugins depend on — never breaks without a version bump |
| 6 | `src/builders/` | `definePlugin / defineListView / defineFormView / …` — thin identity + validation |
| 7 | `src/host/` | `AdminRoot` + `usePluginHost` — activates plugins, seeds mocks, builds the registry |

Plus `src/runtime/` (resource client, query cache, mock backend, hooks) and
`src/lib/` (cn, id, emitter, format) as cross-cutting support.

## The DX promise

A plugin developer writes **schema, not JSX**. Here's a complete CRM contacts
admin screen — nav entry, list view with filters + sort + bulk actions, create
form, detail view, and a command palette entry:

```ts
export const crmPlugin = definePlugin({
  id: "crm",
  label: "CRM",
  admin: {
    nav: [{ id: "contacts", label: "Contacts", icon: "Users",
            path: "/contacts", view: "crm.contacts" }],
    resources: [contactResource],
    views: [
      defineListView({
        id: "crm.contacts",
        title: "Contacts",
        resource: contactResource.id,
        columns: [
          { field: "name", sortable: true },
          { field: "email", kind: "email" },
          { field: "stage", kind: "enum", options: […] },
        ],
        filters: [{ field: "stage", kind: "enum", options: […] }],
        actions: [
          { id: "new",   label: "New contact", placement: ["page"],
            run: ({ runtime }) => runtime.navigate("/contacts/new") },
          { id: "del",   label: "Delete", intent: "danger",
            placement: ["row", "bulk"],
            confirm: { title: "Delete?", destructive: true },
            run: async ({ records, resource, runtime }) => {
              await Promise.all(records.map(r =>
                runtime.delete(resource, r.id)));
              runtime.toast({ title: "Deleted", intent: "danger" });
            } },
        ],
      }),
      defineFormView({ … }),
      defineDetailView({ … }),
    ],
    commands: [
      { id: "new-contact", label: "New contact",
        run: () => (location.hash = "/contacts/new") },
    ],
  },
});
```

Zero React code was written. The shell renders the sidebar entry, binds `/contacts`
to the list view, wires `⌘K` → palette → new-contact, derives `/contacts/new` →
form view, `/contacts/:id` → detail view, and `/contacts/:id/edit` → form view.
Row actions render as a dropdown; bulk actions surface when rows are selected.

Run `bun run dev` and open `http://localhost:5173/#/contacts` to see it live.

## Three demo plugins

| Plugin | Shape | What it proves |
| ------ | ----- | -------------- |
| `examples/booking` | Dashboard + list + form + detail, row + bulk + page actions, filters, sort, pagination, badge on nav | Full end-to-end CRUD |
| `examples/crm` | List + form + detail, bulk delete, mark-VIP, confirm dialog | Second plugin's views coexist with the first |
| `examples/audit` | Read-only list + custom view, no form | Partial contributions — shell hides what you don't declare |

## Universal design ("Framework theme")

- **Tokens everything.** No hardcoded colors/spacings in any component. Change
  a variable in `tokens.css`, propagate everywhere.
- **Dark-first.** Both themes are first-class with dedicated accent, surface,
  border, and intent scales. Toggle from Topbar.
- **Density.** Three modes (`comfortable` / `compact` / `dense`) switch row and
  field heights uniformly via CSS variables. Ops users live in dense.
- **Dense data-app aesthetic.** Warm neutral base, strong indigo accent, 1px
  borders, `radius-md` default, subtle shadows only on overlays.
- **Accessibility.** Radix under every interactive primitive. Focus rings token
  driven. Reduced-motion honored.

## Multi-tenancy

The framework supports **three deployment modes** via environment variables.

| Mode | `DB_KIND` | `MULTISITE` | What it gives you |
|---|---|---|---|
| **Default (dev)** | `sqlite` | `0` | Zero-config. One SQLite file. Single implicit `Main` tenant. |
| **Single-site prod** | `postgres` | `0` | Postgres, one tenant. Useful for self-hosted per-customer deployments. |
| **Multi-site prod** | `postgres` | `1` | Schema-per-tenant. Each tenant gets its own Postgres schema (`tenant_<slug>`). Requests route to the right schema via subdomain / header / path. |

### How tenant resolution works

Every `/api/*` request passes through `tenantMiddleware` which resolves the active tenant in this priority:

1. **Session-bound tenant** (the user switched workspaces) — stored in `sessions.tenant_id`
2. **Domain table match** — `public.tenant_domains` can map arbitrary hosts to a tenant
3. **Strategy-specific** (picked by `TENANT_RESOLUTION`):
   - `subdomain`: `acme.gutu.app` → tenant with slug `acme`
   - `header`: request header `x-tenant: acme`
   - `path`: request path prefix `/t/acme/…`
4. **Default fallback**: the `defaultTenantSlug` tenant (always exists at boot)

The resolved tenant is stored in `AsyncLocalStorage` (`TenantContext`) and available to every downstream handler. WebSocket connections also resolve tenant at upgrade time and only receive broadcasts for their own tenant.

### Data isolation

- Per-tenant data (`records`, `audit_events`, `files`) lives in the tenant's schema.
- Global data (`tenants`, `users`, `sessions`, `memberships`, `domains`) lives in `public`.
- Users are global; **memberships** decide which tenants they can access and with what role.
- Hard-delete a tenant ⇒ drops its schema + memberships + domains + files in one transaction. The default tenant is protected from hard-delete.

### Enabling multi-site

1. Start Postgres, create a database (e.g. `createdb gutu`).
2. Copy `.env.example` to `admin-panel/backend/.env` and set:
   ```
   DB_KIND=postgres
   DATABASE_URL=postgres://user:pass@localhost:5432/gutu
   MULTISITE=1
   TENANT_RESOLUTION=subdomain
   ROOT_DOMAIN=gutu.app
   SUPER_ADMIN_EMAIL=you@gutu.app
   ```
3. `bun run dev` — the server runs `migrateGlobal()` (public schema) and `migrateTenantSchema()` for the default tenant automatically.
4. Sign in, visit **/platform/tenants**, click **New tenant**. The backend creates a new Postgres schema and runs per-tenant migrations in one atomic transaction.
5. Point DNS at the server and create subdomain tenants, or attach custom domains via `POST /api/tenants/:id/domains`.

### What the frontend does

- `/api/config` tells the frontend the mode. In single-site mode the **WorkspaceSwitcher** self-hides when there's only one tenant.
- `AuthGuard` loads memberships after login. `authStore.activeTenant` / `availableTenants` are the canonical state.
- The **WorkspaceSwitcher** in the topbar shows the active tenant and lets users switch. Switching POSTs `/api/auth/switch-tenant`, clears the frontend cache, and reloads the page so WebSocket reconnects scoped to the new tenant.
- **/platform/tenants** is a full admin CRUD: create, archive, hard-delete (typed confirm), manage memberships + domains.

### Hardening guarantees

- Tenant id is **never** read from the request body — the middleware derives it from session + host.
- Schema names are validated (`[a-z_][a-z0-9_]*`) before being interpolated into DDL.
- Hard-delete requires two checks: the user confirms the slug, and the default tenant is blocked by the route handler.
- All tenant mutations write to `audit_events` with actor, action, and IP.
- WebSocket broadcasts are filtered by tenant on send — a client subscribed as tenant A cannot receive tenant B events.
- Files live under `<FILES_ROOT>/<schema_name>/…`, so tenant deletion is a single `rm -rf`.

## Plug-and-play + customization

Every plugin is physically self-contained. For each plugin, the entire surface
— resources, list/form/detail schemas, and any hand-crafted custom pages —
lives next to the plugin file. No plugin reaches into a shared `custom-pages`
folder. Moving a plugin to its own repo is a folder copy.

```
src/examples/
├── accounting.ts              plugin config
├── accounting-pages.tsx       its custom pages
├── ai-core.ts  / ai-core-pages.tsx
├── treasury.ts / treasury-pages.tsx
├── booking/{plugin.tsx, BookingCalendarPage.tsx, BookingDashboardKpis.tsx}
├── crm/{plugin.tsx, CrmPages.tsx, …}
├── audit/{plugin.tsx, AuditEventDetailPage.tsx, LiveAuditPage.tsx}
└── _shared/live-hooks.ts      framework-level realtime hooks (not plugin code)
```

Consumers drop a plugin into `plugins[]` in `AdminRoot` and its nav, list,
form, detail, and custom pages are live — no app-side wiring. To **customize**
without forking, pass an `extraViews` entry whose `id` matches an existing view
id; the shell's last-write-wins lookup picks the override:

```ts
// Override the built-in cash position page, keep everything else.
mountPlugin({
  ...treasuryPlugin,
  admin: {
    ...treasuryPlugin.admin,
    views: [
      ...treasuryPlugin.admin.views.filter((v) => v.id !== "treasury.cash.view"),
      myCustomTreasuryView, // same id, new render()
    ],
  },
});
```

Same pattern for nav entries (`id`), resources (`id`), and commands. Schema +
contracts stay stable; only the render swaps.

## Plugin contract surface

The type boundary between a plugin and the shell is `AdminContribution`
(`src/contracts/plugin.ts`):

```ts
interface AdminContribution {
  nav?: readonly NavItem[];
  navSections?: readonly NavSection[];
  resources?: readonly ResourceDefinition[];
  views?: readonly View[];
  widgets?: readonly DashboardWidget[];
  globalActions?: readonly ActionDescriptor[];
  commands?: readonly CommandDescriptor[];
}
```

Plugins also receive an `ActionRuntime` at call time for side effects
(toast, navigate, refresh, confirm, create, update, delete) — never touching
the adapter directly.

## Runtime boundary

`ResourceClient` wraps a pluggable `ResourceAdapter`:

```ts
interface ResourceAdapter {
  list(resource, query): Promise<ListResult>
  get(resource, id): Promise<Record<string, unknown> | null>
  create(resource, data): Promise<Record<string, unknown>>
  update(resource, id, data): Promise<Record<string, unknown>>
  delete(resource, id): Promise<void>
}
```

The `MockBackend` is the default (supports filter/search/sort/pagination with
artificial latency so UX can be verified). Swap in a REST or GraphQL adapter
without touching any view, plugin, or shell code.

## Migration from the legacy admin libraries

The folder layout is already package-ready. To turn this into the 7 standalone
repos from `WORKSPACE_REPOS.md`:

| This folder | Extracts to | Notes |
| ----------- | ----------- | ----- |
| `src/tokens/` | `gutu-lib-ui-kit` (extend existing) | Merge tokens. Keep public API shape. |
| `src/primitives/` | `gutu-lib-ui-primitives` (new) | Publishes a11y primitives; depends on ui-kit. |
| `src/admin-primitives/` | `gutu-lib-admin-widgets` (rebuild) | Absorbs parts of `-listview` and `-formview`. |
| `src/views/` | `gutu-lib-admin-{listview,formview,reporting}` (rebuild) | Split 1-to-1 by view type, keep contract surface. |
| `src/contracts/` | `gutu-lib-admin-contracts` (keep) | **Do not break.** Every domain plugin depends on this. |
| `src/builders/` | `gutu-lib-admin-builders` (keep, thin) | Becomes mostly re-exports + validation. |
| `src/shell/` | `gutu-lib-admin-shell` (rename from `-shell-workbench`) | Replaces the workbench lib. |
| `src/host/` + `src/runtime/` | `gutu-plugin-admin-shell` (rename) | Host plugin that mounts the shell into `gutu-core`. |

Migration order (incremental, no big-bang outage):
1. Tag current admin libs `legacy-*`.
2. Cut new packages from the folders above.
3. Flip `gutu-app-platform-dev-console` to the new shell — acceptance gate.
4. Port first-party plugins one-by-one. Each port is a visual diff; contract surface unchanged.
5. Delete `legacy-*` after the last plugin migrates.

## Verification this session

Ran and visually confirmed in the preview browser:

- All 3 plugins activate and their nav contributions appear grouped by section
  (Operations: Overview, Bookings, Contacts · Platform: Audit log, About audit).
- Dashboard (`/`): 4 KPI widgets + getting-started card render.
- Bookings (`/bookings`): 18 seeded rows, pageSize=10, sort, filters, selection,
  row + page actions, refresh button. Row click navigates to detail.
- CRM (`/contacts`): 38 seeded rows, pageSize=12, bulk delete (with confirm),
  mark VIP, stage + VIP filters.
- Audit (`/audit`): 40 rows, pageSize=15, relative time rendering, level badges.
- Custom view (`/audit/about`): renders static JSX.
- Create flow: `/bookings/new` → fill form → submit → redirects to `/bookings/:id`
  (detail view renders the newly-created record).
- Theme toggle (light ↔ dark) and density toggle (comfortable ↔ compact ↔ dense)
  persist to localStorage and re-apply on reload.
- Command palette (`⌘K`) opens, shows Navigation + Actions groups with all
  plugin contributions; Escape closes.
- `bun run typecheck` passes with no errors.

## Files

```
admin-panel/
├── package.json        vite, react, tailwind, radix, cmdk, zod
├── tailwind.config.ts  token-driven theme extension
├── tsconfig.json       strict, @/ path alias
├── vite.config.ts      bun-friendly; port 5173
├── index.html          bootstraps theme + density from localStorage
└── src/
    ├── app/            main.tsx + App.tsx (consumer glue)
    ├── tokens/         Tier 0 — design tokens (CSS vars)
    ├── primitives/     Tier 1 — 15 headless a11y primitives
    ├── admin-primitives/ Tier 2 — 11 composite surfaces
    ├── contracts/      Tier 5 — plugin/nav/view/action/command/resource types
    ├── builders/       Tier 6 — define* fluent APIs
    ├── runtime/        resource client + cache + mock backend + React hooks
    ├── views/          Tier 3 — List/Form/Detail/Dashboard renderers
    ├── shell/          Tier 4 — AppShell + router + registry + palette + hosts
    ├── host/           Tier 7 — AdminRoot + usePluginHost
    ├── examples/       booking, crm, audit demo plugins
    └── lib/            cn, id, emitter, format
```

## License

Same as the parent workspace.
