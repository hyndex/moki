import { normalizeActionInput } from "@platform/schema";

export type DomainActionInput = {
  personId: string;
  tenantId: string;
  fullName: string;
  email: string;
  employmentType: "employee" | "contractor" | "member";
  reason?: string | undefined;
};

export function registerPerson(input: DomainActionInput): {
  ok: true;
  nextStatus: "invited" | "active";
  directoryKey: string;
} {
  normalizeActionInput(input);
  const directoryKey = input.email.trim().toLowerCase();
  const nextStatus = input.reason?.toLowerCase().includes("onboard") ? "active" : "invited";
  return { ok: true, nextStatus, directoryKey };
}
