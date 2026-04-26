import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as Icons from "lucide-react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { ReportBuilder } from "@/admin-primitives/ReportBuilder";
import { EmptyStateFramework } from "@/admin-primitives/EmptyStateFramework";
import { useHash } from "@/views/useRoute";
function Icon({ name }) {
    if (!name)
        return null;
    const C = Icons[name];
    if (!C)
        return null;
    return _jsx(C, { className: "h-4 w-4 text-accent" });
}
/** Build a reports-library index + detail pair for any plugin.
 *  Returns [indexView, detailView] — register both in the plugin.
 *  Paths: /<basePath> for the index and /<basePath>/:id for detail. */
export function buildReportLibrary(args) {
    const indexView = defineCustomView({
        id: args.indexViewId,
        title: args.title,
        description: args.description,
        resource: args.resource,
        render: () => (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: args.title, description: args.description }), _jsx("div", { className: "grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", children: args.reports.map((r) => (_jsx(Card, { className: "cursor-pointer hover:border-accent/60 transition-colors", onClick: () => (window.location.hash = `${args.basePath}/${r.id}`), children: _jsxs(CardContent, { className: "py-4 flex items-start gap-3", children: [_jsx("div", { className: "h-8 w-8 rounded-md bg-accent-subtle flex items-center justify-center shrink-0", children: _jsx(Icon, { name: r.icon }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-text-primary", children: r.label }), r.description && (_jsx("div", { className: "text-xs text-text-muted mt-0.5 line-clamp-2", children: r.description }))] })] }) }, r.id))) })] })),
    });
    const detailView = defineCustomView({
        id: args.detailViewId,
        title: `${args.title} — report`,
        description: "Live report — filterable, exportable.",
        resource: args.resource,
        render: () => {
            const hash = useHash();
            const escaped = args.basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const match = hash.match(new RegExp(`^${escaped}/([^/?]+)`));
            const id = match?.[1];
            const report = id ? args.reports.find((r) => r.id === id) : undefined;
            if (!report) {
                return (_jsx(EmptyStateFramework, { kind: "no-results", title: "Report not found", description: `No report with id "${id}".`, primary: { label: "Back to reports", href: args.basePath } }));
            }
            return _jsx(ReportBuilder, { definition: report });
        },
    });
    return { indexView, detailView };
}
