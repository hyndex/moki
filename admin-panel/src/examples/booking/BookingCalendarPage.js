import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Calendar } from "@/admin-primitives/Calendar";
import { MetricGrid } from "@/admin-primitives/MetricGrid";
import { Card, CardContent } from "@/admin-primitives/Card";
import { code, daysAgo, pick } from "../_factory/seeds";
function bookingEvents() {
    const intents = ["info", "success", "warning", "danger"];
    return Array.from({ length: 22 }, (_, i) => ({
        id: code("BKG", i),
        title: `${code("BKG", i)} · ${pick(["Consult", "On-site", "Deep clean", "Training"], i)}`,
        date: daysAgo(-5 + i * 1.2),
        intent: pick(intents, i),
    }));
}
export const bookingCalendarView = defineCustomView({
    id: "booking.calendar.view",
    title: "Calendar",
    description: "All bookings on a month grid.",
    resource: "booking.booking",
    render: () => (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Booking calendar", description: "Every booking, month-at-a-glance." }), _jsx(MetricGrid, { columns: 4, metrics: [
                    { label: "Today", value: "6" },
                    { label: "This week", value: "34" },
                    { label: "This month", value: "128" },
                    { label: "Utilization", value: "72%", trend: { value: 5, positive: true } },
                ] }), _jsx(Card, { children: _jsx(CardContent, { className: "pt-4", children: _jsx(Calendar, { events: bookingEvents() }) }) })] })),
});
