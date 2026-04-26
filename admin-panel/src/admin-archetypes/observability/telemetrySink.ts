/** Bridge `gutu:archetype-event` and `gutu:widget-error` CustomEvents
 *  to a structured logger / audit-core / external monitoring provider.
 *
 *  Plugins call `installTelemetrySink({ ... })` once at boot; the
 *  installed handlers receive every event the runtime emits. The sink
 *  is opt-in — by default the events fire into the void (the in-app
 *  /settings/archetype-events devtools page subscribes manually). */

import type { ArchetypeEvent } from "../hooks/useArchetypeTelemetry";

export interface WidgetErrorPayload {
  error: unknown;
  componentStack?: string;
  widgetId?: string;
  archetype?: string;
  label?: string;
}

export interface TelemetrySinkConfig {
  /** Called for every archetype-event (page-mount / page-unmount /
   *  widget-render / interaction). */
  onArchetypeEvent?: (event: ArchetypeEvent) => void;
  /** Called for every widget error caught by WidgetErrorBoundary. */
  onWidgetError?: (payload: WidgetErrorPayload) => void;
  /** Sample rate 0..1 for archetype events (errors are always sampled).
   *  Default: 1. */
  sampleArchetype?: number;
  /** Optional console shim for development logging. */
  console?: { info: (m: string, d?: unknown) => void; warn: (m: string, d?: unknown) => void; error: (m: string, d?: unknown) => void };
}

let installed: { detach: () => void } | null = null;

/** Install telemetry sink. Idempotent — calling twice replaces the
 *  previous installation. Returns a `detach()` to remove it. */
export function installTelemetrySink(
  config: TelemetrySinkConfig,
): { detach: () => void } {
  if (typeof window === "undefined") return { detach: () => {} };
  if (installed) installed.detach();

  const sample = Math.max(0, Math.min(1, config.sampleArchetype ?? 1));
  const console_ = config.console;

  const onArch = (e: Event) => {
    const detail = (e as CustomEvent<ArchetypeEvent>).detail;
    if (!detail) return;
    if (sample < 1 && Math.random() > sample) return;
    try {
      config.onArchetypeEvent?.(detail);
    } catch (err) {
      console_?.warn("[telemetry] archetype handler threw", err);
    }
  };

  const onErr = (e: Event) => {
    const detail = (e as CustomEvent).detail as WidgetErrorPayload | undefined;
    if (!detail) return;
    try {
      config.onWidgetError?.(detail);
    } catch (err) {
      console_?.warn("[telemetry] error handler threw", err);
    }
  };

  window.addEventListener("gutu:archetype-event", onArch);
  window.addEventListener("gutu:widget-error", onErr);

  const handle = {
    detach: () => {
      window.removeEventListener("gutu:archetype-event", onArch);
      window.removeEventListener("gutu:widget-error", onErr);
      installed = null;
    },
  };
  installed = handle;
  return handle;
}

/** Convenience: a sink that forwards every event to `console` with a
 *  consistent prefix. Useful in development. */
export function consoleTelemetrySink(prefix = "[archetypes]") {
  return installTelemetrySink({
    onArchetypeEvent: (e) => {
      // eslint-disable-next-line no-console
      console.info(`${prefix} ${e.kind}`, e);
    },
    onWidgetError: (p) => {
      // eslint-disable-next-line no-console
      console.error(`${prefix} widget-error`, p);
    },
  });
}

/** Convenience: a sink that POSTs every event to a backend endpoint
 *  (with batched flushing on a timer + on page unload). */
export function httpBatchTelemetrySink(options: {
  endpoint: string;
  /** Flush interval ms. Default 5000. */
  flushMs?: number;
  /** Max batch size before forced flush. Default 100. */
  maxBatch?: number;
  /** Custom fetch impl (testing). */
  fetcher?: typeof fetch;
}) {
  const flushMs = options.flushMs ?? 5_000;
  const maxBatch = options.maxBatch ?? 100;
  const fetcher = options.fetcher ?? (typeof fetch !== "undefined" ? fetch : undefined);
  if (!fetcher) return installTelemetrySink({});

  const queue: Array<
    | { type: "archetype"; data: ArchetypeEvent }
    | { type: "widget-error"; data: WidgetErrorPayload }
  > = [];

  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (queue.length === 0) return;
    const batch = queue.splice(0, queue.length);
    try {
      await fetcher(options.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch.map((b) => ({ kind: b.type, ...(b.data as object) })) }),
        // Use keepalive so a flush during page unload still completes.
        keepalive: true,
      });
    } catch {
      // Re-queue on transient failure (best-effort; drop on further failure).
      for (const item of batch.slice(0, maxBatch)) queue.push(item);
    }
  };

  const enqueue = (item: (typeof queue)[number]) => {
    queue.push(item);
    if (queue.length >= maxBatch) {
      void flush();
      return;
    }
    if (!timer) timer = setTimeout(() => void flush(), flushMs);
  };

  const handle = installTelemetrySink({
    onArchetypeEvent: (e) => enqueue({ type: "archetype", data: e }),
    onWidgetError: (p) => enqueue({ type: "widget-error", data: p }),
  });

  if (typeof window !== "undefined") {
    const onUnload = () => void flush();
    window.addEventListener("pagehide", onUnload);
    const oldDetach = handle.detach;
    handle.detach = () => {
      window.removeEventListener("pagehide", onUnload);
      void flush();
      oldDetach();
    };
  }

  return handle;
}
