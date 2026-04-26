/** Readiness probe — distinct from liveness.
 *
 *  Returns 200 ONLY after the boot sequence has finished (migrations
 *  + plugin start hooks). Returns 503 while booting OR while
 *  draining (post-SIGTERM). Use this for k8s readinessProbe so the
 *  load balancer takes us out of rotation during boot or shutdown. */

import { Hono } from "hono";
import { isBooting, isDraining, lifecycleSnapshot } from "../host/lifecycle";

export const readyRoutes = new Hono();

readyRoutes.get("/", (c) => {
  const snap = lifecycleSnapshot();
  if (isBooting()) {
    return c.json({ ready: false, reason: "booting", ...snap }, 503);
  }
  if (isDraining()) {
    return c.json({ ready: false, reason: "draining", ...snap }, 503);
  }
  return c.json({ ready: true, ...snap });
});
