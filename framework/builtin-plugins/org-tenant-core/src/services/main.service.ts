import { normalizeActionInput } from "@platform/schema";

export type DomainActionInput = {
  id: string;
  tenantId: string;
  slug: string;
  billingPlan: "trial" | "standard" | "enterprise";
  reason?: string | undefined;
};

export function activateTenant(input: DomainActionInput): {
  ok: true;
  nextStatus: "active" | "suspended";
  resolvedSlug: string;
} {
  normalizeActionInput(input);
  const resolvedSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const nextStatus = input.reason?.toLowerCase().includes("suspend") ? "suspended" : "active";
  return { ok: true, nextStatus, resolvedSlug };
}
