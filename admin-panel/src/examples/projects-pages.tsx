import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { LiveDnDKanban } from "@/admin-primitives/LiveDnDKanban";
import { Badge } from "@/primitives/Badge";

const PROJECT_COLS = [
  { id: "open", title: "Open", intent: "info" as const },
  { id: "in_progress", title: "In progress", intent: "warning" as const },
  { id: "resolved", title: "Done", intent: "success" as const },
  { id: "closed", title: "Closed", intent: "neutral" as const },
];
const PRIORITY_INTENT: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

type ProjectRow = {
  id: string;
  code?: string;
  name?: string;
  owner?: string;
  priority?: keyof typeof PRIORITY_INTENT;
  status: string;
  progressPct?: number;
};

export const projectsBoardView = defineCustomView({
  id: "projects.board.view",
  title: "Board",
  description: "Projects grouped by status — drag to move.",
  resource: "projects.project",
  render: () => (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Project board"
        description="Every active project. Drag to update status."
      />
      <LiveDnDKanban<ProjectRow>
        resource="projects.project"
        statusField="status"
        columns={PROJECT_COLS}
        onCardClick={(row) => {
          window.location.hash = `/projects/${row.id}`;
        }}
        renderCard={(p) => (
          <div>
            <div className="flex items-center justify-between">
              <code className="text-xs font-mono text-text-muted">{p.code}</code>
              {p.priority && (
                <Badge intent={PRIORITY_INTENT[p.priority] ?? "neutral"}>
                  {p.priority}
                </Badge>
              )}
            </div>
            <div className="text-sm text-text-primary mt-1 line-clamp-2">
              {p.name}
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-xs text-text-muted">{p.owner}</div>
              {typeof p.progressPct === "number" && (
                <div className="text-xs text-text-secondary tabular-nums">
                  {p.progressPct}%
                </div>
              )}
            </div>
          </div>
        )}
      />
    </div>
  ),
});
