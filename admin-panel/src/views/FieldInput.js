import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Input } from "@/primitives/Input";
import { Textarea } from "@/primitives/Textarea";
import { Checkbox } from "@/primitives/Checkbox";
import { Switch } from "@/primitives/Switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/primitives/Select";
export function FieldInput({ field, value, onChange, record, invalid, disabled, }) {
    const readOnly = disabled || field.readonly;
    if (field.render) {
        return _jsx(_Fragment, { children: field.render({ value, record, onChange, invalid, disabled: readOnly }) });
    }
    switch (field.kind) {
        case "textarea":
            return (_jsx(Textarea, { value: value ?? "", onChange: (e) => onChange(e.target.value), placeholder: field.placeholder, invalid: invalid, disabled: readOnly }));
        case "number":
        case "currency":
            return (_jsx(Input, { type: "number", value: value == null ? "" : String(value), onChange: (e) => onChange(e.target.value === "" ? null : Number(e.target.value)), placeholder: field.placeholder, invalid: invalid, disabled: readOnly }));
        case "email":
            return (_jsx(Input, { type: "email", value: value ?? "", onChange: (e) => onChange(e.target.value), placeholder: field.placeholder, invalid: invalid, disabled: readOnly }));
        case "url":
            return (_jsx(Input, { type: "url", value: value ?? "", onChange: (e) => onChange(e.target.value), placeholder: field.placeholder, invalid: invalid, disabled: readOnly }));
        case "phone":
            return (_jsx(Input, { type: "tel", value: value ?? "", onChange: (e) => onChange(e.target.value), placeholder: field.placeholder, invalid: invalid, disabled: readOnly }));
        case "date":
            return (_jsx(Input, { type: "date", value: value ?? "", onChange: (e) => onChange(e.target.value || null), invalid: invalid, disabled: readOnly }));
        case "datetime":
            return (_jsx(Input, { type: "datetime-local", value: value ?? "", onChange: (e) => onChange(e.target.value || null), invalid: invalid, disabled: readOnly }));
        case "boolean":
            return (_jsxs("div", { className: "flex items-center gap-2 h-field-h", children: [_jsx(Switch, { checked: !!value, onCheckedChange: (v) => onChange(v), disabled: readOnly }), _jsx("span", { className: "text-sm text-text-secondary", children: value ? "Enabled" : "Disabled" })] }));
        case "enum":
            return (_jsxs(Select, { value: value ?? "", onValueChange: (v) => onChange(v), disabled: readOnly, children: [_jsx(SelectTrigger, { invalid: invalid, children: _jsx(SelectValue, { placeholder: field.placeholder ?? "Select…" }) }), _jsx(SelectContent, { children: field.options?.map((opt) => (_jsx(SelectItem, { value: opt.value, children: opt.label }, opt.value))) })] }));
        case "multi-enum":
            return (_jsx("div", { className: "flex flex-col gap-1.5", children: field.options?.map((opt) => {
                    const arr = Array.isArray(value) ? value : [];
                    const checked = arr.includes(opt.value);
                    return (_jsxs("label", { className: "inline-flex items-center gap-2 text-sm text-text-primary cursor-pointer", children: [_jsx(Checkbox, { checked: checked, onCheckedChange: () => {
                                    const next = new Set(arr);
                                    checked ? next.delete(opt.value) : next.add(opt.value);
                                    onChange(Array.from(next));
                                }, disabled: readOnly }), opt.label] }, opt.value));
                }) }));
        case "json":
            return (_jsx(Textarea, { rows: 6, className: "font-mono text-xs", value: typeof value === "string"
                    ? value
                    : value == null
                        ? ""
                        : JSON.stringify(value, null, 2), onChange: (e) => onChange(e.target.value), invalid: invalid, disabled: readOnly }));
        case "text":
        default:
            return (_jsx(Input, { type: "text", value: value ?? "", onChange: (e) => onChange(e.target.value), placeholder: field.placeholder, invalid: invalid, disabled: readOnly }));
    }
}
