import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { pick, personName, daysAgo } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
import type { ReportDefinition, ReportResult } from "@/contracts/widgets";

const controlRoomView = buildCompactControlRoom({
  viewId: "role-policy.control-room.view",
  resource: "role-policy.role",
  title: "Roles & Policies Control Room",
  description: "Access control pulse: roles, policies, assignments.",
  kpis: [
    { label: "Roles", resource: "role-policy.role" },
    { label: "Policies", resource: "role-policy.policy" },
    { label: "Assignments", resource: "role-policy.assignment" },
    { label: "Pending reviews", resource: "role-policy.access-review",
      filter: { field: "status", op: "eq", value: "pending" }, warnAbove: 3 },
  ],
  charts: [
    { label: "Roles by size", resource: "role-policy.role", chart: "bar", groupBy: "name" },
    { label: "Policies by effect", resource: "role-policy.policy", chart: "donut", groupBy: "effect" },
  ],
  shortcuts: [
    { label: "New role", icon: "Shield", href: "/roles/new" },
    { label: "New policy", icon: "FileLock", href: "/policies/new" },
    { label: "Access review", icon: "ClipboardCheck", href: "/roles/access-reviews/new" },
    { label: "Reports", icon: "BarChart3", href: "/roles/reports" },
  ],
});

async function fetchAll(r: import("@/runtime/resourceClient").ResourceClient, resource: string) {
  return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows as Record<string, unknown>[];
}
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const rolePopulationReport: ReportDefinition = {
  id: "role-population", label: "Role Population",
  description: "Members per role.",
  icon: "Shield", resource: "role-policy.role", filters: [],
  async execute({ resources }): Promise<ReportResult> {
    const roles = await fetchAll(resources, "role-policy.role");
    const rows = roles.map((r) => ({
      name: str(r.name),
      description: str(r.description),
      members: num(r.members),
      policies: num(r.policies),
    })).sort((a, b) => b.members - a.members);
    return {
      columns: [
        { field: "name", label: "Role", fieldtype: "text" },
        { field: "description", label: "Description", fieldtype: "text" },
        { field: "members", label: "Members", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "policies", label: "Policies", fieldtype: "number", align: "right", totaling: "sum" },
      ],
      rows,
    };
  },
};

const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
  indexViewId: "role-policy.reports.view",
  detailViewId: "role-policy.reports-detail.view",
  resource: "role-policy.role",
  title: "Role & Policy Reports",
  description: "Role population + access analytics.",
  basePath: "/roles/reports",
  reports: [rolePopulationReport],
});

export const rolePolicyPlugin = buildDomainPlugin({
  id: "role-policy",
  label: "Roles & Policies",
  icon: "Shield",
  section: SECTIONS.people,
  order: 3,
  resources: [
    {
      id: "role",
      singular: "Role",
      plural: "Roles",
      icon: "Shield",
      path: "/roles",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "description", kind: "text" },
        { name: "members", kind: "number", align: "right", sortable: true },
        { name: "policies", kind: "number", align: "right" },
        { name: "system", label: "System role", kind: "boolean" },
      ],
      seedCount: 10,
      seed: (i) => ({
        name: pick(["Admin", "Manager", "Engineer", "Sales Rep", "Support", "Finance", "Auditor", "Billing", "Guest", "Service Account"], i),
        description: pick(["Full access", "Team-level controls", "Read+write code resources", "CRM and orders", "Tickets and KB", "Invoices + payments", "Read-only audit", "Billing actions", "Limited read", "Automation"], i),
        members: 1 + ((i * 11) % 40),
        policies: 3 + (i * 2) % 15,
        system: i < 5,
      }),
    },
    {
      id: "policy",
      singular: "Policy",
      plural: "Policies",
      icon: "FileLock",
      path: "/policies",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "resource", kind: "text", sortable: true },
        { name: "action", kind: "enum", options: [
          { value: "read", label: "Read" }, { value: "write", label: "Write" },
          { value: "delete", label: "Delete" }, { value: "admin", label: "Admin" },
        ] },
        { name: "effect", kind: "enum", options: [
          { value: "allow", label: "Allow", intent: "success" },
          { value: "deny", label: "Deny", intent: "danger" },
        ] },
        { name: "conditions", kind: "text" },
        { name: "appliedToRoles", kind: "number", align: "right" },
      ],
      seedCount: 20,
      seed: (i) => ({
        name: pick(["Read invoices", "Export contacts", "Delete records", "Manage users", "Audit access", "Write inventory", "Admin billing", "Read reports"], i),
        resource: pick(["accounting.invoice", "crm.contact", "*", "auth.user", "audit.event", "inventory.item", "accounting.*", "analytics-bi.report"], i),
        action: pick(["read", "write", "delete", "admin"], i),
        effect: pick(["allow", "allow", "allow", "deny"], i),
        conditions: pick(["tenant = current", "role = admin", "", "owner = user"], i),
        appliedToRoles: 1 + (i * 3) % 8,
      }),
    },
    {
      id: "assignment",
      singular: "Role Assignment",
      plural: "Role Assignments",
      icon: "UserCheck",
      path: "/roles/assignments",
      fields: [
        { name: "user", kind: "text", required: true, sortable: true },
        { name: "role", kind: "text", required: true, sortable: true },
        { name: "scope", kind: "text" },
        { name: "grantedAt", kind: "date" },
        { name: "grantedBy", kind: "text" },
        { name: "expiresAt", kind: "date" },
      ],
      seedCount: 40,
      seed: (i) => ({
        user: personName(i),
        role: pick(["Admin", "Manager", "Engineer", "Sales Rep", "Support", "Finance"], i),
        scope: pick(["tenant", "department:engineering", "project:alpha", ""], i),
        grantedAt: daysAgo(i * 10),
        grantedBy: "sam@gutu.dev",
        expiresAt: "",
      }),
    },
    {
      id: "access-review",
      singular: "Access Review",
      plural: "Access Reviews",
      icon: "ClipboardCheck",
      path: "/roles/access-reviews",
      defaultSort: { field: "startedAt", dir: "desc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true },
        { name: "scope", kind: "text" },
        { name: "reviewer", kind: "text" },
        { name: "startedAt", kind: "date" },
        { name: "dueAt", kind: "date" },
        { name: "usersReviewed", kind: "number", align: "right" },
        { name: "revoked", kind: "number", align: "right" },
        { name: "status", kind: "enum", options: [
          { value: "pending", label: "Pending", intent: "warning" },
          { value: "in-progress", label: "In progress", intent: "info" },
          { value: "completed", label: "Completed", intent: "success" },
        ] },
      ],
      seedCount: 8,
      seed: (i) => ({
        code: `REV-${String(1000 + i).slice(-4)}`,
        scope: pick(["Quarterly", "Annual", "Manager scope", "Finance scope"], i),
        reviewer: personName(i),
        startedAt: daysAgo(30 - i * 4),
        dueAt: daysAgo(i - 3),
        usersReviewed: 10 + (i * 3),
        revoked: i,
        status: pick(["pending", "in-progress", "completed"], i),
      }),
    },
  ],
  extraNav: [
    { id: "role-policy.control-room.nav", label: "Roles Control Room", icon: "LayoutDashboard", path: "/roles/control-room", view: "role-policy.control-room.view", order: 0 },
    { id: "role-policy.reports.nav", label: "Reports", icon: "BarChart3", path: "/roles/reports", view: "role-policy.reports.view" },
  ],
  extraViews: [controlRoomView, reportsIndex, reportsDetail],
  commands: [
    { id: "roles.go.control-room", label: "Roles: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/roles/control-room"; } },
    { id: "roles.new-role", label: "New role", icon: "Shield", run: () => { window.location.hash = "/roles/new"; } },
    { id: "roles.new-policy", label: "New policy", icon: "FileLock", run: () => { window.location.hash = "/policies/new"; } },
  ],
});
