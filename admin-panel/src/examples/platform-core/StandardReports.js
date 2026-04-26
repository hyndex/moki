import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as Icons from "lucide-react";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { ReportBuilder } from "@/admin-primitives/ReportBuilder";
import { EmptyStateFramework } from "@/admin-primitives/EmptyStateFramework";
import { useHash } from "@/views/useRoute";
import { REPORT_MODULES, findReport, } from "./standard-reports";
function Icon({ name }) {
    if (!name)
        return null;
    const C = Icons[name];
    if (!C)
        return null;
    return _jsx(C, { className: "h-4 w-4 text-accent" });
}
/** Reports discovery page — lists all standard reports grouped by module.
 *  Route: /analytics/reports (custom view id: platform.reports.view) */
export function StandardReportsPage() {
    return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(PageHeader, { title: "Reports", description: "Standard analytical reports across every plugin. Every report reads live data and supports filters, totals, and CSV export." }), Object.entries(REPORT_MODULES).map(([module, ids]) => (_jsxs("section", { className: "flex flex-col gap-2", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wider text-text-muted", children: module }), _jsx("div", { className: "grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", children: ids.map((id) => {
                            const r = findReport(id);
                            if (!r)
                                return null;
                            return (_jsx(Card, { className: "cursor-pointer hover:border-accent/60 transition-colors", onClick: () => (window.location.hash = `/reports/${r.id}`), children: _jsxs(CardContent, { className: "py-4 flex items-start gap-3", children: [_jsx("div", { className: "h-8 w-8 rounded-md bg-accent-subtle flex items-center justify-center shrink-0", children: _jsx(Icon, { name: r.icon }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: r.label }), r.description && (_jsx("div", { className: "text-xs text-text-muted mt-0.5 line-clamp-2", children: r.description }))] })] }) }, r.id));
                        }) })] }, module)))] }));
}
/** Report detail page — resolves `:id` from the route and renders the
 *  ReportBuilder for the matching ReportDefinition. */
export function StandardReportPage() {
    const hash = useHash();
    const match = hash.match(/^\/reports\/([^/?]+)/);
    const id = match?.[1];
    const report = id ? findReport(id) : undefined;
    if (!report) {
        return (_jsx(EmptyStateFramework, { kind: "no-results", title: "Report not found", description: `No standard report with id "${id}".`, primary: { label: "Back to reports", href: "/analytics/reports" } }));
    }
    return _jsx(ReportBuilder, { definition: report });
}
