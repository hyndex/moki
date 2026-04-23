import { Hono } from "hono";
import { db } from "../db";

export const healthRoutes = new Hono();

healthRoutes.get("/", (c) => {
  const row = db.prepare("SELECT COUNT(*) AS c FROM records").get() as { c: number };
  return c.json({
    status: "ok",
    time: new Date().toISOString(),
    records: row.c,
  });
});
