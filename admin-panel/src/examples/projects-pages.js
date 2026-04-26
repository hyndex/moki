import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { LiveDnDKanban } from "@/admin-primitives/LiveDnDKanban";
import { Badge } from "@/primitives/Badge";
const PROJECT_COLS = [
    { id: "open", title: "Open", intent: "info" },
    { id: "in_progress", title: "In progress", intent: "warning" },
    { id: "resolved", title: "Done", intent: "success" },
    { id: "closed", title: "Closed", intent: "neutral" },
];
const PRIORITY_INTENT = {
    low: "neutral",
    normal: "info",
    high: "warning",
    urgent: "danger",
};
export const projectsBoardView = defineCustomView({
    id: "projects.board.view",
    title: "Board",
    description: "Projects grouped by status — drag to move.",
    resource: "projects.project",
    render: () => (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Project board", description: "Every active project. Drag to update status." }), _jsx(LiveDnDKanban, { resource: "projects.project", statusField: "status", columns: PROJECT_COLS, onCardClick: (row) => {
                    window.location.hash = `/projects/${row.id}`;
                }, renderCard: (p) => (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("code", { className: "text-xs font-mono text-text-muted", children: p.code }), p.priority && (_jsx(Badge, { intent: PRIORITY_INTENT[p.priority] ?? "neutral", children: p.priority }))] }), _jsx("div", { className: "text-sm text-text-primary mt-1 line-clamp-2", children: p.name }), _jsxs("div", { className: "flex items-center justify-between mt-1", children: [_jsx("div", { className: "text-xs text-text-muted", children: p.owner }), typeof p.progressPct === "number" && (_jsxs("div", { className: "text-xs text-text-secondary tabular-nums", children: [p.progressPct, "%"] }))] })] })) })] })),
});
