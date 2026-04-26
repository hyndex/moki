import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useFieldMetadata } from "@/runtime/useFieldMetadata";
import { Input } from "@/primitives/Input";
export function CustomFieldsSection({ resource, values, onChange, title = "Custom fields", readOnly, compact, }) {
    const { fields, loading } = useFieldMetadata(resource);
    if (loading)
        return null;
    if (fields.length === 0)
        return null;
    // Group fields by their `options.group` (defaults to "Custom").
    const groups = new Map();
    for (const f of fields) {
        const g = f.options.group ?? title;
        const list = groups.get(g) ?? [];
        list.push(f);
        groups.set(g, list);
    }
    return (_jsx("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: Array.from(groups.entries()).map(([group, items]) => (_jsxs("fieldset", { style: {
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: 12,
                margin: 0,
            }, children: [_jsx("legend", { style: {
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        padding: "0 6px",
                    }, children: group }), _jsx("div", { style: {
                        display: "grid",
                        gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))",
                        gap: 12,
                    }, children: items.map((f) => (_jsx(CustomFieldRow, { field: f, value: values[f.key], onChange: (v) => onChange(f.key, v), readOnly: readOnly }, f.id))) })] }, group))) }));
}
function CustomFieldRow({ field, value, onChange, readOnly }) {
    return (_jsxs("label", { style: {
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: 13,
        }, children: [_jsxs("span", { style: { fontWeight: 500, color: "#374151" }, children: [field.label, field.required && _jsx("span", { style: { color: "#dc2626", marginLeft: 2 }, children: "*" })] }), _jsx(CustomFieldInput, { field: field, value: value, onChange: onChange, readOnly: readOnly }), field.options.helpText && !readOnly && (_jsx("span", { style: { fontSize: 11, color: "#9ca3af" }, children: field.options.helpText }))] }));
}
function CustomFieldInput({ field, value, onChange, readOnly }) {
    const k = field.kind;
    const display = (v) => {
        if (v === null || v === undefined)
            return "";
        if (typeof v === "string" || typeof v === "number")
            return String(v);
        return JSON.stringify(v);
    };
    if (readOnly) {
        return (_jsx("span", { style: { color: "#111827", fontWeight: 400, padding: "4px 0" }, children: value === undefined || value === null || value === ""
                ? _jsx("span", { style: { color: "#9ca3af" }, children: "\u2014" })
                : k === "boolean"
                    ? value ? "Yes" : "No"
                    : k === "multiselect" && Array.isArray(value)
                        ? value.join(", ")
                        : k === "url" && typeof value === "string"
                            ? _jsx("a", { href: value, target: "_blank", rel: "noopener noreferrer", style: { color: "#2563eb" }, children: value })
                            : display(value) }));
    }
    switch (k) {
        case "text":
        case "email":
        case "phone":
        case "url":
            return (_jsx(Input, { type: k === "email" ? "email" : k === "url" ? "url" : "text", value: display(value), onChange: (e) => onChange(e.target.value), maxLength: field.options.maxLength }));
        case "long-text":
            return (_jsx("textarea", { rows: 3, value: display(value), onChange: (e) => onChange(e.target.value), maxLength: field.options.maxLength, style: {
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: "inherit",
                } }));
        case "rich-text":
            // Lightweight — the editor stack uses TipTap inside iframes;
            // surfacing it here would balloon the bundle. Inputs as
            // textarea + persisted as HTML string. Future: lazy-load TipTap
            // for inline rich-text in forms.
            return (_jsx("textarea", { rows: 4, value: display(value), onChange: (e) => onChange(e.target.value), style: {
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: "ui-monospace, monospace",
                } }));
        case "number":
            return (_jsx(Input, { type: "number", value: display(value), min: field.options.min, max: field.options.max, step: field.options.step, onChange: (e) => onChange(e.target.value === "" ? null : Number(e.target.value)) }));
        case "currency":
            return (_jsxs("div", { style: { display: "flex", gap: 4 }, children: [_jsx("span", { style: {
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "0 8px",
                            border: "1px solid #d1d5db",
                            borderRight: 0,
                            borderRadius: "4px 0 0 4px",
                            background: "#f3f4f6",
                            fontSize: 12,
                            color: "#6b7280",
                        }, children: field.options.currency ?? "USD" }), _jsx(Input, { type: "number", value: display(value), step: field.options.step ?? 0.01, onChange: (e) => onChange(e.target.value === "" ? null : Number(e.target.value)), style: { borderRadius: "0 4px 4px 0" } })] }));
        case "boolean":
            return (_jsx("input", { type: "checkbox", checked: value === true, onChange: (e) => onChange(e.target.checked), style: { alignSelf: "flex-start", marginTop: 6 } }));
        case "date":
            return (_jsx(Input, { type: "date", value: typeof value === "string" ? value.slice(0, 10) : "", onChange: (e) => onChange(e.target.value || null) }));
        case "datetime":
            return (_jsx(Input, { type: "datetime-local", value: typeof value === "string" ? value.slice(0, 16) : "", onChange: (e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null) }));
        case "select": {
            const options = field.options.options ?? [];
            return (_jsxs("select", { value: typeof value === "string" ? value : "", onChange: (e) => onChange(e.target.value || null), style: {
                    padding: "6px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: 13,
                    background: "#fff",
                }, children: [_jsx("option", { value: "", children: "\u2014" }), options.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value)))] }));
        }
        case "multiselect": {
            const options = field.options.options ?? [];
            const selected = new Set(Array.isArray(value) ? value : []);
            return (_jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 }, children: options.map((o) => {
                    const isOn = selected.has(o.value);
                    return (_jsx("button", { type: "button", onClick: () => {
                            const next = new Set(selected);
                            if (isOn)
                                next.delete(o.value);
                            else
                                next.add(o.value);
                            onChange(Array.from(next));
                        }, style: {
                            padding: "3px 10px",
                            fontSize: 12,
                            border: `1px solid ${isOn ? (o.color ?? "#2563eb") : "#d1d5db"}`,
                            background: isOn ? (o.color ?? "#dbeafe") : "#fff",
                            color: isOn ? "#fff" : "#111827",
                            borderRadius: 999,
                            cursor: "pointer",
                            fontWeight: 500,
                        }, children: o.label }, o.value));
                }) }));
        }
        case "relation":
            return (_jsx(Input, { type: "text", value: typeof value === "string" ? value : "", onChange: (e) => onChange(e.target.value || null), placeholder: field.options.relationTarget ? `${field.options.relationTarget} id` : "Record id" }));
        case "json":
            return (_jsx("textarea", { rows: 3, value: typeof value === "string" ? value : value ? JSON.stringify(value, null, 2) : "", onChange: (e) => {
                    try {
                        onChange(JSON.parse(e.target.value));
                    }
                    catch {
                        onChange(e.target.value);
                    }
                }, style: {
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: "ui-monospace, monospace",
                } }));
    }
}
