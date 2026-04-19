import { normalizeActionInput } from "@platform/schema";

export type DomainActionInput = {
  accountId: string;
  tenantId: string;
  accountType: "customer" | "member" | "vendor" | "patient" | "student";
  subjectId: string;
  primaryIdentityId: string;
  activateNow: boolean;
  enableSelfService: Array<"cases" | "documents" | "billing" | "bookings" | "learning">;
  preferredHome: "overview" | "billing" | "cases" | "appointments" | "learning";
  reason?: string | undefined;
};

const preferredRouteByHome = {
  appointments: "/portal/appointments",
  billing: "/portal/billing",
  cases: "/portal/cases",
  learning: "/portal/learning",
  overview: "/portal/home"
} as const;

const defaultHomeByAccountType = {
  customer: "overview",
  member: "overview",
  patient: "appointments",
  student: "learning",
  vendor: "billing"
} as const;

const widgetSlotByFeature = {
  billing: "portal.billing.summary",
  bookings: "portal.bookings.summary",
  cases: "portal.cases.summary",
  documents: "portal.documents.summary",
  learning: "portal.learning.progress"
} as const;

export function enablePortalAccount(input: DomainActionInput): {
  ok: true;
  nextStatus: "invited" | "active";
  homeRoute: string;
  widgets: string[];
} {
  normalizeActionInput(input);
  const defaultHome = defaultHomeByAccountType[input.accountType];
  const resolvedHome = input.preferredHome === "overview" ? defaultHome : input.preferredHome;
  const widgets = [...new Set(input.enableSelfService.map((feature) => widgetSlotByFeature[feature]))].sort();

  return {
    ok: true,
    nextStatus: input.activateNow ? "active" : "invited",
    homeRoute: preferredRouteByHome[resolvedHome],
    widgets
  };
}
