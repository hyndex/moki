import * as React from "react";
import { PanelRightOpen, X } from "lucide-react";
import { Button } from "@/primitives/Button";
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
  /** Label for the rail's "Open Details" affordance on mobile. Default "Details". */
  drawerLabel?: React.ReactNode;
  /** When true, the collapsed-rail "Details" button is rendered. Default true.
   *  Set false to hide the drawer entirely (e.g., editor canvas). */
  showDrawerOnCollapse?: boolean;
  className?: string;
}

/** Layout primitive that places main + rail. Below `collapseAt`, the rail
 *  collapses out of the grid; on collapse a floating "Details" button
 *  reveals the rail content as a bottom-sheet drawer so it remains
 *  reachable on mobile. */
export function BodyLayout({
  main,
  rail,
  railWidth = 360,
  collapseAt = 1100,
  drawerLabel = "Details",
  showDrawerOnCollapse = true,
  className,
}: BodyLayoutProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Visual-viewport breakpoint: independent of container width, so the
    // rail collapses on mobile even when an outer max-width container
    // remains larger than the viewport.
    const mq = window.matchMedia(`(max-width: ${collapseAt - 1}px)`);

    const evaluate = (containerWidth?: number) => {
      const tooNarrowByContainer =
        containerWidth !== undefined && containerWidth < collapseAt;
      setCollapsed(mq.matches || tooNarrowByContainer);
    };

    evaluate();

    const onMq = () => evaluate();
    mq.addEventListener?.("change", onMq);

    let observer: ResizeObserver | undefined;
    const el = containerRef.current;
    if (el && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          evaluate(entry.contentRect.width);
        }
      });
      observer.observe(el);
    }

    return () => {
      mq.removeEventListener?.("change", onMq);
      observer?.disconnect();
    };
  }, [collapseAt]);

  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Auto-close drawer on viewport upgrade.
  React.useEffect(() => {
    if (!collapsed) setDrawerOpen(false);
  }, [collapsed]);

  // Esc closes drawer.
  React.useEffect(() => {
    if (!drawerOpen) return;
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  if (!rail || collapsed) {
    return (
      <div
        ref={containerRef}
        data-slot="body-layout"
        data-rail-collapsed={collapsed ? "true" : "false"}
        className={cn("min-w-0 relative", className)}
      >
        {main}
        {rail && collapsed && showDrawerOnCollapse && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDrawerOpen(true)}
              className="fixed bottom-4 right-4 z-30 shadow-md"
              aria-label="Open details panel"
              aria-expanded={drawerOpen}
              aria-controls="body-rail-drawer"
            >
              <PanelRightOpen className="h-4 w-4 mr-1" aria-hidden />
              {drawerLabel}
            </Button>
            <div
              id="body-rail-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Details panel"
              data-open={drawerOpen ? "true" : "false"}
              className={cn(
                "fixed inset-x-0 bottom-0 z-40 max-h-[85vh] overflow-auto",
                "bg-surface-raised border-t border-border shadow-lg rounded-t-lg",
                "transition-transform duration-200 motion-reduce:transition-none",
                drawerOpen ? "translate-y-0" : "translate-y-full pointer-events-none",
              )}
            >
              <header className="sticky top-0 flex items-center justify-between px-4 py-2 border-b border-border bg-surface-raised">
                <span className="text-sm font-semibold text-text-primary">
                  {drawerLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close"
                  className="p-1 rounded hover:bg-surface-1"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </header>
              <div className="px-4 py-3 flex flex-col gap-3">{rail}</div>
            </div>
            {drawerOpen && (
              <div
                aria-hidden
                onClick={() => setDrawerOpen(false)}
                className="fixed inset-0 z-30 bg-black/30"
              />
            )}
          </>
        )}
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
