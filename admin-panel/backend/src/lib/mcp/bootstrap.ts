/** Tool registry bootstrap. Walks every resource the records table
 *  knows about and auto-registers list/get/search/create/update/
 *  delete tools. Idempotent — registering twice is a no-op (the
 *  registry rejects duplicates).
 *
 *  Two registration modes:
 *
 *    1. eager  — at process start, enumerate the records table and
 *                register tools for every distinct resource. Fast +
 *                simple but misses resources that don't have any
 *                records yet.
 *    2. lazy   — on `tools/list` call, refresh from the records
 *                table so newly-introduced resources show up
 *                without a restart. Skipped if eager already ran
 *                in the last 60 s. */

import { db } from "../../db";
import { listTools, registerResourceTools, _resetToolRegistry_forTest } from "./tools";

let lastBootstrapMs = 0;
const STALE_AFTER_MS = 60_000;

export function bootstrapMcpTools(force = false): void {
  if (!force && Date.now() - lastBootstrapMs < STALE_AFTER_MS) return;
  const rows = db.prepare(`SELECT DISTINCT resource FROM records ORDER BY resource`).all() as { resource: string }[];
  const known = new Set<string>();
  for (const t of listTools()) {
    if (t.resource) known.add(t.resource);
  }
  for (const row of rows) {
    if (!known.has(row.resource)) {
      try {
        registerResourceTools(row.resource);
      } catch {
        // already registered — defensive
      }
    }
  }
  lastBootstrapMs = Date.now();
}

export function _resetBootstrap_forTest(): void {
  _resetToolRegistry_forTest();
  lastBootstrapMs = 0;
}
