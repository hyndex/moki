import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { ChevronDown, Search, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { NavIcon } from "./NavIcon";
import { navigateTo } from "@/views/useRoute";
import { useFavorites } from "@/runtime/useFavorites";
export function Sidebar({ registry, currentPath }) {
    const grouped = groupBySection(registry.nav, registry.navSections);
    const [filter, setFilter] = React.useState("");
    const needle = filter.trim().toLowerCase();
    const filteredGroups = needle
        ? grouped
            .map(({ section, items }) => ({
            section,
            items: items.filter((i) => i.label.toLowerCase().includes(needle) ||
                (i.path?.toLowerCase().includes(needle) ?? false)),
        }))
            .filter((g) => g.items.length > 0)
        : grouped;
    return (_jsxs("aside", { className: "w-sidebar-w shrink-0 h-full bg-surface-1 border-r border-border flex flex-col", "aria-label": "Primary navigation", children: [_jsxs("div", { className: "flex items-center gap-2 px-4 h-topbar-h border-b border-border shrink-0", children: [_jsx("div", { className: "w-7 h-7 rounded-md bg-accent text-accent-fg flex items-center justify-center text-xs font-bold", "aria-hidden": true, children: "G" }), _jsxs("div", { className: "flex flex-col leading-tight", children: [_jsx("span", { className: "text-sm font-semibold text-text-primary", children: "Gutu" }), _jsx("span", { className: "text-[10px] text-text-muted uppercase tracking-wider", children: "Admin" })] })] }), _jsx("div", { className: "px-2 pt-2 shrink-0", children: _jsxs("label", { className: "relative block", children: [_jsx("span", { className: "sr-only", children: "Filter navigation" }), _jsx(Search, { className: "absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted", "aria-hidden": true }), _jsx("input", { type: "text", placeholder: "Filter\u2026", value: filter, onChange: (e) => setFilter(e.target.value), className: "w-full h-7 pl-7 pr-2 rounded-md border border-border bg-surface-0 text-sm outline-none placeholder:text-text-muted focus:shadow-focus focus:border-accent" })] }) }), _jsxs("nav", { className: "p-2 flex flex-col gap-3 overflow-y-auto", children: [_jsx(FavoritesSection, { registry: registry, currentPath: currentPath, filter: needle }), filteredGroups.length === 0 ? (_jsxs("div", { className: "px-2 py-3 text-xs text-text-muted", children: ["No matches for \u201C", filter, "\u201D."] })) : (filteredGroups.map(({ section, items }) => (_jsx(Section, { section: section, items: items, currentPath: currentPath, forceOpen: !!needle }, section?.id ?? "__default"))))] })] }));
}
/* ----------------------------------------------------------- */
/* Favorites — backed by /api/favorites (useFavorites hook).    */
/* drag-reorder is post-v1                                       */
/* ----------------------------------------------------------- */
function FavoritesSection({ registry, currentPath, filter, }) {
    const fav = useFavorites();
    const rows = fav.list();
    // Build resource → base path map once per render — used to translate
    // record/view favorites into hash routes.
    const basePathMap = React.useMemo(() => buildBasePathMap(registry), [registry]);
    const resolved = React.useMemo(() => rows
        .map((f) => resolveFavorite(f, basePathMap))
        .filter((x) => !!x), [rows, basePathMap]);
    const filtered = filter
        ? resolved.filter((r) => r.label.toLowerCase().includes(filter) ||
            r.path.toLowerCase().includes(filter))
        : resolved;
    // Empty: do not render the section header at all (per spec).
    if (filtered.length === 0)
        return null;
    return (_jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsxs("div", { className: "flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider", "aria-label": "Favorites", children: [_jsx(Star, { className: "h-3 w-3", "aria-hidden": true }), "Favorites"] }), filtered.map((f) => (_jsx(FavoriteEntry, { fav: f, currentPath: currentPath }, `${f.kind}:${f.targetId}`)))] }));
}
function resolveFavorite(f, basePathMap) {
    const fallbackLabel = f.label ?? labelFromTarget(f);
    if (f.kind === "link") {
        return {
            kind: "link",
            targetId: f.targetId,
            label: fallbackLabel,
            icon: f.icon,
            path: f.targetId,
            external: true,
        };
    }
    if (f.kind === "page") {
        return {
            kind: "page",
            targetId: f.targetId,
            label: fallbackLabel,
            icon: f.icon,
            path: `/page/${f.targetId}`,
            external: false,
        };
    }
    if (f.kind === "record") {
        // targetId convention: "<resource>:<recordId>"
        const idx = f.targetId.indexOf(":");
        if (idx === -1)
            return null;
        const resource = f.targetId.slice(0, idx);
        const recordId = f.targetId.slice(idx + 1);
        const base = basePathMap[resource];
        if (!base)
            return null; // resource not contributed by any plugin in this build
        return {
            kind: "record",
            targetId: f.targetId,
            label: fallbackLabel,
            icon: f.icon,
            path: `${base}/${recordId}`,
            external: false,
        };
    }
    if (f.kind === "view") {
        // Saved view: navigate to the resource's list with ?view=<id>. We
        // need to know which resource the view belongs to — look it up via
        // the savedViews store synchronously cached on registry isn't
        // possible here; fall back to the view id by scanning the saved
        // views in localStorage. Cheap and read-only.
        const viewId = f.targetId;
        const resource = lookupViewResource(viewId);
        const base = resource ? basePathMap[resource] : undefined;
        if (!base)
            return null;
        return {
            kind: "view",
            targetId: f.targetId,
            label: fallbackLabel,
            icon: f.icon,
            path: `${base}?view=${encodeURIComponent(viewId)}`,
            external: false,
        };
    }
    return null;
}
function labelFromTarget(f) {
    if (f.kind === "record") {
        const idx = f.targetId.indexOf(":");
        return idx === -1 ? f.targetId : f.targetId.slice(idx + 1);
    }
    return f.targetId;
}
/** Read-through against the saved-views localStorage cache to find the
 *  resource that a view id belongs to. Avoids dragging the runtime
 *  context into the Sidebar.                                            */
function lookupViewResource(viewId) {
    if (typeof window === "undefined")
        return undefined;
    try {
        const raw = window.localStorage.getItem("gutu-admin-saved-views");
        if (!raw)
            return undefined;
        const parsed = JSON.parse(raw);
        return parsed.views?.[viewId]?.resource;
    }
    catch {
        return undefined;
    }
}
function buildBasePathMap(registry) {
    const out = {};
    const walk = (items) => {
        for (const n of items) {
            if (n.view && n.path) {
                const v = registry.views[n.view];
                if (v &&
                    "resource" in v &&
                    typeof v.resource === "string" &&
                    v.type === "list") {
                    out[v.resource] = n.path;
                }
            }
            if (n.children)
                walk(n.children);
        }
    };
    walk(registry.nav);
    return out;
}
function FavoriteEntry({ fav, currentPath, }) {
    const active = !fav.external &&
        (currentPath === fav.path ||
            currentPath.startsWith(fav.path.split("?")[0] + "/"));
    if (fav.external) {
        return (_jsxs("a", { href: fav.path, target: "_blank", rel: "noreferrer noopener", className: cn("group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors", "text-text-secondary hover:text-text-primary hover:bg-surface-2"), children: [_jsx(NavIcon, { name: fav.icon ?? "Star", className: "h-4 w-4 shrink-0" }), _jsx("span", { className: "flex-1 min-w-0 truncate", children: fav.label })] }));
    }
    return (_jsxs("a", { href: `#${fav.path}`, onClick: (e) => {
            e.preventDefault();
            navigateTo(fav.path);
        }, className: cn("group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors", active
            ? "bg-accent-subtle text-accent font-medium"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-2"), "aria-current": active ? "page" : undefined, children: [_jsx(NavIcon, { name: fav.icon ?? "Star", className: "h-4 w-4 shrink-0" }), _jsx("span", { className: "flex-1 min-w-0 truncate", children: fav.label })] }));
}
function Section({ section, items, currentPath, forceOpen, }) {
    const containsActive = items.some((i) => !!i.path &&
        (currentPath === i.path || currentPath.startsWith(i.path + "/")));
    const [open, setOpen] = React.useState(forceOpen || containsActive || !section);
    React.useEffect(() => {
        if (forceOpen || containsActive)
            setOpen(true);
    }, [forceOpen, containsActive]);
    return (_jsxs("div", { className: "flex flex-col gap-0.5", children: [section && (_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: "flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors", "aria-expanded": open, children: [_jsx(ChevronDown, { className: cn("h-3 w-3 transition-transform", !open && "-rotate-90"), "aria-hidden": true }), section.label] })), open &&
                items.map((item) => (_jsx(NavEntry, { item: item, currentPath: currentPath, depth: 0 }, item.id)))] }));
}
function NavEntry({ item, currentPath, depth, }) {
    const active = !!item.path &&
        (currentPath === item.path || currentPath.startsWith(item.path + "/"));
    const hasChildren = (item.children?.length ?? 0) > 0;
    const [open, setOpen] = React.useState(active || depth === 0);
    if (!item.path && hasChildren) {
        return (_jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: cn("flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-text-secondary", "hover:text-text-primary hover:bg-surface-2 transition-colors"), children: [_jsx(NavIcon, { name: item.icon, className: "h-4 w-4" }), _jsx("span", { className: "flex-1 text-left", children: item.label }), _jsx(ChevronDown, { className: cn("h-3 w-3 transition-transform text-text-muted", !open && "-rotate-90"), "aria-hidden": true })] }), open && (_jsx("div", { className: "pl-4 flex flex-col gap-0.5", children: item.children.map((c) => (_jsx(NavEntry, { item: c, currentPath: currentPath, depth: depth + 1 }, c.id))) }))] }));
    }
    return (_jsxs("a", { href: item.path ? `#${item.path}` : undefined, onClick: (e) => {
            if (!item.path)
                return;
            e.preventDefault();
            navigateTo(item.path);
        }, className: cn("group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors", active
            ? "bg-accent-subtle text-accent font-medium"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-2"), "aria-current": active ? "page" : undefined, children: [_jsx(NavIcon, { name: item.icon, className: "h-4 w-4 shrink-0" }), _jsx("span", { className: "flex-1 min-w-0 truncate", children: item.label }), item.badge != null && (_jsx("span", { className: cn("inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-medium", active
                    ? "bg-accent text-accent-fg"
                    : "bg-surface-3 text-text-secondary"), children: item.badge }))] }));
}
function groupBySection(nav, sections) {
    const sectionMap = new Map(sections.map((s) => [s.id, s]));
    const groups = new Map();
    for (const item of nav) {
        const key = item.section ?? undefined;
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(item);
    }
    const out = [];
    if (groups.has(undefined))
        out.push({ items: groups.get(undefined) });
    for (const s of sections) {
        if (groups.has(s.id))
            out.push({ section: s, items: groups.get(s.id) });
    }
    for (const [k, items] of groups) {
        if (k === undefined)
            continue;
        if (!sectionMap.has(k))
            out.push({ section: { id: k, label: k }, items });
    }
    return out;
}
