import * as React from "react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./Card";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/primitives/DropdownMenu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/primitives/Tabs";
import { Spinner } from "@/primitives/Spinner";
import { EmptyStateFramework } from "./EmptyStateFramework";
import { ErrorRecoveryFramework } from "./ErrorRecoveryFramework";
import { FreshnessIndicator } from "./FreshnessIndicator";
import { cn } from "@/lib/cn";
import { Breadcrumbs } from "./Breadcrumbs";
import type { Intent } from "@/primitives/Badge";
import type { ReactNode } from "react";

/** RichDetailPage — the declarative "proper in-depth detail page" primitive.
 *
 *  Replaces the thin auto-generated DetailView for plugins that want a
 *  full enterprise layout. Every page built on this gets:
 *
 *    ┌─ Breadcrumb ─────────────────────────────────────────────────────┐
 *    │ EntityHero                                                       │
 *    │   avatar/code · title · subtitle · status badge · KPI strip      │
 *    │   primary action · secondary actions · kebab (extra actions)     │
 *    │   workflow progress stepper (optional)                           │
 *    ├─ Main (tabbed) ──────────────┬─ Right rail (sticky) ─────────────┤
 *    │   Overview / Activity /       │  metadata card                    │
 *    │   Related / Files / Comments  │  ConnectionsPanel                 │
 *    │   Audit / domain-specific     │  AIInsightPanel                   │
 *    │                               │  AutomationHookPanel              │
 *    │                               │  HealthMonitorWidget              │
 *    │                               │  any custom rail module           │
 *    └───────────────────────────────┴───────────────────────────────────┘
 *
 *  Every surface is optional. Tabs and rail modules are composed per
 *  plugin via descriptor objects; common patterns (activity, audit, files,
 *  comments) have opinionated renderers; domain-specific tabs accept raw
 *  JSX.
 */

export interface RichDetailAction {
  id: string;
  label: string;
  intent?: "primary" | "ghost" | "danger";
  icon?: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  hidden?: boolean;
}

export interface RichDetailTab {
  id: string;
  label: string;
  /** Badge shown next to the tab label (e.g. count). */
  count?: number | string;
  /** Prevents tab from rendering. */
  hidden?: boolean;
  /** Content — rendered lazily on activation. */
  render: () => ReactNode;
  /** If the tab needs to load data before rendering, supply a loader. */
  loading?: boolean;
}

export interface RichDetailRailModule {
  id: string;
  /** Priority for collapse order on narrow screens (lower = first to hide). */
  priority?: number;
  render: () => ReactNode;
}

export interface RichDetailHeroMetric {
  label: string;
  value: ReactNode;
  helper?: string;
  intent?: Intent;
}

export interface RichDetailWorkflowStep {
  id: string;
  label: string;
  /** Current status of this step. */
  status: "completed" | "active" | "pending" | "error" | "skipped";
}

export interface RichDetailPageProps {
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;

  /** Optional breadcrumb chain. Last item is typically the record id. */
  breadcrumb?: { label: ReactNode; path?: string }[];

  /** Hero content — required for a proper detail page. */
  avatar?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  status?: { label: string; intent: Intent };
  /** Small KPI strip inside the hero (typically 2–4 items). */
  metrics?: RichDetailHeroMetric[];
  /** Inline progress across an ordered workflow (e.g. deal stages). */
  workflow?: { steps: readonly RichDetailWorkflowStep[]; activeId?: string };

  /** Actions. Primary renders as a solid button; secondaries as ghosts; the
   *  rest go into a kebab menu. */
  primaryAction?: RichDetailAction;
  secondaryActions?: readonly RichDetailAction[];
  extraActions?: readonly RichDetailAction[];

  /** Freshness — typically the record's updatedAt. */
  lastUpdatedAt?: Date | string | number | null;
  live?: boolean;

  /** Tabs (main content area). */
  tabs: readonly RichDetailTab[];
  /** Default active tab id. Defaults to the first visible tab. */
  defaultTabId?: string;

  /** Right-rail modules. Rail collapses on narrow viewports; modules are
   *  hidden in priority order. */
  rail?: readonly RichDetailRailModule[];

  /** Extra content between the hero and the tabs (e.g. alerts). */
  beforeTabs?: ReactNode;

  className?: string;
}

export function RichDetailPage({
  loading,
  error,
  onRetry,
  breadcrumb,
  avatar,
  title,
  subtitle,
  status,
  metrics,
  workflow,
  primaryAction,
  secondaryActions,
  extraActions,
  lastUpdatedAt,
  live,
  tabs,
  defaultTabId,
  rail,
  beforeTabs,
  className,
}: RichDetailPageProps) {
  const visibleTabs = React.useMemo(() => tabs.filter((t) => !t.hidden), [tabs]);
  const [active, setActive] = React.useState<string>(
    defaultTabId ?? visibleTabs[0]?.id ?? "",
  );
  React.useEffect(() => {
    if (!visibleTabs.some((t) => t.id === active) && visibleTabs[0]) {
      setActive(visibleTabs[0].id);
    }
  }, [visibleTabs, active]);

  if (error) {
    return (
      <div className={cn("py-8", className)}>
        <ErrorRecoveryFramework
          message={error.message}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn("py-16 flex items-center justify-center gap-2 text-sm text-text-muted", className)}>
        <Spinner size={14} /> Loading…
      </div>
    );
  }

  const visibleExtras = (extraActions ?? []).filter((a) => !a.hidden);
  const visibleSecondaries = (secondaryActions ?? []).filter((a) => !a.hidden);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Breadcrumbs items={breadcrumb.map((b) => ({ label: b.label, path: b.path }))} />
      )}

      {/* Hero */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start gap-4">
            {avatar && <div className="shrink-0">{avatar}</div>}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-semibold text-text-primary truncate">
                      {title}
                    </h1>
                    {status && (
                      <Badge intent={status.intent}>{status.label}</Badge>
                    )}
                  </div>
                  {subtitle && (
                    <div className="text-sm text-text-muted mt-0.5 truncate">
                      {subtitle}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {lastUpdatedAt !== undefined && (
                    <FreshnessIndicator lastUpdatedAt={lastUpdatedAt} live={live} />
                  )}
                  {visibleSecondaries.map((a) => (
                    <Button
                      key={a.id}
                      variant="ghost"
                      size="sm"
                      onClick={() => void a.onClick()}
                      disabled={a.disabled}
                      iconLeft={a.icon}
                    >
                      {a.label}
                    </Button>
                  ))}
                  {primaryAction && !primaryAction.hidden && (
                    <Button
                      variant={primaryAction.intent === "danger" ? "danger" : "primary"}
                      size="sm"
                      onClick={() => void primaryAction.onClick()}
                      disabled={primaryAction.disabled}
                      iconLeft={primaryAction.icon}
                    >
                      {primaryAction.label}
                    </Button>
                  )}
                  {visibleExtras.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="More actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {visibleExtras.map((a, i) => [
                          i > 0 && a.intent === "danger" ? (
                            <DropdownMenuSeparator key={`${a.id}-sep`} />
                          ) : null,
                          <DropdownMenuItem
                            key={a.id}
                            onSelect={() => void a.onClick()}
                            disabled={a.disabled}
                            intent={a.intent === "danger" ? "danger" : undefined}
                          >
                            {a.icon}
                            {a.label}
                          </DropdownMenuItem>,
                        ])}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {metrics && metrics.length > 0 && (
                <div className="mt-3 grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                  {metrics.map((m) => (
                    <div key={m.label} className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wider text-text-muted font-medium">
                        {m.label}
                      </div>
                      <div
                        className={cn(
                          "text-lg font-semibold tabular-nums mt-0.5 truncate",
                          m.intent === "success" && "text-intent-success",
                          m.intent === "warning" && "text-intent-warning",
                          m.intent === "danger" && "text-intent-danger",
                          (!m.intent || m.intent === "neutral" || m.intent === "info" || m.intent === "accent") && "text-text-primary",
                        )}
                      >
                        {m.value}
                      </div>
                      {m.helper && (
                        <div className="text-xs text-text-muted mt-0.5 truncate">{m.helper}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {workflow && workflow.steps.length > 0 && (
                <div className="mt-4">
                  <WorkflowProgress steps={workflow.steps} activeId={workflow.activeId} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {beforeTabs}

      {/* Main + Rail */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Tabs value={active} onValueChange={setActive}>
            <TabsList>
              {visibleTabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id}>
                  {t.label}
                  {t.count !== undefined && (
                    <span className="ml-1.5 text-xs text-text-muted tabular-nums">{t.count}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {visibleTabs.map((t) => (
              <TabsContent key={t.id} value={t.id} className="mt-4 flex flex-col gap-3">
                {t.loading ? (
                  <div className="py-10 flex items-center justify-center gap-2 text-sm text-text-muted">
                    <Spinner size={12} /> Loading…
                  </div>
                ) : (
                  t.render()
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {rail && rail.length > 0 && (
          <aside className="flex flex-col gap-3 lg:sticky lg:top-4 self-start">
            {[...rail]
              .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
              .map((m) => (
                <React.Fragment key={m.id}>{m.render()}</React.Fragment>
              ))}
          </aside>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- */
/* Supporting: inline workflow progress strip                    */
/* ----------------------------------------------------------- */

function WorkflowProgress({
  steps,
  activeId,
}: {
  steps: readonly RichDetailWorkflowStep[];
  activeId?: string;
}) {
  return (
    <ol className="flex items-center gap-0 w-full overflow-x-auto">
      {steps.map((s, i) => {
        const isActive = s.id === activeId || s.status === "active";
        return (
          <li key={s.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 min-w-0 px-1">
              <div
                className={cn(
                  "h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold tabular-nums",
                  s.status === "completed" && "bg-intent-success text-white",
                  s.status === "error" && "bg-intent-danger text-white",
                  isActive && "bg-accent text-accent-fg",
                  s.status === "skipped" && "bg-surface-2 text-text-muted",
                  s.status === "pending" && !isActive && "bg-surface-2 text-text-muted",
                )}
              >
                {s.status === "completed" ? "✓" : i + 1}
              </div>
              <div
                className={cn(
                  "text-[10px] uppercase tracking-wider truncate max-w-[80px]",
                  isActive && "text-text-primary font-medium",
                  !isActive && "text-text-muted",
                )}
              >
                {s.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px mx-1 mt-[-18px]",
                  s.status === "completed" ? "bg-intent-success" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ----------------------------------------------------------- */
/* Common rail modules (exported helpers)                        */
/* ----------------------------------------------------------- */

/** Metadata card — owner, created/updated, id. Common to every detail page. */
export function MetadataRailCard({
  items,
}: {
  items: readonly { label: string; value: ReactNode }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <dl className="divide-y divide-border-subtle">
          {items.map((i) => (
            <div key={i.label} className="px-3 py-2 flex items-start gap-3">
              <dt className="text-xs text-text-muted w-24 shrink-0">{i.label}</dt>
              <dd className="text-sm text-text-primary min-w-0 flex-1 truncate">{i.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/** Stub empty state for "tab without data yet". */
export function TabEmpty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Card>
      <CardContent>
        <EmptyStateFramework kind="cleared" title={title} description={description} />
      </CardContent>
    </Card>
  );
}

/** Consistent "related records" block — used in the Related tab. */
export function RelatedRecordsBlock({
  title,
  description,
  rows,
  columns,
  onRowClick,
  allHref,
}: {
  title: string;
  description?: string;
  rows: readonly Record<string, unknown>[];
  columns: readonly { label: string; render: (row: Record<string, unknown>) => ReactNode }[];
  onRowClick?: (row: Record<string, unknown>) => void;
  allHref?: string;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <EmptyStateFramework kind="cleared" title="Nothing linked yet" />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {allHref && (
            <a
              href={`#${allHref}`}
              className="text-xs text-text-muted hover:text-text-primary inline-flex items-center gap-1"
            >
              View all
              <ChevronRight className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
              {columns.map((c) => (
                <th key={c.label} className="text-left px-3 py-2 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className={cn(
                  "border-b border-border-subtle last:border-b-0",
                  onRowClick && "cursor-pointer hover:bg-surface-1",
                )}
                onClick={() => onRowClick?.(r)}
              >
                {columns.map((c) => (
                  <td key={c.label} className="px-3 py-2">
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
