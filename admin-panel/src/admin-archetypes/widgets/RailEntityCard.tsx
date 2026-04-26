import * as React from "react";
import { cn } from "@/lib/cn";
import type { Severity } from "../types";

export interface RailEntityFact {
  label: React.ReactNode;
  value: React.ReactNode;
}

export interface RailEntityCardProps {
  /** Hero heading (entity name). */
  title: React.ReactNode;
  /** One-line subtitle (type · status · owner). */
  subtitle?: React.ReactNode;
  /** Optional avatar / logo / image source. */
  avatarSrc?: string;
  /** Optional initials fallback for avatar. */
  initials?: string;
  /** Status pill tone. */
  status?: { label: React.ReactNode; tone: Severity };
  /** Bottom-list of small facts (5–8 max). */
  facts?: readonly RailEntityFact[];
  /** Action shown on the right of the title (e.g., Edit). */
  action?: React.ReactNode;
  /** Slot rendered under the facts grid — typically a "Open detail" link
   *  so the rail card drives a drill-through into the canonical detail
   *  page for the focused entity. */
  footer?: React.ReactNode;
  className?: string;
}

const TONE_PILL: Record<Severity, string> = {
  info: "bg-info-soft text-info-strong",
  success: "bg-success-soft text-success-strong",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger-strong",
  neutral: "bg-surface-2 text-text-muted",
};

/** S4 rail entity card — the focused entity's hero in the rail. */
export function RailEntityCard({
  title,
  subtitle,
  avatarSrc,
  initials,
  status,
  facts,
  action,
  footer,
  className,
}: RailEntityCardProps) {
  return (
    <div
      data-archetype-widget="rail-entity-card"
      className={cn(
        "rounded-lg border border-border bg-surface-0 p-3 flex flex-col gap-2",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-surface-2 flex items-center justify-center overflow-hidden shrink-0 text-sm font-semibold text-text-muted">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            initials ?? "·"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-text-primary truncate">
              {title}
            </div>
            {action}
          </div>
          {subtitle && (
            <div className="text-xs text-text-muted truncate">{subtitle}</div>
          )}
          {status && (
            <span
              className={cn(
                "inline-flex items-center text-[11px] font-medium rounded-full px-1.5 py-0.5 mt-1",
                TONE_PILL[status.tone],
              )}
            >
              {status.label}
            </span>
          )}
        </div>
      </div>
      {facts && facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs pt-1 border-t border-border-subtle">
          {facts.map((fact, i) => (
            <div key={i} className="min-w-0">
              <dt className="text-text-muted truncate uppercase tracking-wide text-[10px]">
                {fact.label}
              </dt>
              <dd className="text-text-primary truncate tabular-nums">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {footer && <div className="pt-1 border-t border-border-subtle">{footer}</div>}
    </div>
  );
}
