/** Risk classification for MCP tool calls.
 *
 *  Every tool the framework exposes carries a risk level the server
 *  uses to gate the call:
 *
 *    safe-read       Idempotent reads. List, get, search, count.
 *                    No state change. Always allowed for any agent
 *                    that has the resource scope.
 *    low-mutation    Reversible writes — create + update on records
 *                    that have a soft-delete recovery path. Allowed
 *                    when the agent's risk-ceiling is at least
 *                    low-mutation AND the per-action rate limit has
 *                    headroom AND the budget has headroom.
 *    high-mutation   Hard writes that can't be undone in <1 minute
 *                    (cross-record updates, bulk operations).
 *                    Allowed only at the high-mutation ceiling AND
 *                    only when an idempotency key is present.
 *    irreversible    Permanently destructive — hard delete, archive,
 *                    bulk truncate, payment send, mail dispatch.
 *                    Always requires an explicit human dual-key
 *                    confirmation token. Even at the high-mutation
 *                    ceiling, the agent CANNOT call these without
 *                    the operator pre-approving in the admin UI.
 *
 *  The classifier is deterministic and explicit — never inferred at
 *  runtime from the action verb. Plugins that contribute their own
 *  tools must declare risk explicitly. */

export type Risk = "safe-read" | "low-mutation" | "high-mutation" | "irreversible";

export const RISK_RANK: Record<Risk, number> = {
  "safe-read": 0,
  "low-mutation": 1,
  "high-mutation": 2,
  "irreversible": 3,
};

/** Standard verbs and their default risk classification when a plugin
 *  doesn't override. The auto-generated resource tools use these. */
export const VERB_RISK: Record<string, Risk> = {
  list: "safe-read",
  get: "safe-read",
  search: "safe-read",
  count: "safe-read",
  exists: "safe-read",

  create: "low-mutation",
  update: "low-mutation",
  patch: "low-mutation",
  archive: "low-mutation", // soft delete

  upsert: "high-mutation",
  bulk_create: "high-mutation",
  bulk_update: "high-mutation",

  destroy: "irreversible", // hard delete
  delete: "irreversible",
  send: "irreversible", // outbound mail / push
  pay: "irreversible",
  cancel_invoice: "irreversible",
};

/** True when the agent's ceiling permits this risk level (irreversible
 *  is NEVER allowed by ceiling alone — it always needs a human
 *  dual-key, see `requiresDualKey`). */
export function ceilingAllows(ceiling: Risk, requested: Risk): boolean {
  if (requested === "irreversible") return false;
  return RISK_RANK[requested] <= RISK_RANK[ceiling];
}

export function requiresDualKey(risk: Risk): boolean {
  return risk === "irreversible";
}

export function requiresIdempotency(risk: Risk): boolean {
  // Anything past low-mutation must carry an idempotency key so a
  // retry storm can't duplicate writes.
  return RISK_RANK[risk] >= RISK_RANK["high-mutation"];
}
