/** Shell server: builds the Hono app with the cross-cutting routes
 *  it owns. Plugin-contributed routes are mounted by main.ts via the
 *  plugin loader after createApp() returns. */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth";
import { resourceRoutes } from "./routes/resources";
import { healthRoutes } from "./routes/health";
import { readyRoutes } from "./routes/ready";
import { metricsRoutes } from "./routes/_metrics";
import { gdprRoutes } from "./routes/_gdpr";
import { auditRoutes } from "./routes/audit";
import { filesRoutes } from "./routes/files";
import { storageRoutes } from "./routes/storage";
import { tenantRoutes } from "./routes/tenants";
import { configRoutes } from "./routes/config";
import { mailRoutes } from "./routes/mail";
import { analyticsRoutes } from "./routes/analytics";
import { searchRoutes } from "./routes/search";
import { i18nRoutes } from "./routes/i18n";
import { tenantMiddleware } from "./tenancy/middleware";
import { loadConfig } from "./config";
import { drainMiddleware } from "./host/lifecycle";
import {
  traceAndLog,
  securityHeaders,
  bodySizeLimit,
  rateLimit,
  metricsCollector,
} from "./host/middleware-stack";

/** Parse comma-separated CORS origin list from env. */
function allowedOrigins(): string[] | "dev-any" {
  const cfg = loadConfig();
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  // Dev-only: echo any Origin. Production installs MUST set CORS_ORIGINS.
  if (cfg.dev) return "dev-any";
  // Production default: refuse cross-origin by returning empty allowlist.
  return [];
}

export function createApp() {
  const app = new Hono();

  // Order matters:
  //   1. drain — refuses new requests after SIGTERM with 503 + Retry-After
  //   2. trace + structured log — gives every other middleware a traceId
  //   3. security headers — applied to every response
  //   4. body-size cap — fail-fast on adversarial uploads
  //   5. rate limit — DoS shielding (skips /api/health + /api/ready)
  //   6. metrics — collects per-route counters for /api/_metrics
  //   7. CORS
  //   8. tenant resolution — AsyncLocalStorage tenant scope
  app.use("*", drainMiddleware());
  app.use("*", traceAndLog());
  app.use("*", securityHeaders());
  app.use("*", bodySizeLimit());
  app.use("*", rateLimit());
  app.use("*", metricsCollector());

  const origins = allowedOrigins();
  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (origins === "dev-any") return origin ?? "*";
        if (!origin) return origin ?? "";
        return origins.includes(origin) ? origin : "";
      },
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization", "x-tenant", "x-request-id"],
      exposeHeaders: ["x-tenant", "x-request-id", "x-ratelimit-limit", "x-ratelimit-remaining", "retry-after"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      maxAge: 600,
    }),
  );

  // Tenant resolution wraps every /api/* handler in an AsyncLocalStorage
  // scope. In single-site mode this always resolves to the default tenant.
  app.use("/api/*", tenantMiddleware());

  // Shell-owned routes. Bootstrap concerns (auth, tenants, health,
  // ready, config, metrics) and the generic `resources` CRUD facade —
  // anything a plugin needs before its own routes can be reached. EVERY
  // domain surface (GL, sales, stock, workflows, webhooks, api-tokens,
  // …) is contributed by a plugin in HOST_PLUGINS and mounted by main.ts.
  app.route("/api/health", healthRoutes);
  app.route("/api/ready", readyRoutes);
  app.route("/api/_metrics", metricsRoutes);
  app.route("/api/_gdpr", gdprRoutes);
  app.route("/api/config", configRoutes);
  app.route("/api/auth", authRoutes);
  app.route("/api/tenants", tenantRoutes);
  app.route("/api/audit", auditRoutes);
  app.route("/api/resources", resourceRoutes);
  app.route("/api/files", filesRoutes);
  app.route("/api/storage", storageRoutes);
  // Mail plugin: kept as a shell-mounted route for now (mailRoutes lives
  // in admin-panel/backend/src/routes/mail.ts). Will migrate to a
  // dedicated gutu-plugin-mail-core plugin in a follow-up pass; until
  // then we mount it here so existing mail UX keeps working.
  app.route("/api/mail", mailRoutes);
  app.route("/api/analytics", analyticsRoutes);
  app.route("/api/search", searchRoutes);
  app.route("/api/i18n", i18nRoutes);

  app.notFound((c) => c.json({ error: "not found" }, 404));
  app.onError((err, c) => {
    const traceId = c.get("requestId") ?? "";
    console.error(`[api][${traceId}] error`, err);
    return c.json({
      error: err instanceof Error ? err.message : "unknown",
      traceId,
    }, 500);
  });

  return app;
}
