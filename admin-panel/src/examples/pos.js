import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { code, daysAgo, money, pick, personName } from "./_factory/seeds";
import { posShiftSummaryView } from "./pos-pages";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "pos.control-room.view",
    resource: "pos.sale",
    title: "POS Control Room",
    description: "Today's sales, terminals, cashiers.",
    kpis: [
        { label: "Sales today", resource: "pos.sale", range: "mtd" },
        { label: "Revenue today", resource: "pos.sale", fn: "sum", field: "total", format: "currency", range: "mtd" },
        { label: "Online terminals", resource: "pos.terminal",
            filter: { field: "status", op: "eq", value: "online" } },
        { label: "Active shifts", resource: "pos.shift",
            filter: { field: "status", op: "eq", value: "open" } },
    ],
    charts: [
        { label: "Sales by terminal", resource: "pos.sale", chart: "bar", groupBy: "terminal", fn: "sum", field: "total" },
        { label: "Sales trend (30d)", resource: "pos.sale", chart: "area", period: "day", fn: "sum", field: "total", lastDays: 30 },
    ],
    shortcuts: [
        { label: "New sale", icon: "ShoppingBag", href: "/pos/sales/new" },
        { label: "Shift summary", icon: "Receipt", href: "/pos/shift" },
        { label: "Terminals", icon: "Monitor", href: "/pos/terminals" },
        { label: "Reports", icon: "BarChart3", href: "/pos/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const salesByTerminalReport = {
    id: "sales-by-terminal", label: "Sales by Terminal",
    description: "Sales $ + count per terminal.",
    icon: "Monitor", resource: "pos.sale", filters: [],
    async execute({ resources }) {
        const sales = await fetchAll(resources, "pos.sale");
        const by = new Map();
        for (const s of sales) {
            const t = str(s.terminal);
            const r = by.get(t) ?? { terminal: t, sales: 0, revenue: 0, items: 0 };
            r.sales++;
            r.revenue += num(s.total);
            r.items += num(s.items);
            by.set(t, r);
        }
        const rows = [...by.values()].sort((a, b) => b.revenue - a.revenue);
        return {
            columns: [
                { field: "terminal", label: "Terminal", fieldtype: "text" },
                { field: "sales", label: "Sales", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "items", label: "Items", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "revenue", label: "Revenue", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
const salesByHourReport = {
    id: "sales-by-hour", label: "Sales by Hour",
    description: "Hourly distribution to guide staffing.",
    icon: "Clock", resource: "pos.sale", filters: [],
    async execute({ resources }) {
        const sales = await fetchAll(resources, "pos.sale");
        const byHour = new Map();
        for (const s of sales) {
            const d = new Date(str(s.occurredAt));
            if (Number.isNaN(d.getTime()))
                continue;
            const h = d.getHours();
            const r = byHour.get(h) ?? { hour: h, sales: 0, revenue: 0 };
            r.sales++;
            r.revenue += num(s.total);
            byHour.set(h, r);
        }
        const rows = Array.from({ length: 24 }, (_, h) => byHour.get(h) ?? { hour: h, sales: 0, revenue: 0 });
        return {
            columns: [
                { field: "hour", label: "Hour", fieldtype: "number", align: "right" },
                { field: "sales", label: "Sales", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "revenue", label: "Revenue", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
const topProductsReport = {
    id: "top-products", label: "Top Products",
    description: "Best-selling products at POS (last 30 days).",
    icon: "TrendingUp", resource: "pos.sale-line", filters: [],
    async execute({ resources }) {
        const lines = await fetchAll(resources, "pos.sale-line");
        const by = new Map();
        for (const l of lines) {
            const k = str(l.sku);
            const r = by.get(k) ?? { sku: k, name: str(l.name), qty: 0, revenue: 0 };
            r.qty += num(l.qty);
            r.revenue += num(l.total);
            by.set(k, r);
        }
        const rows = [...by.values()].sort((a, b) => b.qty - a.qty).slice(0, 20);
        return {
            columns: [
                { field: "sku", label: "SKU", fieldtype: "text" },
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "qty", label: "Qty", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "revenue", label: "Revenue", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "pos.reports.view",
    detailViewId: "pos.reports-detail.view",
    resource: "pos.sale",
    title: "POS Reports",
    description: "Sales by terminal, by hour, top products.",
    basePath: "/pos/reports",
    reports: [salesByTerminalReport, salesByHourReport, topProductsReport],
});
export const posPlugin = buildDomainPlugin({
    id: "pos",
    label: "Point of Sale",
    icon: "Store",
    section: SECTIONS.commerce,
    order: 3,
    resources: [
        {
            id: "terminal",
            singular: "Terminal",
            plural: "Terminals",
            icon: "Monitor",
            path: "/pos/terminals",
            fields: [
                { name: "code", kind: "text", required: true, sortable: true, width: 110 },
                { name: "name", kind: "text", required: true },
                { name: "location", kind: "text", sortable: true },
                { name: "store", kind: "text" },
                { name: "serialNumber", kind: "text" },
                { name: "status", kind: "enum", options: [
                        { value: "online", label: "Online", intent: "success" },
                        { value: "offline", label: "Offline", intent: "danger" },
                        { value: "maintenance", label: "Maintenance", intent: "warning" },
                    ] },
                { name: "lastCheckin", kind: "datetime", sortable: true },
            ],
            seedCount: 12,
            seed: (i) => ({
                code: code("POS", i, 4),
                name: `Terminal ${i + 1}`,
                location: pick(["Downtown", "Airport", "Mall", "Outlet", "Flagship", "Warehouse"], i),
                store: pick(["Store A", "Store B", "Store C"], i),
                serialNumber: `SN-${String(100000 + i * 37).slice(-6)}`,
                status: pick(["online", "online", "online", "offline", "maintenance"], i),
                lastCheckin: daysAgo(i * 0.2),
            }),
        },
        {
            id: "sale",
            singular: "Sale",
            plural: "Sales",
            icon: "ShoppingBag",
            path: "/pos/sales",
            readOnly: true,
            displayField: "ref",
            defaultSort: { field: "occurredAt", dir: "desc" },
            fields: [
                { name: "ref", label: "Ref", kind: "text", sortable: true, width: 130 },
                { name: "terminal", kind: "text", sortable: true },
                { name: "cashier", kind: "text" },
                { name: "customer", kind: "text" },
                { name: "items", kind: "number", align: "right" },
                { name: "subtotal", kind: "currency", align: "right" },
                { name: "tax", kind: "currency", align: "right" },
                { name: "discount", kind: "currency", align: "right" },
                { name: "total", kind: "currency", align: "right", sortable: true },
                { name: "paymentMethod", kind: "enum", options: [
                        { value: "card", label: "Card" }, { value: "cash", label: "Cash" },
                        { value: "gift-card", label: "Gift card" }, { value: "mobile", label: "Mobile" },
                    ] },
                { name: "occurredAt", kind: "datetime", sortable: true },
                { name: "refunded", kind: "boolean" },
            ],
            seedCount: 40,
            seed: (i) => {
                const subtotal = money(i, 5, 500);
                const tax = Math.round(subtotal * 0.08);
                const discount = i % 5 === 0 ? Math.round(subtotal * 0.1) : 0;
                const occurred = new Date(Date.now() - i * 3 * 3_600_000);
                return {
                    ref: code("SALE", i, 6),
                    terminal: code("POS", i % 8, 4),
                    cashier: personName(i),
                    customer: i % 3 === 0 ? personName(i + 5) : "",
                    items: 1 + (i % 8),
                    subtotal,
                    tax,
                    discount,
                    total: subtotal + tax - discount,
                    paymentMethod: pick(["card", "card", "cash", "mobile", "gift-card"], i),
                    occurredAt: occurred.toISOString(),
                    refunded: i % 20 === 0,
                };
            },
        },
        {
            id: "sale-line",
            singular: "Sale Line",
            plural: "Sale Lines",
            icon: "Receipt",
            path: "/pos/sale-lines",
            readOnly: true,
            displayField: "sku",
            fields: [
                { name: "saleRef", label: "Sale", kind: "text", sortable: true },
                { name: "sku", kind: "text", required: true, sortable: true },
                { name: "name", kind: "text" },
                { name: "qty", kind: "number", align: "right" },
                { name: "unitPrice", kind: "currency", align: "right" },
                { name: "total", kind: "currency", align: "right" },
                { name: "taxRate", kind: "number", align: "right" },
            ],
            seedCount: 80,
            seed: (i) => {
                const qty = 1 + (i % 4);
                const unitPrice = money(i, 5, 200);
                return {
                    saleRef: code("SALE", i % 40, 6),
                    sku: code("P", (i * 3) % 20, 6),
                    name: pick(["Classic Tee", "Running Shoes", "Coffee Mug", "Wireless Mouse", "Notebook"], i),
                    qty,
                    unitPrice,
                    total: qty * unitPrice,
                    taxRate: 0.08,
                };
            },
        },
        {
            id: "shift",
            singular: "Shift",
            plural: "Shifts",
            icon: "Clock",
            path: "/pos/shifts",
            defaultSort: { field: "openedAt", dir: "desc" },
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "terminal", kind: "text", sortable: true },
                { name: "cashier", kind: "text" },
                { name: "openedAt", kind: "datetime", sortable: true },
                { name: "closedAt", kind: "datetime" },
                { name: "openingFloat", kind: "currency", align: "right" },
                { name: "closingFloat", kind: "currency", align: "right" },
                { name: "expected", kind: "currency", align: "right" },
                { name: "actual", kind: "currency", align: "right" },
                { name: "variance", kind: "currency", align: "right" },
                { name: "status", kind: "enum", options: [
                        { value: "open", label: "Open", intent: "success" },
                        { value: "closed", label: "Closed", intent: "neutral" },
                        { value: "discrepancy", label: "Discrepancy", intent: "warning" },
                    ] },
            ],
            seedCount: 16,
            seed: (i) => {
                const expected = money(i, 200, 5000);
                const actual = expected - (i % 3 === 0 ? 5 : 0);
                return {
                    code: code("SHIFT", i, 5),
                    terminal: code("POS", i % 4, 4),
                    cashier: personName(i),
                    openedAt: daysAgo(i),
                    closedAt: i < 12 ? daysAgo(i - 0.3) : "",
                    openingFloat: 200,
                    closingFloat: actual + 200,
                    expected,
                    actual,
                    variance: actual - expected,
                    status: i >= 12 ? "open" : i % 5 === 0 ? "discrepancy" : "closed",
                };
            },
        },
        {
            id: "cashier",
            singular: "Cashier",
            plural: "Cashiers",
            icon: "UserCircle",
            path: "/pos/cashiers",
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "email", kind: "email" },
                { name: "store", kind: "text" },
                { name: "salesToday", kind: "number", align: "right" },
                { name: "revenueToday", kind: "currency", align: "right" },
                { name: "active", kind: "boolean" },
            ],
            seedCount: 10,
            seed: (i) => ({
                code: code("CSH", i, 4),
                name: personName(i),
                email: `cashier${i}@gutu.dev`,
                store: pick(["Store A", "Store B", "Store C"], i),
                salesToday: 5 + (i * 3),
                revenueToday: 500 + (i * 317),
                active: i !== 9,
            }),
        },
    ],
    extraNav: [
        { id: "pos.control-room.nav", label: "POS Control Room", icon: "LayoutDashboard", path: "/pos/control-room", view: "pos.control-room.view", order: 0 },
        { id: "pos.reports.nav", label: "Reports", icon: "BarChart3", path: "/pos/reports", view: "pos.reports.view" },
        { id: "pos.shift-summary.nav", label: "Shift summary", icon: "Receipt", path: "/pos/shift-summary", view: "pos.shift-summary.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail, posShiftSummaryView],
    commands: [
        { id: "pos.go.control-room", label: "POS: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/pos/control-room"; } },
        { id: "pos.go.reports", label: "POS: Reports", icon: "BarChart3", run: () => { window.location.hash = "/pos/reports"; } },
        { id: "pos.new-sale", label: "New sale", icon: "ShoppingBag", run: () => { window.location.hash = "/pos/sales/new"; } },
        { id: "pos.new-shift", label: "Open shift", icon: "Clock", run: () => { window.location.hash = "/pos/shifts/new"; } },
    ],
});
