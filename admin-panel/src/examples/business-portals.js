import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { COMPANIES, daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
const controlRoomView = buildCompactControlRoom({
    viewId: "business-portals.control-room.view",
    resource: "business-portals.portal",
    title: "Business Portals Control Room",
    description: "Tenant portals, users, logins.",
    kpis: [
        { label: "Active portals", resource: "business-portals.portal",
            filter: { field: "status", op: "eq", value: "active" } },
        { label: "Total users", resource: "business-portals.portal-user" },
        { label: "Logins (7d)", resource: "business-portals.portal-user", range: "last-7" },
    ],
    charts: [
        { label: "Portals by status", resource: "business-portals.portal", chart: "donut", groupBy: "status" },
        { label: "Users by portal", resource: "business-portals.portal-user", chart: "bar", groupBy: "portal" },
    ],
    shortcuts: [
        { label: "New portal", icon: "Plus", href: "/portals/business/new" },
        { label: "Portal users", icon: "Users", href: "/portals/business/users" },
    ],
});
export const businessPortalsPlugin = buildDomainPlugin({
    id: "business-portals",
    label: "Business Portals",
    icon: "Globe",
    section: SECTIONS.portals,
    order: 1,
    resources: [
        {
            id: "portal",
            singular: "Portal",
            plural: "Portals",
            icon: "Globe",
            path: "/portals/business",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "tenant", kind: "text", sortable: true },
                { name: "domain", kind: "url" },
                { name: "kind", label: "Type", kind: "enum", options: [
                        { value: "customer", label: "Customer" }, { value: "partner", label: "Partner" },
                        { value: "vendor", label: "Vendor" }, { value: "supplier", label: "Supplier" },
                    ] },
                { name: "usersCount", kind: "number", align: "right" },
                { name: "theme", kind: "text" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE },
                { name: "updatedAt", kind: "datetime", sortable: true },
            ],
            seedCount: 10,
            seed: (i) => ({
                name: pick(["Customer Portal", "Partner Hub", "Vendor Desk", "Supplier Board", "Investor Room"], i),
                tenant: pick(COMPANIES, i),
                domain: `https://portal.${pick(COMPANIES, i).toLowerCase().replace(/\s+/g, "")}.com`,
                kind: pick(["customer", "partner", "vendor", "supplier"], i),
                usersCount: 20 + (i * 13) % 200,
                theme: pick(["default", "dark", "high-contrast"], i),
                status: pick(["active", "active", "inactive"], i),
                updatedAt: daysAgo(i),
            }),
        },
        {
            id: "portal-user",
            singular: "Portal User",
            plural: "Portal Users",
            icon: "Users",
            path: "/portals/business/users",
            fields: [
                { name: "email", kind: "email", required: true, sortable: true },
                { name: "portal", kind: "text", sortable: true },
                { name: "role", kind: "text" },
                { name: "lastLogin", kind: "datetime" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE },
            ],
            seedCount: 30,
            seed: (i) => ({
                email: `user+${i}@partner.example.com`,
                portal: pick(["Customer Portal", "Partner Hub", "Vendor Desk"], i),
                role: pick(["Admin", "Member", "Viewer"], i),
                lastLogin: daysAgo(i * 0.5),
                status: pick(["active", "active", "inactive"], i),
            }),
        },
    ],
    extraNav: [
        { id: "business-portals.control-room.nav", label: "Business Portals Control Room", icon: "LayoutDashboard", path: "/portals/business/control-room", view: "business-portals.control-room.view", order: 0 },
    ],
    extraViews: [controlRoomView],
    commands: [
        { id: "bp.go.control-room", label: "Business Portals: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/portals/business/control-room"; } },
        { id: "bp.new", label: "New portal", icon: "Plus", run: () => { window.location.hash = "/portals/business/new"; } },
    ],
});
