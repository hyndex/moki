# Testing

Four shell suites (149 probes), plugin-author harness patterns, CI
integration, debugging tips.

---

## 1. The four shell suites

Live in `admin-panel/scripts/`. Each is self-contained, runs Playwright
headless, takes screenshots, writes JSON reports.

| Suite | Probes | Verifies | Runtime |
|---|---|---|---|
| `e2e-crud.ts` | 53 | Bearer-auth API + UI rendering for every plugin's CRUD | ~60s |
| `visual-smoke.ts` | 10 | Page renders + zero JS/network errors | ~30s |
| `visual-interactions.ts` | 10 | Dialogs open + Cmd-K + list/detail flow | ~45s |
| `bug-hunt.ts` | 76 | Adversarial probes: validation, tenancy, auth guards, listing | ~60s |
| **Total** | **149** | | **~3 min** |

### 1.1 Running

```bash
# Bring up the system first
cd admin-panel/backend && bun run src/main.ts &
cd admin-panel && bun run dev:ui &

# Run any (or all) suites
cd admin-panel
bun run scripts/e2e-crud.ts
bun run scripts/visual-smoke.ts
bun run scripts/visual-interactions.ts
bun run scripts/bug-hunt.ts
```

Each script logs results in real time. JSON reports + screenshots land
in `tmp/visual-smoke/` and `tmp/e2e-crud/` and `tmp/bug-hunt/`.

### 1.2 What e2e-crud covers

For each plugin:
1. POST a record via the plugin's REST endpoint (using a Bearer token)
2. Verify the row appears in the UI list
3. PUT/PATCH if applicable; verify update visible
4. DELETE; verify the row is gone
5. Assert per-route concerns (e.g. webhook delivery, render output)

Covers: webhooks, api-tokens, custom-fields, property-setters,
naming-series, print-formats, letter-heads, notification-rules,
workflows, contacts (CRM), 6 resource read paths, Cmd-K palette.

### 1.3 What visual-smoke covers

Logs in, navigates to each settings page + landing, takes a screenshot,
asserts:
- Body length > 0 (page rendered)
- No `pageerror` events
- No 4xx or 5xx network requests

10 routes: landing, custom-fields, property-setters, naming-series,
print-formats, notification-rules, bulk-import, workflows, webhooks,
api-tokens.

### 1.4 What visual-interactions covers

Drives the actual UI:
- Click "+ Add field" → dialog opens
- Click "+ New series" → dialog opens
- Cmd-K → palette opens, search returns results
- Bulk-import wizard renders 3 steps
- Click a contact row → detail page renders

### 1.5 What bug-hunt covers

Adversarial probes against the new infrastructure:
- `/api/_plugins` endpoint contract (list, single, missing, sub-paths)
- Leader leases (6 cluster-singletons, valid expiry, holder)
- Per-tenant enablement (validation, persist, default-on)
- Auth guards (no token → 401, bad token → 401)
- Uninstall edge cases
- Manifest permissions (valid against allowed set)
- Decentralized discovery (every package.json entry loaded)
- CRUD edge cases (bad URLs, bad patterns, empty arrays, duplicate keys,
  missing template vars, partial PATCH, idempotent DELETE)
- Cross-tenant data leak attempts
- Health endpoint shape
- Pagination (limit, offset, negative)

---

## 2. Plugin-author test patterns

### 2.1 Lifecycle test

Verify the plugin's contract surface is well-formed:

```ts
// plugins/gutu-plugin-fleet-core/tests/lifecycle.test.ts
import { test, expect } from "bun:test";
import { hostPlugin } from "../framework/builtin-plugins/fleet-core/src/host-plugin";

test("identity", () => {
  expect(hostPlugin.id).toBe("fleet-core");
  expect(hostPlugin.version).toMatch(/^\d+\.\d+\.\d+$/);
});

test("manifest declares required permissions", () => {
  const perms = hostPlugin.manifest?.permissions ?? [];
  expect(perms).toContain("db.write");
  expect(perms).toContain("audit.write");
});

test("dependsOn shape", () => {
  for (const dep of hostPlugin.dependsOn ?? []) {
    if (typeof dep === "object") {
      expect(dep.id).toBeTruthy();
      expect(dep.versionRange).toMatch(/^[\^~>=]/);
    }
  }
});

test("provides + consumes are arrays", () => {
  expect(Array.isArray(hostPlugin.provides ?? [])).toBe(true);
  expect(Array.isArray(hostPlugin.consumes ?? [])).toBe(true);
});

test("routes have valid mountPaths", () => {
  for (const r of hostPlugin.routes ?? []) {
    expect(r.mountPath).toMatch(/^\/[a-z][a-z0-9-/]*$/);
    expect(r.router).toBeDefined();
  }
});

test("migrate is idempotent", () => {
  // Second invocation must not throw — schema is CREATE TABLE IF NOT EXISTS
  hostPlugin.migrate?.();
  expect(() => hostPlugin.migrate?.()).not.toThrow();
});

test("health probe returns the right shape", async () => {
  if (!hostPlugin.health) return;
  const h = await hostPlugin.health();
  expect(typeof h.ok).toBe("boolean");
});
```

### 2.2 Schema test

```ts
import { db } from "@gutu-host";
import { migrate } from "../framework/builtin-plugins/fleet-core/src/host-plugin/db/migrate";

test("migration creates fleet_vehicles", () => {
  migrate();
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='fleet_vehicles'"
  ).get();
  expect(row).toBeDefined();
});

test("indexes are created", () => {
  const rows = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'fleet_vehicles_%'"
  ).all();
  expect(rows.length).toBeGreaterThan(0);
});
```

### 2.3 Route test (unit-style)

For pure-function logic, test directly:

```ts
import { Hono } from "@gutu-host";
import { fleetRoutes } from "../framework/builtin-plugins/fleet-core/src/host-plugin/routes/fleet-core";

test("GET / requires auth", async () => {
  const app = new Hono();
  app.route("/api/fleet", fleetRoutes);
  const res = await app.request("/api/fleet");
  expect(res.status).toBe(401);
});
```

### 2.4 Integration test (full-stack)

Spin up the shell with just your plugin loaded:

```ts
import { test, expect, beforeAll, afterAll } from "bun:test";

let cleanup: () => Promise<void>;
let baseUrl: string;
let token: string;

beforeAll(async () => {
  process.env.GUTU_PLUGINS = "@gutu-plugin/fleet-core";
  process.env.NODE_ENV = "test";
  process.env.PORT = "3344";
  process.env.DB_PATH = "/tmp/test-fleet.db";

  // Boot via main.ts (have it export a bootForTest helper)
  const { bootForTest } = await import("../../../admin-panel/backend/src/main");
  const server = await bootForTest();
  baseUrl = `http://127.0.0.1:${process.env.PORT}`;
  cleanup = () => server.stop();

  // Sign in to get a token
  const r = await fetch(`${baseUrl}/api/auth/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "test" }),
  });
  token = (await r.json()).token;
});
afterAll(async () => { await cleanup(); });

test("POST /api/fleet creates a vehicle", async () => {
  const r = await fetch(`${baseUrl}/api/fleet`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "F-150", year: 2024 }),
  });
  expect(r.status).toBe(201);
  const body = await r.json();
  expect(body.id).toBeTruthy();
  expect(body.name).toBe("F-150");
});

test("GET /api/fleet lists the vehicle", async () => {
  const r = await fetch(`${baseUrl}/api/fleet`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(r.status).toBe(200);
  const body = await r.json();
  expect(body.rows.length).toBeGreaterThan(0);
});
```

### 2.5 Frontend test (Playwright)

If your plugin ships UI:

```ts
import { test, expect } from "@playwright/test";

test("vehicles page renders empty state", async ({ page }) => {
  await page.goto("http://localhost:5173/");
  await page.fill('input[type=email]', 'chinmoy@gutu.dev');
  await page.fill('input[type=password]', 'password');
  await page.click('button:has-text("Sign in")');
  await page.waitForURL(/dashboards|home/);

  await page.goto("http://localhost:5173/#/fleet/vehicles");
  await expect(page.getByText("No vehicles yet")).toBeVisible();
  await expect(page.getByRole('button', { name: /\+ Add vehicle/i })).toBeVisible();
});

test("creating a vehicle adds it to the list", async ({ page }) => {
  // ... sign in ...
  await page.goto("http://localhost:5173/#/fleet/vehicles");
  await page.click('button:has-text("+ Add vehicle")');
  await page.fill('input[name="name"]', 'F-150 Test');
  await page.fill('input[name="year"]', '2024');
  await page.click('button:has-text("Save")');
  await expect(page.getByText("F-150 Test")).toBeVisible();
});
```

### 2.6 Worker / leader-election test

Mock the `meta` table, simulate two callers, verify only one wins:

```ts
import { acquireOnce, withLeadership } from "@gutu-host/leader";

test("acquireOnce serialises", () => {
  const key = `test:${Date.now()}`;
  expect(acquireOnce(key)).toBe(true);
  expect(acquireOnce(key)).toBe(false);   // second call loses
});

test("withLeadership starts at most one worker", async () => {
  let started = 0;
  const stop1 = withLeadership(`test:lead:${Date.now()}`, () => {
    started++;
    return () => started--;
  });
  const stop2 = withLeadership(`test:lead:${Date.now()}`, () => {
    started++;
    return () => started--;
  });
  await new Promise((r) => setTimeout(r, 50));
  expect(started).toBe(1);
  stop1();
  stop2();
});
```

---

## 3. CI integration

`.github/workflows/ci.yml` runs all four suites + typecheck + docker
build on every push and PR:

```yaml
jobs:
  test:
    steps:
      - actions/checkout
      - oven-sh/setup-bun
      - bun install
      - bunx playwright install chromium
      - start backend
      - start frontend
      - bun run scripts/e2e-crud.ts
      - bun run scripts/visual-smoke.ts
      - bun run scripts/visual-interactions.ts
      - bun run scripts/bug-hunt.ts
      - upload backend log on failure
      - upload screenshots on failure
  typecheck:
    steps:
      - bun run typecheck (backend + frontend)
  docker-build:
    steps:
      - docker build
      - smoke-run image; verify /api/health
```

Plugins shipped as separate repos can run a subset:
```yaml
# In each plugin repo's CI
- bun test                             # the plugin's own tests
- (optionally) clone the host shell + run the e2e suites against
  HOST_PLUGINS=@gutu-plugin/<this>
```

---

## 4. Test environments

### 4.1 Local development

- Use `bun run dev` from `admin-panel/backend` (HMR on)
- Use `bun run dev:ui` from `admin-panel` (HMR on)
- Tests target `http://127.0.0.1:3333` (backend) and
  `http://127.0.0.1:5173` (frontend)

### 4.2 CI

- Backend: `bun run src/main.ts` (no HMR)
- Frontend: `bun run dev:ui` (Vite dev server is fine for headless)
- Tests target the same localhost ports

### 4.3 Production smoke

After every deploy, run a subset of `bug-hunt.ts` against the
production URL:

```bash
BASE=https://api.example.com bun run scripts/bug-hunt.ts
```

(The harnesses already accept `BASE` and `API` env overrides.)

---

## 5. Database isolation

The shell uses a single SQLite file (`data.db` by default). Tests CAN
share the dev DB but it accumulates rows.

### 5.1 Test-only DB

```bash
DB_PATH=/tmp/test-$(date +%s).db bun run scripts/e2e-crud.ts
```

The plugin loader will run all migrations on the empty DB, then run
the seed (if you set `SEED_FORCE=1`).

### 5.2 Cleanup between tests

Each suite cleans up after itself by deleting the records it created.
For belt-and-suspenders cleanup:
```bash
rm -f /tmp/test-*.db
```

---

## 6. Debugging failed tests

### 6.1 Get the failure log

The harness prints failures inline. To see more:
```bash
bun run scripts/e2e-crud.ts 2>&1 | tee /tmp/run.log
```

### 6.2 Capture screenshots

`visual-smoke` and `visual-interactions` always capture screenshots in
`tmp/visual-smoke/`. Open the relevant `.png` to see what the browser
saw.

### 6.3 Browser console + network logs

Each Playwright run captures `pageerror` events. The harness prints
them at the end. For deeper debugging, modify the harness to add:

```ts
page.on("console", (m) => console.log(`[console.${m.type()}] ${m.text()}`));
page.on("response", (r) => {
  if (r.status() >= 400) console.log(`[network] ${r.status()} ${r.url()}`);
});
```

### 6.4 Backend log

In dev, the backend prints structured JSON to stdout. `tail -f` it
during a test run; correlate failures by `traceId`.

### 6.5 Common gotchas

- **"page rendered but assertion failed"** — usually a timing issue.
  Increase the `waitForTimeout` after `goto`. The harnesses use 2.5s
  default; some pages need 3-5s on cold-start.
- **"401 in test that worked manually"** — the bearer token has
  expired. Re-run login. (The harness re-logs in on each invocation.)
- **"flaky every other run"** — usually a worker side effect. Did
  your last test fail to clean up? Check `/api/_plugins/_leases` —
  stale leases?
- **"works locally, fails in CI"** — race condition between backend
  boot + first request. Increase the boot poll loop in the workflow.

---

## 7. Plugin-specific test conventions

### 7.1 Folder layout

```
plugins/gutu-plugin-fleet-core/
├── tests/
│   ├── lifecycle.test.ts              # contract surface
│   ├── schema.test.ts                  # migrate idempotency
│   ├── routes.test.ts                  # route handlers (unit)
│   ├── integration.test.ts             # full-stack (with shell)
│   └── ui.spec.ts                      # Playwright browser tests
└── ...
```

### 7.2 Naming

- `*.test.ts` for Bun tests
- `*.spec.ts` for Playwright tests

### 7.3 Shared test utilities

```ts
// plugins/gutu-plugin-fleet-core/tests/helpers.ts
import { db, uuid } from "@gutu-host";

export function seedTestVehicle(tenantId: string): string {
  const id = uuid();
  db.prepare(
    "INSERT INTO fleet_vehicles (id, tenant_id, name, ...) VALUES (?, ?, ?, ?)",
  ).run(id, tenantId, "Test Vehicle", ...);
  return id;
}

export function clearTestVehicles(tenantId: string): void {
  db.prepare("DELETE FROM fleet_vehicles WHERE tenant_id = ?").run(tenantId);
}
```

---

## 8. The "make sure my plugin doesn't break the host" workflow

Before publishing a new plugin version:

```bash
# 1. Add your plugin to the host's gutuPlugins array (locally)
# 2. Restart the backend
cd admin-panel/backend && bun run src/main.ts &

# 3. Run the four shell suites
cd admin-panel
bun run scripts/e2e-crud.ts            # MUST be 53/53
bun run scripts/visual-smoke.ts        # MUST be 10/10
bun run scripts/visual-interactions.ts # MUST be 10/10
bun run scripts/bug-hunt.ts            # MUST be 76/76

# Total: 149/149. If anything fails, your plugin broke the host.
```

---

## 9. The end-to-end test pyramid

```
                   ┌────────────────┐
                   │   bug-hunt     │   76 adversarial probes
                   ├────────────────┤
                   │  e2e-crud      │   53 CRUD scenarios
                   ├────────────────┤
                   │  v-smoke       │   10 page renders
                   │  v-interact    │   10 dialog flows
                   ├────────────────┤
                   │ Plugin tests   │   N per plugin (unit + integration)
                   ├────────────────┤
                   │  Type checks   │   tsc --noEmit (every PR)
                   └────────────────┘
                  149 + plugin-specific
```

The shell guarantees 149/149. Plugins that follow this doc + the
checklist add their own bottom layer.
