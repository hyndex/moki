import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { daysAgo, daysFromNow, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";

const controlRoomView = buildCompactControlRoom({
  viewId: "org-tenant.control-room.view",
  resource: "org-tenant.tenant",
  title: "Tenants Control Room",
  description: "Multi-tenant operations + seats.",
  kpis: [
    { label: "Active tenants", resource: "org-tenant.tenant",
      filter: { field: "status", op: "eq", value: "active" } },
    { label: "Enterprise", resource: "org-tenant.tenant",
      filter: { field: "plan", op: "eq", value: "enterprise" } },
    { label: "Total seats", resource: "org-tenant.tenant", fn: "sum", field: "seats" },
    { label: "Invites pending", resource: "org-tenant.invite",
      filter: { field: "status", op: "eq", value: "pending" } },
  ],
  charts: [
    { label: "Tenants by plan", resource: "org-tenant.tenant", chart: "donut", groupBy: "plan" },
    { label: "Tenants by status", resource: "org-tenant.tenant", chart: "donut", groupBy: "status" },
  ],
  shortcuts: [
    { label: "New tenant", icon: "Plus", href: "/platform/tenants/new" },
    { label: "Invites", icon: "Mail", href: "/platform/tenants/invites" },
  ],
});

export const orgTenantPlugin = buildDomainPlugin({
  id: "org-tenant",
  label: "Tenants",
  icon: "Building2",
  section: SECTIONS.platform,
  order: 3,
  resources: [
    {
      id: "tenant",
      singular: "Tenant",
      plural: "Tenants",
      icon: "Building2",
      path: "/platform/tenants",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "slug", kind: "text" },
        { name: "plan", kind: "enum", options: [
          { value: "free", label: "Free" }, { value: "pro", label: "Pro" },
          { value: "team", label: "Team" }, { value: "enterprise", label: "Enterprise" },
        ], sortable: true },
        { name: "status", kind: "enum", options: STATUS_ACTIVE },
        { name: "seats", kind: "number", align: "right", sortable: true },
        { name: "seatsUsed", kind: "number", align: "right" },
        { name: "schemaName", kind: "text" },
        { name: "dataResidency", kind: "enum", options: [
          { value: "us", label: "US" }, { value: "eu", label: "EU" },
          { value: "apac", label: "APAC" },
        ] },
        { name: "createdAt", kind: "date", sortable: true },
      ],
      seedCount: 14,
      seed: (i) => ({
        name: pick(["Gutu", "Acme Corp", "Globex", "Initech", "Hooli", "Pied Piper", "Dunder Mifflin"], i),
        slug: pick(["gutu", "acme", "globex", "initech", "hooli", "pied-piper"], i),
        plan: pick(["free", "pro", "team", "enterprise"], i),
        status: pick(["active", "active", "inactive"], i),
        seats: 5 + ((i * 17) % 200),
        seatsUsed: 3 + ((i * 13) % 100),
        schemaName: `tenant_${i + 1}`,
        dataResidency: pick(["us", "eu", "apac"], i),
        createdAt: daysAgo(i * 30),
      }),
    },
    {
      id: "invite",
      singular: "Tenant Invite",
      plural: "Invites",
      icon: "Mail",
      path: "/platform/tenants/invites",
      fields: [
        { name: "email", kind: "email", required: true, sortable: true },
        { name: "tenant", kind: "text" },
        { name: "role", kind: "text" },
        { name: "status", kind: "enum", options: [
          { value: "pending", label: "Pending", intent: "warning" },
          { value: "accepted", label: "Accepted", intent: "success" },
          { value: "expired", label: "Expired", intent: "neutral" },
        ] },
        { name: "invitedAt", kind: "date" },
        { name: "expiresAt", kind: "date" },
      ],
      seedCount: 10,
      seed: (i) => ({
        email: `invite+${i}@example.com`,
        tenant: pick(["Gutu", "Acme", "Globex"], i),
        role: pick(["admin", "member", "viewer"], i),
        status: pick(["pending", "accepted", "expired"], i),
        invitedAt: daysAgo(i),
        expiresAt: daysFromNow(14 - i),
      }),
    },
  ],
  extraNav: [
    { id: "org-tenant.control-room.nav", label: "Control Room", icon: "LayoutDashboard", path: "/platform/tenants/control-room", view: "org-tenant.control-room.view", order: 0 },
  ],
  extraViews: [controlRoomView],
  commands: [
    { id: "ot.go.control-room", label: "Tenants: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/platform/tenants/control-room"; } },
    { id: "ot.new", label: "New tenant", icon: "Plus", run: () => { window.location.hash = "/platform/tenants/new"; } },
  ],
});
