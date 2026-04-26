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
import { isV2Plugin } from "@/contracts/plugin-v2";
/* Note: AnyPlugin === PluginV2 now. Legacy plugin shape has been retired. */
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
export async function loadFilesystemPlugins() {
    let modules = {};
    try {
        // Accept .ts, .tsx, .js, .jsx. Each call is individually transformed.
        modules = {
            /* eslint-disable @typescript-eslint/no-explicit-any */
            ...import.meta.glob("../plugins/*/index.ts"),
            ...import.meta.glob("../plugins/*/index.tsx"),
            ...import.meta.glob("../plugins/*/index.js"),
            ...import.meta.glob("../plugins/*/index.jsx"),
            /* eslint-enable @typescript-eslint/no-explicit-any */
        };
    }
    catch {
        // eslint-disable-next-line no-console
        console.warn("[plugin-loader] import.meta.glob unavailable — filesystem loader disabled.");
        return [];
    }
    const out = [];
    const errors = [];
    const entries = Object.entries(modules);
    await Promise.all(entries.map(async ([path, load]) => {
        try {
            const mod = (await load());
            const plugin = mod.default ?? findPluginExport(mod);
            if (plugin)
                out.push(plugin);
            else {
                // eslint-disable-next-line no-console
                console.warn(`[plugin-loader] "${path}" has no default export and no plugin-like export; skipping.`);
            }
        }
        catch (err) {
            errors.push({ path, error: err });
            // eslint-disable-next-line no-console
            console.error(`[plugin-loader] failed to load "${path}":`, err);
        }
    }));
    if (errors.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(`[plugin-loader] ${errors.length} filesystem plugin(s) failed to load.`);
    }
    return out;
}
/** Best-effort — find a v2 plugin-like export in a module's named exports
 *  when no `default` is declared. */
function findPluginExport(mod) {
    for (const v of Object.values(mod)) {
        if (!v || typeof v !== "object")
            continue;
        if (isV2Plugin(v))
            return v;
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
export async function loadNpmPlugins(specifiers) {
    const out = [];
    for (const spec of specifiers) {
        try {
            const mod = (await import(/* @vite-ignore */ spec));
            const plugin = mod.default ?? findPluginExport(mod);
            if (plugin)
                out.push(plugin);
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error(`[plugin-loader] npm "${spec}" failed`, err);
        }
    }
    return out;
}
export async function discoverAllPlugins(args) {
    const explicit = args.explicit ?? [];
    const filesystem = args.disableFilesystem ? [] : await loadFilesystemPlugins();
    // Merge explicit npm specifiers with any declared via
    // `VITE_GUTU_PLUGINS` (CSV list injected from `package.json`'s
    // `gutuPlugins` array by the build pipeline, or set at runtime).
    const envSpecs = (typeof import.meta !== "undefined"
        ? (import.meta.env?.VITE_GUTU_PLUGINS ?? "")
        : "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const npmSpecs = [...(args.npmSpecifiers ?? []), ...envSpecs];
    const npm = npmSpecs.length > 0 ? await loadNpmPlugins(npmSpecs) : [];
    const builtins = [];
    if (args.includeBuiltins !== false) {
        // Built-in plugins (Plugin Inspector, etc.) — always on.
        const { pluginInspectorPlugin } = await import("./builtinPlugins");
        builtins.push(pluginInspectorPlugin);
    }
    // Precedence: explicit > npm > filesystem > builtins. Builtins are the
    // last-resort default — any user plugin with the same id wins.
    const sources = new Map();
    const record = (src, p) => {
        const id = idOf(p);
        const set = sources.get(id) ?? new Set();
        set.add(src);
        sources.set(id, set);
    };
    for (const p of builtins)
        record("builtin", p);
    for (const p of filesystem)
        record("filesystem", p);
    for (const p of npm)
        record("npm", p);
    for (const p of explicit)
        record("explicit", p);
    const byId = new Map();
    for (const p of builtins)
        byId.set(idOf(p), p);
    for (const p of filesystem)
        byId.set(idOf(p), p);
    for (const p of npm)
        byId.set(idOf(p), p);
    for (const p of explicit)
        byId.set(idOf(p), p);
    const duplicates = Array.from(sources.entries())
        .filter(([, s]) => s.size > 1)
        .map(([id, s]) => ({ id, sources: Array.from(s) }));
    for (const dup of duplicates) {
        // eslint-disable-next-line no-console
        console.warn(`[plugin-loader] duplicate plugin id "${dup.id}" from sources: ${dup.sources.join(", ")}. Precedence-winning source used.`);
    }
    return {
        explicit,
        filesystem,
        npm,
        all: Array.from(byId.values()),
        duplicates,
    };
}
function idOf(p) {
    return isV2Plugin(p) ? p.manifest.id : p.id;
}
