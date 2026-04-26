/** Bridges the archetype runtime's pluggable cross-plugin services
 *  (RecordLinksProvider, TimelineEventsProvider, SavedViewsProvider,
 *  I18nProvider, and the telemetry sink) to the framework's existing
 *  resource client so widgets read real backend data with no per-page
 *  wiring.
 *
 *  Mounted once near the app root, alongside PermissionsRoot, by
 *  `AdminRoot.tsx`. */

import * as React from "react";
import {
  RecordLinksProvider,
  type RecordLinksAdapter,
  type RecordLinkGroup,
  TimelineEventsProvider,
  type TimelineEventsAdapter,
  type TimelineEvent,
  type TimelineFilter,
  SavedViewsProvider,
  LocalStorageSavedViewsAdapter,
  I18nProvider,
  installTelemetrySink,
} from "@/admin-archetypes";
import { useRuntime } from "@/runtime/context";

/** Real adapter that reads record-links via the framework resource
 *  client. Backed by `crm.contact` (people/companies), `sales.deal`,
 *  `support.ticket`, etc. — discovers what's available at runtime.
 *
 *  The adapter computes counts + summaries for each known target type
 *  on-demand. When a record-links-core resource is wired in production,
 *  this implementation can be swapped for an explicit lookup. */
class FrameworkRecordLinksAdapter implements RecordLinksAdapter {
  constructor(
    private readonly listRecords: (
      resource: string,
      filter: { field: string; op: string; value: unknown },
    ) => Promise<readonly Record<string, unknown>[]>,
  ) {}

  async listGroups(entity: { type: string; id: string }): Promise<RecordLinkGroup[]> {
    const groups: RecordLinkGroup[] = [];
    // CRM contact: surface deals + tickets + notes.
    if (entity.type === "crm.contact") {
      const [deals, tickets, notes] = await Promise.all([
        this.safe("sales.deal", "contactId", entity.id),
        this.safe("support.ticket", "contactId", entity.id),
        this.safe("crm.note", "contactId", entity.id),
      ]);
      const openDeals = deals.filter(
        (d) => d.stage !== "won" && d.stage !== "lost" && d.status !== "closed",
      );
      const openDealValue = openDeals.reduce(
        (s, d) => s + Number(d.amount ?? 0),
        0,
      );
      if (deals.length > 0) {
        groups.push({
          label: "Deals",
          count: deals.length,
          summary:
            openDeals.length > 0
              ? new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(openDealValue)
              : `${deals.length}`,
          icon: "Target",
          href: `#/crm/deals?filter=contactId:eq:${entity.id}`,
          severity: openDeals.length > 0 ? "info" : "neutral",
        });
      }
      if (tickets.length > 0) {
        const openTickets = tickets.filter(
          (t) => t.status !== "closed" && t.status !== "resolved",
        );
        groups.push({
          label: "Tickets",
          count: tickets.length,
          summary:
            openTickets.length > 0
              ? `${openTickets.length} open`
              : `${tickets.length}`,
          icon: "MessageSquare",
          href: `#/support/tickets?filter=contactId:eq:${entity.id}`,
          severity: openTickets.length > 0 ? "warning" : "neutral",
        });
      }
      if (notes.length > 0) {
        groups.push({
          label: "Notes",
          count: notes.length,
          summary: `${notes.length}`,
          icon: "StickyNote",
        });
      }
      return groups;
    }
    // Sales deal: surface contact + tickets.
    if (entity.type === "sales.deal") {
      const tickets = await this.safe("support.ticket", "dealId", entity.id);
      if (tickets.length > 0) {
        groups.push({
          label: "Tickets",
          count: tickets.length,
          icon: "MessageSquare",
        });
      }
      return groups;
    }
    return groups;
  }

  private async safe(
    resource: string,
    field: string,
    value: unknown,
  ): Promise<readonly Record<string, unknown>[]> {
    try {
      return await this.listRecords(resource, { field, op: "eq", value });
    } catch {
      return [];
    }
  }
}

/** Real adapter that reads timeline events via the framework resource
 *  client. Reads `audit.event` by default and (when entity scope is
 *  given) applies a server-side filter. */
class FrameworkTimelineAdapter implements TimelineEventsAdapter {
  constructor(
    private readonly listRecords: (
      resource: string,
      filter?: { field: string; op: string; value: unknown },
    ) => Promise<readonly Record<string, unknown>[]>,
  ) {}

  async list(filter: TimelineFilter): Promise<TimelineEvent[]> {
    const recordFilter = filter.entity
      ? { field: "resourceId", op: "eq", value: filter.entity.id }
      : undefined;
    let rows: readonly Record<string, unknown>[];
    try {
      rows = await this.listRecords("audit.event", recordFilter);
    } catch {
      return [];
    }
    let events = rows.map<TimelineEvent>((r) => ({
      id: String(r.id ?? ""),
      ts: String(r.ts ?? r.createdAt ?? new Date().toISOString()),
      kind: String(r.action ?? r.kind ?? "unknown"),
      actor: String(r.actor ?? r.user ?? "system"),
      title:
        typeof r.title === "string"
          ? r.title
          : `${r.action ?? r.kind ?? "event"} on ${r.resource ?? "—"}`,
      body: typeof r.body === "string" ? r.body : undefined,
      severity:
        r.level === "error"
          ? "danger"
          : r.level === "warn"
            ? "warning"
            : "info",
    }));
    if (filter.kindPrefix) {
      events = events.filter((e) => e.kind.startsWith(filter.kindPrefix!));
    }
    if (filter.severity) {
      events = events.filter((e) => e.severity === filter.severity);
    }
    return events
      .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
      .slice(0, filter.limit ?? 100);
  }
}

/** Mount this once near the app root. It composes:
 *
 *    <I18nProvider>
 *      <SavedViewsProvider adapter={localStorageAdapter}>
 *        <RecordLinksProvider adapter={frameworkAdapter}>
 *          <TimelineEventsProvider adapter={frameworkAdapter}>
 *            {children}
 *          </TimelineEventsProvider>
 *        </RecordLinksProvider>
 *      </SavedViewsProvider>
 *    </I18nProvider>
 *
 *  + installs the console telemetry sink in development. */
export function ArchetypeServiceProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtime = useRuntime();

  // Build a stable list-records function bound to the framework client.
  const list = React.useMemo(() => {
    return async (
      resource: string,
      filter?: { field: string; op: string; value: unknown },
    ) => {
      const result = await runtime.resources.list(resource, {
        page: 1,
        pageSize: 1000,
        filters: filter ? { [filter.field]: filter.value } : undefined,
      });
      return result.rows;
    };
  }, [runtime]);

  const recordLinksAdapter = React.useMemo<RecordLinksAdapter>(
    () => new FrameworkRecordLinksAdapter(list),
    [list],
  );
  const timelineAdapter = React.useMemo<TimelineEventsAdapter>(
    () => new FrameworkTimelineAdapter(list),
    [list],
  );
  const savedViewsAdapter = React.useMemo(
    () => new LocalStorageSavedViewsAdapter("anon"),
    [],
  );

  // Install a development telemetry sink that logs to the console once.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const isDev =
      typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
    if (!isDev) return;
    const handle = installTelemetrySink({
      onWidgetError: (p) => {
        // eslint-disable-next-line no-console
        console.warn("[archetypes] widget error", p);
      },
    });
    return () => handle.detach();
  }, []);

  return (
    <I18nProvider>
      <SavedViewsProvider adapter={savedViewsAdapter}>
        <RecordLinksProvider adapter={recordLinksAdapter}>
          <TimelineEventsProvider adapter={timelineAdapter}>
            {children}
          </TimelineEventsProvider>
        </RecordLinksProvider>
      </SavedViewsProvider>
    </I18nProvider>
  );
}
