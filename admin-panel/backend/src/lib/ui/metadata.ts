/** UI metadata layer — plugins announce the resources they own so the
 *  admin shell can render proper pickers (resource/scope/tool) instead
 *  of asking operators to type strings.
 *
 *  Architecture
 *  ------------
 *  Two registration paths, mirroring the MCP tool registry:
 *
 *    1. Explicit — plugins call `registerUiResource(...)` from their
 *       `start()` hook. Use this when the plugin wants to control the
 *       label, icon, group, or available actions independently of
 *       what the MCP tool registry derives.
 *
 *    2. Implicit — the aggregation endpoint folds in every resource
 *       that has at least one MCP tool registered against it. So a
 *       plugin that contributes records via the generic CRUD bootstrap
 *       still appears in pickers without writing UI metadata.
 *
 *  Listing is read-mostly: it's called from admin pages every time a
 *  picker mounts, so we keep the registry as a plain Map and let the
 *  caller filter/sort.
 *
 *  Resources are tenant-agnostic by design — the descriptor describes
 *  the *shape* (label, actions, fields) of a resource, not which rows
 *  a tenant has. Per-tenant access checks live in ACL + scopes; this
 *  module only feeds the picker UI. */

import { listTools } from "../mcp/tools";

/** What a single resource looks like in the admin shell.
 *
 *  Fields are intentionally minimal — anything heavier (full schema,
 *  validation rules, etc.) belongs in the field-metadata layer. */
export interface UiResourceDescriptor {
  /** Stable id, e.g. "crm.contact". Matches the tool-registry resource. */
  id: string;
  /** Human label, e.g. "Contact". Falls back to the id if absent. */
  label?: string;
  /** Optional plural form for list pickers, e.g. "Contacts". */
  pluralLabel?: string;
  /** Group the resource belongs to in the picker tree, e.g. "CRM". */
  group?: string;
  /** A short emoji or icon identifier the shell renders next to the
   *  label. Stays opaque to the host — it's whatever the admin UI
   *  understands. */
  icon?: string;
  /** Actions the agent CAN be granted on this resource. The MCP scope
   *  enum is { read, write, delete }; plugins SHOULD restrict it (e.g.
   *  read-only resources expose `["read"]` so the picker hides write +
   *  delete). */
  actions?: ReadonlyArray<"read" | "write" | "delete">;
  /** Owning plugin id. Set automatically when registered through the
   *  PluginContext helper; manually set when registered directly. */
  pluginId?: string;
  /** Free-form notes the picker tooltips ("Includes archived rows",
   *  "Tenant-shared", etc.). */
  description?: string;
}

const REGISTRY = new Map<string, UiResourceDescriptor>();

/** Register (or replace) a resource descriptor. Plugins call this from
 *  their `start()` hook when they want to override the default label /
 *  group / actions for resources they own. */
export function registerUiResource(d: UiResourceDescriptor): void {
  REGISTRY.set(d.id, { ...d });
}

/** Bulk variant — convenience for plugins that own multiple resources. */
export function registerUiResources(descriptors: UiResourceDescriptor[]): void {
  for (const d of descriptors) registerUiResource(d);
}

/** Direct lookup — used by the host when it needs a label for a
 *  specific resource (audit log rendering, dialog titles, etc.). */
export function getUiResource(id: string): UiResourceDescriptor | undefined {
  return REGISTRY.get(id);
}

/** Snapshot of every explicitly-registered descriptor. The
 *  aggregation in `listUiResources()` merges this with the implicit
 *  set discovered from the MCP tool registry. */
export function listRegisteredUiResources(): UiResourceDescriptor[] {
  return Array.from(REGISTRY.values()).sort((a, b) => a.id.localeCompare(b.id));
}

/** Test-only — wipe the explicit registry. */
export function _resetUiResources_forTest(): void {
  REGISTRY.clear();
}

/** Verbs the MCP tool registry uses → scope action they require.
 *  Mirrors `VERB_RISK` in lib/mcp/risk.ts so a tool that maps to the
 *  same verb gets the same picker action. */
const VERB_TO_ACTION: Record<string, "read" | "write" | "delete"> = {
  list: "read",
  get: "read",
  search: "read",
  create: "write",
  update: "write",
  upsert: "write",
  delete: "delete",
  archive: "delete",
};

/** The picker-feeding endpoint reads this. We merge:
 *
 *    - the explicit registry (plugin-declared)
 *    - resources discovered from the MCP tool registry (every tool's
 *      `resource` + `scopeAction`)
 *
 *  Explicit beats implicit when both are present — the plugin author
 *  knows the better label. Implicit-only entries get a synthesised
 *  label that title-cases the last segment ("crm.contact" → "Contact"). */
export function listUiResources(): UiResourceDescriptor[] {
  const merged = new Map<string, UiResourceDescriptor>();
  // Implicit pass — tool registry.
  for (const t of listTools()) {
    if (!t.resource) continue;
    const cur = merged.get(t.resource) ?? {
      id: t.resource,
      label: humanLabel(t.resource),
      group: groupOf(t.resource),
      actions: [] as Array<"read" | "write" | "delete">,
    };
    if (t.scopeAction) {
      const acts = new Set(cur.actions ?? []);
      acts.add(t.scopeAction);
      cur.actions = Array.from(acts).sort() as UiResourceDescriptor["actions"];
    } else {
      // Fall back to deriving from the verb when scopeAction is unset
      // (rare — auto-generated tools always set it).
      const verb = t.definition.name.split(".").pop() ?? "";
      const action = VERB_TO_ACTION[verb];
      if (action) {
        const acts = new Set(cur.actions ?? []);
        acts.add(action);
        cur.actions = Array.from(acts).sort() as UiResourceDescriptor["actions"];
      }
    }
    merged.set(t.resource, cur);
  }
  // Explicit pass — overrides labels + carries plugin id.
  for (const explicit of REGISTRY.values()) {
    const cur = merged.get(explicit.id);
    if (!cur) {
      merged.set(explicit.id, {
        ...explicit,
        actions: explicit.actions && explicit.actions.length > 0 ? explicit.actions : ["read"],
      });
      continue;
    }
    merged.set(explicit.id, {
      ...cur,
      ...explicit,
      // Union of actions — plugin can declare additional verbs (e.g.
      // a read-only aggregate that has no MCP tool yet).
      actions: explicit.actions && explicit.actions.length > 0
        ? Array.from(new Set([...cur.actions ?? [], ...explicit.actions])).sort() as UiResourceDescriptor["actions"]
        : cur.actions,
    });
  }
  return Array.from(merged.values()).sort((a, b) => a.id.localeCompare(b.id));
}

function humanLabel(id: string): string {
  const last = id.split(".").pop() ?? id;
  // Title-case "contact" → "Contact", split kebab on the way.
  return last
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function groupOf(id: string): string | undefined {
  const head = id.split(".")[0];
  if (!head || head === id) return undefined;
  return head
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
