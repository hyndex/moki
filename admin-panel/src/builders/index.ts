import type {
  ListView,
  FormView,
  DetailView,
  DashboardView,
  CustomView,
  KanbanView,
} from "@/contracts/views";
import type { Plugin, AdminContribution } from "@/contracts/plugin";
import type { ResourceDefinition } from "@/contracts/resources";

/** Tier 6 — Fluent builders.
 *  They are intentionally thin: `defineX` is an `identity + validation` pass.
 *  The payoff is inference — plugins get strict types without extra generics. */

export function defineListView(view: Omit<ListView, "type">): ListView {
  return { ...view, type: "list" };
}

export function defineFormView(view: Omit<FormView, "type">): FormView {
  return { ...view, type: "form" };
}

export function defineDetailView(view: Omit<DetailView, "type">): DetailView {
  return { ...view, type: "detail" };
}

export function defineDashboard(view: Omit<DashboardView, "type">): DashboardView {
  return { ...view, type: "dashboard" };
}

export function defineCustomView(view: Omit<CustomView, "type">): CustomView {
  return { ...view, type: "custom" };
}

export function defineKanbanView(view: Omit<KanbanView, "type">): KanbanView {
  return { ...view, type: "kanban" };
}

export function defineResource<R extends ResourceDefinition>(resource: R): R {
  validateResource(resource);
  return resource;
}

export function defineAdmin(contribution: AdminContribution): AdminContribution {
  return contribution;
}

export function definePlugin(plugin: Plugin): Plugin {
  validatePlugin(plugin);
  return plugin;
}

/* ---- Validation (runs at startup; surfaces misuse loudly) -------------- */

function validateResource(r: ResourceDefinition): void {
  if (!r.id || typeof r.id !== "string") {
    throw new Error(`[defineResource] resource.id is required`);
  }
  if (!r.schema || typeof (r.schema as { parse?: unknown }).parse !== "function") {
    throw new Error(`[defineResource] resource "${r.id}" missing zod schema`);
  }
}

function validatePlugin(p: Plugin): void {
  if (!p.id || typeof p.id !== "string") {
    throw new Error(`[definePlugin] plugin.id is required`);
  }
  const seenView = new Set<string>();
  for (const v of p.admin?.views ?? []) {
    if (seenView.has(v.id)) {
      throw new Error(`[definePlugin ${p.id}] duplicate view id "${v.id}"`);
    }
    seenView.add(v.id);
  }
  const seenRes = new Set<string>();
  for (const r of p.admin?.resources ?? []) {
    if (seenRes.has(r.id)) {
      throw new Error(`[definePlugin ${p.id}] duplicate resource id "${r.id}"`);
    }
    seenRes.add(r.id);
  }
}
