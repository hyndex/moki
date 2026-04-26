import * as React from "react";

/** Reactive `prefers-reduced-motion` media-query state. SSR-safe.
 *  Slot components and animated widgets read this to opt out of motion
 *  for users who have set the OS-level accessibility preference. */
export function usePrefersReducedMotion(): boolean {
  const get = React.useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const [reduced, setReduced] = React.useState<boolean>(get);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  return reduced;
}
