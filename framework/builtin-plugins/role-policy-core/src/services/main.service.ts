import { normalizeActionInput } from "@platform/schema";

export type DomainActionInput = {
  grantId: string;
  tenantId: string;
  subjectId: string;
  permission: string;
  effect: "allow" | "deny";
  reason?: string | undefined;
};

export function assignGrant(input: DomainActionInput): {
  ok: true;
  nextStatus: "active" | "revoked";
  grantKey: string;
} {
  normalizeActionInput(input);
  const grantKey = `${input.tenantId}:${input.subjectId}:${input.permission}`;
  const nextStatus = input.reason?.toLowerCase().includes("revoke") ? "revoked" : "active";
  return { ok: true, nextStatus, grantKey };
}
