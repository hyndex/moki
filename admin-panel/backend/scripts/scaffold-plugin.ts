#!/usr/bin/env bun
/* Scaffold a plugin folder mirroring the structure of forms-core etc.
 *
 *   bun scripts/scaffold-plugin.ts <code> <packageName>
 *
 * Example:
 *   bun scripts/scaffold-plugin.ts webhooks-core webhooks-core
 *
 * This creates:
 *   plugins/gutu-plugin-<packageName>/framework/builtin-plugins/<code>/src/host-plugin/{index.ts,db/migrate.ts}
 *   plugins/gutu-plugin-<packageName>/package.json
 *   plugins/gutu-plugin-<packageName>/tsconfig.json
 *
 * After scaffolding, drop route files into routes/ + lib/ inside host-plugin
 * and add them to host-plugin/index.ts. */
import path from "node:path";
import fs from "node:fs";

const FW_ROOT = path.resolve(__dirname, "../../../plugins");
const SHELL = path.resolve(__dirname, "../..");

const code = process.argv[2];
const pkg = process.argv[3] ?? code;
if (!code) {
  console.error("usage: bun scaffold-plugin.ts <code> [packageName]");
  process.exit(1);
}

const root = path.join(FW_ROOT, `gutu-plugin-${pkg}`);
const hp = path.join(root, "framework/builtin-plugins", code, "src/host-plugin");

fs.mkdirSync(path.join(hp, "routes"), { recursive: true });
fs.mkdirSync(path.join(hp, "lib"), { recursive: true });
fs.mkdirSync(path.join(hp, "db"), { recursive: true });

const writeIfMissing = (p: string, body: string) => {
  if (fs.existsSync(p)) return;
  fs.writeFileSync(p, body);
};

writeIfMissing(path.join(hp, "index.ts"), `/** Host-plugin contribution for ${code}. */
import type { HostPlugin } from "@gutu-host/plugin-contract";
import { migrate } from "./db/migrate";

export const hostPlugin: HostPlugin = {
  id: "${code}",
  version: "1.0.0",
  dependsOn: [],
  migrate,
  routes: [],
};

export * from "./lib";
`);

writeIfMissing(path.join(hp, "db/migrate.ts"), `import type { DB } from "@gutu-host";

/** ${code} schema. CREATE TABLE IF NOT EXISTS so it's safe to re-run. */
export function migrate(db: DB): void {
  // Add CREATE TABLE statements here.
}
`);

writeIfMissing(path.join(hp, "lib/index.ts"), "export {};\n");

writeIfMissing(path.join(root, "package.json"), JSON.stringify({
  name: `@gutu-plugin/${pkg}`,
  version: "1.0.0",
  private: true,
  type: "module",
  exports: {
    ".": `./framework/builtin-plugins/${code}/src/host-plugin/index.ts`,
  },
}, null, 2) + "\n");

const tsconfigPath = path.join(root, "tsconfig.json");
if (!fs.existsSync(tsconfigPath)) {
  // Read forms-core tsconfig as a template
  const tmpl = path.join(FW_ROOT, "gutu-plugin-forms-core/tsconfig.json");
  if (fs.existsSync(tmpl)) fs.copyFileSync(tmpl, tsconfigPath);
}

console.log(`scaffolded ${root}`);
console.log(`hp: ${hp}`);
