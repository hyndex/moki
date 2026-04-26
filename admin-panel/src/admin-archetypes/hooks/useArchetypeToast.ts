import * as React from "react";
import { useRuntime } from "@/runtime/context";

export interface ArchetypeToast {
  title: string;
  description?: string;
  intent?: "default" | "success" | "warning" | "danger" | "info";
  durationMs?: number;
}

/** Emit a toast through the shell's runtime bus. Callers don't need to
 *  know about the bus shape — `toast({ title, intent: "success" })`
 *  just works.
 *
 *  Falls back to a `gutu:toast` CustomEvent dispatch when the runtime
 *  bus is not available (e.g. in tests, or in a sandboxed widget). */
export function useArchetypeToast() {
  const runtime = useRuntimeOrNull();
  const counterRef = React.useRef(0);
  return React.useCallback(
    (t: ArchetypeToast) => {
      const id = `toast-${++counterRef.current}-${Date.now()}`;
      const payload = { id, ...t };
      if (runtime?.bus?.emit) {
        try {
          runtime.bus.emit("toast:add", payload);
          return;
        } catch {
          /* fall through to CustomEvent */
        }
      }
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(new CustomEvent("gutu:toast", { detail: payload }));
        } catch {
          /* ignore */
        }
      }
    },
    [runtime],
  );
}

/** Like useRuntime but returns null when no provider is mounted, so the
 *  hook is usable from contexts that don't depend on the shell (tests,
 *  storybook, isolated catalogs). */
function useRuntimeOrNull(): ReturnType<typeof useRuntime> | null {
  try {
    return useRuntime();
  } catch {
    return null;
  }
}
