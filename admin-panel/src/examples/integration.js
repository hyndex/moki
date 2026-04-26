import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { daysAgo, daysFromNow, pick } from "./_factory/seeds";
import { integrationsStatusView } from "./integration-pages";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "integration.control-room.view",
    resource: "integration.connection",
    title: "Integrations Control Room",
    description: "Connections, sync health, webhooks.",
    kpis: [
        { label: "Active connections", resource: "integration.connection",
            filter: { field: "status", op: "eq", value: "active" } },
        { label: "Sync errors (24h)", resource: "integration.sync-event",
            filter: { field: "success", op: "eq", value: false }, range: "last-30",
            warnAbove: 3, dangerAbove: 10 },
        { label: "Webhooks", resource: "integration.webhook",
            filter: { field: "active", op: "eq", value: true } },
        { label: "API tokens", resource: "integration.api-key",
            filter: { field: "revoked", op: "eq", value: false } },
    ],
    charts: [
        { label: "Connections by provider", resource: "integration.connection", chart: "donut", groupBy: "provider" },
        { label: "Sync events (30d)", resource: "integration.sync-event", chart: "area", period: "day", lastDays: 30 },
    ],
    shortcuts: [
        { label: "New connection", icon: "Plug", href: "/automation/integrations/new" },
        { label: "Webhooks", icon: "Webhook", href: "/automation/integrations/webhooks" },
        { label: "Status", icon: "Activity", href: "/automation/integrations/status" },
        { label: "Reports", icon: "BarChart3", href: "/automation/integrations/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const syncHealthReport = {
    id: "sync-health", label: "Sync Health",
    description: "Success rate per connection.",
    icon: "Activity", resource: "integration.sync-event", filters: [],
    async execute({ resources }) {
        const events = await fetchAll(resources, "integration.sync-event");
        const by = new Map();
        for (const e of events) {
            const c = str(e.connection);
            const r = by.get(c) ?? { connection: c, total: 0, succeeded: 0, rate: 0 };
            r.total++;
            if (e.success)
                r.succeeded++;
            by.set(c, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, rate: r.total > 0 ? Math.round((r.succeeded / r.total) * 100) : 0 }))
            .sort((a, b) => a.rate - b.rate);
        return {
            columns: [
                { field: "connection", label: "Connection", fieldtype: "text" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "succeeded", label: "Success", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "rate", label: "Rate %", fieldtype: "percent", align: "right" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "integration.reports.view",
    detailViewId: "integration.reports-detail.view",
    resource: "integration.connection",
    title: "Integration Reports",
    description: "Sync health.",
    basePath: "/automation/integrations/reports",
    reports: [syncHealthReport],
});
export const integrationPlugin = buildDomainPlugin({
    id: "integration",
    label: "Integrations",
    icon: "Plug",
    section: SECTIONS.automation,
    order: 5,
    resources: [
        {
            id: "connection",
            singular: "Connection",
            plural: "Connections",
            icon: "Plug",
            path: "/automation/integrations",
            fields: [
                { name: "provider", kind: "enum", required: true, options: [
                        { value: "slack", label: "Slack" }, { value: "stripe", label: "Stripe" },
                        { value: "hubspot", label: "HubSpot" }, { value: "github", label: "GitHub" },
                        { value: "salesforce", label: "Salesforce" }, { value: "zapier", label: "Zapier" },
                        { value: "quickbooks", label: "QuickBooks" }, { value: "shopify", label: "Shopify" },
                    ], sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "account", kind: "text" },
                { name: "authMethod", kind: "enum", options: [
                        { value: "oauth", label: "OAuth" }, { value: "api-key", label: "API key" },
                        { value: "basic", label: "Basic auth" },
                    ] },
                { name: "status", kind: "enum", options: STATUS_ACTIVE, sortable: true },
                { name: "lastSync", kind: "datetime", sortable: true },
                { name: "syncCount", kind: "number", align: "right" },
                { name: "errorRate", label: "Error %", kind: "number", align: "right" },
            ],
            seedCount: 14,
            seed: (i) => ({
                provider: pick(["slack", "stripe", "hubspot", "github", "salesforce", "zapier", "quickbooks", "shopify"], i),
                name: pick(["Primary", "Ops", "Revenue", "Engineering", "Marketing"], i),
                account: `org-${i}`,
                authMethod: pick(["oauth", "oauth", "api-key"], i),
                status: pick(["active", "active", "inactive"], i),
                lastSync: daysAgo(i * 0.3),
                syncCount: 100 + (i * 37) % 5000,
                errorRate: (i * 3) % 10,
            }),
        },
        {
            id: "webhook",
            singular: "Webhook",
            plural: "Webhooks",
            icon: "Webhook",
            path: "/automation/integrations/webhooks",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "url", kind: "url", required: true },
                { name: "events", kind: "multi-enum", options: [
                        { value: "record.created", label: "Record created" },
                        { value: "record.updated", label: "Record updated" },
                        { value: "record.deleted", label: "Record deleted" },
                    ] },
                { name: "secret", kind: "text" },
                { name: "deliveryCount", kind: "number", align: "right" },
                { name: "lastDeliveredAt", kind: "datetime" },
                { name: "active", kind: "boolean" },
            ],
            seedCount: 10,
            seed: (i) => ({
                name: pick(["Slack notifier", "Salesforce sync", "Stripe relay", "Analytics pipeline"], i),
                url: `https://webhook.example.com/ep${i}`,
                events: pick([["record.created"], ["record.updated"], ["record.created", "record.updated"]], i),
                secret: `whsec_${String(1000 + i).slice(-4)}`,
                deliveryCount: 100 + (i * 317) % 5000,
                lastDeliveredAt: daysAgo(i * 0.5),
                active: i !== 9,
            }),
        },
        {
            id: "api-key",
            singular: "API Key",
            plural: "API Keys",
            icon: "Key",
            path: "/automation/integrations/api-keys",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "prefix", kind: "text" },
                { name: "scopes", kind: "multi-enum", options: [
                        { value: "read", label: "Read" }, { value: "write", label: "Write" },
                        { value: "admin", label: "Admin" },
                    ] },
                { name: "lastUsedAt", kind: "datetime" },
                { name: "expiresAt", kind: "date" },
                { name: "revoked", kind: "boolean" },
            ],
            seedCount: 8,
            seed: (i) => ({
                name: pick(["CI/CD", "Slack bot", "Zapier", "Partner API"], i),
                prefix: `gutu_${String(1000 + i).slice(-4)}`,
                scopes: pick([["read"], ["read", "write"], ["admin"]], i),
                lastUsedAt: daysAgo(i),
                expiresAt: daysFromNow(365),
                revoked: i === 7,
            }),
        },
        {
            id: "sync-event",
            singular: "Sync Event",
            plural: "Sync Events",
            icon: "RefreshCw",
            path: "/automation/integrations/sync-events",
            readOnly: true,
            defaultSort: { field: "occurredAt", dir: "desc" },
            fields: [
                { name: "connection", kind: "text", sortable: true },
                { name: "kind", kind: "enum", options: [
                        { value: "full", label: "Full sync" }, { value: "incremental", label: "Incremental" },
                        { value: "webhook", label: "Webhook" },
                    ] },
                { name: "records", kind: "number", align: "right" },
                { name: "success", kind: "boolean" },
                { name: "message", kind: "text" },
                { name: "occurredAt", kind: "datetime", sortable: true },
            ],
            seedCount: 40,
            seed: (i) => ({
                connection: pick(["Slack Primary", "Stripe Primary", "HubSpot Revenue"], i),
                kind: pick(["full", "incremental", "webhook"], i),
                records: 100 + (i * 37) % 1000,
                success: i % 8 !== 5,
                message: i % 8 === 5 ? "Rate limited by provider" : "",
                occurredAt: daysAgo(i * 0.3),
            }),
        },
    ],
    extraNav: [
        { id: "integration.control-room.nav", label: "Integration Control Room", icon: "LayoutDashboard", path: "/automation/integrations/control-room", view: "integration.control-room.view", order: 0 },
        { id: "integration.reports.nav", label: "Reports", icon: "BarChart3", path: "/automation/integrations/reports", view: "integration.reports.view" },
        { id: "integration.status.nav", label: "Status", icon: "Activity", path: "/automation/integrations/status", view: "integration.status.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail, integrationsStatusView],
    commands: [
        { id: "int.go.control-room", label: "Integrations: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/automation/integrations/control-room"; } },
        { id: "int.new", label: "New integration", icon: "Plug", run: () => { window.location.hash = "/automation/integrations/new"; } },
    ],
});
