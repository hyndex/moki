import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { BarChart as BarIcon, LineChart as LineIcon, PieChart as PieIcon, Printer, RotateCw, Table as TableIcon, TrendingUp, } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "./Card";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Checkbox } from "@/primitives/Checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/primitives/Select";
import { Spinner } from "@/primitives/Spinner";
import { Badge } from "@/primitives/Badge";
import { EmptyStateFramework } from "./EmptyStateFramework";
import { ErrorRecoveryFramework } from "./ErrorRecoveryFramework";
import { FreshnessIndicator } from "./FreshnessIndicator";
import { LineChart } from "./charts/LineChart";
import { BarChart } from "./charts/BarChart";
import { Donut } from "./charts/Donut";
import { Funnel } from "./charts/Funnel";
import { ExportCenter } from "./ExportCenter";
import { PivotTable } from "./PivotTable";
import { formatValue } from "./widgets/formatters";
import { useReport } from "@/runtime/useReport";
import { cn } from "@/lib/cn";
export function ReportBuilder({ definition }) {
    const initial = React.useMemo(() => {
        const out = {};
        for (const f of definition.filters) {
            if (f.defaultValue !== undefined)
                out[f.field] = f.defaultValue;
        }
        return out;
    }, [definition]);
    const [filters, setFilters] = React.useState(initial);
    const [lastUpdated, setLastUpdated] = React.useState(new Date());
    const [viewMode, setViewMode] = React.useState("table");
    const [chartKindOverride, setChartKindOverride] = React.useState(null);
    const { data, loading, error, refetch } = useReport(definition, filters);
    React.useEffect(() => {
        if (!loading && data)
            setLastUpdated(new Date());
    }, [data, loading]);
    const updateFilter = (field, value) => {
        setFilters((prev) => ({ ...prev, [field]: value }));
    };
    const handlePrint = () => {
        if (typeof window === "undefined")
            return;
        window.print();
    };
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: definition.label, description: definition.description, actions: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FreshnessIndicator, { lastUpdatedAt: lastUpdated }), _jsx(Button, { variant: "ghost", size: "sm", onClick: refetch, iconLeft: _jsx(RotateCw, { className: "h-3.5 w-3.5" }), children: "Refresh" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: handlePrint, iconLeft: _jsx(Printer, { className: "h-3.5 w-3.5" }), children: "Print" }), _jsx(ExportCenter, { resource: definition.id, count: data?.rows.length, fetchRows: async () => data?.rows ?? [], formats: ["csv", "json", "xlsx"] })] }) }), definition.filters.length > 0 && (_jsx(Card, { children: _jsx(CardContent, { className: "py-3", children: _jsx("div", { className: "flex flex-wrap items-center gap-3", children: definition.filters.map((f) => (_jsx(FilterField, { def: f, value: filters[f.field], onChange: (v) => updateFilter(f.field, v) }, f.field))) }) }) })), error ? (_jsx(ErrorRecoveryFramework, { message: error.message, onRetry: refetch })) : loading && !data ? (_jsx(Card, { children: _jsxs(CardContent, { className: "py-10 flex items-center justify-center gap-2 text-sm text-text-muted", children: [_jsx(Spinner, { size: 14 }), " Running report\u2026"] }) })) : !data || data.rows.length === 0 ? (_jsx(Card, { children: _jsx(CardContent, { children: _jsx(EmptyStateFramework, { kind: "no-results", title: "No data for this report", description: "Try broadening the filters or picking a different period." }) }) })) : (_jsxs(_Fragment, { children: [_jsx(ViewModeBar, { mode: viewMode, onModeChange: setViewMode, hasChart: Boolean(data.chart), chartKind: chartKindOverride ?? data.chart?.kind ?? "bar", onChartKindChange: setChartKindOverride }), viewMode === "chart" && data.chart && (_jsx(ReportChartBlock, { chart: chartKindOverride
                            ? { ...data.chart, kind: chartKindOverride }
                            : data.chart, rows: data.rows })), data.message && (_jsx("div", { className: "text-xs text-text-muted", children: data.message })), viewMode === "pivot" ? (_jsx(Card, { children: _jsx(CardContent, { children: _jsx(PivotTable, { rows: data.rows, fields: columnsToPivotFields(data.columns) }) }) })) : (_jsx(Card, { children: _jsx(CardContent, { className: "p-0", children: _jsx(ReportTable, { columns: data.columns, rows: data.rows, totals: data.totals }) }) }))] }))] }));
}
/* -------------------------------------------------------------------- */
/* View-mode bar                                                         */
/* -------------------------------------------------------------------- */
function ViewModeBar({ mode, onModeChange, hasChart, chartKind, onChartKindChange, }) {
    const modes = [
        { id: "table", label: "Table", icon: TableIcon },
        { id: "chart", label: "Chart", icon: TrendingUp },
        { id: "pivot", label: "Pivot", icon: BarIcon },
    ];
    const chartKinds = [
        { id: "bar", label: "Bar", icon: BarIcon },
        { id: "line", label: "Line", icon: LineIcon },
        { id: "area", label: "Area", icon: TrendingUp },
        { id: "donut", label: "Donut", icon: PieIcon },
    ];
    return (_jsxs("div", { className: "flex items-center justify-between flex-wrap gap-2", children: [_jsx("div", { className: "inline-flex rounded-md border border-border bg-surface-0 overflow-hidden", children: modes.map((m) => {
                    const Icon = m.icon;
                    if (m.id === "chart" && !hasChart)
                        return null;
                    const active = mode === m.id;
                    return (_jsxs("button", { type: "button", onClick: () => onModeChange(m.id), className: cn("px-3 py-1.5 text-xs inline-flex items-center gap-1.5 border-r border-border last:border-r-0", active
                            ? "bg-accent text-accent-contrast"
                            : "text-text-muted hover:bg-surface-1"), children: [_jsx(Icon, { className: "h-3.5 w-3.5" }), m.label] }, m.id));
                }) }), mode === "chart" && hasChart && (_jsx("div", { className: "inline-flex rounded-md border border-border bg-surface-0 overflow-hidden", children: chartKinds.map((c) => {
                    const Icon = c.icon;
                    const active = chartKind === c.id;
                    return (_jsxs("button", { type: "button", onClick: () => onChartKindChange(c.id), className: cn("px-3 py-1.5 text-xs inline-flex items-center gap-1.5 border-r border-border last:border-r-0", active
                            ? "bg-accent-subtle text-accent"
                            : "text-text-muted hover:bg-surface-1"), children: [_jsx(Icon, { className: "h-3.5 w-3.5" }), c.label] }, c.id));
                }) }))] }));
}
function columnsToPivotFields(columns) {
    return columns.map((c) => {
        const isNumeric = c.fieldtype === "currency" ||
            c.fieldtype === "number" ||
            c.fieldtype === "percent";
        return {
            field: c.field,
            label: c.label,
            asDimension: !isNumeric,
            asValue: isNumeric,
            format: c.fieldtype === "currency"
                ? "currency"
                : c.fieldtype === "percent"
                    ? "percent"
                    : c.fieldtype === "number"
                        ? "number"
                        : undefined,
            currency: c.options,
        };
    });
}
/* -------------------------------------------------------------------- */
/* Filter field                                                          */
/* -------------------------------------------------------------------- */
function FilterField({ def, value, onChange, }) {
    if (def.kind === "enum") {
        return (_jsxs("label", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-xs text-text-muted", children: def.label }), _jsxs(Select, { value: value !== undefined && value !== null ? String(value) : "", onValueChange: (v) => onChange(v === "__all__" ? undefined : v), children: [_jsx(SelectTrigger, { className: "h-8 min-w-[140px]", children: _jsx(SelectValue, { placeholder: "All" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "__all__", children: "All" }), (def.options ?? []).map((o) => (_jsx(SelectItem, { value: o.value, children: o.label }, o.value)))] })] })] }));
    }
    if (def.kind === "boolean") {
        return (_jsxs("label", { className: "inline-flex items-center gap-2 text-xs text-text-muted", children: [_jsx(Checkbox, { checked: Boolean(value), onCheckedChange: (v) => onChange(Boolean(v)) }), def.label] }));
    }
    if (def.kind === "date" || def.kind === "date_range") {
        return (_jsxs("label", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-xs text-text-muted", children: def.label }), _jsx(Input, { type: "date", className: "h-8 w-36", value: typeof value === "string" ? value : "", onChange: (e) => onChange(e.target.value || undefined) })] }));
    }
    return (_jsxs("label", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "text-xs text-text-muted", children: def.label }), _jsx(Input, { type: def.kind === "number" ? "number" : "text", className: "h-8 w-40", value: value !== undefined && value !== null ? String(value) : "", onChange: (e) => onChange(e.target.value || undefined), placeholder: def.label })] }));
}
/* -------------------------------------------------------------------- */
/* Chart                                                                 */
/* -------------------------------------------------------------------- */
function ReportChartBlock({ chart, rows, }) {
    const dataset = React.useMemo(() => chart.from(rows), [chart, rows]);
    const fmt = (v) => formatValue(v, chart.format, chart.currency);
    const height = chart.height ?? 260;
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx("div", { children: _jsx(CardTitle, { children: chart.label }) }) }), _jsx(CardContent, { children: "series" in dataset ? (_jsx(LineChart, { xLabels: dataset.xLabels, series: dataset.series, height: height, valueFormatter: fmt, area: chart.kind === "area" })) : chart.kind === "line" || chart.kind === "area" ? (_jsx(LineChart, { xLabels: dataset.map((d) => d.label), series: [{ label: chart.label, data: dataset.map((d) => d.value) }], height: height, valueFormatter: fmt, area: chart.kind === "area" })) : chart.kind === "bar" ? (_jsx(BarChart, { data: dataset, height: height, valueFormatter: fmt })) : chart.kind === "donut" ? (_jsx(Donut, { data: dataset })) : (_jsx(Funnel, { data: dataset })) })] }));
}
/* -------------------------------------------------------------------- */
/* Table                                                                 */
/* -------------------------------------------------------------------- */
function ReportTable({ columns, rows, totals, }) {
    const [sortCol, setSortCol] = React.useState(null);
    const [sortDir, setSortDir] = React.useState("asc");
    const sorted = React.useMemo(() => {
        if (!sortCol)
            return rows;
        const dir = sortDir === "asc" ? 1 : -1;
        return [...rows].sort((a, b) => {
            const av = a[sortCol];
            const bv = b[sortCol];
            if (av === bv)
                return 0;
            if (av === null || av === undefined)
                return 1;
            if (bv === null || bv === undefined)
                return -1;
            if (typeof av === "number" && typeof bv === "number")
                return dir * (av - bv);
            return dir * String(av).localeCompare(String(bv));
        });
    }, [rows, sortCol, sortDir]);
    const toggleSort = (field) => {
        if (sortCol === field)
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortCol(field);
            setSortDir("asc");
        }
    };
    return (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-border text-xs uppercase tracking-wider text-text-muted", children: columns.map((c) => (_jsxs("th", { className: cn("px-3 py-2 font-medium cursor-pointer select-none", c.align === "right" && "text-right", c.align === "center" && "text-center", !c.align && "text-left", sortCol === c.field && "text-text-primary"), style: { width: c.width }, onClick: () => toggleSort(c.field), children: [c.label, sortCol === c.field && (_jsx("span", { className: "ml-1", children: sortDir === "asc" ? "↑" : "↓" }))] }, c.field))) }) }), _jsx("tbody", { children: sorted.map((row, i) => (_jsx("tr", { className: "border-b border-border-subtle last:border-b-0 hover:bg-surface-1", children: columns.map((c) => (_jsx("td", { className: cn("px-3 py-2", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center", !c.align && "text-left"), children: _jsx(CellRenderer, { column: c, value: row[c.field], row: row }) }, c.field))) }, i))) }), totals && Object.keys(totals).length > 0 && (_jsx("tfoot", { children: _jsx("tr", { className: "border-t-2 border-border font-semibold bg-surface-1", children: columns.map((c, i) => (_jsxs("td", { className: cn("px-3 py-2", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center", !c.align && "text-left"), children: [i === 0 && "Total", totals[c.field] !== undefined &&
                                    formatCell(c, totals[c.field])] }, c.field))) }) }))] }) }));
}
function formatCell(column, value) {
    if (value === null || value === undefined || value === "")
        return "—";
    switch (column.fieldtype) {
        case "currency":
            return typeof value === "number"
                ? formatValue(value, "currency", column.options ?? "USD")
                : String(value);
        case "number":
            return typeof value === "number" ? formatValue(value, "number") : String(value);
        case "percent":
            return typeof value === "number" ? formatValue(value, "percent") : String(value);
        case "date":
        case "datetime":
            return typeof value === "string" ? new Date(value).toLocaleString() : String(value);
        case "enum":
            return _jsx(Badge, { intent: "neutral", children: String(value) });
        case "ref":
            return (_jsx("code", { className: "font-mono text-xs text-text-secondary", children: String(value) }));
        case "text":
        default:
            return String(value);
    }
}
function CellRenderer({ column, value, row, }) {
    if (column.format)
        return _jsx(_Fragment, { children: column.format(value, row) });
    return _jsx(_Fragment, { children: formatCell(column, value) });
}
