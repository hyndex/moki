import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/cn";
import { formatValue } from "./widgets/formatters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/primitives/Select";
export function PivotTable({ rows, fields, defaultRow, defaultColumn, defaultValue, defaultAgg = "sum", className, }) {
    const dims = fields.filter((f) => f.asDimension !== false);
    const values = fields.filter((f) => f.asValue !== false);
    const [rowField, setRowField] = React.useState(defaultRow ?? dims[0]?.field ?? "");
    const [colField, setColField] = React.useState(defaultColumn ?? "");
    const [valField, setValField] = React.useState(defaultValue ?? values[0]?.field ?? "");
    const [agg, setAgg] = React.useState(defaultAgg);
    const { table, rowKeys, colKeys, rowTotals, colTotals, grandTotal } = React.useMemo(() => computePivot(rows, rowField, colField, valField, agg), [rows, rowField, colField, valField, agg]);
    const valueFieldDef = values.find((v) => v.field === valField);
    const fmt = (v) => valueFieldDef?.format
        ? formatValue(v, valueFieldDef.format, valueFieldDef.currency)
        : formatValue(v, "number");
    return (_jsxs("div", { className: cn("flex flex-col gap-3", className), children: [_jsxs("div", { className: "flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface-1 p-3", children: [_jsx(LabeledSelect, { label: "Rows", value: rowField, onChange: setRowField, options: dims.map((d) => ({ value: d.field, label: d.label })) }), _jsx(LabeledSelect, { label: "Columns", value: colField || "__none__", onChange: (v) => setColField(v === "__none__" ? "" : v), options: [
                            { value: "__none__", label: "(none)" },
                            ...dims
                                .filter((d) => d.field !== rowField)
                                .map((d) => ({ value: d.field, label: d.label })),
                        ] }), _jsx(LabeledSelect, { label: "Values", value: valField, onChange: setValField, options: values.map((v) => ({ value: v.field, label: v.label })) }), _jsx(LabeledSelect, { label: "Aggregation", value: agg, onChange: (v) => setAgg(v), options: [
                            { value: "sum", label: "Sum" },
                            { value: "avg", label: "Average" },
                            { value: "count", label: "Count" },
                            { value: "min", label: "Min" },
                            { value: "max", label: "Max" },
                        ] })] }), _jsx("div", { className: "overflow-x-auto border border-border rounded-md bg-surface-0", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-surface-1 sticky top-0", children: _jsxs("tr", { children: [_jsx("th", { className: "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-text-muted border-b border-border", children: dims.find((d) => d.field === rowField)?.label ?? rowField }), colField
                                        ? colKeys.map((ck) => (_jsx("th", { className: "px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-muted border-b border-border", children: ck === "__empty__" ? "—" : ck }, ck)))
                                        : (_jsx("th", { className: "px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-muted border-b border-border", children: valueFieldDef?.label ?? valField })), _jsx("th", { className: "px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-muted border-b border-border bg-accent-subtle", children: "Total" })] }) }), _jsx("tbody", { children: rowKeys.map((rk) => (_jsxs("tr", { className: "border-b border-border-subtle last:border-b-0 hover:bg-surface-1", children: [_jsx("td", { className: "px-3 py-2 font-medium text-text-primary", children: rk === "__empty__" ? "—" : rk }), colField
                                        ? colKeys.map((ck) => {
                                            const v = table.get(rk)?.get(ck);
                                            return (_jsx("td", { className: "px-3 py-2 text-right tabular-nums", children: v !== undefined ? fmt(v) : "" }, ck));
                                        })
                                        : (_jsx("td", { className: "px-3 py-2 text-right tabular-nums", children: fmt(rowTotals.get(rk) ?? 0) })), _jsx("td", { className: "px-3 py-2 text-right tabular-nums font-semibold bg-accent-subtle", children: fmt(rowTotals.get(rk) ?? 0) })] }, rk))) }), _jsx("tfoot", { children: _jsxs("tr", { className: "border-t-2 border-border bg-surface-1 font-semibold", children: [_jsx("td", { className: "px-3 py-2", children: "Total" }), colField
                                        ? colKeys.map((ck) => (_jsx("td", { className: "px-3 py-2 text-right tabular-nums", children: fmt(colTotals.get(ck) ?? 0) }, ck)))
                                        : (_jsx("td", { className: "px-3 py-2 text-right tabular-nums", children: fmt(grandTotal) })), _jsx("td", { className: "px-3 py-2 text-right tabular-nums bg-accent-subtle", children: fmt(grandTotal) })] }) })] }) })] }));
}
/* ---- helpers ---- */
function LabeledSelect({ label, value, onChange, options, }) {
    return (_jsxs("label", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-xs text-text-muted", children: label }), _jsxs(Select, { value: value, onValueChange: onChange, children: [_jsx(SelectTrigger, { className: "h-8 min-w-[140px]", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: options.map((o) => (_jsx(SelectItem, { value: o.value, children: o.label }, o.value))) })] })] }));
}
function computePivot(rows, rowField, colField, valField, agg) {
    // For each (rowKey, colKey) bucket, accumulate an array of numeric values
    // so we can compute sum/avg/count/min/max consistently.
    const buckets = new Map();
    const rowKeysSet = new Set();
    const colKeysSet = new Set();
    const getNum = (r) => {
        const v = r[valField];
        if (typeof v === "number")
            return v;
        if (typeof v === "string") {
            const n = Number(v);
            return Number.isFinite(n) ? n : agg === "count" ? 1 : 0;
        }
        return agg === "count" ? 1 : 0;
    };
    for (const r of rows) {
        const rk = String(r[rowField] ?? "__empty__");
        const ck = colField ? String(r[colField] ?? "__empty__") : "__all__";
        rowKeysSet.add(rk);
        colKeysSet.add(ck);
        const rowMap = buckets.get(rk) ?? new Map();
        const list = rowMap.get(ck) ?? [];
        list.push(agg === "count" ? 1 : getNum(r));
        rowMap.set(ck, list);
        buckets.set(rk, rowMap);
    }
    const aggregate = (arr) => {
        if (arr.length === 0)
            return 0;
        switch (agg) {
            case "sum":
                return arr.reduce((a, b) => a + b, 0);
            case "avg":
                return arr.reduce((a, b) => a + b, 0) / arr.length;
            case "count":
                return arr.length;
            case "min":
                return Math.min(...arr);
            case "max":
                return Math.max(...arr);
        }
    };
    const table = new Map();
    for (const [rk, rm] of buckets) {
        const agged = new Map();
        for (const [ck, list] of rm)
            agged.set(ck, aggregate(list));
        table.set(rk, agged);
    }
    const rowKeys = [...rowKeysSet].sort();
    const colKeys = colField ? [...colKeysSet].sort() : [];
    const rowTotals = new Map();
    const colTotals = new Map();
    let grandTotal = 0;
    for (const rk of rowKeys) {
        const row = table.get(rk);
        let total = 0;
        for (const [ck, v] of row) {
            total += v;
            colTotals.set(ck, (colTotals.get(ck) ?? 0) + v);
        }
        rowTotals.set(rk, total);
        grandTotal += total;
    }
    return { table, rowKeys, colKeys, rowTotals, colTotals, grandTotal };
}
