/** In-process event bus for record CRUD events.
 *
 *  Every successful resource write emits a `RecordEvent` here. The
 *  workflow engine subscribes to drive `database event` triggers, and
 *  the outbound webhook dispatcher subscribes to fan events out to
 *  configured external URLs. New subscribers register at boot.
 *
 *  The bus is **synchronous** so subscribers run inside the same tick
 *  as the write. Subscribers that need async work (HTTP delivery,
 *  workflow runs longer than a few ms) MUST schedule their work — the
 *  bus does not own queueing. We use `setImmediate`-style deferral via
 *  `queueMicrotask` so the HTTP response returns first.
 *
 *  Failures inside subscribers are caught + logged; one bad subscriber
 *  cannot break another. Observability via the `errors` counter. */

export interface RecordEvent {
  /** Event topic — `record.created` | `record.updated` | `record.deleted` |
   *  `record.restored` | `record.destroyed`. Subscribers can pattern-
   *  match on these. */
  type:
    | "record.created"
    | "record.updated"
    | "record.deleted"
    | "record.restored"
    | "record.destroyed";
  resource: string;
  recordId: string;
  tenantId: string;
  actor: string;
  record: Record<string, unknown>;
  before?: Record<string, unknown>;
  diff?: Record<string, { from: unknown; to: unknown }>;
  occurredAt?: string;
}

export type RecordEventHandler = (event: RecordEvent) => void | Promise<void>;

const handlers = new Set<RecordEventHandler>();
let totalEvents = 0;
let totalErrors = 0;

export function subscribeRecordEvents(h: RecordEventHandler): () => void {
  handlers.add(h);
  return () => { handlers.delete(h); };
}

export function emitRecordEvent(event: RecordEvent): void {
  totalEvents++;
  const enriched: RecordEvent = {
    ...event,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
  };
  // Defer subscribers to a microtask so they don't block the request
  // path. queueMicrotask runs AFTER the current synchronous handler
  // finishes (the HTTP response writer) but before any I/O event.
  queueMicrotask(async () => {
    for (const h of handlers) {
      try {
        await h(enriched);
      } catch (err) {
        totalErrors++;
        // eslint-disable-next-line no-console
        console.error("[event-bus] handler error", err);
      }
    }
  });
}

export function eventBusStats(): { handlers: number; events: number; errors: number } {
  return { handlers: handlers.size, events: totalEvents, errors: totalErrors };
}

/** For tests: clear handlers + counters. Never call in production. */
export function __resetEventBus(): void {
  handlers.clear();
  totalEvents = 0;
  totalErrors = 0;
}
