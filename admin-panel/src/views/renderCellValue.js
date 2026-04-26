import { jsx as _jsx } from "react/jsx-runtime";
import { Badge } from "@/primitives/Badge";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
/** Default cell renderer used when a column doesn't supply a custom `render`.
 *
 *  Now registry-aware: if a plugin has contributed a `fieldKinds` entry with
 *  a `cell` component for the column's kind, that component takes over. This
 *  is the primary extension point for new column kinds (e.g. "color-swatch",
 *  "barcode", "rating") — plugins register once, every list view picks it up. */
export function renderCellValue(col, value, record = {}, registries) {
    // First: registry override for the column's kind.
    if (registries && col.kind) {
        const kindSpec = registries.fieldKinds.get(col.kind);
        if (kindSpec?.cell) {
            const Cell = kindSpec.cell;
            return (_jsx(Cell, { value: value, record: record, options: col.options }));
        }
    }
    if (value === undefined || value === null || value === "") {
        return _jsx("span", { className: "text-text-muted", children: "\u2014" });
    }
    switch (col.kind) {
        case "boolean":
            return value ? (_jsx(Badge, { intent: "success", children: "Yes" })) : (_jsx(Badge, { intent: "neutral", children: "No" }));
        case "date":
            return formatDate(value);
        case "datetime":
            return formatDateTime(value);
        case "currency":
            return formatCurrency(Number(value));
        case "number":
            return formatNumber(Number(value));
        case "enum": {
            const opt = col.options?.find((o) => o.value === value);
            if (!opt)
                return String(value);
            return _jsx(Badge, { intent: opt.intent ?? "neutral", children: opt.label });
        }
        case "email":
            return (_jsx("a", { href: `mailto:${String(value)}`, className: "text-text-link hover:underline", children: String(value) }));
        case "url":
            return (_jsx("a", { href: String(value), target: "_blank", rel: "noreferrer", className: "text-text-link hover:underline", children: String(value) }));
        default:
            return String(value);
    }
}
/** Dot-path accessor: "customer.name" -> row.customer.name */
export function getPath(row, path) {
    if (!row || typeof row !== "object")
        return undefined;
    const parts = path.split(".");
    let cursor = row;
    for (const p of parts) {
        if (cursor == null || typeof cursor !== "object")
            return undefined;
        cursor = cursor[p];
    }
    return cursor;
}
