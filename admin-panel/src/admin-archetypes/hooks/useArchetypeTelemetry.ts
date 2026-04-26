import * as React from "react";
import type { ArchetypeId } from "../types";

/** Lightweight telemetry surface for archetype/widget instrumentation.
 *
 *  Pages call `useArchetypeTelemetry({ id, archetype })` near the top of
 *  the component to emit a "page-mount" event when the page first
 *  renders, and a "page-unmount" event when it unmounts. They can also
 *  call the returned `event(...)` helper to emit ad-hoc events.
 *
 *  Events are dispatched as `gutu:archetype-event` CustomEvents on
 *  `window`. The shell (or audit-core / observability plugins) can
 *  listen and forward them to any sink. There is no implicit network
 *  call — this hook stays free of side-effects beyond the event
 *  dispatch. */

export type ArchetypeEvent =
  | {
      kind: "page-mount";
      pageId: string;
      archetype: ArchetypeId;
      ts: number;
    }
  | {
      kind: "page-unmount";
      pageId: string;
      archetype: ArchetypeId;
      ts: number;
      lifetimeMs: number;
    }
  | {
      kind: "widget-render";
      pageId: string;
      archetype: ArchetypeId;
      widgetId: string;
      ms: number;
      ts: number;
    }
  | {
      kind: "interaction";
      pageId: string;
      archetype: ArchetypeId;
      action: string;
      detail?: Record<string, unknown>;
      ts: number;
    };

export interface UseArchetypeTelemetryArgs {
  /** Page id (matches `id` prop on the archetype root). */
  id: string;
  /** Archetype declared on the descriptor. */
  archetype: ArchetypeId;
  /** When false, suppress all dispatches. Default: true. */
  enabled?: boolean;
}

export interface ArchetypeTelemetryHandle {
  /** Emit a custom event scoped to this page. */
  event: (
    kind: ArchetypeEvent["kind"] | "interaction",
    payload?: { action?: string; widgetId?: string; ms?: number; detail?: Record<string, unknown> },
  ) => void;
}

const SAFE_DISPATCH = (e: ArchetypeEvent) => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent("gutu:archetype-event", { detail: e }),
    );
  } catch {
    /* CustomEvent unsupported in odd environments; ignore */
  }
};

export function useArchetypeTelemetry(
  { id, archetype, enabled = true }: UseArchetypeTelemetryArgs,
): ArchetypeTelemetryHandle {
  const enabledRef = React.useRef(enabled);
  enabledRef.current = enabled;
  const idRef = React.useRef(id);
  idRef.current = id;
  const archetypeRef = React.useRef(archetype);
  archetypeRef.current = archetype;
  const mountedAtRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!enabledRef.current) return;
    const ts = Date.now();
    mountedAtRef.current = ts;
    SAFE_DISPATCH({ kind: "page-mount", pageId: idRef.current, archetype: archetypeRef.current, ts });
    return () => {
      const start = mountedAtRef.current ?? ts;
      SAFE_DISPATCH({
        kind: "page-unmount",
        pageId: idRef.current,
        archetype: archetypeRef.current,
        ts: Date.now(),
        lifetimeMs: Date.now() - start,
      });
    };
  }, []);

  const event = React.useCallback<ArchetypeTelemetryHandle["event"]>(
    (kind, payload) => {
      if (!enabledRef.current) return;
      const ts = Date.now();
      const pageId = idRef.current;
      const archetype = archetypeRef.current;
      if (kind === "widget-render") {
        SAFE_DISPATCH({
          kind: "widget-render",
          pageId,
          archetype,
          widgetId: payload?.widgetId ?? "(unknown)",
          ms: payload?.ms ?? 0,
          ts,
        });
      } else if (kind === "interaction") {
        SAFE_DISPATCH({
          kind: "interaction",
          pageId,
          archetype,
          action: payload?.action ?? "(unknown)",
          detail: payload?.detail,
          ts,
        });
      } else if (kind === "page-mount") {
        SAFE_DISPATCH({ kind: "page-mount", pageId, archetype, ts });
      } else if (kind === "page-unmount") {
        SAFE_DISPATCH({
          kind: "page-unmount",
          pageId,
          archetype,
          ts,
          lifetimeMs:
            mountedAtRef.current != null ? ts - mountedAtRef.current : 0,
        });
      }
    },
    [],
  );

  return { event };
}

/** Subscribe to archetype telemetry events at the shell or plugin level.
 *  Returns an `off()` to detach. */
export function onArchetypeEvent(
  handler: (event: ArchetypeEvent) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<ArchetypeEvent>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener("gutu:archetype-event", listener);
  return () => window.removeEventListener("gutu:archetype-event", listener);
}
