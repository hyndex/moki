import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { ErrorState } from "@/admin-primitives/ErrorState";
import { Skeleton } from "@/admin-primitives/Skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger, } from "@/primitives/Tabs";
import { Button } from "@/primitives/Button";
import { useRecord } from "@/runtime/hooks";
import { useRuntime } from "@/runtime/context";
import { ActionButton } from "./ListView";
import { navigateTo } from "./useRoute";
export function DetailViewRenderer({ view, id, editPath, basePath, }) {
    const runtime = useRuntime();
    const { data, loading, error } = useRecord(view.resource, id);
    const [tab, setTab] = React.useState(view.tabs[0]?.id ?? "");
    if (loading)
        return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(Skeleton, { className: "h-8 w-60" }), _jsx(Skeleton, { className: "h-4 w-96" }), _jsx(Skeleton, { className: "h-64 w-full" })] }));
    if (error)
        return (_jsx(ErrorState, { error: error, onRetry: () => runtime.resources.refresh(view.resource) }));
    if (!data)
        return (_jsx(ErrorState, { title: "Not found", description: `No ${view.title.toLowerCase()} with id "${id}".`, onRetry: () => navigateTo(basePath) }));
    const detailActions = view.actions?.filter((a) => !a.placement || a.placement.includes("detail")) ?? [];
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: view.header ? view.header(data) : data.name ?? view.title, description: view.description, actions: _jsxs(_Fragment, { children: [editPath && (_jsx(Button, { variant: "secondary", size: "sm", onClick: () => navigateTo(editPath), children: "Edit" })), detailActions.map((a) => (_jsx(ActionButton, { action: a, records: [data], resource: view.resource, runtime: runtime, size: "sm" }, a.id)))] }) }), _jsxs(Tabs, { value: tab, onValueChange: setTab, children: [_jsx(TabsList, { children: view.tabs.map((t) => (_jsx(TabsTrigger, { value: t.id, children: t.label }, t.id))) }), view.tabs.map((t) => (_jsx(TabsContent, { value: t.id, children: t.render(data) }, t.id)))] })] }));
}
