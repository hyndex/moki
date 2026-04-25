import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { resourceRoutes } from "./routes/resources";
import { healthRoutes } from "./routes/health";
import { auditRoutes } from "./routes/audit";
import { filesRoutes } from "./routes/files";
import { storageRoutes } from "./routes/storage";
import { editorRoutes } from "./routes/editors";
import { tenantRoutes } from "./routes/tenants";
import { configRoutes } from "./routes/config";
import { tenantMiddleware } from "./tenancy/middleware";
import { loadConfig } from "./config";

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
  app.use("*", logger());

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
      allowHeaders: ["Content-Type", "Authorization", "x-tenant"],
      exposeHeaders: ["x-tenant"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      maxAge: 600,
    }),
  );

  // Tenant resolution wraps every /api/* handler in an AsyncLocalStorage
  // scope. In single-site mode this always resolves to the default tenant.
  app.use("/api/*", tenantMiddleware());

  app.route("/api/health", healthRoutes);
  app.route("/api/config", configRoutes);
  app.route("/api/auth", authRoutes);
  app.route("/api/tenants", tenantRoutes);
  app.route("/api/audit", auditRoutes);
  app.route("/api/resources", resourceRoutes);
  app.route("/api/files", filesRoutes);
  app.route("/api/storage", storageRoutes);
  app.route("/api/editors", editorRoutes);

  app.notFound((c) => c.json({ error: "not found" }, 404));
  app.onError((err, c) => {
    console.error("[api] error", err);
    return c.json({ error: err instanceof Error ? err.message : "unknown" }, 500);
  });

  return app;
}
