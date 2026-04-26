import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { defineKanbanView } from "@/builders";
import { Badge } from "@/primitives/Badge";
const TICKET_COLS = [
    { id: "open", title: "Open", intent: "info" },
    { id: "in_progress", title: "In progress", intent: "warning" },
    { id: "resolved", title: "Resolved", intent: "success" },
    { id: "closed", title: "Closed", intent: "neutral" },
];
const PRIORITY_INTENT = {
    low: "neutral",
    normal: "info",
    high: "warning",
    urgent: "danger",
};
/** Issues kanban — declarative view backed by KanbanViewRenderer.
 *  Gets search, simple filter chips, and the advanced QueryBuilder for free. */
export const issuesKanbanView = defineKanbanView({
    id: "issues.kanban.view",
    title: "Issues board",
    description: "Every open engineering issue. Drag cards to move them between columns.",
    resource: "issues.issue",
    statusField: "status",
    columns: TICKET_COLS,
    search: true,
    searchFields: ["title", "code", "assignee"],
    filters: [
        {
            field: "priority",
            label: "Priority",
            kind: "enum",
            options: [
                { value: "urgent", label: "Urgent" },
                { value: "high", label: "High" },
                { value: "normal", label: "Normal" },
                { value: "low", label: "Low" },
            ],
        },
        {
            field: "severity",
            label: "Severity",
            kind: "enum",
        },
    ],
    advancedFilterFields: [
        { field: "title", label: "Title", kind: "text" },
        { field: "code", label: "Code", kind: "text" },
        {
            field: "priority",
            label: "Priority",
            kind: "enum",
            options: [
                { value: "urgent", label: "Urgent" },
                { value: "high", label: "High" },
                { value: "normal", label: "Normal" },
                { value: "low", label: "Low" },
            ],
        },
        { field: "assignee", label: "Assignee", kind: "text" },
        { field: "severity", label: "Severity", kind: "text" },
    ],
    cardPath: (row) => `/issues/${String(row.id)}`,
    renderCard: (row) => {
        const i = row;
        return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("code", { className: "text-xs font-mono text-text-muted", children: i.code }), i.priority && (_jsx(Badge, { intent: PRIORITY_INTENT[i.priority] ?? "neutral", children: i.priority }))] }), _jsx("div", { className: "text-sm text-text-primary mt-1 line-clamp-2", children: i.title }), _jsx("div", { className: "text-xs text-text-muted mt-1", children: i.assignee })] }));
    },
});
