import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Plus, X } from "lucide-react";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/primitives/Select";
import { cn } from "@/lib/cn";
const OPS_BY_KIND = {
    text: ["contains", "eq", "neq", "starts_with", "is_null", "is_not_null"],
    number: ["eq", "neq", "lt", "lte", "gt", "gte", "between", "is_null", "is_not_null"],
    enum: ["eq", "neq", "in", "nin", "is_null", "is_not_null"],
    date: ["eq", "lt", "lte", "gt", "gte", "between", "is_null", "is_not_null"],
    boolean: ["eq", "is_null", "is_not_null"],
};
const OP_LABELS = {
    eq: "equals",
    neq: "not equals",
    lt: "less than",
    lte: "≤",
    gt: "greater than",
    gte: "≥",
    in: "in list",
    nin: "not in list",
    contains: "contains",
    starts_with: "starts with",
    between: "between",
    is_null: "is empty",
    is_not_null: "is not empty",
};
function isLeaf(tree) {
    return "field" in tree && "op" in tree;
}
function emptyLeaf(fields) {
    const first = fields[0];
    return { field: first?.field ?? "", op: "eq", value: "" };
}
function toGroup(tree) {
    if (!tree)
        return { mode: "and", children: [] };
    if ("and" in tree)
        return { mode: "and", children: tree.and };
    if ("or" in tree)
        return { mode: "or", children: tree.or };
    return { mode: "and", children: [tree] };
}
export function AdvancedFilterBuilder({ fields, value, onChange, className, }) {
    const group = toGroup(value);
    const emit = (children, mode = group.mode) => {
        if (children.length === 0)
            onChange(undefined);
        else if (children.length === 1 && isLeaf(children[0]))
            onChange(children[0]);
        else
            onChange(mode === "and" ? { and: children } : { or: children });
    };
    const addLeaf = () => emit([...group.children, emptyLeaf(fields)]);
    const removeAt = (idx) => emit(group.children.filter((_, i) => i !== idx));
    const updateAt = (idx, next) => emit(group.children.map((c, i) => (i === idx ? next : c)));
    return (_jsxs("div", { className: cn("flex flex-col gap-2 p-3 border border-border rounded-md bg-surface-1", className), role: "group", "aria-label": "Advanced filter", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-text-muted", children: [_jsx("span", { children: "Match" }), _jsxs(Select, { value: group.mode, onValueChange: (v) => emit(group.children, v), children: [_jsx(SelectTrigger, { className: "h-7 w-20", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "and", children: "all" }), _jsx(SelectItem, { value: "or", children: "any" })] })] }), _jsx("span", { children: "of the following:" })] }), group.children.map((child, idx) => (_jsx(LeafRow, { fields: fields, leaf: isLeaf(child) ? child : emptyLeaf(fields), onChange: (next) => updateAt(idx, next), onRemove: () => removeAt(idx) }, idx))), _jsx("div", { children: _jsx(Button, { variant: "ghost", size: "sm", onClick: addLeaf, iconLeft: _jsx(Plus, { className: "h-3 w-3" }), children: "Add filter" }) })] }));
}
function LeafRow({ fields, leaf, onChange, onRemove, }) {
    const def = fields.find((f) => f.field === leaf.field);
    const ops = def ? OPS_BY_KIND[def.kind] : ["eq"];
    const showValue = leaf.op !== "is_null" && leaf.op !== "is_not_null";
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Select, { value: leaf.field, onValueChange: (v) => onChange({ ...leaf, field: v }), children: [_jsx(SelectTrigger, { className: "h-8 w-40", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: fields.map((f) => (_jsx(SelectItem, { value: f.field, children: f.label }, f.field))) })] }), _jsxs(Select, { value: leaf.op, onValueChange: (v) => onChange({ ...leaf, op: v }), children: [_jsx(SelectTrigger, { className: "h-8 w-36", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: ops.map((op) => (_jsx(SelectItem, { value: op, children: OP_LABELS[op] ?? op }, op))) })] }), showValue && (_jsx(_Fragment, { children: def?.kind === "enum" && def.options ? (_jsxs(Select, { value: typeof leaf.value === "string" ? leaf.value : "", onValueChange: (v) => onChange({ ...leaf, value: v }), children: [_jsx(SelectTrigger, { className: "h-8 flex-1", children: _jsx(SelectValue, { placeholder: "value" }) }), _jsx(SelectContent, { children: def.options.map((o) => (_jsx(SelectItem, { value: o.value, children: o.label }, o.value))) })] })) : (_jsx(Input, { className: "h-8 flex-1", type: def?.kind === "number" ? "number" : def?.kind === "date" ? "date" : "text", value: (leaf.value ?? ""), onChange: (e) => onChange({ ...leaf, value: e.target.value }), placeholder: "value" })) })), _jsx("button", { type: "button", onClick: onRemove, className: "h-8 w-8 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted", "aria-label": "Remove filter", children: _jsx(X, { className: "h-3.5 w-3.5" }) })] }));
}
