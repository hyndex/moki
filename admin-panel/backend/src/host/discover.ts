/** Decentralized plugin discovery.
 *
 *  Strategies (tried in order, first non-empty result wins):
 *
 *    1. Explicit list: `package.json` "gutuPlugins": ["@acme/gutu-foo", ...]
 *       — npm-style. Plugin author publishes to a registry, host
 *       installs with `bun add` and adds the package name here.
 *
 *    2. Filesystem scan of `plugins/gutu-plugin-*` siblings — for
 *       monorepo development. Discovers every plugin that has a
 *       package.json with name "@gutu-plugin/<code>".
 *
 *    3. Explicit allowlist via env: GUTU_PLUGINS="@gutu-plugin/foo,@gutu-plugin/bar"
 *       — for when discovery should be locked down (production).
 *
 *  Each strategy returns a list of import specifiers; the caller does
 *  `await import(spec)` and pulls out the `hostPlugin` named export.
 *
 *  This file is the BACKEND discoverer; the frontend has its own
 *  Vite-time discovery that mirrors strategy 1 (vite.config.ts reads
 *  the same package.json field). */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

import type { HostPlugin } from "./plugin-contract";

interface PackageJsonShape {
  gutuPlugins?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJson(file: string): PackageJsonShape | null {
  try { return JSON.parse(readFileSync(file, "utf-8")) as PackageJsonShape; }
  catch { return null; }
}

/** 1. Explicit list in `package.json` of the host (admin-panel/backend/package.json). */
function fromPackageJson(): string[] {
  const pkgPath = path.resolve(__dirname, "../../package.json");
  const pkg = readPackageJson(pkgPath);
  return pkg?.gutuPlugins?.filter(Boolean) ?? [];
}

/** 2. Monorepo sibling scan: every `plugins/gutu-plugin-*` package
 *  with a package.json gets included. */
function fromMonorepo(): string[] {
  const root = path.resolve(__dirname, "../../../..", "plugins");
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const name of readdirSync(root)) {
    if (!name.startsWith("gutu-plugin-")) continue;
    const pkgPath = path.join(root, name, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = readPackageJson(pkgPath);
    if (!pkg) continue;
    // Use the package name as the import specifier so the path-mapping
    // in tsconfig kicks in.
    const npmName = (pkg as { name?: string }).name;
    if (typeof npmName === "string") out.push(npmName);
  }
  return out;
}

/** 3. Env-driven allowlist (for prod where you want to pin the set). */
function fromEnv(): string[] {
  const raw = process.env.GUTU_PLUGINS?.trim();
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

export function discoverPluginSpecs(): string[] {
  const env = fromEnv();
  if (env.length > 0) return env;
  const explicit = fromPackageJson();
  if (explicit.length > 0) return explicit;
  return fromMonorepo();
}

/** Resolve specs → loaded HostPlugins. Failed imports are logged but
 *  don't abort the discovery — those plugins are simply missing. */
export async function loadDiscoveredPlugins(): Promise<HostPlugin[]> {
  const specs = discoverPluginSpecs();
  const out: HostPlugin[] = [];
  const errors: Array<{ spec: string; error: string }> = [];
  for (const spec of specs) {
    try {
      const mod = (await import(spec)) as { hostPlugin?: HostPlugin };
      if (mod.hostPlugin && typeof mod.hostPlugin === "object" && typeof mod.hostPlugin.id === "string") {
        out.push(mod.hostPlugin);
      } else {
        errors.push({ spec, error: "package does not export `hostPlugin`" });
      }
    } catch (err) {
      errors.push({ spec, error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (errors.length > 0) {
    console.warn(`[plugin-host] ${errors.length} plugin(s) failed to load:`);
    for (const e of errors) console.warn(`  ${e.spec}: ${e.error}`);
  }
  console.log(`[plugin-host] discovered ${out.length} plugin(s): ${out.map((p) => p.id).join(", ")}`);
  return out;
}
