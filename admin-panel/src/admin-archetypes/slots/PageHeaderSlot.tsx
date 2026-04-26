import * as React from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderSlotProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Status pill or entity badge — small chip on the right of the title. */
  badge?: React.ReactNode;
  /** Breadcrumb component (consumes shell breadcrumbs by default). */
  breadcrumbs?: React.ReactNode;
  /** Right-aligned action cluster: 1–3 primary buttons + overflow. */
  actions?: React.ReactNode;
  /** Tab strip rendered as a second row of the header. */
  tabs?: React.ReactNode;
  /** When true, header is sticky on scroll. Default true. */
  sticky?: boolean;
  /** When true, the header collapses height by ~30% as the page scrolls. */
  collapsing?: boolean;
  className?: string;
}

/** S1 — the page header. Sticky by default; collapses on scroll. */
export function PageHeaderSlot({
  title,
  subtitle,
  badge,
  breadcrumbs,
  actions,
  tabs,
  sticky = true,
  collapsing = true,
  className,
}: PageHeaderSlotProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    if (!collapsing) return;
    if (typeof window === "undefined") return;
    const onScroll = () => {
      setCollapsed(window.scrollY > 32);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [collapsing]);

  return (
    <header
      role="banner"
      data-slot="page-header"
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "flex flex-col gap-1.5 transition-[padding,height] duration-200 motion-reduce:transition-none",
        sticky &&
          "sticky top-0 z-20 bg-surface-canvas/80 backdrop-blur supports-[backdrop-filter]:bg-surface-canvas/60",
        collapsed ? "py-2 border-b border-border" : "pb-3 pt-1",
        className,
      )}
    >
      {breadcrumbs && !collapsed && (
        <div className="text-xs text-text-muted">{breadcrumbs}</div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <h1
            className={cn(
              "font-semibold text-text-primary truncate",
              collapsed ? "text-base" : "text-xl",
            )}
            title={typeof title === "string" ? title : undefined}
          >
            {title}
          </h1>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        {actions && (
          <div className="flex items-center gap-1.5 shrink-0">{actions}</div>
        )}
      </div>
      {!collapsed && subtitle && (
        <div className="text-sm text-text-muted">{subtitle}</div>
      )}
      {tabs && <div className="-mb-px">{tabs}</div>}
    </header>
  );
}
