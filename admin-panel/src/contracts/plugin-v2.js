/** Plugin contract v2 — the ecosystem-grade plugin surface.
 *
 *  Coexists with the legacy `Plugin` in `./plugin.ts` via a dual-mode
 *  wrapper in the host. Written plugins can choose either shape. The host
 *  normalises both into a v2 `ActivatedPlugin` at runtime.
 *
 *  Design goals (from the spec):
 *    - Zero shell edits to add a new plugin
 *    - Plugins ship independently (filesystem folder, npm pkg, remote URL)
 *    - Every hardcoded enum in the shell (field kinds, widget types, view
 *      modes, chart kinds, auth providers, data sources …) becomes an open
 *      registry that plugins contribute to at activation time
 *    - Capability-based permissions — plugins declare what they touch
 *    - Per-plugin error boundary isolation
 *    - Disposable contributions → hot-reload + safe uninstall
 *    - Dependency + semver resolution with topological activation order
 *    - Lazy activation via `activationEvents`
 */
/* ================================================================== */
/* definePlugin — the v2 author-facing helper                          */
/* ================================================================== */
/** Strongly typed helper for authoring a v2 plugin. Does no work; returns
 *  the object as-is. Exists so plugin files read like JSON config. */
export function definePlugin(plugin) {
    return plugin;
}
export function isV2Plugin(p) {
    return "manifest" in p && "activate" in p && typeof p.activate === "function";
}
