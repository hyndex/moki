import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { ErrorState } from "@/admin-primitives/ErrorState";
/** Catches render errors in any descendant (plugin views, custom renderers).
 *  Keeps the shell responsive so users can navigate away from a broken view. */
export class ErrorBoundary extends React.Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        console.error("[admin] render error caught by boundary", error, info);
    }
    reset = () => this.setState({ error: null });
    render() {
        if (this.state.error) {
            if (this.props.fallback)
                return this.props.fallback;
            return (_jsx("div", { className: "p-6", children: _jsx(ErrorState, { title: "This view crashed", description: this.state.error.message, onRetry: this.reset }) }));
        }
        return this.props.children;
    }
}
