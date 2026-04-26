import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Filter, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { Popover, PopoverContent, PopoverTrigger, } from "@/primitives/Popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/primitives/Select";
import { OPERATORS, operatorsFor, describeFilter } from "@/lib/filterEngine";
const EMPTY_AND = { and: [] };
/** Normalise `value` into an AND-group root so the UI can always edit it. */
function normalize(v) {
    if (!v)
        return { and: [] };
    if ("and" in v)
        return v;
    if ("or" in v)
        return { and: [v] };
    return { and: [v] };
}
/** Drop the root AND if it's empty, otherwise return it as-is. */
function simplify(root) {
    if (root.and.length === 0)
        return undefined;
    if (root.and.length === 1)
        return root.and[0];
    return root;
}
/** The main trigger — opens a popover with the builder. */
export function QueryBuilder({ fields, value, onChange, className, triggerLabel = "Filter", }) {
    const count = countLeaves(value);
    return (_jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "sm", iconLeft: _jsx(Filter, { className: "h-3.5 w-3.5" }), className: className, "aria-label": "Advanced filter", children: [triggerLabel, count > 0 && (_jsx("span", { className: "ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded bg-accent text-accent-fg text-[10px] font-semibold tabular-nums", children: count }))] }) }), _jsx(PopoverContent, { className: "w-[560px] p-0", align: "start", children: _jsx(QueryBuilderInner, { fields: fields, value: value, onChange: onChange }) })] }));
}
function QueryBuilderInner({ fields, value, onChange, }) {
    const root = normalize(value);
    const update = (next) => onChange(simplify(next));
    const addLeaf = () => {
        const defaultField = fields[0];
        if (!defaultField)
            return;
        const ops = operatorsFor(defaultField.kind);
        const op = ops[0]?.op ?? "eq";
        const leaf = { field: defaultField.field, op, value: "" };
        update({ and: [...root.and, leaf] });
    };
    const addGroup = (mode) => {
        const group = mode === "or" ? { or: [] } : { and: [] };
        update({ and: [...root.and, group] });
    };
    const removeAt = (idx) => {
        const next = [...root.and];
        next.splice(idx, 1);
        update({ and: next });
    };
    const replaceAt = (idx, next) => {
        const arr = [...root.and];
        if (!next)
            arr.splice(idx, 1);
        else
            arr[idx] = next;
        update({ and: arr });
    };
    return (_jsxs("div", { className: "flex flex-col gap-0", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 border-b border-border", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-wider text-text-primary", children: "Advanced filter" }), _jsx("div", { className: "flex items-center gap-1", children: _jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(X, { className: "h-3 w-3" }), disabled: root.and.length === 0, onClick: () => onChange(undefined), children: "Clear" }) })] }), _jsxs("div", { className: "p-2 flex flex-col gap-2 max-h-[420px] overflow-y-auto", children: [root.and.length === 0 && (_jsx("div", { className: "text-xs text-text-muted px-2 py-3 text-center", children: "No filters. Add a condition to start." })), root.and.map((child, idx) => (_jsxs("div", { className: "flex items-start gap-1", children: [idx > 0 && (_jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-text-muted px-1 pt-1.5", children: "AND" })), _jsx("div", { className: "flex-1", children: "and" in child || "or" in child ? (_jsx(GroupEditor, { fields: fields, value: child, onChange: (next) => replaceAt(idx, next) })) : (_jsx(LeafEditor, { fields: fields, value: child, onChange: (next) => replaceAt(idx, next) })) }), _jsx("button", { type: "button", className: "h-7 w-7 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-2", onClick: () => removeAt(idx), "aria-label": "Remove condition", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) })] }, idx)))] }), _jsxs("div", { className: "flex items-center gap-1 px-2 py-2 border-t border-border", children: [_jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(Plus, { className: "h-3 w-3" }), onClick: addLeaf, children: "Add condition" }), _jsx(Button, { variant: "ghost", size: "xs", onClick: () => addGroup("or"), children: "+ OR group" }), _jsx(Button, { variant: "ghost", size: "xs", onClick: () => addGroup("and"), children: "+ AND group" })] })] }));
}
/* ---------------- Group editor ---------------- */
function GroupEditor({ fields, value, onChange, }) {
    const mode = "or" in value ? "or" : "and";
    const children = "or" in value ? value.or : value.and;
    const replace = (next) => {
        if (next.length === 0)
            onChange(undefined);
        else
            onChange(mode === "or" ? { or: next } : { and: next });
    };
    const add = () => {
        const defaultField = fields[0];
        if (!defaultField)
            return;
        const ops = operatorsFor(defaultField.kind);
        const leaf = {
            field: defaultField.field,
            op: ops[0]?.op ?? "eq",
            value: "",
        };
        replace([...children, leaf]);
    };
    const toggleMode = () => {
        if (mode === "or")
            onChange({ and: children });
        else
            onChange({ or: children });
    };
    return (_jsxs("div", { className: "border border-border rounded-md bg-surface-1 p-2 flex flex-col gap-1.5", children: [_jsxs("button", { type: "button", className: "text-[10px] font-semibold uppercase tracking-wider text-accent hover:underline self-start", onClick: toggleMode, children: [mode, " group \u2014 click to toggle"] }), children.map((c, i) => (_jsxs("div", { className: "flex items-start gap-1", children: [i > 0 && (_jsx("span", { className: "text-[10px] font-semibold uppercase tracking-wider text-text-muted pt-1.5", children: mode.toUpperCase() })), _jsx("div", { className: "flex-1", children: "and" in c || "or" in c ? (_jsx(GroupEditor, { fields: fields, value: c, onChange: (next) => {
                                const arr = [...children];
                                if (!next)
                                    arr.splice(i, 1);
                                else
                                    arr[i] = next;
                                replace(arr);
                            } })) : (_jsx(LeafEditor, { fields: fields, value: c, onChange: (next) => {
                                const arr = [...children];
                                if (!next)
                                    arr.splice(i, 1);
                                else
                                    arr[i] = next;
                                replace(arr);
                            } })) }), _jsx("button", { type: "button", className: "h-7 w-7 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-2", onClick: () => {
                            const arr = [...children];
                            arr.splice(i, 1);
                            replace(arr);
                        }, "aria-label": "Remove", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) })] }, i))), _jsx(Button, { variant: "ghost", size: "xs", iconLeft: _jsx(Plus, { className: "h-3 w-3" }), onClick: add, children: "Add" })] }));
}
/* ---------------- Leaf editor ---------------- */
function LeafEditor({ fields, value, onChange, }) {
    const field = fields.find((f) => f.field === value.field) ?? fields[0];
    const ops = operatorsFor(field?.kind ?? "text");
    const opDef = OPERATORS.find((o) => o.op === value.op);
    const arity = opDef?.arity ?? 1;
    const onFieldChange = (name) => {
        const f = fields.find((x) => x.field === name) ?? field;
        const nextOps = operatorsFor(f.kind);
        // Keep op if compatible, else pick first
        const nextOp = nextOps.find((o) => o.op === value.op)?.op ?? nextOps[0]?.op ?? "eq";
        onChange({ field: name, op: nextOp, value: "" });
    };
    const onOpChange = (op) => {
        const nextOpDef = OPERATORS.find((o) => o.op === op);
        const nextArity = nextOpDef?.arity ?? 1;
        let nextValue = value.value;
        if (nextArity === 0)
            nextValue = undefined;
        else if (nextArity === 2 && !Array.isArray(value.value))
            nextValue = ["", ""];
        onChange({ field: value.field, op: op, value: nextValue });
    };
    const setV = (v) => onChange({ field: value.field, op: value.op, value: v });
    return (_jsxs("div", { className: "flex items-center gap-1.5 rounded-md border border-border bg-surface-0 px-1.5 py-1", children: [_jsxs(Select, { value: value.field, onValueChange: onFieldChange, children: [_jsx(SelectTrigger, { className: "h-7 min-w-[140px] text-xs", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: fields.map((f) => (_jsx(SelectItem, { value: f.field, children: f.label }, f.field))) })] }), _jsxs(Select, { value: value.op, onValueChange: onOpChange, children: [_jsx(SelectTrigger, { className: "h-7 min-w-[130px] text-xs", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: ops.map((o) => (_jsx(SelectItem, { value: o.op, children: o.label }, o.op))) })] }), arity === 0 && (_jsx("span", { className: "inline-flex h-7 items-center rounded-sm border border-border bg-surface-1 px-2 text-[11px] italic text-text-muted", title: "This operator has no value \u2014 the engine evaluates the condition on its own (e.g. 'this month' is dynamic).", children: "self-contained" })), arity === 1 && (_jsx(LeafValueInput, { field: field, op: value.op, value: value.value, onChange: setV })), arity === 2 && (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(LeafValueInput, { field: field, op: value.op, value: Array.isArray(value.value) ? value.value[0] : "", onChange: (v) => {
                            const arr = Array.isArray(value.value) ? [...value.value] : ["", ""];
                            arr[0] = v;
                            setV(arr);
                        } }), _jsx("span", { className: "text-xs text-text-muted", children: "to" }), _jsx(LeafValueInput, { field: field, op: value.op, value: Array.isArray(value.value) ? value.value[1] : "", onChange: (v) => {
                            const arr = Array.isArray(value.value) ? [...value.value] : ["", ""];
                            arr[1] = v;
                            setV(arr);
                        } })] }))] }));
}
function LeafValueInput({ field, op, value, onChange, }) {
    if (!field)
        return null;
    const isArrayOp = op === "in" || op === "nin";
    if (isArrayOp) {
        // Multi-value — comma-separated input for simplicity
        const str = Array.isArray(value) ? value.join(",") : String(value ?? "");
        return (_jsx(Input, { className: "h-7 text-xs min-w-[160px]", placeholder: "a, b, c", value: str, onChange: (e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean)) }));
    }
    if (op === "last_n_days") {
        return (_jsx(Input, { className: "h-7 text-xs w-20", type: "number", min: 1, placeholder: "N", value: value === undefined || value === null ? "" : String(value), onChange: (e) => onChange(e.target.value ? Number(e.target.value) : undefined) }));
    }
    if (field.kind === "enum" && field.options) {
        return (_jsxs(Select, { value: String(value ?? ""), onValueChange: (v) => onChange(v), children: [_jsx(SelectTrigger, { className: "h-7 min-w-[140px] text-xs", children: _jsx(SelectValue, { placeholder: "Value" }) }), _jsx(SelectContent, { children: field.options.map((o) => (_jsx(SelectItem, { value: o.value, children: o.label }, o.value))) })] }));
    }
    if (field.kind === "boolean") {
        return (_jsxs(Select, { value: String(value ?? "true"), onValueChange: (v) => onChange(v === "true"), children: [_jsx(SelectTrigger, { className: "h-7 min-w-[90px] text-xs", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "true", children: "True" }), _jsx(SelectItem, { value: "false", children: "False" })] })] }));
    }
    if (field.kind === "date" || field.kind === "datetime") {
        return (_jsx(Input, { className: "h-7 text-xs w-[140px]", type: "date", value: typeof value === "string" ? value : "", onChange: (e) => onChange(e.target.value || undefined) }));
    }
    if (field.kind === "number" || field.kind === "currency") {
        return (_jsx(Input, { className: "h-7 text-xs w-[110px]", type: "number", value: value === undefined || value === null ? "" : String(value), onChange: (e) => onChange(e.target.value === "" ? undefined : Number(e.target.value)) }));
    }
    return (_jsx(Input, { className: "h-7 text-xs min-w-[140px]", value: value === undefined || value === null ? "" : String(value), onChange: (e) => onChange(e.target.value), placeholder: field.label }));
}
/* ---------------- Utilities ---------------- */
function countLeaves(tree) {
    if (!tree)
        return 0;
    if ("and" in tree)
        return tree.and.reduce((a, c) => a + countLeaves(c), 0);
    if ("or" in tree)
        return tree.or.reduce((a, c) => a + countLeaves(c), 0);
    return 1;
}
export { describeFilter };
