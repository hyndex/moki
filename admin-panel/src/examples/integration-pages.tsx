import * as React from "react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent } from "@/admin-primitives/Card";
import { EmptyState } from "@/admin-primitives/EmptyState";
import { StatusDot } from "@/admin-primitives/StatusDot";
import { Button } from "@/primitives/Button";
import { Spinner } from "@/primitives/Spinner";
import { useIntegrationPings } from "./_shared/live-hooks";

export const integrationsStatusView = defineCustomView({
  id: "integration.status.view",
  title: "Status",
  description: "Live health of every integration.",
  resource: "integration.connection",
  render: () => <IntegrationStatusPage />,
});

function IntegrationStatusPage() {
  const { data: pings, loading } = useIntegrationPings();
  if (loading && pings.length === 0)
    return (
      <div className="py-16 flex items-center justify-center text-sm text-text-muted gap-2">
        <Spinner size={14} /> Loading…
      </div>
    );
  const latest: Record<string, (typeof pings)[number]> = {};
  for (const p of pings) {
    const existing = latest[p.connector];
    if (!existing || p.pingedAt > existing.pingedAt) latest[p.connector] = p;
  }
  const rows = Object.values(latest).sort((a, b) => a.connector.localeCompare(b.connector));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Integration status"
        description={`Live health of ${rows.length} connectors · realtime.`}
      />
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState title="No pings yet" />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {rows.map((r) => (
                <li key={r.connector} className="flex items-center gap-3 p-3">
                  <StatusDot
                    intent={
                      r.status === "ok"
                        ? "success"
                        : r.status === "warning"
                          ? "warning"
                          : "danger"
                    }
                    pulse={r.status !== "ok"}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary capitalize">
                      {r.connector}
                    </div>
                    <div className="text-xs text-text-muted">
                      last ping {new Date(r.pingedAt).toLocaleString()}
                    </div>
                  </div>
                  {r.latencyMs > 0 && (
                    <span className="text-xs text-text-muted tabular-nums w-16 text-right">
                      {r.latencyMs}ms
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      window.location.hash = `#/integrations/connections/${encodeURIComponent(r.connector)}`;
                    }}
                  >
                    Test
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
