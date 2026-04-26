import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { Sparkline } from "@/admin-primitives/charts/Sparkline";
import { Spinner } from "@/primitives/Spinner";
import { useInventoryAlerts } from "./_shared/live-hooks";
export const inventoryAlertsView = defineCustomView({
    id: "inventory.alerts.view",
    title: "Low stock",
    description: "Items below their reorder point.",
    resource: "inventory.item",
    render: () => _jsx(InventoryAlertsPage, {}),
});
function InventoryAlertsPage() {
    const { data: alerts, loading } = useInventoryAlerts();
    if (loading && alerts.length === 0)
        return (_jsxs("div", { className: "h-full w-full flex items-center justify-center gap-2 text-sm text-text-muted py-16", children: [_jsx(Spinner, { size: 14 }), " Loading\u2026"] }));
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Low-stock alerts", description: "Items that have crossed their reorder threshold." }), alerts.length === 0 ? (_jsx(EmptyState, { title: "No active alerts", description: "Every SKU is above its reorder point." })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wider text-text-muted", children: [_jsx("th", { className: "text-left p-3", children: "SKU" }), _jsx("th", { className: "text-left p-3", children: "Name" }), _jsx("th", { className: "text-right p-3", children: "On hand" }), _jsx("th", { className: "text-right p-3", children: "Reorder @" }), _jsx("th", { className: "text-right p-3", children: "Days left" }), _jsx("th", { className: "text-right p-3", children: "Trend" })] }) }), _jsx("tbody", { children: alerts.map((it) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0", children: [_jsx("td", { className: "p-3 font-mono text-xs text-text-secondary", children: it.sku }), _jsx("td", { className: "p-3 text-text-primary", children: it.name }), _jsx("td", { className: "p-3 text-right tabular-nums font-medium " +
                                                (it.severity === "high"
                                                    ? "text-intent-danger"
                                                    : it.severity === "medium"
                                                        ? "text-intent-warning"
                                                        : "text-text-secondary"), children: it.onHand }), _jsx("td", { className: "p-3 text-right tabular-nums text-text-muted", children: it.reorderPoint }), _jsx("td", { className: "p-3 text-right tabular-nums text-text-secondary", children: it.daysToStockout }), _jsx("td", { className: "p-3 text-right", children: _jsx(Sparkline, { data: it.trend, color: it.severity === "high"
                                                    ? "rgb(var(--intent-danger))"
                                                    : it.severity === "medium"
                                                        ? "rgb(var(--intent-warning))"
                                                        : "rgb(var(--text-muted))" }) })] }, it.id))) })] }) }) }))] }));
}
