import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { MetricGrid } from "@/admin-primitives/MetricGrid";
import { Card, CardContent, CardHeader, CardTitle } from "@/admin-primitives/Card";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { BarChart } from "@/admin-primitives/charts/BarChart";
import { Donut } from "@/admin-primitives/charts/Donut";
import { Spinner } from "@/primitives/Spinner";
import { useHrHeadcount } from "./_shared/live-hooks";
export const hrHeadcountView = defineCustomView({
    id: "hr-payroll.headcount.view",
    title: "Headcount",
    description: "Employee growth and distribution.",
    resource: "hr-payroll.employee",
    render: () => _jsx(HrHeadcountPage, {}),
});
function HrHeadcountPage() {
    const { data: snapshots, loading } = useHrHeadcount();
    if (loading && snapshots.length === 0)
        return (_jsxs("div", { className: "h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted py-16", children: [_jsx(Spinner, { size: 14 }), " Loading\u2026"] }));
    const latest = snapshots[snapshots.length - 1];
    const byDept = latest?.byDepartment ?? [];
    const months = snapshots.map((s) => s.month);
    const hires = snapshots.map((s) => s.netHires);
    const totalNow = latest?.total ?? 0;
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Headcount", description: "People, by department and over time." }), _jsx(MetricGrid, { columns: 4, metrics: [
                    { label: "Headcount", value: String(totalNow), trend: { value: 6, positive: true } },
                    { label: "Open roles", value: "7" },
                    { label: "Avg tenure", value: "2.4 yr" },
                    { label: "Attrition (TTM)", value: "8%" },
                ] }), _jsxs("div", { className: "grid gap-3 lg:grid-cols-2", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "By department" }) }) }), _jsx(CardContent, { children: byDept.length > 0 ? (_jsx(Donut, { data: byDept.map((d) => ({ label: d.department, value: d.count })) })) : (_jsx(EmptyState, { title: "No data" })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Net hires (last 12 months)" }) }) }), _jsx(CardContent, { children: months.length > 0 ? (_jsx(BarChart, { data: months.map((m, i) => ({ label: m, value: hires[i] })), height: 180 })) : (_jsx(EmptyState, { title: "No data" })) })] })] })] }));
}
