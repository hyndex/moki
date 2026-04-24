/** Plugin loaders — discover plugins from the various distribution
 *  channels supported by the shell.
 *
 *  Each loader returns a list of `AnyPlugin` objects. The pluginHost is
 *  source-agnostic: it treats everything the same once loaded.
 *
 *  Supported sources:
 *    - Filesystem: `plugins/ * /index.ts` inside the admin-panel dir
 *                  (uses Vite's `import.meta.glob` so new folders are
 *                  auto-discovered — zero `App.tsx` edits).
 *    - URL / remote: `installFromURL` on the host (see pluginHost2).
 *    - NPM / workspace: `package.json` gutuPlugins[] entries (declarative;
 *                  resolved by Vite's module graph at build time).
 *
 *  The package.json scanner is intentionally cooperative: any dependency
 *  whose package.json has a `"gutuPlugin": true` flag is auto-loaded,
 *  letting the ecosystem distribute plugins via npm with zero manual
 *  wiring in the shell.
 */

import type { AnyPlugin } from "@/contracts/plugin-v2";
import { isV2Plugin } from "@/contracts/plugin-v2";

/* ================================================================== */
/* Filesystem loader                                                   */
/* ================================================================== */

/** Eagerly load every plugin under `src/plugins/ * /index.*`. When a new
 *  folder is dropped in, Vite picks it up automatically.
 *
 *  Vite's `import.meta.glob` is a compile-time transform — the literal
 *  call must appear verbatim in the source for Vite to rewrite it. We
 *  emit it in a try/catch so non-Vite bundlers (rollup, webpack, tests)
 *  silently fall back to an empty set. */
export async function loadFilesystemPlugins(): Promise<AnyPlugin[]> {
  let modules: Record<string, () => Promise<unknown>> = {};
  try {
    // Accept .ts, .tsx, .js, .jsx. Each call is individually transformed.
    modules = {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      ...((import.meta as any).glob("../plugins/*/index.ts") as Record<string, () => Promise<unknown>>),
      ...((import.meta as any).glob("../plugins/*/index.tsx") as Record<string, () => Promise<unknown>>),
      ...((import.meta as any).glob("../plugins/*/index.js") as Record<string, () => Promise<unknown>>),
      ...((import.meta as any).glob("../plugins/*/index.jsx") as Record<string, () => Promise<unknown>>),
      /* eslint-enable @typescript-eslint/no-explicit-any */
    };
  } catch {
    // eslint-disable-next-line no-console
    console.warn("[plugin-loader] import.meta.glob unavailable — filesystem loader disabled.");
    return [];
  }
  const out: AnyPlugin[] = [];
  const errors: { path: string; error: unknown }[] = [];
  const entries = Object.entries(modules);
  await Promise.all(
    entries.map(async ([path, load]) => {
      try {
        const mod = (await load()) as { default?: AnyPlugin } & Record<string, unknown>;
        const plugin = mod.default ?? findPluginExport(mod);
        if (plugin) out.push(plugin);
        else {
          // eslint-disable-next-line no-console
          console.warn(
            `[plugin-loader] "${path}" has no default export and no plugin-like export; skipping.`,
          );
        }
      } catch (err) {
        errors.push({ path, error: err });
        // eslint-disable-next-line no-console
        console.error(`[plugin-loader] failed to load "${path}":`, err);
      }
    }),
  );
  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[plugin-loader] ${errors.length} filesystem plugin(s) failed to load.`,
    );
  }
  return out;
}

/** Best-effort — find a plugin-like export in a module's named exports
 *  when no `default` is declared. Matches either v1 `{id, admin}` or v2
 *  `{manifest, activate}`. */
function findPluginExport(mod: Record<string, unknown>): AnyPlugin | undefined {
  for (const v of Object.values(mod)) {
    if (!v || typeof v !== "object") continue;
    if (isV2Plugin(v as AnyPlugin)) return v as AnyPlugin;
    if (
      "id" in (v as object) &&
      ("admin" in (v as object) || "onActivate" in (v as object))
    ) {
      return v as AnyPlugin;
    }
  }
  return undefined;
}

/* ================================================================== */
/* npm / workspace loader                                              */
/* ================================================================== */

/** Scan `package.json`'s `gutuPlugins` array at build time. Each entry is
 *  a module specifier; vite resolves them. Any module with a default v2
 *  plugin export is registered. The app's `App.tsx` doesn't need edits —
 *  adding a plugin is just `npm install @acme/gutu-warehouse` + one line
 *  in `gutuPlugins[]`. */
export async function loadNpmPlugins(
  specifiers: readonly string[],
): Promise<AnyPlugin[]> {
  const out: AnyPlugin[] = [];
  for (const spec of specifiers) {
    try {
      const mod = (await import(/* @vite-ignore */ spec)) as {
        default?: AnyPlugin;
      } & Record<string, unknown>;
      const plugin = mod.default ?? findPluginExport(mod);
      if (plugin) out.push(plugin);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[plugin-loader] npm "${spec}" failed`, err);
    }
  }
  return out;
}

/* ================================================================== */
/* Consolidated boot discovery                                         */
/* ================================================================== */

export interface DiscoveryResult {
  readonly explicit: readonly AnyPlugin[];
  readonly filesystem: readonly AnyPlugin[];
  readonly npm: readonly AnyPlugin[];
  /** Merged list — later loaders override earlier by id. */
  readonly all: readonly AnyPlugin[];
}

export async function discoverAllPlugins(args: {
  readonly explicit?: readonly AnyPlugin[];
  readonly npmSpecifiers?: readonly string[];
  readonly disableFilesystem?: boolean;
  readonly includeBuiltins?: boolean;
}): Promise<DiscoveryResult> {
  const explicit = args.explicit ?? [];
  const filesystem = args.disableFilesystem ? [] : await loadFilesystemPlugins();
  const npm = args.npmSpecifiers ? await loadNpmPlugins(args.npmSpecifiers) : [];
  const builtins: AnyPlugin[] = [];
  if (args.includeBuiltins !== false) {
    // Built-in plugins (Plugin Inspector, etc.) — always on.
    const { pluginInspectorPlugin } = await import("./builtinPlugins");
    builtins.push(pluginInspectorPlugin);
  }
  // Precedence: explicit > npm > filesystem > builtins. Builtins are the
  // last-resort default — any user plugin with the same id wins.
  const byId = new Map<string, AnyPlugin>();
  for (const p of builtins) byId.set(idOf(p), p);
  for (const p of filesystem) byId.set(idOf(p), p);
  for (const p of npm) byId.set(idOf(p), p);
  for (const p of explicit) byId.set(idOf(p), p);
  return {
    explicit,
    filesystem,
    npm,
    all: Array.from(byId.values()),
  };
}

function idOf(p: AnyPlugin): string {
  return isV2Plugin(p) ? p.manifest.id : (p as { id: string }).id;
}
