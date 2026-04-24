import type { AdminRegistry } from "./registry";
import type { View } from "@/contracts/views";

export interface Route {
  path: string;
  view: View;
  mode: "list" | "new" | "edit" | "detail" | "dashboard" | "custom" | "kanban";
  id?: string;
  navItemPath?: string;
}

/** Resolve a hash-path against the registry to the right view + mode.
 *
 *  Conventions:
 *    /<nav.path>                    → view bound to that nav item
 *    /<nav.path>/new                → form view for resource (create)
 *    /<nav.path>/<id>               → detail view for resource
 *    /<nav.path>/<id>/edit          → form view for resource (edit)
 *
 *  The nav item's `path` is the stable base; sub-paths are derived from
 *  the resource. We prefer the MOST-specific nav match.                     */
export function resolveRoute(
  path: string,
  registry: AdminRegistry,
): Route | null {
  const clean = path.replace(/^#/, "").replace(/\/+$/, "") || "/";

  // Try nav items — longest match first
  const navMatches = collectNavPaths(registry.nav)
    .filter((n) => !!n.path)
    .sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0));

  for (const n of navMatches) {
    if (!n.path) continue;
    if (clean === n.path || clean.startsWith(n.path + "/")) {
      const remainder = clean.slice(n.path.length);
      const view = findViewForNav(n, registry);
      if (!view) continue;
      return classify(view, n.path, remainder);
    }
  }

  // Root dashboard fallback
  if (clean === "/" || clean === "") {
    const firstDashboard = Object.values(registry.views).find(
      (v) => v.type === "dashboard",
    );
    if (firstDashboard)
      return {
        path: "/",
        view: firstDashboard,
        mode: "dashboard",
        navItemPath: "/",
      };
  }

  return null;
}

interface NavPath {
  path?: string;
  view?: string;
  id: string;
}

function collectNavPaths(
  nav: AdminRegistry["nav"],
  acc: NavPath[] = [],
): NavPath[] {
  for (const item of nav) {
    if (item.path) acc.push({ path: item.path, view: item.view, id: item.id });
    if (item.children) collectNavPaths(item.children, acc);
  }
  return acc;
}

function findViewForNav(
  nav: NavPath,
  registry: AdminRegistry,
): View | null {
  // 1. Explicit: nav.view declared.
  if (nav.view && registry.views[nav.view]) return registry.views[nav.view];
  // 2. By nav id.
  if (registry.views[nav.id]) return registry.views[nav.id];
  // 3. Heuristic: any list view whose id ends with `.<navId>` or `.<last-path-segment>`.
  const lastSeg = nav.path?.replace(/\/+$/, "").split("/").filter(Boolean).pop();
  const candidates = [nav.id, lastSeg].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const hit = Object.values(registry.views).find(
      (v) =>
        (v.type === "list" ||
          v.type === "dashboard" ||
          v.type === "custom" ||
          v.type === "kanban") &&
        (v.id.endsWith(`.${candidate}`) || v.id === candidate),
    );
    if (hit) return hit;
  }
  // 4. Last-resort includes match.
  for (const candidate of candidates) {
    const hit = Object.values(registry.views).find((v) =>
      v.id.includes(candidate),
    );
    if (hit) return hit;
  }
  return null;
}

function classify(view: View, base: string, remainder: string): Route {
  if (!remainder || remainder === "/") {
    if (view.type === "dashboard")
      return { path: base, view, mode: "dashboard", navItemPath: base };
    if (view.type === "list")
      return { path: base, view, mode: "list", navItemPath: base };
    if (view.type === "kanban")
      return { path: base, view, mode: "kanban", navItemPath: base };
    if (view.type === "custom")
      return { path: base, view, mode: "custom", navItemPath: base };
    if (view.type === "form")
      return { path: base, view, mode: "new", navItemPath: base };
    if (view.type === "detail")
      return { path: base, view, mode: "detail", navItemPath: base };
  }
  const parts = remainder.replace(/^\//, "").split("/");
  if (parts[0] === "new")
    return { path: base + "/new", view, mode: "new", navItemPath: base };
  if (parts.length === 1)
    return {
      path: base + "/" + parts[0],
      view,
      mode: "detail",
      id: parts[0],
      navItemPath: base,
    };
  if (parts[1] === "edit")
    return {
      path: base + "/" + parts[0] + "/edit",
      view,
      mode: "edit",
      id: parts[0],
      navItemPath: base,
    };
  return {
    path: base + "/" + parts.join("/"),
    view,
    mode: "list",
    navItemPath: base,
  };
}
