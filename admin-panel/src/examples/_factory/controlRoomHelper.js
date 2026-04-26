import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { defineCustomView } from "@/builders";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { FreshnessIndicator } from "@/admin-primitives/FreshnessIndicator";
import { WorkspaceRenderer } from "@/admin-primitives/widgets/WorkspaceRenderer";
/** Factory for Control-Room dashboards — a consistent pattern used across
 *  every plugin. Pass a WorkspaceDescriptor; get back a CustomView with the
 *  standard PageHeader + freshness indicator + WorkspaceRenderer. */
export function buildControlRoom(args) {
    return defineCustomView({
        id: args.viewId,
        title: args.title,
        description: args.description,
        resource: args.resource,
        render: () => {
            const [asOf, setAsOf] = React.useState(new Date());
            React.useEffect(() => {
                const t = setInterval(() => setAsOf(new Date()), 30_000);
                return () => clearInterval(t);
            }, []);
            return (_jsxs("div", { className: "flex flex-col gap-5", children: [_jsx(PageHeader, { title: args.title, description: args.description, actions: _jsx(FreshnessIndicator, { lastUpdatedAt: asOf, live: true }) }), _jsx(WorkspaceRenderer, { workspace: args.workspace })] }));
        },
    });
}
