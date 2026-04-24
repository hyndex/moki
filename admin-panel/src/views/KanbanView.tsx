import type { KanbanView as KanbanViewDef } from "@/contracts/views";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { LiveDnDKanban } from "@/admin-primitives/LiveDnDKanban";
import { navigateTo } from "./useRoute";

export interface KanbanViewRendererProps {
  view: KanbanViewDef;
  basePath: string;
}

/** KanbanView renderer — wraps LiveDnDKanban with the declarative view. */
export function KanbanViewRenderer({ view, basePath }: KanbanViewRendererProps) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={view.title} description={view.description} />
      <LiveDnDKanban<Record<string, unknown> & { id: string }>
        resource={view.resource}
        statusField={view.statusField}
        columns={view.columns.map((c) => ({
          id: c.id,
          title: c.title,
          intent: c.intent,
          wipLimit: c.wipLimit,
        }))}
        filter={view.filter}
        pageSize={view.pageSize}
        onCardClick={(row) =>
          navigateTo(
            view.cardPath
              ? view.cardPath(row)
              : `${basePath}/${String(row.id)}`,
          )
        }
        renderCard={(row) => view.renderCard(row)}
      />
    </div>
  );
}
