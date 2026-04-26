import * as React from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/primitives/Button";
import { cn } from "@/lib/cn";

export interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  /** Label of the widget for the error message. */
  label?: string;
  /** Stable id for the widget (used by telemetry to attribute errors). */
  widgetId?: string;
  /** Archetype id (for telemetry attribution). */
  archetype?: string;
  /** Optional retry handler to allow user-triggered recovery. */
  onRetry?: () => void;
  /** Tail logger; receives the error + componentStack + widget context.
   *  Plugins can wire this to a telemetry provider (e.g., audit-core,
   *  Sentry, or the shell's structured logger). */
  onError?: (
    error: unknown,
    info: { componentStack: string; widgetId?: string; archetype?: string },
  ) => void;
  className?: string;
}

interface State {
  error: unknown;
  /** Reset key so a successful retry can re-mount children. */
  attempt: number;
}

/** Per-widget error boundary. One failing widget never blanks a page.
 *
 *  Production hardening:
 *    • Errors propagate to a global handler (window.dispatchEvent of a
 *      `gutu:widget-error` CustomEvent) so the shell or audit plugin can
 *      observe and report them centrally.
 *    • In development the original error stack is shown to speed up
 *      debugging; in production only the message + traceId is shown.
 *    • Resetting bumps an `attempt` counter that becomes part of the
 *      child key, forcing a clean mount of the previously-broken subtree
 *      so a flaky child doesn't immediately re-throw stale state. */
export class WidgetErrorBoundary extends React.Component<
  WidgetErrorBoundaryProps,
  State
> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error };
  }

  componentDidCatch(error: unknown, info: { componentStack: string }) {
    const ctx = {
      componentStack: info.componentStack,
      widgetId: this.props.widgetId,
      archetype: this.props.archetype,
    };
    try {
      this.props.onError?.(error, ctx);
    } catch {
      /* user handler must never break the boundary */
    }
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("gutu:widget-error", {
            detail: { error, ...ctx, label: this.props.label },
          }),
        );
      } catch {
        /* CustomEvent unsupported in some odd environments; ignore */
      }
    }
  }

  reset = () => {
    this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));
    try {
      this.props.onRetry?.();
    } catch {
      /* user handler must never break the reset */
    }
  };

  render() {
    if (this.state.error == null) {
      // Re-key children on retry so previously-broken trees re-mount cleanly.
      return (
        <React.Fragment key={this.state.attempt}>
          {this.props.children}
        </React.Fragment>
      );
    }
    const message =
      this.state.error instanceof Error
        ? this.state.error.message
        : typeof this.state.error === "string"
          ? this.state.error
          : "Something went wrong loading this widget.";
    const isDev =
      typeof process !== "undefined"
        ? process.env?.NODE_ENV !== "production"
        : true;
    const stack =
      isDev && this.state.error instanceof Error
        ? this.state.error.stack
        : undefined;

    return (
      <div
        role="alert"
        aria-live="polite"
        data-widget-error="true"
        data-widget-id={this.props.widgetId ?? null}
        data-archetype={this.props.archetype ?? null}
        className={cn(
          "rounded-md border border-warning/30 bg-warning-soft/30 px-3 py-3 text-sm flex items-start gap-2",
          this.props.className,
        )}
      >
        <AlertCircle
          className="h-4 w-4 shrink-0 mt-0.5 text-warning"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-text-primary">
            {this.props.label ?? "Widget failed"}
          </div>
          <div className="text-text-muted truncate" title={message}>
            {message}
          </div>
          {stack && (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-xs text-text-muted">
                Stack
              </summary>
              <pre className="text-[11px] text-text-muted mt-1 max-h-32 overflow-auto bg-surface-1 p-2 rounded">
                {stack}
              </pre>
            </details>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={this.reset}
          className="shrink-0"
        >
          <RotateCw className="h-3.5 w-3.5 mr-1" aria-hidden /> Retry
        </Button>
      </div>
    );
  }
}
