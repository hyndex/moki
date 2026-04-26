import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
export class PluginBoundary extends React.Component {
    state = { error: null, key: 0 };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        try {
            this.props.onError?.(this.props.pluginId, error, info);
        }
        catch (err) {
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
            if (this.props.fallback)
                return this.props.fallback(this.state.error, this.retry);
            return (_jsx(DefaultFallback, { pluginId: this.props.pluginId, label: this.props.label, error: this.state.error, onRetry: this.retry }));
        }
        return _jsx(React.Fragment, { children: this.props.children }, this.state.key);
    }
}
function DefaultFallback({ pluginId, label, error, onRetry, }) {
    return (_jsx("div", { role: "alert", className: "rounded-md border border-intent-danger/40 bg-intent-danger/5 p-4 text-sm", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx(AlertTriangle, { className: "h-4 w-4 text-intent-danger flex-shrink-0 mt-0.5" }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "font-medium text-intent-danger", children: ["Plugin crashed \u2014 ", label ?? pluginId] }), _jsx("div", { className: "text-xs text-text-muted mt-1 break-words font-mono", children: error.message }), _jsxs("div", { className: "text-[10px] text-text-muted mt-2 font-mono opacity-70", children: ["plugin: ", pluginId] })] }), _jsxs("button", { type: "button", onClick: onRetry, className: "inline-flex items-center gap-1 rounded border border-border bg-surface-0 px-2 py-1 text-xs hover:bg-surface-1", children: [_jsx(RefreshCw, { className: "h-3 w-3" }), "Retry"] })] }) }));
}
