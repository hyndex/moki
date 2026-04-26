import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { z } from "zod";
import { defineDashboard, defineDetailView, defineFormView, defineListView, defineResource, } from "@/builders";
import { definePlugin } from "@/contracts/plugin-v2";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { Badge } from "@/primitives/Badge";
import { formatDateTime } from "@/lib/format";
import { bookingCalendarView } from "./BookingCalendarPage";
import { BookingDashboardKpis } from "./BookingDashboardKpis";
import { BOOKING_EXTENDED_RESOURCES, BOOKING_EXTENDED_VIEWS, } from "./booking-extended";
import { bookingControlRoomView, bookingReportsIndexView, bookingReportsDetailView, } from "./booking-dashboard";
const BookingSchema = z.object({
    id: z.string(),
    code: z.string(),
    customer: z.string(),
    service: z.string(),
    startAt: z.string(),
    durationMin: z.number(),
    status: z.enum(["draft", "confirmed", "cancelled", "completed"]),
    amount: z.number(),
    notes: z.string().optional(),
});
const bookingResource = defineResource({
    id: "booking.booking",
    singular: "Booking",
    plural: "Bookings",
    schema: BookingSchema,
    displayField: "code",
    searchable: ["code", "customer", "service"],
    icon: "Calendar",
});
// The mock backend is seeded via this opt-in metadata.
bookingResource.__seed = seed();
const bookingList = defineListView({
    id: "booking.bookings",
    title: "Bookings",
    description: "Manage customer appointments across locations.",
    resource: bookingResource.id,
    search: true,
    pageSize: 10,
    defaultSort: { field: "startAt", dir: "desc" },
    columns: [
        { field: "code", label: "Code", sortable: true, width: 120 },
        { field: "customer", label: "Customer", sortable: true },
        { field: "service", label: "Service" },
        {
            field: "startAt",
            label: "Starts",
            kind: "datetime",
            sortable: true,
            width: 180,
        },
        {
            field: "status",
            label: "Status",
            kind: "enum",
            sortable: true,
            width: 120,
            options: [
                { value: "draft", label: "Draft", intent: "neutral" },
                { value: "confirmed", label: "Confirmed", intent: "info" },
                { value: "cancelled", label: "Cancelled", intent: "danger" },
                { value: "completed", label: "Completed", intent: "success" },
            ],
        },
        { field: "amount", label: "Amount", kind: "currency", align: "right", width: 100, totaling: "sum" },
    ],
    filters: [
        {
            field: "status",
            label: "Status",
            kind: "enum",
            options: [
                { value: "draft", label: "Draft" },
                { value: "confirmed", label: "Confirmed" },
                { value: "cancelled", label: "Cancelled" },
                { value: "completed", label: "Completed" },
            ],
        },
        { field: "startAt", label: "Date", kind: "date-range" },
    ],
    actions: [
        {
            id: "booking.new",
            label: "New booking",
            placement: ["page"],
            run: ({ runtime }) => runtime.navigate("/bookings/new"),
        },
        {
            id: "booking.confirm",
            label: "Confirm",
            placement: ["row", "bulk"],
            guard: ({ records }) => records.length > 0 && records.every((r) => r.status === "draft"),
            run: async ({ records, resource, runtime }) => {
                await Promise.all(records.map((r) => runtime.update(resource, String(r.id), { status: "confirmed" })));
                runtime.toast({
                    title: `${records.length} confirmed`,
                    intent: "success",
                });
            },
        },
        {
            id: "booking.cancel",
            label: "Cancel",
            intent: "danger",
            placement: ["row"],
            confirm: {
                title: "Cancel booking?",
                description: "The customer will be notified.",
                destructive: true,
            },
            guard: ({ records }) => records.length > 0 &&
                records.every((r) => r.status === "draft" || r.status === "confirmed"),
            run: async ({ records, resource, runtime }) => {
                await Promise.all(records.map((r) => runtime.update(resource, String(r.id), { status: "cancelled" })));
                runtime.toast({ title: "Cancelled", intent: "warning" });
            },
        },
    ],
});
const bookingForm = defineFormView({
    id: "booking.booking-form",
    title: "Booking",
    resource: bookingResource.id,
    defaults: { status: "draft", durationMin: 60, amount: 0 },
    sections: [
        {
            id: "overview",
            title: "Overview",
            columns: 2,
            fields: [
                { name: "code", label: "Code", kind: "text", required: true, placeholder: "BKG-001" },
                {
                    name: "status",
                    label: "Status",
                    kind: "enum",
                    required: true,
                    options: [
                        { value: "draft", label: "Draft" },
                        { value: "confirmed", label: "Confirmed" },
                        { value: "cancelled", label: "Cancelled" },
                        { value: "completed", label: "Completed" },
                    ],
                },
                { name: "customer", label: "Customer", kind: "text", required: true },
                { name: "service", label: "Service", kind: "text", required: true },
                { name: "startAt", label: "Starts at", kind: "datetime", required: true },
                {
                    name: "durationMin",
                    label: "Duration (minutes)",
                    kind: "number",
                    required: true,
                },
            ],
        },
        {
            id: "billing",
            title: "Billing",
            columns: 2,
            fields: [
                { name: "amount", label: "Amount", kind: "currency", required: true },
            ],
        },
        {
            id: "notes",
            title: "Notes",
            fields: [
                {
                    name: "notes",
                    label: "Internal notes",
                    kind: "textarea",
                    help: "Only visible to staff.",
                },
            ],
        },
    ],
});
const bookingDetail = defineDetailView({
    id: "booking.booking-detail",
    title: "Booking detail",
    resource: bookingResource.id,
    header: (r) => (_jsxs("span", { className: "inline-flex items-center gap-2", children: [String(r.code), _jsx(Badge, { intent: r.status === "confirmed"
                    ? "info"
                    : r.status === "cancelled"
                        ? "danger"
                        : r.status === "completed"
                            ? "success"
                            : "neutral", children: String(r.status) })] })),
    tabs: [
        {
            id: "overview",
            label: "Overview",
            render: (r) => (_jsxs("dl", { className: "grid grid-cols-2 gap-x-6 gap-y-3 text-sm", children: [_jsx(Row, { label: "Customer", value: r.customer }), _jsx(Row, { label: "Service", value: r.service }), _jsx(Row, { label: "Starts", value: formatDateTime(r.startAt) }), _jsx(Row, { label: "Duration", value: `${r.durationMin} min` }), _jsx(Row, { label: "Amount", value: `$${Number(r.amount).toFixed(2)}` }), _jsx(Row, { label: "Notes", value: r.notes || "—" })] })),
        },
        {
            id: "activity",
            label: "Activity",
            render: () => (_jsx(EmptyState, { title: "No activity yet", description: "Lifecycle events will appear here as the booking progresses." })),
        },
    ],
});
const bookingDashboard = defineDashboard({
    id: "booking.dashboard",
    title: "Bookings overview",
    description: "Daily operations snapshot.",
    resource: bookingResource.id,
    widgets: [
        {
            id: "kpi-today",
            title: "",
            size: "sm",
            render: () => _jsx(BookingDashboardKpis, { kind: "today" }),
        },
        {
            id: "kpi-week",
            title: "",
            size: "sm",
            render: () => _jsx(BookingDashboardKpis, { kind: "week" }),
        },
        {
            id: "kpi-revenue",
            title: "",
            size: "sm",
            render: () => _jsx(BookingDashboardKpis, { kind: "revenue" }),
        },
        {
            id: "kpi-cancel",
            title: "",
            size: "sm",
            render: () => _jsx(BookingDashboardKpis, { kind: "cancel" }),
        },
        {
            id: "intro",
            title: "Getting started",
            size: "xl",
            render: () => (_jsxs("div", { className: "text-sm text-text-secondary leading-relaxed", children: [_jsxs("p", { className: "mb-2", children: ["This dashboard is contributed by the ", _jsx("code", { className: "font-mono text-xs px-1 rounded bg-surface-2", children: "booking" }), " plugin. Every widget, nav entry, view, filter, action, and command in this admin is declaratively provided by a plugin \u2014 no JSX was written in the shell."] }), _jsxs("p", { children: ["Try ", _jsx("kbd", { className: "text-xs font-mono px-1 rounded bg-surface-2 border border-border", children: "\u2318K" }), " to open the command palette and navigate across plugins, or hit ", _jsx("b", { children: "New booking" }), " to exercise the form renderer."] })] })),
        },
    ],
});
function Row({ label, value }) {
    return (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-text-muted", children: label }), _jsx("dd", { className: "text-text-primary", children: value })] }));
}
const bookingNavSections = [
    { id: "operations", label: "Operations", order: 20 },
];
const bookingNav = [
    {
        id: "bookings-home",
        label: "Overview",
        icon: "LayoutDashboard",
        path: "/",
        view: "booking.dashboard",
        order: 0,
    },
    {
        id: "bookings",
        label: "Bookings",
        icon: "Calendar",
        path: "/bookings",
        view: "booking.bookings",
        section: "operations",
        order: 10,
        badge: 3,
    },
    {
        id: "bookings-calendar",
        label: "Booking calendar",
        icon: "CalendarDays",
        path: "/bookings/calendar",
        view: "booking.calendar.view",
        section: "operations",
        order: 11,
    },
    { id: "booking.control-room.nav", label: "Booking Control Room", icon: "LayoutDashboard", path: "/bookings/control-room", view: "booking.control-room.view", section: "operations", order: 12 },
    { id: "booking.reports.nav", label: "Reports", icon: "BarChart3", path: "/bookings/reports", view: "booking.reports.view", section: "operations", order: 13 },
    { id: "booking.services.nav", label: "Services", icon: "Briefcase", path: "/bookings/services", view: "booking.services.list", section: "operations", order: 14 },
    { id: "booking.resources.nav", label: "Bookable Resources", icon: "DoorOpen", path: "/bookings/resources", view: "booking.resources.list", section: "operations", order: 15 },
    { id: "booking.staff.nav", label: "Staff", icon: "UserCircle", path: "/bookings/staff", view: "booking.staff.list", section: "operations", order: 16 },
    { id: "booking.availability-rules.nav", label: "Availability rules", icon: "Clock", path: "/bookings/availability-rules", view: "booking.availability-rules.list", section: "operations", order: 17 },
    { id: "booking.locations.nav", label: "Locations", icon: "MapPin", path: "/bookings/locations", view: "booking.locations.list", section: "operations", order: 18 },
    { id: "booking.waitlist.nav", label: "Waitlist", icon: "ListOrdered", path: "/bookings/waitlist", view: "booking.waitlist.list", section: "operations", order: 19 },
];
const bookingResources = [bookingResource, ...BOOKING_EXTENDED_RESOURCES];
const bookingViews = [
    bookingDashboard, bookingList, bookingForm, bookingDetail, bookingCalendarView,
    bookingControlRoomView, bookingReportsIndexView, bookingReportsDetailView,
    ...BOOKING_EXTENDED_VIEWS,
];
const bookingCommands = [
    {
        id: "booking.new",
        label: "New booking",
        icon: "Plus",
        keywords: ["create", "add", "appointment"],
        shortcut: "⌘N",
        run: () => {
            window.location.hash = "/bookings/new";
        },
    },
    { id: "booking.go.control-room", label: "Booking: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/bookings/control-room"; } },
    { id: "booking.go.reports", label: "Booking: Reports", icon: "BarChart3", run: () => { window.location.hash = "/bookings/reports"; } },
    { id: "booking.go.calendar", label: "Booking: Calendar", icon: "CalendarDays", run: () => { window.location.hash = "/bookings/calendar"; } },
    { id: "booking.go.waitlist", label: "Booking: Waitlist", icon: "ListOrdered", run: () => { window.location.hash = "/bookings/waitlist"; } },
    { id: "booking.new-service", label: "New service", icon: "Briefcase", run: () => { window.location.hash = "/bookings/services/new"; } },
    { id: "booking.new-staff", label: "New staff member", icon: "UserCircle", run: () => { window.location.hash = "/bookings/staff/new"; } },
];
export const bookingPlugin = definePlugin({
    manifest: {
        id: "booking",
        version: "0.1.0",
        label: "Booking",
        description: "Schedule and manage bookings.",
        icon: "Calendar",
        requires: {
            shell: "*",
            capabilities: [
                "resources:read", "resources:write", "resources:delete",
                "nav", "commands", "storage",
            ],
        },
        activationEvents: [{ kind: "onStart" }],
        origin: { kind: "explicit" },
    },
    async activate(ctx) {
        ctx.contribute.navSections(bookingNavSections);
        ctx.contribute.nav(bookingNav);
        ctx.contribute.resources(bookingResources);
        ctx.contribute.views(bookingViews);
        ctx.contribute.commands(bookingCommands);
    },
});
function seed() {
    const now = Date.now();
    const services = ["Consultation", "Deep clean", "Strategy call", "On-site visit", "Training"];
    const customers = [
        "Acme Corp",
        "Globex",
        "Initech",
        "Umbrella Co",
        "Soylent Ltd",
        "Hooli",
        "Pied Piper",
        "Dunder Mifflin",
        "Stark Industries",
        "Wayne Enterprises",
        "Cyberdyne",
        "Tyrell Corp",
    ];
    const statuses = ["draft", "confirmed", "confirmed", "completed", "cancelled", "confirmed"];
    const rows = [];
    for (let i = 0; i < 18; i++) {
        const start = new Date(now + (i - 5) * 36 * 3600_000);
        rows.push({
            id: `bk_${i + 100}`,
            code: `BKG-${1000 + i}`,
            customer: customers[i % customers.length],
            service: services[i % services.length],
            startAt: start.toISOString(),
            durationMin: 30 + (i % 4) * 30,
            status: statuses[i % statuses.length],
            amount: 75 + ((i * 13) % 400),
            notes: i % 3 === 0 ? "Needs parking validation" : "",
        });
    }
    return rows;
}
