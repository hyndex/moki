import { Hono } from "hono";
import { loadConfig } from "../config";

export const configRoutes = new Hono();

/** Minimal public config — tells the frontend whether multisite is on so it
 *  can conditionally show the WorkspaceSwitcher. No secrets here. */
configRoutes.get("/", (c) => {
  const cfg = loadConfig();
  return c.json({
    multisite: cfg.multisite,
    dbKind: cfg.dbKind,
    tenantResolution: cfg.tenantResolution,
    rootDomain: cfg.rootDomain ?? null,
    defaultTenantSlug: cfg.defaultTenantSlug,
  });
});
