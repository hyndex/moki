import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/** PluginBoundary — an error boundary scoped to a single plugin's rendered
 *  UI. If a plugin throws during render, only its tiles go red; the rest
 *  of the dashboard keeps working.
 *
 *  Used to wrap:
 *    - Every view rendered from `contributions.views`.
 *    - Every widget in a WorkspaceRenderer.
 *    - Every view extension (tab, section, railCard).
 *    - Every custom-view render.
 *
 *  The boundary surfaces the error to telemetry via `onError` and allows
 *  a one-click retry (resets the internal errored-state). */
export interface PluginBoundaryProps {
  readonly pluginId: string;
  readonly label?: string;
  readonly onError?: (pluginId: string, error: Error, info: React.ErrorInfo) => void;
  readonly fallback?: (err: Error, retry: () => void) => React.ReactNode;
  readonly children: React.ReactNode;
}

interface State {
  error: Error | null;
  key: number;
}

export class PluginBoundary extends React.Component<PluginBoundaryProps, State> {
  state: State = { error: null, key: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    try {
      this.props.onError?.(this.props.pluginId, error, info);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[plugin-boundary] onError threw", err);
    }
    // eslint-disable-next-line no-console
    console.error(`[plugin:${this.props.pluginId}] render error`, error, info.componentStack);
  }

  retry = () => {
    this.setState((s) => ({ error: null, key: s.key + 1 }));
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.retry);
      return (
        <DefaultFallback
          pluginId={this.props.pluginId}
          label={this.props.label}
          error={this.state.error}
          onRetry={this.retry}
        />
      );
    }
    return <React.Fragment key={this.state.key}>{this.props.children}</React.Fragment>;
  }
}

function DefaultFallback({
  pluginId,
  label,
  error,
  onRetry,
}: {
  pluginId: string;
  label?: string;
  error: Error;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-md border border-intent-danger/40 bg-intent-danger/5 p-4 text-sm"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-intent-danger flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-intent-danger">
            Plugin crashed — {label ?? pluginId}
          </div>
          <div className="text-xs text-text-muted mt-1 break-words font-mono">
            {error.message}
          </div>
          <div className="text-[10px] text-text-muted mt-2 font-mono opacity-70">
            plugin: {pluginId}
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded border border-border bg-surface-0 px-2 py-1 text-xs hover:bg-surface-1"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    </div>
  );
}
