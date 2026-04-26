import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Spinner } from "@/primitives/Spinner";
import { useList } from "@/runtime/hooks";
import { useRuntime } from "@/runtime/context";
import { DnDKanban } from "./DnDKanban";
import { ErrorState } from "./ErrorState";
export function LiveDnDKanban({ resource, statusField, columns, renderCard, filter, pageSize = 200, onMove, onCardClick, stateKey, className, }) {
    const runtime = useRuntime();
    const { data, loading, error, refetch } = useList(resource, { page: 1, pageSize });
    const rows = React.useMemo(() => {
        const base = (data?.rows ?? []);
        return filter ? base.filter(filter) : base;
    }, [data?.rows, filter]);
    const handleMove = React.useCallback(async (row, fromColumn, toColumn /*, _idx: number */) => {
        // Custom hook wins if provided.
        if (onMove) {
            try {
                await onMove(row, fromColumn, toColumn);
                return;
            }
            catch (err) {
                runtime.actions.toast({
                    title: "Move failed",
                    description: err instanceof Error ? err.message : String(err),
                    intent: "danger",
                });
                return;
            }
        }
        // Default: patch the status field.
        const id = String(row.id);
        try {
            await runtime.resources.update(resource, id, {
                [statusField]: toColumn,
            });
            runtime.actions.toast({
                title: `Moved to ${toColumn}`,
                intent: "success",
            });
        }
        catch (err) {
            runtime.actions.toast({
                title: "Move failed",
                description: err instanceof Error ? err.message : String(err),
                intent: "danger",
            });
            // Force refetch to snap the card back.
            refetch();
        }
    }, [onMove, runtime, resource, statusField, refetch]);
    if (error)
        return _jsx(ErrorState, { error: error, onRetry: refetch });
    if (loading && rows.length === 0) {
        return (_jsxs("div", { className: "flex items-center justify-center gap-2 py-10 text-xs text-text-muted", children: [_jsx(Spinner, { size: 12 }), " Loading board\u2026"] }));
    }
    return (_jsx("div", { className: className, onClick: (e) => e.stopPropagation(), children: _jsx(DnDKanban, { columns: columns, rows: rows, rowId: (r) => String(r.id), columnOf: (r) => String(r[statusField] ?? columns[0]?.id ?? ""), renderCard: (r) => onCardClick ? (_jsx("div", { role: "button", tabIndex: 0, onClick: (e) => {
                    e.stopPropagation();
                    onCardClick(r);
                }, onKeyDown: (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onCardClick(r);
                    }
                }, children: renderCard(r) })) : (renderCard(r)), onMove: (row, from, to /*, idx */) => void handleMove(row, from, to), stateKey: stateKey ?? resource }) }));
}
