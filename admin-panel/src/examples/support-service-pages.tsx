import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { LiveDnDKanban } from "@/admin-primitives/LiveDnDKanban";
import { Card, CardContent, CardHeader, CardTitle } from "@/admin-primitives/Card";
import { MetricGrid } from "@/admin-primitives/MetricGrid";
import { Badge } from "@/primitives/Badge";
import { BarChart } from "@/admin-primitives/charts/BarChart";
import { Donut } from "@/admin-primitives/charts/Donut";

const TICKET_COLS = [
  { id: "open", title: "Open", intent: "info" as const, wipLimit: 40 },
  { id: "in_progress", title: "In progress", intent: "warning" as const, wipLimit: 25 },
  { id: "resolved", title: "Resolved", intent: "success" as const },
  { id: "closed", title: "Closed", intent: "neutral" as const },
];
const PRIORITY_INTENT: Record<string, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

type TicketRow = {
  id: string;
  code?: string;
  subject?: string;
  priority?: keyof typeof PRIORITY_INTENT;
  requester?: string;
  assignee?: string;
  status: string;
  slaBreached?: boolean;
};

export const supportKanbanView = defineCustomView({
  id: "support-service.kanban.view",
  title: "Ticket Board",
  description: "Tickets grouped by status — drag to update.",
  resource: "support-service.ticket",
  render: () => (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Ticket board"
        description="Drag tickets between columns to change status. WIP limits flag overloaded columns."
      />
      <LiveDnDKanban<TicketRow>
        resource="support-service.ticket"
        statusField="status"
        columns={TICKET_COLS}
        onCardClick={(row) => {
          window.location.hash = `/support/tickets/${row.id}`;
        }}
        renderCard={(i) => (
          <div>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs font-mono text-text-muted">{i.code}</code>
              <div className="flex items-center gap-1">
                {i.slaBreached && (
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-intent-danger-bg text-intent-danger">
                    SLA
                  </span>
                )}
                {i.priority && (
                  <Badge intent={PRIORITY_INTENT[i.priority] ?? "neutral"}>
                    {i.priority}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-sm text-text-primary mt-1 line-clamp-2">
              {i.subject}
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-xs text-text-muted truncate">{i.requester}</div>
              {i.assignee && (
                <div className="text-xs text-text-secondary">{i.assignee}</div>
              )}
            </div>
          </div>
        )}
      />
    </div>
  ),
});

export const supportAnalyticsView = defineCustomView({
  id: "support-service.analytics.view",
  title: "Analytics",
  description: "Ticket volume and resolution health.",
  resource: "support-service.ticket",
  render: () => (
    <div className="flex flex-col gap-4">
      <PageHeader title="Support analytics" description="Trends and SLA health." />
      <MetricGrid
        columns={4}
        metrics={[
          { label: "CSAT", value: "4.6 / 5" },
          { label: "First response", value: "18 m", trend: { value: 2, positive: true } },
          { label: "Time to resolution", value: "6.2 h" },
          { label: "SLA miss", value: "3.8%", trend: { value: 1, positive: true } },
        ]}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Volume by day</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              data={"Mon Tue Wed Thu Fri Sat Sun"
                .split(" ")
                .map((l, i) => ({ label: l, value: 20 + (i * 13) % 38 }))}
              height={180}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>By category</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Donut
              data={[
                { label: "Account", value: 42 },
                { label: "Billing", value: 28 },
                { label: "Integrations", value: 19 },
                { label: "Product", value: 24 },
                { label: "Other", value: 9 },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  ),
});
