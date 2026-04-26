import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "@/primitives/Input";
import { Button } from "@/primitives/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/primitives/Select";
export function FilterBar({ search, searchValue, onSearchChange, filters, filterValues = {}, onFilterChange, className, trailing, }) {
    const activeCount = Object.values(filterValues).filter((v) => v !== undefined && v !== null && v !== "").length;
    return (_jsxs("div", { className: cn("flex items-center gap-2 flex-wrap py-2", className), children: [search && (_jsx("div", { className: "min-w-[220px] flex-1 max-w-sm", children: _jsx(Input, { placeholder: "Search\u2026", prefix: _jsx(Search, { className: "h-3.5 w-3.5" }), value: searchValue ?? "", onChange: (e) => onSearchChange?.(e.target.value) }) })), filters?.map((f) => (_jsx(FilterControl, { filter: f, value: filterValues[f.field], onChange: (v) => onFilterChange?.({ ...filterValues, [f.field]: v }) }, f.field))), activeCount > 0 && (_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => onFilterChange?.({}), iconLeft: _jsx(X, { className: "h-3 w-3" }), children: ["Clear ", activeCount] })), _jsx("div", { className: "ml-auto flex items-center gap-2", children: trailing })] }));
}
function FilterControl({ filter, value, onChange, }) {
    if (filter.kind === "enum") {
        return (_jsxs(Select, { value: value ?? "", onValueChange: (v) => onChange(v === "__all__" ? "" : v), children: [_jsx(SelectTrigger, { className: "h-8 min-w-[140px] w-auto", children: _jsx(SelectValue, { placeholder: filter.label ?? filter.field }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "__all__", children: "All" }), filter.options?.map((opt) => (_jsx(SelectItem, { value: opt.value, children: opt.label }, opt.value)))] })] }));
    }
    if (filter.kind === "boolean") {
        return (_jsxs(Select, { value: value === true ? "true" : value === false ? "false" : "", onValueChange: (v) => onChange(v === "__all__" ? "" : v === "true" ? true : false), children: [_jsx(SelectTrigger, { className: "h-8 min-w-[120px] w-auto", children: _jsx(SelectValue, { placeholder: filter.label ?? filter.field }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "__all__", children: "All" }), _jsx(SelectItem, { value: "true", children: "Yes" }), _jsx(SelectItem, { value: "false", children: "No" })] })] }));
    }
    if (filter.kind === "text") {
        return (_jsx(Input, { placeholder: filter.label ?? filter.field, value: value ?? "", onChange: (e) => onChange(e.target.value), className: "h-8 w-[180px]" }));
    }
    if (filter.kind === "date-range") {
        const v = value ?? {};
        return (_jsxs("div", { className: "flex items-center gap-1 text-sm", children: [_jsx(Input, { type: "date", value: v.from ?? "", onChange: (e) => onChange({ ...v, from: e.target.value || undefined }), className: "h-8 w-[140px]" }), _jsx("span", { className: "text-text-muted", children: "\u2192" }), _jsx(Input, { type: "date", value: v.to ?? "", onChange: (e) => onChange({ ...v, to: e.target.value || undefined }), className: "h-8 w-[140px]" })] }));
    }
    return null;
}
