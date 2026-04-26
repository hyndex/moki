import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Error boundary that wraps every `<EditorHost>` mount. Without this, a
 *  Univer / BlockSuite render exception would unmount the whole shell. */
import React from "react";
export class EditorErrorBoundary extends React.Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        // Surface to console for the dev. A production install can wire this to
        // an analytics sink via `window.gutuTelemetry?.trackEditorCrash(...)`.
        // eslint-disable-next-line no-console
        console.error(`[editor:${this.props.kind}/${this.props.recordId}] crashed`, error, info);
        const tele = window
            .gutuTelemetry;
        tele?.trackEditorCrash?.({ kind: this.props.kind, recordId: this.props.recordId, error });
    }
    reset = () => {
        this.setState({ error: null });
    };
    render() {
        if (this.state.error) {
            return (_jsxs("div", { role: "alert", style: { padding: 32, maxWidth: 720, margin: "32px auto", lineHeight: 1.5 }, children: [_jsx("h2", { style: { fontSize: 18, marginBottom: 12, color: "#b00020" }, children: "Editor crashed" }), _jsxs("p", { style: { color: "#555", marginBottom: 8 }, children: ["The ", _jsx("code", { children: this.props.kind }), " editor stopped responding. Your last saved snapshot is intact in storage; you can reopen this record to retry."] }), _jsx("pre", { style: {
                            background: "#f5f5f5",
                            padding: 12,
                            borderRadius: 6,
                            fontSize: 13,
                            maxHeight: 220,
                            overflow: "auto",
                        }, children: this.state.error.stack ?? this.state.error.message }), _jsx("button", { type: "button", onClick: this.reset, style: { padding: "8px 14px", marginTop: 12 }, children: "Try again" })] }));
        }
        return this.props.children;
    }
}
