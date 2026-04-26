import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { code, daysAgo, daysFromNow, money, pick, COMPANIES } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "subscriptions.control-room.view",
    resource: "subscriptions.subscription",
    title: "Subscriptions Control Room",
    description: "MRR, churn, trials, past-due accounts.",
    kpis: [
        { label: "Active subs", resource: "subscriptions.subscription",
            filter: { field: "status", op: "eq", value: "active" }, drilldown: "/subscriptions" },
        { label: "MRR", resource: "subscriptions.subscription",
            fn: "sum", field: "mrr", format: "currency",
            filter: { field: "status", op: "eq", value: "active" } },
        { label: "Trialing", resource: "subscriptions.subscription",
            filter: { field: "status", op: "eq", value: "trialing" } },
        { label: "Past due", resource: "subscriptions.subscription",
            filter: { field: "status", op: "eq", value: "past_due" },
            warnAbove: 2, dangerAbove: 10 },
    ],
    charts: [
        { label: "Subs by plan", resource: "subscriptions.subscription", chart: "donut", groupBy: "plan" },
        { label: "Subs by status", resource: "subscriptions.subscription", chart: "donut", groupBy: "status" },
    ],
    shortcuts: [
        { label: "New subscription", icon: "Plus", href: "/subscriptions/new" },
        { label: "Plans", icon: "Layers", href: "/subscriptions/plans" },
        { label: "Invoices", icon: "FileText", href: "/subscriptions/invoices" },
        { label: "Reports", icon: "BarChart3", href: "/subscriptions/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const mrrByPlanReport = {
    id: "mrr-by-plan", label: "MRR by Plan",
    description: "Monthly recurring revenue per plan.",
    icon: "Layers", resource: "subscriptions.subscription", filters: [],
    async execute({ resources }) {
        const subs = await fetchAll(resources, "subscriptions.subscription");
        const by = new Map();
        for (const s of subs) {
            if (s.status !== "active")
                continue;
            const p = str(s.plan);
            const r = by.get(p) ?? { plan: p, customers: 0, mrr: 0, avgMrr: 0 };
            r.customers++;
            r.mrr += num(s.mrr);
            by.set(p, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, avgMrr: r.customers > 0 ? Math.round(r.mrr / r.customers) : 0 }))
            .sort((a, b) => b.mrr - a.mrr);
        return {
            columns: [
                { field: "plan", label: "Plan", fieldtype: "enum" },
                { field: "customers", label: "Customers", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "mrr", label: "MRR", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "avgMrr", label: "ARPU", fieldtype: "currency", align: "right", options: "USD" },
            ],
            rows,
        };
    },
};
const churnReport = {
    id: "churn", label: "Churn",
    description: "Canceled subscriptions this month.",
    icon: "TrendingDown", resource: "subscriptions.subscription", filters: [],
    async execute({ resources }) {
        const subs = await fetchAll(resources, "subscriptions.subscription");
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const canceled = subs.filter((s) => s.status === "canceled" && Date.parse(str(s.canceledAt)) >= monthStart.getTime());
        const rows = canceled.map((s) => ({
            ref: str(s.ref),
            customer: str(s.customer),
            plan: str(s.plan),
            mrrLost: num(s.mrr),
            canceledAt: str(s.canceledAt),
            reason: str(s.cancelReason),
        })).sort((a, b) => b.canceledAt.localeCompare(a.canceledAt));
        return {
            columns: [
                { field: "ref", label: "Sub", fieldtype: "text" },
                { field: "customer", label: "Customer", fieldtype: "text" },
                { field: "plan", label: "Plan", fieldtype: "enum" },
                { field: "mrrLost", label: "MRR lost", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "canceledAt", label: "Canceled", fieldtype: "date" },
                { field: "reason", label: "Reason", fieldtype: "text" },
            ],
            rows,
        };
    },
};
const renewalsReport = {
    id: "upcoming-renewals", label: "Upcoming Renewals",
    description: "Subscriptions renewing in the next 30 days.",
    icon: "CalendarClock", resource: "subscriptions.subscription", filters: [],
    async execute({ resources }) {
        const subs = await fetchAll(resources, "subscriptions.subscription");
        const cutoff = Date.now() + 30 * 86_400_000;
        const rows = subs
            .filter((s) => s.status === "active" && Date.parse(str(s.renewsAt)) <= cutoff)
            .map((s) => ({
            ref: str(s.ref),
            customer: str(s.customer),
            plan: str(s.plan),
            mrr: num(s.mrr),
            renewsAt: str(s.renewsAt),
            daysUntil: Math.ceil((Date.parse(str(s.renewsAt)) - Date.now()) / 86_400_000),
        }))
            .sort((a, b) => a.daysUntil - b.daysUntil);
        return {
            columns: [
                { field: "ref", label: "Sub", fieldtype: "text" },
                { field: "customer", label: "Customer", fieldtype: "text" },
                { field: "plan", label: "Plan", fieldtype: "enum" },
                { field: "mrr", label: "MRR", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "renewsAt", label: "Renews", fieldtype: "date" },
                { field: "daysUntil", label: "Days until", fieldtype: "number", align: "right" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "subscriptions.reports.view",
    detailViewId: "subscriptions.reports-detail.view",
    resource: "subscriptions.subscription",
    title: "Subscription Reports",
    description: "MRR by plan, churn, upcoming renewals.",
    basePath: "/subscriptions/reports",
    reports: [mrrByPlanReport, churnReport, renewalsReport],
});
export const subscriptionsPlugin = buildDomainPlugin({
    id: "subscriptions",
    label: "Subscriptions",
    icon: "RefreshCw",
    section: SECTIONS.commerce,
    order: 4,
    resources: [
        {
            id: "subscription",
            singular: "Subscription",
            plural: "Subscriptions",
            icon: "RefreshCw",
            path: "/subscriptions",
            defaultSort: { field: "renewsAt", dir: "asc" },
            fields: [
                { name: "ref", kind: "text", required: true, sortable: true, width: 130 },
                { name: "customer", kind: "text", required: true, sortable: true },
                { name: "plan", kind: "enum", required: true, options: [
                        { value: "starter", label: "Starter" },
                        { value: "pro", label: "Pro" },
                        { value: "team", label: "Team" },
                        { value: "enterprise", label: "Enterprise" },
                    ], sortable: true },
                { name: "mrr", label: "MRR", kind: "currency", align: "right", sortable: true },
                { name: "quantity", kind: "number", align: "right" },
                { name: "billingInterval", kind: "enum", options: [
                        { value: "month", label: "Monthly" },
                        { value: "year", label: "Yearly" },
                    ] },
                { name: "status", kind: "enum", required: true, options: [
                        { value: "trialing", label: "Trialing", intent: "warning" },
                        { value: "active", label: "Active", intent: "success" },
                        { value: "past_due", label: "Past due", intent: "danger" },
                        { value: "canceled", label: "Canceled", intent: "neutral" },
                        { value: "paused", label: "Paused", intent: "info" },
                    ], sortable: true },
                { name: "startedAt", kind: "date", sortable: true },
                { name: "trialEndsAt", kind: "date" },
                { name: "currentPeriodStart", kind: "date" },
                { name: "currentPeriodEnd", kind: "date" },
                { name: "renewsAt", kind: "date", sortable: true },
                { name: "canceledAt", kind: "date" },
                { name: "cancelReason", kind: "text" },
                { name: "owner", kind: "text" },
            ],
            seedCount: 30,
            seed: (i) => {
                const status = pick(["trialing", "active", "active", "active", "past_due", "canceled", "paused"], i);
                return {
                    ref: code("SUB", i, 6),
                    customer: pick(COMPANIES, i),
                    plan: pick(["starter", "pro", "team", "enterprise"], i),
                    mrr: money(i, 10, 5000),
                    quantity: 1 + (i % 5),
                    billingInterval: pick(["month", "year"], i),
                    status,
                    startedAt: daysAgo(365 - i * 10),
                    trialEndsAt: daysAgo(350 - i * 10),
                    currentPeriodStart: daysAgo(10),
                    currentPeriodEnd: daysFromNow(20),
                    renewsAt: daysFromNow(20 + (i % 30)),
                    canceledAt: status === "canceled" ? daysAgo(i * 3) : "",
                    cancelReason: status === "canceled" ? pick(["Too expensive", "Not using", "Switched vendor", "Business closed"], i) : "",
                    owner: "sam@gutu.dev",
                };
            },
        },
        {
            id: "plan",
            singular: "Plan",
            plural: "Plans",
            icon: "Layers",
            path: "/subscriptions/plans",
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "priceMonthly", kind: "currency", align: "right" },
                { name: "priceYearly", kind: "currency", align: "right" },
                { name: "features", kind: "multi-enum", options: [
                        { value: "api", label: "API" }, { value: "sso", label: "SSO" },
                        { value: "audit", label: "Audit log" }, { value: "priority", label: "Priority support" },
                    ] },
                { name: "active", kind: "boolean" },
            ],
            seedCount: 4,
            seed: (i) => ({
                code: pick(["starter", "pro", "team", "enterprise"], i),
                name: pick(["Starter", "Pro", "Team", "Enterprise"], i),
                priceMonthly: pick([0, 29, 99, 499], i),
                priceYearly: pick([0, 290, 990, 4990], i),
                features: pick([[], ["api"], ["api", "sso"], ["api", "sso", "audit", "priority"]], i),
                active: true,
            }),
        },
        {
            id: "subscription-invoice",
            singular: "Subscription Invoice",
            plural: "Invoices",
            icon: "FileText",
            path: "/subscriptions/invoices",
            readOnly: true,
            defaultSort: { field: "issuedAt", dir: "desc" },
            fields: [
                { name: "number", kind: "text", required: true, sortable: true },
                { name: "subscriptionRef", kind: "text" },
                { name: "customer", kind: "text", sortable: true },
                { name: "amount", kind: "currency", align: "right" },
                { name: "status", kind: "enum", options: [
                        { value: "open", label: "Open", intent: "info" },
                        { value: "paid", label: "Paid", intent: "success" },
                        { value: "past_due", label: "Past due", intent: "danger" },
                        { value: "void", label: "Void", intent: "neutral" },
                    ] },
                { name: "issuedAt", kind: "date" },
                { name: "dueAt", kind: "date" },
            ],
            seedCount: 20,
            seed: (i) => ({
                number: code("SINV", i, 6),
                subscriptionRef: code("SUB", i % 30, 6),
                customer: pick(COMPANIES, i),
                amount: money(i, 10, 5000),
                status: pick(["paid", "paid", "paid", "open", "past_due"], i),
                issuedAt: daysAgo(i * 3),
                dueAt: daysAgo(i * 3 - 14),
            }),
        },
    ],
    extraNav: [
        { id: "subscriptions.control-room.nav", label: "Subscriptions Control Room", icon: "LayoutDashboard", path: "/subscriptions/control-room", view: "subscriptions.control-room.view", order: 0 },
        { id: "subscriptions.reports.nav", label: "Reports", icon: "BarChart3", path: "/subscriptions/reports", view: "subscriptions.reports.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail],
    commands: [
        { id: "subs.go.control-room", label: "Subscriptions: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/subscriptions/control-room"; } },
        { id: "subs.go.reports", label: "Subscriptions: Reports", icon: "BarChart3", run: () => { window.location.hash = "/subscriptions/reports"; } },
        { id: "subs.new", label: "New subscription", icon: "Plus", run: () => { window.location.hash = "/subscriptions/new"; } },
    ],
});
