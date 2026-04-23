import { loadConfig } from "../config";
import { ensureDefaultTenant, getTenantByDomain, getTenantBySlug, type Tenant } from "./provisioner";

/** Resolve the active tenant from a request.
 *
 * Priority order:
 *   1. Session's bound `tenant_id` (set when user switched tenants)
 *   2. Explicit header / subdomain / path — according to config
 *   3. Default tenant (singleton in single-site mode)
 */
export async function resolveTenant(input: {
  host: string | null;
  headers: Record<string, string>;
  pathname: string;
  sessionTenantId: string | null;
}): Promise<{ tenant: Tenant; source: "session" | "domain" | "subdomain" | "header" | "path" | "default" }> {
  const cfg = loadConfig();

  // 1. Session-bound tenant wins — this is how users switch workspaces.
  if (input.sessionTenantId) {
    const byId = await getTenantByIdInternal(input.sessionTenantId);
    if (byId) return { tenant: byId, source: "session" };
  }

  if (!cfg.multisite) {
    // Single-site mode — ALWAYS the default tenant, ignoring any host/header.
    const t = await ensureDefaultTenant();
    return { tenant: t, source: "default" };
  }

  // 2. Multisite — resolve by configured strategy.
  const host = (input.host ?? "").toLowerCase();

  // Domain table first — an exact host match always wins if the admin has
  // attached a domain to a tenant.
  if (host) {
    const byDomain = await getTenantByDomain(host);
    if (byDomain) return { tenant: byDomain, source: "domain" };
  }

  if (cfg.tenantResolution === "subdomain" && cfg.rootDomain && host.endsWith(cfg.rootDomain)) {
    const sub = host.slice(0, -cfg.rootDomain.length).replace(/\.$/, "");
    if (sub && sub !== "www" && sub !== cfg.rootDomain) {
      const bySlug = await getTenantBySlug(sub);
      if (bySlug) return { tenant: bySlug, source: "subdomain" };
    }
  }

  if (cfg.tenantResolution === "header") {
    const slug = input.headers[cfg.tenantHeader];
    if (slug) {
      const bySlug = await getTenantBySlug(slug.toLowerCase());
      if (bySlug) return { tenant: bySlug, source: "header" };
    }
  }

  if (cfg.tenantResolution === "path" && input.pathname.startsWith(cfg.tenantPathPrefix + "/")) {
    const remainder = input.pathname.slice(cfg.tenantPathPrefix.length + 1);
    const slug = remainder.split("/")[0];
    if (slug) {
      const bySlug = await getTenantBySlug(slug.toLowerCase());
      if (bySlug) return { tenant: bySlug, source: "path" };
    }
  }

  // 3. Fallback — default tenant (this still works in multisite for super-admin ops).
  const t = await ensureDefaultTenant();
  return { tenant: t, source: "default" };
}

async function getTenantByIdInternal(id: string): Promise<Tenant | null> {
  const mod = await import("./provisioner");
  return mod.getTenant(id);
}
