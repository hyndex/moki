/** Runtime configuration.
 *
 * Single source of truth for what mode the backend runs in.
 *
 * Modes:
 *   singlesite + sqlite    (default; zero-config dev)
 *   singlesite + postgres  (production, one tenant)
 *   multisite  + postgres  (production, many tenants, schema-per-tenant)
 *
 * Multi-site with SQLite is not supported — SQLite has no schema concept.
 * Starting the server with MULTISITE=1 and DB_KIND!=postgres exits 1.
 */

export type DbKind = "sqlite" | "postgres";
export type TenantResolution = "subdomain" | "header" | "path";

export interface Config {
  port: number;
  dbKind: DbKind;
  /** SQLite only. */
  sqlitePath: string;
  /** Postgres only. Standard URL; tested with the default password from .env. */
  pgUrl?: string;
  /** Max Postgres pool size. */
  pgMax: number;
  multisite: boolean;
  tenantResolution: TenantResolution;
  /** If the resolver finds no tenant, fall back to this slug. */
  defaultTenantSlug: string;
  /** Subdomain suffix stripped when resolving tenant.
   *  e.g. "gutu.app" so "acme.gutu.app" → tenant "acme". */
  rootDomain?: string;
  /** HTTP header used when resolution = "header". */
  tenantHeader: string;
  /** Path prefix used when resolution = "path". Requests to /t/<slug>/... */
  tenantPathPrefix: string;
  /** Full absolute path where per-tenant file uploads live. */
  filesRoot: string;
  /** Admin email that can always manage tenants regardless of membership. */
  superAdminEmail?: string;
  /** Prefix for auto-generated tenant schema names. */
  tenantSchemaPrefix: string;
  /** Dev mode enables verbose logging and skips some safety checks. */
  dev: boolean;
}

function envFlag(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v === "true" || v === "TRUE" || v === "yes";
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envEnum<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const v = process.env[name];
  if (!v) return fallback;
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;

  const dbKind = envEnum<DbKind>("DB_KIND", ["sqlite", "postgres"], "sqlite");
  const multisite = envFlag("MULTISITE", false);

  if (multisite && dbKind !== "postgres") {
    console.error(
      "[config] MULTISITE=1 requires DB_KIND=postgres. SQLite has no schema concept.",
    );
    process.exit(1);
  }

  // The generic record/audit/files query layer (backend/src/lib/query.ts,
  // lib/audit.ts, routes/resources.ts) still uses the synchronous legacy
  // SQLite handle. Tenant-scoped per-schema routing via dbx() is in place
  // for the tenancy module itself, but not yet migrated into the data-plane
  // routes. Booting in Postgres multisite mode without this acknowledgement
  // silently breaks isolation — see docs/AUDIT.md (finding #1/#5).
  if (
    multisite &&
    dbKind === "postgres" &&
    process.env.I_UNDERSTAND_POSTGRES_MULTISITE_BETA !== "1"
  ) {
    console.error(
      "[config] Postgres multisite mode is beta — lib/query.ts is not yet\n" +
        "          tenant-scoped. Set I_UNDERSTAND_POSTGRES_MULTISITE_BETA=1 to\n" +
        "          acknowledge the gap and proceed. See docs/AUDIT.md.",
    );
    process.exit(1);
  }

  const path = require("node:path") as typeof import("node:path");
  // Resolve relative to this file so the server runs regardless of cwd.
  // config.ts lives in admin-panel/backend/src → backendRoot = ../
  const backendRoot = path.resolve(import.meta.dir, "..");

  cached = {
    port: envInt("API_PORT", 3333),
    dbKind,
    sqlitePath: process.env.DB_PATH ?? path.join(backendRoot, "data.db"),
    pgUrl: process.env.DATABASE_URL,
    pgMax: envInt("PG_MAX_POOL", 10),
    multisite,
    tenantResolution: envEnum<TenantResolution>(
      "TENANT_RESOLUTION",
      ["subdomain", "header", "path"],
      "subdomain",
    ),
    defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG ?? "main",
    rootDomain: process.env.ROOT_DOMAIN,
    tenantHeader: process.env.TENANT_HEADER ?? "x-tenant",
    tenantPathPrefix: process.env.TENANT_PATH_PREFIX ?? "/t",
    filesRoot: process.env.FILES_ROOT ?? path.join(backendRoot, "files"),
    superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
    tenantSchemaPrefix: process.env.TENANT_SCHEMA_PREFIX ?? "tenant_",
    dev: process.env.NODE_ENV !== "production",
  };

  return cached;
}

export function resetConfig(): void {
  cached = null;
}
