import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuTrigger, } from "@/primitives/DropdownMenu";
import { Button } from "@/primitives/Button";
import { useRuntime } from "@/runtime/context";
import { useRegistries } from "@/host/pluginHostContext";
function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
export function ExportCenter({ resource, count, fetchRows, fileName, formats, className, }) {
    const { analytics, actions } = useRuntime();
    const registries = useRegistries();
    const [busy, setBusy] = React.useState(null);
    /* Discover exporters from the registry. Every plugin-registered
     * exporter appears here automatically. */
    const availableExporters = React.useMemo(() => {
        const all = registries?.exporters.list() ?? [];
        if (!formats)
            return all;
        const filter = new Set(formats);
        return all.filter((e) => filter.has(e.key));
    }, [registries, formats]);
    const run = async (format) => {
        setBusy(format);
        const started = Date.now();
        try {
            const rows = await fetchRows();
            analytics.emit("page.export.started", { resource, format, rows: rows.length });
            const baseName = fileName ?? resource.replace(/\./g, "-");
            const entry = registries?.exporters.list().find((e) => e.key === format);
            if (entry) {
                const blob = await entry.value.export(rows, { fileName: baseName });
                download(blob, `${baseName}.${entry.value.extension}`);
            }
            else {
                // No registered exporter — server-side / delegated path.
                actions.toast({
                    title: `${format.toUpperCase()} export queued`,
                    description: "You'll receive a notification when it's ready.",
                    intent: "info",
                });
            }
            analytics.emit("page.export.delivered", {
                resource,
                format,
                durationMs: Date.now() - started,
            });
        }
        catch (err) {
            actions.toast({
                title: "Export failed",
                description: err instanceof Error ? err.message : "Unknown error",
                intent: "danger",
            });
        }
        finally {
            setBusy(null);
        }
    };
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Download, { className: "h-3.5 w-3.5" }), loading: busy !== null, className: className, children: "Export" }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsx(DropdownMenuLabel, { className: "text-xs", children: count !== undefined ? `${count} records · current view` : "Current view" }), _jsx(DropdownMenuSeparator, {}), availableExporters.length === 0 ? (_jsx(DropdownMenuItem, { disabled: true, children: "No exporters registered" })) : (availableExporters.map((e) => (_jsxs(DropdownMenuItem, { onSelect: () => void run(e.key), children: ["Export as ", e.value.label, e.contributor !== "shell" && (_jsxs("span", { className: "ml-2 text-[10px] text-text-muted", children: ["\u00B7 ", e.contributor] }))] }, e.key))))] })] }));
}
