import { jsx as _jsx } from "react/jsx-runtime";
import { KPI } from "@/admin-primitives/KPI";
import { useAllRecords } from "@/runtime/hooks";
function pct(a, b) {
    if (b === 0)
        return 0;
    return Math.round(((a - b) / b) * 100);
}
export function BookingDashboardKpis({ kind }) {
    const { data } = useAllRecords("booking.kpi");
    const kpi = data[0];
    if (kind === "today") {
        const delta = kpi ? pct(kpi.today, kpi.yesterday) : 0;
        return (_jsx(KPI, { label: "Today", value: kpi ? String(kpi.today) : "—", trend: kpi ? { value: Math.abs(delta), label: "vs yesterday", positive: delta >= 0 } : undefined }));
    }
    if (kind === "week") {
        const delta = kpi ? pct(kpi.week, kpi.weekPrev) : 0;
        return (_jsx(KPI, { label: "This week", value: kpi ? String(kpi.week) : "—", trend: kpi ? { value: Math.abs(delta), label: "vs last", positive: delta >= 0 } : undefined }));
    }
    if (kind === "revenue") {
        const delta = kpi ? pct(kpi.monthRevenue, kpi.monthRevenuePrev) : 0;
        return (_jsx(KPI, { label: "Revenue (MTD)", value: kpi ? `$${kpi.monthRevenue.toLocaleString()}` : "—", trend: kpi ? { value: Math.abs(delta), label: "vs last mo", positive: delta >= 0 } : undefined }));
    }
    return (_jsx(KPI, { label: "Cancellations", value: kpi ? String(kpi.cancellations) : "—", helper: kpi ? `${(kpi.cancellationRate * 100).toFixed(1)}% of bookings` : undefined }));
}
