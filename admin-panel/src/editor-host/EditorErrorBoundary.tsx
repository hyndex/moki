/** Error boundary that wraps every `<EditorHost>` mount. Without this, a
 *  Univer / BlockSuite render exception would unmount the whole shell. */

import React from "react";
import type { EditorKind } from "./types";

interface Props {
  children: React.ReactNode;
  kind: EditorKind;
  recordId: string;
}

interface State {
  error: Error | null;
}

export class EditorErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface to console for the dev. A production install can wire this to
    // an analytics sink via `window.gutuTelemetry?.trackEditorCrash(...)`.
    // eslint-disable-next-line no-console
    console.error(`[editor:${this.props.kind}/${this.props.recordId}] crashed`, error, info);
    const tele = (window as unknown as { gutuTelemetry?: { trackEditorCrash?: (e: unknown) => void } })
      .gutuTelemetry;
    tele?.trackEditorCrash?.({ kind: this.props.kind, recordId: this.props.recordId, error });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div role="alert" style={{ padding: 32, maxWidth: 720, margin: "32px auto", lineHeight: 1.5 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12, color: "#b00020" }}>
            Editor crashed
          </h2>
          <p style={{ color: "#555", marginBottom: 8 }}>
            The <code>{this.props.kind}</code> editor stopped responding. Your last
            saved snapshot is intact in storage; you can reopen this record to retry.
          </p>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 12,
              borderRadius: 6,
              fontSize: 13,
              maxHeight: 220,
              overflow: "auto",
            }}
          >
            {this.state.error.stack ?? this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.reset}
            style={{ padding: "8px 14px", marginTop: 12 }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
