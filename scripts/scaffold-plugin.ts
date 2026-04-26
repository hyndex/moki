#!/usr/bin/env bun
/* Plugin scaffolder.
 *
 *   bun run scaffold:plugin <code> [--ui] [--worker]
 *
 * Examples:
 *   bun run scaffold:plugin fleet-core
 *   bun run scaffold:plugin invoicing-core --ui
 *   bun run scaffold:plugin reporting-core --ui --worker
 *
 * Creates a fully-wired plugin under
 *   plugins/gutu-plugin-<code>/
 *     ├── package.json                 (npm name, type=module, exports)
 *     ├── README.md                    (author quickstart)
 *     ├── tsconfig.base.json           (forms-core template)
 *     └── framework/builtin-plugins/<code>/
 *         ├── tsconfig.json            (path mappings to host SDK)
 *         └── src/host-plugin/
 *             ├── index.ts             (HostPlugin export with full lifecycle)
 *             ├── db/migrate.ts        (CREATE TABLE IF NOT EXISTS scaffold)
 *             ├── routes/<code>.ts     (Hono router with auth)
 *             ├── lib/index.ts         (lib barrel)
 *             └── ui/ (only if --ui)
 *                 ├── index.ts         (defineAdminUi barrel)
 *                 └── pages/HomePage.tsx
 *
 * Then prints what to add to admin-panel/backend/package.json["gutuPlugins"]
 * and admin-panel/{vite.config.ts, tsconfig.json} so the discovery loader
 * picks the plugin up. */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const code = argv[0];
if (!code || code.startsWith("--")) {
  console.error("usage: bun run scaffold:plugin <code> [--ui] [--worker]");
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]+-core$/.test(code)) {
  console.error(`error: <code> must be lowercase, hyphenated, and end in "-core" (got "${code}")`);
  process.exit(1);
}
const withUi = argv.includes("--ui");
const withWorker = argv.includes("--worker");

const ROOT = path.resolve(__dirname, "..");
const PLUGIN_DIR = path.join(ROOT, "plugins", `gutu-plugin-${code}`);
const HP = path.join(PLUGIN_DIR, "framework/builtin-plugins", code, "src/host-plugin");

if (existsSync(PLUGIN_DIR)) {
  console.error(`error: plugin already exists at ${PLUGIN_DIR}`);
  process.exit(1);
}

const npmName = `@gutu-plugin/${code}`;
const packageJson = {
  name: npmName,
  version: "1.0.0",
  private: true,
  type: "module",
  exports: { ".": `./framework/builtin-plugins/${code}/src/host-plugin/index.ts` },
};

const readme = `# @gutu-plugin/${code}

Auto-scaffolded plugin. Edit \`framework/builtin-plugins/${code}/src/host-plugin/\` to add your own routes, schema, workers, and (if --ui) admin UI.

## Wiring up

1. Add to \`admin-panel/backend/package.json\`:
   \`\`\`json
   "gutuPlugins": ["${npmName}", ...]
   \`\`\`
2. Add tsconfig path in \`admin-panel/backend/tsconfig.json\`:
   \`\`\`json
   "${npmName}": ["../../plugins/gutu-plugin-${code}/framework/builtin-plugins/${code}/src/host-plugin"]
   \`\`\`
3. Restart the backend; you'll see your plugin listed in \`/api/_plugins\`.

## Lifecycle

- \`migrate()\` runs every boot (idempotent CREATE TABLE)
- \`install(ctx)\` runs once per (plugin, version)
- \`start(ctx)\` runs every boot, fires workers (use \`withLeadership\` for cluster-singletons)
- \`stop()\` runs on SIGTERM
- \`uninstall()\` runs on operator request via \`POST /api/_plugins/${code}/uninstall\`
`;

const indexTs = `/** Host-plugin contribution for ${code}.
 *
 *  Auto-scaffolded. Replace the example route + schema with your own. */
import type { HostPlugin } from "@gutu-host/plugin-contract";
${withWorker ? `import { withLeadership } from "@gutu-host/leader";\n` : ""}import { migrate } from "./db/migrate";
import { ${camel(code)}Routes } from "./routes/${code}";

${withWorker ? `let stopLeader: (() => void) | null = null;\n\n` : ""}export const hostPlugin: HostPlugin = {
  id: "${code}",
  version: "1.0.0",
  manifest: {
    label: "${titleCase(code)}",
    description: "TODO: write a one-line description.",
    icon: "Box",
    vendor: "TODO",
    permissions: ["db.read", "db.write", "audit.write"],
  },
  dependsOn: [],
  migrate,
  routes: [
    { mountPath: "/${code.replace(/-core$/, "")}", router: ${camel(code)}Routes },
  ],${
    withWorker
      ? `
  start: () => {
    stopLeader = withLeadership("${code}:worker", () => {
      // TODO: spin up your background worker here.
      const interval = setInterval(() => {
        // your tick
      }, 30_000);
      return () => clearInterval(interval);
    });
  },
  stop: () => { stopLeader?.(); stopLeader = null; },`
      : ""
  }
  health: async () => ({ ok: true }),
};

export * from "./lib";
`;

const migrateTs = `/** ${code} schema. Drop the plugin → drop the tables.
 *
 *  CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS so this is
 *  safe to re-run on every boot. */
import { db } from "@gutu-host";

export function migrate(): void {
  db.exec(\`
    CREATE TABLE IF NOT EXISTS ${code.replace(/-/g, "_")}_items (
      id          TEXT PRIMARY KEY,
      tenant_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      created_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ${code.replace(/-/g, "_")}_items_tenant_idx
      ON ${code.replace(/-/g, "_")}_items(tenant_id);
  \`);
}
`;

const routeTs = `/** ${code} REST API.
 *
 *  Routes:
 *    GET   /            list rows for the current tenant
 *    POST  /            create a row
 *    DELETE /:id        delete a row
 *
 *  Wraps everything in requireAuth + tenant scoping for free. */
import { Hono, requireAuth, currentUser, getTenantContext, db, uuid, nowIso, recordAudit } from "@gutu-host";

export const ${camel(code)}Routes = new Hono();
${camel(code)}Routes.use("*", requireAuth);

const TABLE = "${code.replace(/-/g, "_")}_items";

${camel(code)}Routes.get("/", (c) => {
  const tenantId = getTenantContext().tenantId;
  const rows = db
    .prepare(\`SELECT * FROM \${TABLE} WHERE tenant_id = ? ORDER BY created_at DESC\`)
    .all(tenantId);
  return c.json({ rows });
});

${camel(code)}Routes.post("/", async (c) => {
  const user = currentUser(c);
  const tenantId = getTenantContext().tenantId;
  const body = (await c.req.json().catch(() => ({}))) as { name?: string };
  if (typeof body.name !== "string" || body.name.length === 0) {
    return c.json({ error: "name (string) required", code: "invalid-argument" }, 400);
  }
  const id = uuid();
  const now = nowIso();
  db.prepare(\`INSERT INTO \${TABLE} (id, tenant_id, name, created_by, created_at) VALUES (?, ?, ?, ?, ?)\`)
    .run(id, tenantId, body.name, user.email, now);
  recordAudit({
    actor: user.email,
    action: "${code}.created",
    resource: "${code}",
    recordId: id,
    payload: { name: body.name },
  });
  return c.json({ id, tenantId, name: body.name, createdBy: user.email, createdAt: now }, 201);
});

${camel(code)}Routes.delete("/:id", (c) => {
  const user = currentUser(c);
  const tenantId = getTenantContext().tenantId;
  const id = c.req.param("id");
  const result = db.prepare(\`DELETE FROM \${TABLE} WHERE id = ? AND tenant_id = ?\`).run(id, tenantId);
  if (result.changes === 0) return c.json({ error: "not found" }, 404);
  recordAudit({ actor: user.email, action: "${code}.deleted", resource: "${code}", recordId: id });
  return c.json({ ok: true });
});
`;

const libIndexTs = `// Cross-plugin exports go here. Other plugins import via "${npmName}".
export {};
`;

const tsconfigJson = `{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@gutu-host": ["../../../../../admin-panel/backend/src/host/index.ts"],
      "@gutu-host/*": ["../../../../../admin-panel/backend/src/host/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
`;

const tsconfigBaseJson = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "types": ["bun-types", "react", "react-dom"],
    "jsx": "react-jsx",
    "baseUrl": "."
  }
}
`;

const uiIndexTs = withUi
  ? `/** ${code} admin UI: a single page + nav entry + command. */
import { defineAdminUi } from "@gutu-host/plugin-ui-contract";
import { HomePage } from "./pages/HomePage";

export const adminUi = defineAdminUi({
  id: "${code}",
  pages: [
    {
      id: "${code}.home",
      path: "/${code.replace(/-core$/, "")}",
      title: "${titleCase(code)}",
      description: "TODO: describe what this page does.",
      Component: HomePage,
      icon: "Box",
    },
  ],
  navEntries: [
    {
      id: "${code}.nav.home",
      label: "${titleCase(code)}",
      icon: "Box",
      path: "/${code.replace(/-core$/, "")}",
      section: "settings",
      order: 100,
    },
  ],
  commands: [
    {
      id: "${code}.cmd.home",
      label: "Open ${titleCase(code)}",
      keywords: ["${code.split("-").join(" ")}"],
      run: () => { window.location.hash = "/${code.replace(/-core$/, "")}"; },
    },
  ],
});

export { HomePage } from "./pages/HomePage";
`
  : "";

const uiPageTsx = withUi
  ? `import * as React from "react";

export function HomePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">${titleCase(code)}</h1>
      <p className="text-text-muted mt-2">TODO: build the page.</p>
    </div>
  );
}
`
  : "";

/* ---- write everything ---- */

mkdirSync(HP, { recursive: true });
mkdirSync(path.join(HP, "db"), { recursive: true });
mkdirSync(path.join(HP, "routes"), { recursive: true });
mkdirSync(path.join(HP, "lib"), { recursive: true });

writeFileSync(path.join(PLUGIN_DIR, "package.json"), JSON.stringify(packageJson, null, 2) + "\n");
writeFileSync(path.join(PLUGIN_DIR, "README.md"), readme);
writeFileSync(path.join(PLUGIN_DIR, "tsconfig.base.json"), tsconfigBaseJson);
writeFileSync(path.join(PLUGIN_DIR, "framework/builtin-plugins", code, "tsconfig.json"), tsconfigJson);
writeFileSync(path.join(HP, "index.ts"), indexTs);
writeFileSync(path.join(HP, "db/migrate.ts"), migrateTs);
writeFileSync(path.join(HP, `routes/${code}.ts`), routeTs);
writeFileSync(path.join(HP, "lib/index.ts"), libIndexTs);

if (withUi) {
  mkdirSync(path.join(HP, "ui/pages"), { recursive: true });
  writeFileSync(path.join(HP, "ui/index.ts"), uiIndexTs);
  writeFileSync(path.join(HP, "ui/pages/HomePage.tsx"), uiPageTsx);
}

console.log(`✅ Scaffolded plugin at ${PLUGIN_DIR}`);
console.log("\nNext steps:");
console.log(`  1. Add to admin-panel/backend/package.json["gutuPlugins"]:`);
console.log(`     "${npmName}"`);
console.log(`  2. Add to admin-panel/backend/tsconfig.json paths:`);
console.log(`     "${npmName}": ["../../plugins/gutu-plugin-${code}/framework/builtin-plugins/${code}/src/host-plugin"]`);
if (withUi) {
  console.log(`  3. Add to admin-panel/tsconfig.json paths:`);
  console.log(`     "@gutu-plugin-ui/${code}": ["../plugins/gutu-plugin-${code}/framework/builtin-plugins/${code}/src/host-plugin/ui/index.ts"]`);
  console.log(`  4. Add the same alias to admin-panel/vite.config.ts.`);
  console.log(`  5. Add \`import { adminUi as ${camel(code)}Ui } from "@gutu-plugin-ui/${code}"\` to admin-panel/src/examples/admin-tools/plugin.tsx and append to ALL_PLUGINS.`);
}
console.log(`  ${withUi ? 6 : 3}. Restart the backend; check /api/_plugins for "${code}".`);

function camel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}
function titleCase(s: string): string {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bCore\b/, "Core");
}
