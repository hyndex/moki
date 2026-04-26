import { jsx as _jsx } from "react/jsx-runtime";
import { z } from "zod";
import { defineListView, defineResource, defineCustomView, } from "@/builders";
import { definePlugin } from "@/contracts/plugin-v2";
import { Badge } from "@/primitives/Badge";
import { formatRelative } from "@/lib/format";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { auditEventDetailView } from "./AuditEventDetailPage";
import { LiveAuditPage } from "./LiveAuditPage";
import { auditControlRoomView, auditReportsIndexView, auditReportsDetailView, } from "./audit-dashboard";
const EventSchema = z.object({
    id: z.string(),
    actor: z.string(),
    action: z.string(),
    resource: z.string(),
    recordId: z.string(),
    level: z.enum(["info", "warn", "error"]),
    occurredAt: z.string(),
    ip: z.string().optional(),
});
const eventResource = defineResource({
    id: "audit.event",
    singular: "Event",
    plural: "Events",
    schema: EventSchema,
    displayField: "action",
    searchable: ["actor", "action", "resource"],
    icon: "History",
});
eventResource.__seed = seedEvents();
const eventsList = defineListView({
    id: "audit.events",
    title: "Audit log",
    description: "Every state-changing event, immutably recorded.",
    resource: eventResource.id,
    search: true,
    pageSize: 15,
    defaultSort: { field: "occurredAt", dir: "desc" },
    columns: [
        {
            field: "occurredAt",
            label: "When",
            sortable: true,
            width: 160,
            render: (v) => (_jsx("span", { className: "text-text-secondary", children: formatRelative(v) })),
        },
        {
            field: "level",
            label: "Level",
            width: 90,
            render: (v) => (_jsx(Badge, { intent: v === "error" ? "danger" : v === "warn" ? "warning" : "info", children: String(v) })),
        },
        { field: "actor", label: "Actor", sortable: true, width: 140 },
        { field: "action", label: "Action" },
        { field: "resource", label: "Resource", width: 160 },
        {
            field: "recordId",
            label: "Record",
            width: 140,
            render: (v) => (_jsx("code", { className: "text-xs font-mono text-text-muted", children: String(v) })),
        },
    ],
    filters: [
        {
            field: "level",
            label: "Level",
            kind: "enum",
            options: [
                { value: "info", label: "Info" },
                { value: "warn", label: "Warn" },
                { value: "error", label: "Error" },
            ],
        },
        { field: "occurredAt", label: "When", kind: "date-range" },
    ],
});
const about = defineCustomView({
    id: "audit.about",
    title: "About",
    description: "How the audit plugin works.",
    resource: eventResource.id,
    render: () => (_jsx(EmptyState, { title: "Read-only by design", description: "The audit plugin contributes a list view but no form view \u2014 the shell automatically hides the New button and inline edit. This proves the universality of the contract: plugins only declare what they choose to." })),
});
const liveLog = defineCustomView({
    id: "audit.live.view",
    title: "Audit log",
    description: "Live stream of every mutation on the backend.",
    resource: eventResource.id,
    render: () => _jsx(LiveAuditPage, {}),
});
const auditNavSections = [{ id: "platform", label: "Platform", order: 100 }];
const auditNav = [
    {
        id: "audit-events", label: "Audit log", icon: "History",
        path: "/audit", view: "audit.live.view", section: "platform", order: 10,
    },
    {
        id: "audit-events-seeded", label: "Audit log (seeded demo)", icon: "Database",
        path: "/audit/seeded", view: "audit.events", section: "platform", order: 11,
    },
    {
        id: "audit-about", label: "About audit", icon: "Info",
        path: "/audit/about", view: "audit.about", section: "platform", order: 20,
    },
    {
        id: "audit-event-detail", label: "Event detail (sample)", icon: "FileText",
        path: "/audit/event-sample", view: "audit.event-detail.view", section: "platform", order: 25,
    },
    { id: "audit-control-room", label: "Audit Control Room", icon: "LayoutDashboard", path: "/audit/control-room", view: "audit.control-room.view", section: "platform", order: 5 },
    { id: "audit-reports", label: "Reports", icon: "BarChart3", path: "/audit/reports", view: "audit.reports.view", section: "platform", order: 12 },
];
const auditResources = [eventResource];
const auditViews = [
    liveLog, eventsList, about, auditEventDetailView,
    auditControlRoomView, auditReportsIndexView, auditReportsDetailView,
];
const auditCommands = [
    { id: "audit.go.control-room", label: "Audit: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/audit/control-room"; } },
    { id: "audit.go.reports", label: "Audit: Reports", icon: "BarChart3", run: () => { window.location.hash = "/audit/reports"; } },
    { id: "audit.go.log", label: "Audit: Live log", icon: "History", run: () => { window.location.hash = "/audit"; } },
];
export const auditPlugin = definePlugin({
    manifest: {
        id: "audit",
        version: "0.1.0",
        label: "Audit",
        description: "Tamper-evident event log.",
        icon: "History",
        requires: {
            shell: "*",
            capabilities: ["resources:read", "nav", "commands"],
        },
        activationEvents: [{ kind: "onStart" }],
        origin: { kind: "explicit" },
    },
    async activate(ctx) {
        ctx.contribute.navSections(auditNavSections);
        ctx.contribute.nav(auditNav);
        ctx.contribute.resources(auditResources);
        ctx.contribute.views(auditViews);
        ctx.contribute.commands(auditCommands);
    },
});
function seedEvents() {
    const actions = [
        "booking.created",
        "booking.confirmed",
        "booking.cancelled",
        "contact.created",
        "contact.updated",
        "contact.vip.flagged",
        "auth.login",
        "auth.logout",
        "role.assigned",
        "settings.changed",
    ];
    const actors = [
        "chinmoy@gutu.dev",
        "system",
        "sam@gutu.dev",
        "alex@gutu.dev",
        "taylor@gutu.dev",
    ];
    const levels = ["info", "info", "info", "warn", "info", "info", "error", "info"];
    const now = Date.now();
    return Array.from({ length: 40 }, (_, i) => {
        const action = actions[i % actions.length];
        return {
            id: `ev_${i + 1}`,
            actor: actors[i % actors.length],
            action,
            resource: action.split(".")[0],
            recordId: `rec_${1000 + ((i * 37) % 800)}`,
            level: levels[i % levels.length],
            occurredAt: new Date(now - i * 43 * 60_000).toISOString(),
            ip: `10.0.${i % 255}.${(i * 31) % 255}`,
        };
    });
}
