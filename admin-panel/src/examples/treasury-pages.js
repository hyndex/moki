import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/admin-primitives/Card";
import { MetricGrid } from "@/admin-primitives/MetricGrid";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { BarChart } from "@/admin-primitives/charts/BarChart";
import { Spinner } from "@/primitives/Spinner";
import { useTreasurySnapshots } from "./_shared/live-hooks";
export const treasuryCashView = defineCustomView({
    id: "treasury.cash.view",
    title: "Cash position",
    description: "Balance across accounts over time.",
    resource: "treasury.account",
    render: () => _jsx(TreasuryCashPage, {}),
});
function TreasuryCashPage() {
    const { data: snapshots, loading } = useTreasurySnapshots();
    if (loading && snapshots.length === 0)
        return (_jsxs("div", { className: "py-16 flex items-center justify-center text-sm text-text-muted gap-2", children: [_jsx(Spinner, { size: 14 }), " Loading\u2026"] }));
    const latest = snapshots[snapshots.length - 1];
    const byAccount = latest?.byAccount ?? [];
    const byCurrency = {};
    for (const a of byAccount) {
        const curr = a.account.includes("EUR") ? "EUR" : a.account.includes("GBP") ? "GBP" : "USD";
        byCurrency[curr] = (byCurrency[curr] ?? 0) + a.amount;
    }
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Cash position", description: "Total liquidity across bank accounts." }), _jsx(MetricGrid, { columns: 4, metrics: [
                    { label: "Total cash", value: latest ? `$${(latest.totalUsd / 1_000_000).toFixed(2)}M` : "—" },
                    { label: "USD", value: byCurrency.USD ? `$${Math.round(byCurrency.USD / 1000)}K` : "—" },
                    { label: "EUR", value: byCurrency.EUR ? `€${Math.round(byCurrency.EUR / 1000)}K` : "—" },
                    { label: "GBP", value: byCurrency.GBP ? `£${Math.round(byCurrency.GBP / 1000)}K` : "—" },
                ] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: "Balance trend" }) }) }), _jsx(CardContent, { children: snapshots.length > 0 ? (_jsx(BarChart, { data: snapshots.map((s) => ({ label: s.month, value: Math.round(s.totalUsd / 1000) })), height: 220, valueFormatter: (v) => `$${v}K` })) : (_jsx(EmptyState, { title: "No balance data yet" })) })] })] }));
}
