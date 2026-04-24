import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { LiveDnDKanban } from "@/admin-primitives/LiveDnDKanban";
import { Badge } from "@/primitives/Badge";

const TICKET_COLS = [
  { id: "open", title: "Open", intent: "info" as const },
  { id: "in_progress", title: "In progress", intent: "warning" as const },
  { id: "resolved", title: "Resolved", intent: "success" as const },
  { id: "closed", title: "Closed", intent: "neutral" as const },
];
const PRIORITY_INTENT: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

type IssueRow = {
  id: string;
  code?: string;
  title?: string;
  assignee?: string;
  priority?: keyof typeof PRIORITY_INTENT;
  status: string;
  severity?: string;
};

export const issuesKanbanView = defineCustomView({
  id: "issues.kanban.view",
  title: "Board",
  description: "Issues grouped by status — drag to change status.",
  resource: "issues.issue",
  render: () => (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Issues board"
        description="Every open engineering issue. Drag cards to move them between columns."
      />
      <LiveDnDKanban<IssueRow>
        resource="issues.issue"
        statusField="status"
        columns={TICKET_COLS}
        onCardClick={(row) => {
          window.location.hash = `/issues/${row.id}`;
        }}
        renderCard={(i) => (
          <div>
            <div className="flex items-center justify-between">
              <code className="text-xs font-mono text-text-muted">{i.code}</code>
              {i.priority && (
                <Badge intent={PRIORITY_INTENT[i.priority] ?? "neutral"}>
                  {i.priority}
                </Badge>
              )}
            </div>
            <div className="text-sm text-text-primary mt-1 line-clamp-2">
              {i.title}
            </div>
            <div className="text-xs text-text-muted mt-1">{i.assignee}</div>
          </div>
        )}
      />
    </div>
  ),
});
