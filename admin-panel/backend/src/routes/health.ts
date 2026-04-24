import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";

export const healthRoutes = new Hono();

/** Public liveness probe — safe for load balancers. Returns no data. */
healthRoutes.get("/", (c) =>
  c.json({ status: "ok", time: new Date().toISOString() }),
);

/** Authenticated detail — exposes record count (useful for devs + dashboards,
 *  but leaks rough tenant size if public). Requires a valid session. */
healthRoutes.get("/detail", requireAuth, (c) => {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM records")
    .get() as { c: number };
  return c.json({
    status: "ok",
    time: new Date().toISOString(),
    records: row.c,
  });
});
