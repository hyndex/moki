import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/admin-primitives/Card";
import { MetricGrid } from "@/admin-primitives/MetricGrid";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { BarChart } from "@/admin-primitives/charts/BarChart";
import { Donut } from "@/admin-primitives/charts/Donut";
import { Spinner } from "@/primitives/Spinner";
import { usePosShifts } from "./_shared/live-hooks";
export const posShiftSummaryView = defineCustomView({
    id: "pos.shift-summary.view",
    title: "Shift summary",
    description: "End-of-day register totals.",
    resource: "pos.sale",
    render: () => _jsx(PosShiftSummaryPage, {}),
});
function PosShiftSummaryPage() {
    const { data: shifts, loading } = usePosShifts();
    if (loading && shifts.length === 0)
        return (_jsxs("div", { className: "py-16 flex items-center justify-center text-sm text-text-muted gap-2", children: [_jsx(Spinner, { size: 14 }), " Loading\u2026"] }));
    const s = shifts[0];
    if (!s)
        return (_jsx(EmptyState, { title: "No shift recorded", description: "The pos.shift resource is empty." }));
    const avg = s.transactions > 0 ? s.sales / s.transactions : 0;
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: `Today's shift · ${s.terminal}`, description: `Operator: ${s.operator} · ${s.transactions} transactions` }), _jsx(MetricGrid, { columns: 4, metrics: [
                    { label: "Sales", value: `$${s.sales.toLocaleString()}` },
                    { label: "Transactions", value: String(s.transactions) },
                    { label: "Avg basket", value: `$${avg.toFixed(2)}` },
                    { label: "Refunds", value: `$${s.refunds.toFixed(2)}` },
                ] }), _jsxs("div", { className: "grid gap-3 lg:grid-cols-2", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Sales by hour" }) }) }), _jsx(CardContent, { children: _jsx(BarChart, { data: s.byHour.map((h) => ({ label: `${h.hour}h`, value: h.sales })), height: 180, valueFormatter: (v) => `$${v}` }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Payment mix" }) }) }), _jsx(CardContent, { children: _jsx(Donut, { data: s.paymentMix.map((m) => ({ label: m.method, value: m.amount })) }) })] })] })] }));
}
