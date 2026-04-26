import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
const controlRoomView = buildCompactControlRoom({
    viewId: "portal.control-room.view",
    resource: "portal.session",
    title: "Customer Portal Control Room",
    description: "Sessions, tickets, invoices accessed.",
    kpis: [
        { label: "Active sessions", resource: "portal.session",
            filter: { field: "status", op: "eq", value: "active" } },
        { label: "Sessions (7d)", resource: "portal.session", range: "last-7" },
        { label: "Signups (30d)", resource: "portal.signup", range: "last-30" },
    ],
    charts: [
        { label: "Sessions (30d)", resource: "portal.session", chart: "area", period: "day", lastDays: 30 },
    ],
    shortcuts: [
        { label: "Signups", icon: "UserPlus", href: "/portals/customer/signups" },
    ],
});
export const portalPlugin = buildDomainPlugin({
    id: "portal",
    label: "Customer Portal",
    icon: "UserCheck",
    section: SECTIONS.portals,
    order: 2,
    resources: [
        {
            id: "session",
            singular: "Portal Session",
            plural: "Portal Sessions",
            icon: "Key",
            path: "/portals/customer",
            readOnly: true,
            displayField: "user",
            defaultSort: { field: "startedAt", dir: "desc" },
            fields: [
                { name: "user", kind: "text", sortable: true },
                { name: "tenant", kind: "text" },
                { name: "ip", kind: "text" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE },
                { name: "startedAt", kind: "datetime", sortable: true },
                { name: "endedAt", kind: "datetime" },
            ],
            seedCount: 30,
            seed: (i) => ({
                user: `customer+${i}@example.com`,
                tenant: pick(["Acme", "Globex", "Initech"], i),
                ip: `10.0.${i}.${(i * 7) % 255}`,
                status: pick(["active", "inactive"], i),
                startedAt: daysAgo(i),
                endedAt: i % 3 === 0 ? daysAgo(i - 0.1) : "",
            }),
        },
        {
            id: "signup",
            singular: "Signup",
            plural: "Signups",
            icon: "UserPlus",
            path: "/portals/customer/signups",
            defaultSort: { field: "signedUpAt", dir: "desc" },
            fields: [
                { name: "email", kind: "email", required: true, sortable: true },
                { name: "tenant", kind: "text" },
                { name: "signedUpAt", kind: "datetime", sortable: true },
                { name: "confirmed", kind: "boolean" },
            ],
            seedCount: 14,
            seed: (i) => ({
                email: `signup+${i}@example.com`,
                tenant: pick(["Acme", "Globex", "Initech"], i),
                signedUpAt: daysAgo(i * 0.5),
                confirmed: i % 5 !== 4,
            }),
        },
    ],
    extraNav: [
        { id: "portal.control-room.nav", label: "Portal Control Room", icon: "LayoutDashboard", path: "/portals/customer/control-room", view: "portal.control-room.view", order: 0 },
    ],
    extraViews: [controlRoomView],
    commands: [
        { id: "portal.go.control-room", label: "Customer Portal: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/portals/customer/control-room"; } },
    ],
});
