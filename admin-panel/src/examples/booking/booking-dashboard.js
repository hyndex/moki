import { buildControlRoom } from "../_factory/controlRoomHelper";
import { buildReportLibrary } from "../_factory/reportLibraryHelper";
const workspace = {
    id: "booking.control-room",
    label: "Booking Control Room",
    filterBar: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            options: [
                { value: "draft", label: "Draft" },
                { value: "confirmed", label: "Confirmed" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
            ],
        },
        { field: "resource", label: "Resource", kind: "text" },
        { field: "customer", label: "Customer", kind: "text" },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Schedule pulse", level: 2 },
        { id: "k-today", type: "number_card", col: 3, label: "Bookings today",
            aggregation: { resource: "booking.booking", fn: "count", range: { kind: "mtd" } },
            drilldown: "/bookings" },
        { id: "k-confirmed", type: "number_card", col: 3, label: "Confirmed (upcoming)",
            aggregation: { resource: "booking.booking", fn: "count",
                filter: { field: "status", op: "eq", value: "confirmed" } },
            drilldown: "/bookings" },
        { id: "k-waitlist", type: "number_card", col: 3, label: "On waitlist",
            aggregation: { resource: "booking.waitlist", fn: "count",
                filter: { field: "status", op: "eq", value: "waiting" } },
            drilldown: "/bookings/waitlist", warnAbove: 5 },
        { id: "k-cancels", type: "number_card", col: 3, label: "Cancel rate (30d)",
            aggregation: { resource: "booking.booking", fn: "count",
                filter: { field: "status", op: "eq", value: "cancelled" },
                range: { kind: "last", days: 30 } } },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-status", type: "chart", col: 6, label: "Bookings by status", chart: "donut",
            aggregation: { resource: "booking.booking", fn: "count", groupBy: "status" } },
        { id: "c-service", type: "chart", col: 6, label: "Revenue by service", chart: "bar",
            aggregation: { resource: "booking.booking", fn: "sum", field: "amount", groupBy: "service" },
            format: "currency" },
        { id: "c-volume", type: "chart", col: 12, label: "Bookings (30d)", chart: "area",
            aggregation: { resource: "booking.booking", fn: "count", period: "day", range: { kind: "last", days: 30 } } },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-new", type: "shortcut", col: 3, label: "New booking", icon: "Plus", href: "/bookings/new" },
        { id: "sc-calendar", type: "shortcut", col: 3, label: "Calendar", icon: "CalendarDays", href: "/bookings/calendar" },
        { id: "sc-waitlist", type: "shortcut", col: 3, label: "Waitlist", icon: "ListOrdered", href: "/bookings/waitlist" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/bookings/reports" },
    ],
};
export const bookingControlRoomView = buildControlRoom({
    viewId: "booking.control-room.view",
    resource: "booking.booking",
    title: "Booking Control Room",
    description: "Today's pulse, upcoming confirmed, waitlist, cancel rate, service mix.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const revenueReport = {
    id: "revenue-by-service", label: "Revenue by Service",
    description: "Completed booking revenue split per service.",
    icon: "DollarSign", resource: "booking.booking", filters: [],
    async execute({ resources }) {
        const bookings = await fetchAll(resources, "booking.booking");
        const by = new Map();
        for (const b of bookings) {
            if (b.status !== "completed")
                continue;
            const s = str(b.service);
            const r = by.get(s) ?? { service: s, count: 0, revenue: 0 };
            r.count++;
            r.revenue += num(b.amount);
            by.set(s, r);
        }
        const rows = [...by.values()].sort((a, b) => b.revenue - a.revenue);
        return {
            columns: [
                { field: "service", label: "Service", fieldtype: "text" },
                { field: "count", label: "Bookings", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "revenue", label: "Revenue", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            chart: { kind: "bar", label: "Revenue", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.service, value: r.revenue })) },
        };
    },
};
const utilizationReport = {
    id: "staff-utilization", label: "Staff Utilization",
    description: "Booked hours per staff member.",
    icon: "Users", resource: "booking.booking", filters: [],
    async execute({ resources }) {
        const bookings = await fetchAll(resources, "booking.booking");
        const by = new Map();
        for (const b of bookings) {
            if (b.status !== "completed" && b.status !== "confirmed")
                continue;
            const s = str(b.staff, "Unassigned");
            const r = by.get(s) ?? { staff: s, bookings: 0, minutes: 0, hours: 0 };
            r.bookings++;
            r.minutes += num(b.durationMin);
            by.set(s, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, hours: Math.round((r.minutes / 60) * 10) / 10 }))
            .sort((a, b) => b.hours - a.hours);
        return {
            columns: [
                { field: "staff", label: "Staff", fieldtype: "text" },
                { field: "bookings", label: "Bookings", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "hours", label: "Hours", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const cancellationReport = {
    id: "cancellation-analysis", label: "Cancellation Analysis",
    description: "Cancellations by service + reason.",
    icon: "XCircle", resource: "booking.booking", filters: [],
    async execute({ resources }) {
        const bookings = await fetchAll(resources, "booking.booking");
        const by = new Map();
        for (const b of bookings) {
            const s = str(b.service);
            const r = by.get(s) ?? { service: s, total: 0, cancelled: 0, rate: 0 };
            r.total++;
            if (b.status === "cancelled")
                r.cancelled++;
            by.set(s, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, rate: r.total > 0 ? Math.round((r.cancelled / r.total) * 100) : 0 }))
            .sort((a, b) => b.rate - a.rate);
        return {
            columns: [
                { field: "service", label: "Service", fieldtype: "text" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "cancelled", label: "Cancelled", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "rate", label: "Rate %", fieldtype: "percent", align: "right" },
            ],
            rows,
        };
    },
};
const waitlistConversionReport = {
    id: "waitlist-conversion", label: "Waitlist Conversion",
    description: "Waitlist outcomes split by status.",
    icon: "ListChecks", resource: "booking.waitlist", filters: [],
    async execute({ resources }) {
        const wl = await fetchAll(resources, "booking.waitlist");
        const by = new Map();
        for (const w of wl) {
            const s = str(w.status);
            const r = by.get(s) ?? { status: s, count: 0 };
            r.count++;
            by.set(s, r);
        }
        const rows = [...by.values()].sort((a, b) => b.count - a.count);
        return {
            columns: [
                { field: "status", label: "Status", fieldtype: "enum" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
            chart: { kind: "donut", label: "Waitlist outcomes",
                from: (rs) => rs.map((r) => ({ label: r.status, value: r.count })) },
        };
    },
};
const customerFrequencyReport = {
    id: "customer-frequency", label: "Customer Frequency",
    description: "Bookings per customer — identify top repeat customers.",
    icon: "Repeat", resource: "booking.booking", filters: [],
    async execute({ resources }) {
        const bookings = await fetchAll(resources, "booking.booking");
        const by = new Map();
        for (const b of bookings) {
            const c = str(b.customer);
            const r = by.get(c) ?? { customer: c, bookings: 0, spend: 0 };
            r.bookings++;
            if (b.status === "completed")
                r.spend += num(b.amount);
            by.set(c, r);
        }
        const rows = [...by.values()].sort((a, b) => b.bookings - a.bookings);
        return {
            columns: [
                { field: "customer", label: "Customer", fieldtype: "text" },
                { field: "bookings", label: "Bookings", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "spend", label: "Spend", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
export const BOOKING_REPORTS = [
    revenueReport,
    utilizationReport,
    cancellationReport,
    waitlistConversionReport,
    customerFrequencyReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "booking.reports.view",
    detailViewId: "booking.reports-detail.view",
    resource: "booking.booking",
    title: "Booking Reports",
    description: "Revenue, utilization, cancellations, waitlist, customer frequency.",
    basePath: "/bookings/reports",
    reports: BOOKING_REPORTS,
});
export const bookingReportsIndexView = indexView;
export const bookingReportsDetailView = detailView;
