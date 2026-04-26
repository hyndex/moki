/** Production-grade standard reports, ERPNext-style.
 *
 * Each report is a pure function over the live record set — no hardcoded data.
 * Filters bind to real fields; charts drive from the computed rows.
 */
/* ---------- utilities ---------- */
function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function parseDate(v) {
    if (!v)
        return null;
    if (v instanceof Date)
        return v;
    if (typeof v === "string" || typeof v === "number") {
        const d = new Date(v);
        if (!Number.isNaN(d.getTime()))
            return d;
    }
    return null;
}
function num(v, fallback = 0) {
    return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}
function str(v, fallback = "") {
    return typeof v === "string" ? v : fallback;
}
function inDateRange(v, from, to) {
    const d = parseDate(v);
    if (!d)
        return false;
    const fromD = typeof from === "string" ? new Date(from) : null;
    const toD = typeof to === "string" ? new Date(to) : null;
    if (fromD && d < fromD)
        return false;
    if (toD) {
        const end = new Date(toD);
        end.setHours(23, 59, 59, 999);
        if (d > end)
            return false;
    }
    return true;
}
async function fetchAll(resources, resource) {
    const list = await resources.list(resource, { page: 1, pageSize: 10_000 });
    return list.rows;
}
/* ---------- 1. Sales Analytics (Monthly) ---------- */
export const salesAnalyticsReport = {
    id: "sales-analytics",
    label: "Sales Analytics",
    description: "Monthly bookings broken down by stage with trend chart.",
    icon: "TrendingUp",
    resource: "sales.deal",
    filters: [
        { field: "from", label: "From", kind: "date" },
        { field: "to", label: "To", kind: "date" },
        {
            field: "stage",
            label: "Stage",
            kind: "enum",
            options: [
                { value: "qualify", label: "Qualify" },
                { value: "proposal", label: "Proposal" },
                { value: "negotiate", label: "Negotiate" },
                { value: "won", label: "Closed Won" },
                { value: "lost", label: "Closed Lost" },
            ],
        },
    ],
    async execute({ filters, resources }) {
        const deals = await fetchAll(resources, "sales.deal");
        const filtered = deals.filter((d) => {
            if (filters.stage && d.stage !== filters.stage)
                return false;
            if ((filters.from || filters.to) && !inDateRange(d.createdAt, filters.from, filters.to)) {
                return false;
            }
            return true;
        });
        const byMonth = new Map();
        for (const d of filtered) {
            const date = parseDate(d.createdAt);
            if (!date)
                continue;
            const k = monthKey(date);
            const b = byMonth.get(k) ?? { month: k, count: 0, pipeline: 0, won: 0, lost: 0 };
            b.count++;
            const amt = num(d.amount);
            if (d.stage === "won")
                b.won += amt;
            else if (d.stage === "lost")
                b.lost += amt;
            else
                b.pipeline += amt;
            byMonth.set(k, b);
        }
        const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
        const columns = [
            { field: "month", label: "Month", fieldtype: "text", width: 110 },
            { field: "count", label: "Deals", fieldtype: "number", align: "right", totaling: "sum" },
            { field: "pipeline", label: "Pipeline", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            { field: "won", label: "Won", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            { field: "lost", label: "Lost", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
        ];
        const totals = {
            count: rows.reduce((a, r) => a + r.count, 0),
            pipeline: rows.reduce((a, r) => a + r.pipeline, 0),
            won: rows.reduce((a, r) => a + r.won, 0),
            lost: rows.reduce((a, r) => a + r.lost, 0),
        };
        return {
            columns,
            rows,
            totals,
            chart: {
                kind: "bar",
                label: "Bookings by month",
                format: "currency",
                currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.month, value: r.won })),
            },
        };
    },
};
/* ---------- 2. Sales Person Performance ---------- */
export const salesPersonReport = {
    id: "sales-person",
    label: "Sales Person Performance",
    description: "Deals and amounts grouped by owner, ranked.",
    icon: "Trophy",
    resource: "sales.deal",
    filters: [
        {
            field: "stage",
            label: "Stage",
            kind: "enum",
            options: [
                { value: "qualify", label: "Qualify" },
                { value: "proposal", label: "Proposal" },
                { value: "negotiate", label: "Negotiate" },
                { value: "won", label: "Closed Won" },
                { value: "lost", label: "Closed Lost" },
            ],
        },
    ],
    async execute({ filters, resources }) {
        const deals = await fetchAll(resources, "sales.deal");
        const filtered = deals.filter((d) => !filters.stage || d.stage === filters.stage);
        const byOwner = new Map();
        for (const d of filtered) {
            const o = str(d.owner, "Unassigned");
            const b = byOwner.get(o) ?? { owner: o, deals: 0, amount: 0, won: 0, winRate: 0 };
            b.deals++;
            b.amount += num(d.amount);
            if (d.stage === "won")
                b.won += num(d.amount);
            byOwner.set(o, b);
        }
        for (const b of byOwner.values()) {
            b.winRate = b.deals > 0 ? (b.won / (b.amount || 1)) * 100 : 0;
        }
        const rows = [...byOwner.values()].sort((a, b) => b.amount - a.amount);
        return {
            columns: [
                { field: "owner", label: "Owner", fieldtype: "text" },
                { field: "deals", label: "Deals", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "amount", label: "Total value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "won", label: "Won value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
                { field: "winRate", label: "Win %", fieldtype: "percent", align: "right" },
            ],
            rows,
            totals: {
                deals: rows.reduce((a, r) => a + r.deals, 0),
                amount: rows.reduce((a, r) => a + r.amount, 0),
                won: rows.reduce((a, r) => a + r.won, 0),
            },
            chart: {
                kind: "bar",
                label: "Won value by owner",
                format: "currency",
                currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.owner, value: r.won })),
            },
        };
    },
};
/* ---------- 3. Invoice Aging ---------- */
export const invoiceAgingReport = {
    id: "invoice-aging",
    label: "Invoice Aging",
    description: "Outstanding invoices bucketed by days overdue.",
    icon: "Receipt",
    resource: "accounting.invoice",
    filters: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            defaultValue: "open",
            options: [
                { value: "open", label: "Open" },
                { value: "overdue", label: "Overdue" },
                { value: "paid", label: "Paid" },
            ],
        },
    ],
    async execute({ filters, resources }) {
        const invoices = await fetchAll(resources, "accounting.invoice");
        const now = Date.now();
        const active = invoices.filter((i) => !filters.status || i.status === filters.status);
        const BUCKETS = [
            { label: "Not yet due", min: -Infinity, max: 0 },
            { label: "1–30 days", min: 1, max: 30 },
            { label: "31–60 days", min: 31, max: 60 },
            { label: "61–90 days", min: 61, max: 90 },
            { label: "90+ days", min: 91, max: Infinity },
        ];
        const rows = BUCKETS.map((b) => ({
            bucket: b.label,
            count: 0,
            outstanding: 0,
        }));
        for (const inv of active) {
            const due = parseDate(inv.dueAt) ?? parseDate(inv.dueDate) ?? parseDate(inv.createdAt);
            if (!due)
                continue;
            const days = Math.floor((now - due.getTime()) / 86_400_000);
            const bucketIdx = BUCKETS.findIndex((b) => days >= b.min && days <= b.max);
            if (bucketIdx >= 0) {
                rows[bucketIdx].count++;
                rows[bucketIdx].outstanding += num(inv.amount) - num(inv.paidAmount);
            }
        }
        return {
            columns: [
                { field: "bucket", label: "Aging bucket", fieldtype: "text" },
                { field: "count", label: "Invoices", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "outstanding", label: "Outstanding", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            totals: {
                count: rows.reduce((a, r) => a + r.count, 0),
                outstanding: rows.reduce((a, r) => a + r.outstanding, 0),
            },
            chart: {
                kind: "donut",
                label: "Outstanding by aging bucket",
                format: "currency",
                currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.bucket, value: r.outstanding })),
            },
        };
    },
};
/* ---------- 4. Support SLA Summary ---------- */
export const supportSlaReport = {
    id: "support-sla",
    label: "Support SLA Summary",
    description: "Ticket volume by priority and status, with resolution breakdown.",
    icon: "LifeBuoy",
    resource: "support-service.ticket",
    filters: [
        { field: "from", label: "From", kind: "date" },
        { field: "to", label: "To", kind: "date" },
    ],
    async execute({ filters, resources }) {
        const tickets = await fetchAll(resources, "support-service.ticket");
        const filtered = tickets.filter((t) => !(filters.from || filters.to) || inDateRange(t.createdAt, filters.from, filters.to));
        const PRIORITIES = ["urgent", "high", "normal", "low"];
        const rows = PRIORITIES.map((p) => ({
            priority: p,
            open: 0,
            inProgress: 0,
            resolved: 0,
            closed: 0,
            total: 0,
        }));
        for (const t of filtered) {
            const idx = PRIORITIES.indexOf(str(t.priority));
            if (idx < 0)
                continue;
            const r = rows[idx];
            r.total++;
            if (t.status === "open")
                r.open++;
            else if (t.status === "in_progress")
                r.inProgress++;
            else if (t.status === "resolved")
                r.resolved++;
            else if (t.status === "closed")
                r.closed++;
        }
        return {
            columns: [
                { field: "priority", label: "Priority", fieldtype: "enum" },
                { field: "open", label: "Open", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "inProgress", label: "In progress", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "resolved", label: "Resolved", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "closed", label: "Closed", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            totals: {
                open: rows.reduce((a, r) => a + r.open, 0),
                inProgress: rows.reduce((a, r) => a + r.inProgress, 0),
                resolved: rows.reduce((a, r) => a + r.resolved, 0),
                closed: rows.reduce((a, r) => a + r.closed, 0),
                total: rows.reduce((a, r) => a + r.total, 0),
            },
            chart: {
                kind: "bar",
                label: "Open + In-progress tickets by priority",
                from: (rs) => rs.map((r) => ({
                    label: r.priority,
                    value: r.open + r.inProgress,
                })),
            },
        };
    },
};
/* ---------- 5. Stock Balance ---------- */
export const stockBalanceReport = {
    id: "stock-balance",
    label: "Stock Balance",
    description: "Current on-hand quantity, reorder point, and inventory value.",
    icon: "Package",
    resource: "inventory.item",
    filters: [
        {
            field: "category",
            label: "Category",
            kind: "enum",
            options: [
                { value: "raw", label: "Raw materials" },
                { value: "wip", label: "Work in progress" },
                { value: "finished", label: "Finished goods" },
            ],
        },
        { field: "belowReorder", label: "Below reorder only", kind: "boolean" },
    ],
    async execute({ filters, resources }) {
        const items = await fetchAll(resources, "inventory.item");
        const rows = items
            .filter((it) => !filters.category || it.category === filters.category)
            .filter((it) => !filters.belowReorder || num(it.onHand) <= num(it.reorderPoint))
            .map((it) => ({
            sku: str(it.sku),
            name: str(it.name),
            category: str(it.category),
            onHand: num(it.onHand),
            reorderPoint: num(it.reorderPoint),
            unitCost: num(it.unitCost),
            totalValue: num(it.onHand) * num(it.unitCost),
            belowReorder: num(it.onHand) <= num(it.reorderPoint),
        }))
            .sort((a, b) => b.totalValue - a.totalValue);
        return {
            columns: [
                { field: "sku", label: "SKU", fieldtype: "text", width: 100 },
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "category", label: "Category", fieldtype: "enum" },
                { field: "onHand", label: "On hand", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "reorderPoint", label: "Reorder @", fieldtype: "number", align: "right" },
                { field: "unitCost", label: "Unit cost", fieldtype: "currency", align: "right", options: "USD" },
                { field: "totalValue", label: "Value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            totals: {
                onHand: rows.reduce((a, r) => a + r.onHand, 0),
                totalValue: rows.reduce((a, r) => a + r.totalValue, 0),
            },
            chart: {
                kind: "donut",
                label: "Inventory value by category",
                format: "currency",
                currency: "USD",
                from: (rs) => {
                    const by = new Map();
                    for (const r of rs) {
                        by.set(r.category, (by.get(r.category) ?? 0) + r.totalValue);
                    }
                    return [...by].map(([label, value]) => ({ label, value }));
                },
            },
        };
    },
};
/* ---------- 6. Customer Acquisition ---------- */
export const customerAcquisitionReport = {
    id: "customer-acquisition",
    label: "Customer Acquisition",
    description: "New contacts added per month with cumulative total.",
    icon: "UserPlus",
    resource: "crm.contact",
    filters: [
        { field: "from", label: "From", kind: "date" },
        { field: "to", label: "To", kind: "date" },
    ],
    async execute({ filters, resources }) {
        const contacts = await fetchAll(resources, "crm.contact");
        const filtered = contacts.filter((c) => !(filters.from || filters.to) ||
            inDateRange(c.createdAt, filters.from, filters.to));
        const byMonth = new Map();
        for (const c of filtered) {
            const d = parseDate(c.createdAt);
            if (!d)
                continue;
            const k = monthKey(d);
            byMonth.set(k, (byMonth.get(k) ?? 0) + 1);
        }
        const sorted = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
        let cumulative = 0;
        const rows = sorted.map(([month, count]) => {
            cumulative += count;
            return { month, count, cumulative };
        });
        return {
            columns: [
                { field: "month", label: "Month", fieldtype: "text", width: 110 },
                { field: "count", label: "New contacts", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "cumulative", label: "Cumulative", fieldtype: "number", align: "right" },
            ],
            rows,
            totals: { count: rows.reduce((a, r) => a + r.count, 0) },
            chart: {
                kind: "area",
                label: "New contacts per month",
                from: (rs) => rs.map((r) => ({ label: r.month, value: r.count })),
            },
        };
    },
};
/* ---------- 7. Audit Actor Activity ---------- */
export const auditActorReport = {
    id: "audit-actor",
    label: "Audit Actor Activity",
    description: "Volume of recorded actions grouped by actor.",
    icon: "Shield",
    resource: "audit.event",
    filters: [
        { field: "from", label: "From", kind: "date" },
        { field: "to", label: "To", kind: "date" },
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
    ],
    async execute({ filters, resources }) {
        const events = await fetchAll(resources, "audit.event");
        const filtered = events.filter((e) => (!filters.level || e.level === filters.level) &&
            (!(filters.from || filters.to) ||
                inDateRange(e.occurredAt, filters.from, filters.to)));
        const byActor = new Map();
        for (const e of filtered) {
            const a = str(e.actor, "system");
            const b = byActor.get(a) ?? { actor: a, total: 0, info: 0, warn: 0, error: 0 };
            b.total++;
            if (e.level === "info")
                b.info++;
            else if (e.level === "warn")
                b.warn++;
            else if (e.level === "error")
                b.error++;
            byActor.set(a, b);
        }
        const rows = [...byActor.values()].sort((a, b) => b.total - a.total);
        return {
            columns: [
                { field: "actor", label: "Actor", fieldtype: "text" },
                { field: "total", label: "Events", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "info", label: "Info", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "warn", label: "Warn", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "error", label: "Error", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            totals: {
                total: rows.reduce((a, r) => a + r.total, 0),
                info: rows.reduce((a, r) => a + r.info, 0),
                warn: rows.reduce((a, r) => a + r.warn, 0),
                error: rows.reduce((a, r) => a + r.error, 0),
            },
            chart: {
                kind: "bar",
                label: "Events by actor",
                from: (rs) => rs.slice(0, 12).map((r) => ({ label: r.actor, value: r.total })),
            },
        };
    },
};
/* ---------- 8. Booking Trends ---------- */
export const bookingTrendsReport = {
    id: "booking-trends",
    label: "Booking Trends",
    description: "Bookings by day with no-show / completion rates.",
    icon: "CalendarDays",
    resource: "booking.booking",
    filters: [
        { field: "from", label: "From", kind: "date" },
        { field: "to", label: "To", kind: "date" },
    ],
    async execute({ filters, resources }) {
        const bookings = await fetchAll(resources, "booking.booking");
        const filtered = bookings.filter((b) => !(filters.from || filters.to) || inDateRange(b.createdAt, filters.from, filters.to));
        const byDay = new Map();
        for (const b of filtered) {
            const d = parseDate(b.startAt) ?? parseDate(b.createdAt);
            if (!d)
                continue;
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const bucket = byDay.get(k) ?? { day: k, total: 0, completed: 0, cancelled: 0 };
            bucket.total++;
            if (b.status === "completed")
                bucket.completed++;
            if (b.status === "cancelled")
                bucket.cancelled++;
            byDay.set(k, bucket);
        }
        const rows = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
        return {
            columns: [
                { field: "day", label: "Day", fieldtype: "date", width: 110 },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "completed", label: "Completed", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "cancelled", label: "Cancelled", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            totals: {
                total: rows.reduce((a, r) => a + r.total, 0),
                completed: rows.reduce((a, r) => a + r.completed, 0),
                cancelled: rows.reduce((a, r) => a + r.cancelled, 0),
            },
            chart: {
                kind: "line",
                label: "Bookings per day",
                from: (rs) => rs.map((r) => ({ label: r.day.slice(5), value: r.total })),
            },
        };
    },
};
/* ---------- Registry ---------- */
export const STANDARD_REPORTS = [
    salesAnalyticsReport,
    salesPersonReport,
    invoiceAgingReport,
    supportSlaReport,
    stockBalanceReport,
    customerAcquisitionReport,
    auditActorReport,
    bookingTrendsReport,
];
export function findReport(id) {
    return STANDARD_REPORTS.find((r) => r.id === id);
}
export const REPORT_MODULES = {
    Sales: ["sales-analytics", "sales-person", "customer-acquisition"],
    Finance: ["invoice-aging"],
    Operations: ["support-sla", "booking-trends"],
    "Supply Chain": ["stock-balance"],
    Platform: ["audit-actor"],
};
