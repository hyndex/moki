import * as React from "react";
import { cn } from "@/lib/cn";

export interface BodyLayoutProps {
  /** S5 main canvas. */
  main: React.ReactNode;
  /** S4 + S6 right rail (combined). */
  rail?: React.ReactNode;
  /** Width of the rail in px on desktop. */
  railWidth?: 320 | 360 | 400;
  /** Below this width (px), the rail collapses to a "Details" tab inline.
   *  Default 1100px per design system. */
  collapseAt?: number;
  className?: string;
}

/** Layout primitive that places main + rail. Below `collapseAt`, the rail
 *  is hidden (the parent archetype is expected to surface it as a tab or
 *  bottom drawer if needed). */
export function BodyLayout({
  main,
  rail,
  railWidth = 360,
  collapseAt = 1100,
  className,
}: BodyLayoutProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      // Fall back to a media query when ResizeObserver is unavailable.
      const mq = window.matchMedia(`(max-width: ${collapseAt - 1}px)`);
      const sync = () => setCollapsed(mq.matches);
      sync();
      mq.addEventListener?.("change", sync);
      return () => mq.removeEventListener?.("change", sync);
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCollapsed(entry.contentRect.width < collapseAt);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapseAt]);

  if (!rail || collapsed) {
    return (
      <div
        ref={containerRef}
        data-slot="body-layout"
        data-rail-collapsed={collapsed ? "true" : "false"}
        className={cn("min-w-0", className)}
      >
        {main}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-slot="body-layout"
      className={cn(
        "grid gap-4 min-w-0",
        railWidth === 320
          ? "grid-cols-[minmax(0,1fr)_320px]"
          : railWidth === 400
            ? "grid-cols-[minmax(0,1fr)_400px]"
            : "grid-cols-[minmax(0,1fr)_360px]",
        className,
      )}
    >
      <div className="min-w-0">{main}</div>
      <aside
        role="complementary"
        aria-label="Page rail"
        className="min-w-0 flex flex-col gap-3"
      >
        {rail}
      </aside>
    </div>
  );
}
