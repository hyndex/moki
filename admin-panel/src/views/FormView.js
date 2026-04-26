import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { z } from "zod";
import { ChevronDown, ChevronRight } from "lucide-react";
import * as Icons from "lucide-react";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { FormField } from "@/admin-primitives/FormField";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/admin-primitives/Card";
import { ErrorState } from "@/admin-primitives/ErrorState";
import { Button } from "@/primitives/Button";
import { useRuntime } from "@/runtime/context";
import { useRecord } from "@/runtime/hooks";
import { FieldInput } from "./FieldInput";
import { navigateTo } from "./useRoute";
import { cn } from "@/lib/cn";
import { CustomFieldsSection } from "@/admin-primitives/CustomFieldsSection";
import { useFieldMetadata } from "@/runtime/useFieldMetadata";
export function FormViewRenderer({ view, id, returnPath, basePath, }) {
    const runtime = useRuntime();
    const { data: existing, loading, error } = useRecord(view.resource, id);
    // Initial values merge defaults, section field-level defaultValue, and existing record.
    const initialDefaults = React.useMemo(() => {
        const base = { ...(view.defaults ?? {}) };
        for (const section of view.sections) {
            for (const f of section.fields) {
                if (f.defaultValue !== undefined && base[f.name] === undefined) {
                    base[f.name] =
                        typeof f.defaultValue === "function"
                            ? f.defaultValue(base)
                            : f.defaultValue;
                }
            }
        }
        return base;
    }, [view]);
    const [values, setValues] = React.useState(initialDefaults);
    const [errors, setErrors] = React.useState({});
    const [submitting, setSubmitting] = React.useState(false);
    const [dirty, setDirty] = React.useState(false);
    // Section collapse state — key: section.id. Seeded from `collapsible` flag.
    const [collapsedMap, setCollapsedMap] = React.useState(() => {
        const m = {};
        for (const s of view.sections) {
            if (s.collapsible === "collapsed")
                m[s.id] = true;
        }
        return m;
    });
    React.useEffect(() => {
        if (existing) {
            setValues(existing);
            setDirty(false);
        }
        else if (!id) {
            setValues(initialDefaults);
        }
    }, [existing, id, initialDefaults]);
    if (error)
        return (_jsx(ErrorState, { error: error, title: "Record failed to load", onRetry: () => runtime.resources.refresh(view.resource) }));
    const setField = (name, value) => {
        setDirty(true);
        setValues((v) => ({ ...v, [name]: value }));
        if (errors[name])
            setErrors((e) => ({ ...e, [name]: "" }));
    };
    const predicateCtx = (record) => ({
        record,
        // user + hasPermission resolution delegated to runtime.permissions when
        // available at request time. For now we surface record only — predicates
        // operate on record shape, which covers the bulk of ERPNext-parity
        // use cases (conditional visibility, required-when, etc.).
        user: undefined,
        hasPermission: undefined,
    });
    const handleSubmit = async (evt) => {
        evt?.preventDefault();
        const ctx = predicateCtx(values);
        const { ok, errors: errs, cleaned } = validateForm(view, values, ctx);
        setErrors(errs);
        if (!ok) {
            runtime.actions.toast({
                title: "Please fix the highlighted fields",
                intent: "danger",
            });
            return;
        }
        setSubmitting(true);
        try {
            if (id) {
                await runtime.resources.update(view.resource, id, cleaned);
                runtime.actions.toast({
                    title: "Saved",
                    description: "Record updated successfully.",
                    intent: "success",
                });
            }
            else {
                const created = await runtime.resources.create(view.resource, cleaned);
                runtime.actions.toast({
                    title: "Created",
                    description: "Record created successfully.",
                    intent: "success",
                });
                navigateTo(`${basePath}/${String(created.id)}`);
                return;
            }
            navigateTo(returnPath);
        }
        catch (err) {
            runtime.actions.toast({
                title: "Save failed",
                description: err instanceof Error ? err.message : "Unknown error.",
                intent: "danger",
            });
        }
        finally {
            setSubmitting(false);
        }
    };
    const toggleSection = (sid) => setCollapsedMap((m) => ({ ...m, [sid]: !m[sid] }));
    return (_jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", noValidate: true, children: [_jsx(PageHeader, { title: id ? view.title : `New ${view.title}`, description: view.description, actions: _jsxs(_Fragment, { children: [_jsx(Button, { type: "button", variant: "ghost", onClick: () => navigateTo(returnPath), disabled: submitting, children: "Cancel" }), _jsx(Button, { type: "submit", variant: "primary", loading: submitting, disabled: !dirty && !!id, children: id ? "Save changes" : "Create" })] }) }), _jsx(CustomFieldsBlock, { resource: view.resource, values: values, onChange: setField }), view.sections.map((section) => {
                const ctx = predicateCtx(values);
                if (section.visibleWhen && !section.visibleWhen({ record: values, user: ctx.user })) {
                    return null;
                }
                const collapsible = Boolean(section.collapsible);
                const collapsed = collapsible && collapsedMap[section.id];
                const SectionIcon = section.icon
                    ? (Icons[section.icon])
                    : null;
                return (_jsxs(Card, { children: [(section.title || section.description) && (_jsx(CardHeader, { className: cn(collapsible && "cursor-pointer select-none"), onClick: collapsible ? () => toggleSection(section.id) : undefined, children: _jsxs("div", { className: "flex items-start gap-2 w-full", children: [collapsible && (_jsx("span", { className: "mt-0.5 text-text-muted", children: collapsed ? (_jsx(ChevronRight, { className: "h-4 w-4" })) : (_jsx(ChevronDown, { className: "h-4 w-4" })) })), SectionIcon && (_jsx(SectionIcon, { className: "h-4 w-4 text-text-muted mt-0.5" })), _jsxs("div", { className: "flex-1", children: [section.title && _jsx(CardTitle, { children: section.title }), section.description && (_jsx(CardDescription, { children: section.description }))] })] }) })), !collapsed && (_jsx(CardContent, { children: _jsx(SectionFields, { section: section, values: values, errors: errors, loading: loading && !!id, ctx: ctx, onFieldChange: setField }) }))] }, section.id));
            })] }));
}
function SectionFields({ section, values, errors, loading, ctx, onFieldChange, }) {
    const visibleFields = section.fields.filter((f) => isFieldVisible(f, ctx));
    return (_jsx("div", { className: cn("grid gap-4", section.columns === 3
            ? "grid-cols-1 md:grid-cols-3"
            : section.columns === 2
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1"), children: visibleFields.map((f) => {
            const required = f.required || (f.requiredWhen ? f.requiredWhen(ctx) : false);
            const fieldReadonly = f.readonly ||
                (f.readonlyWhen ? f.readonlyWhen(ctx) : false) ||
                (f.canEdit ? !f.canEdit(ctx) : false);
            return (_jsx("div", { className: cn(f.colSpan === "full" && "md:col-span-full", f.colSpan === 2 && "md:col-span-2", f.colSpan === 3 && "md:col-span-3"), children: _jsx(FormField, { label: f.label ?? humanize(f.name), required: required, help: f.description ?? f.help, error: errors[f.name], children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1", children: _jsx(FieldInput, { field: { ...f, required, readonly: fieldReadonly }, value: values[f.name], onChange: (v) => onFieldChange(f.name, v), record: values, invalid: !!errors[f.name], disabled: loading || fieldReadonly }) }), f.unit && (_jsx("span", { className: "text-xs text-text-muted whitespace-nowrap", children: f.unit }))] }) }) }, f.name));
        }) }));
}
function isFieldVisible(f, ctx) {
    if (f.formHidden)
        return false;
    if (f.canView && !f.canView(ctx))
        return false;
    if (f.visibleWhen && !f.visibleWhen(ctx))
        return false;
    return true;
}
function validateForm(view, values, ctx) {
    const errors = {};
    const cleaned = { ...values };
    for (const section of view.sections) {
        if (section.visibleWhen &&
            !section.visibleWhen({ record: values, user: ctx.user }))
            continue;
        for (const f of section.fields) {
            if (!isFieldVisible(f, ctx))
                continue;
            const raw = values[f.name];
            const required = f.required || (f.requiredWhen ? f.requiredWhen(ctx) : false);
            if (required && (raw === undefined || raw === null || raw === "")) {
                errors[f.name] = `${f.label ?? humanize(f.name)} is required`;
                continue;
            }
            if (f.validate && raw !== undefined) {
                const v = f.validate(raw, values);
                if (v) {
                    errors[f.name] = v;
                    continue;
                }
            }
            if (f.kind === "email" && typeof raw === "string" && raw) {
                if (!z.string().email().safeParse(raw).success) {
                    errors[f.name] = "Enter a valid email";
                }
            }
            if (f.kind === "url" && typeof raw === "string" && raw) {
                if (!z.string().url().safeParse(raw).success) {
                    errors[f.name] = "Enter a valid URL";
                }
            }
            if (f.kind === "json" && typeof raw === "string" && raw.trim() !== "") {
                try {
                    cleaned[f.name] = JSON.parse(raw);
                }
                catch {
                    errors[f.name] = "Invalid JSON";
                }
            }
        }
    }
    return { ok: Object.keys(errors).length === 0, errors, cleaned };
}
function humanize(field) {
    return field
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .replace(/_/g, " ")
        .trim();
}
/** Wraps the platform's CustomFieldsSection in the form's Card
 *  visual language so it lines up with the Zod-derived sections.
 *  Only renders when the resource has at least one custom field —
 *  the inner component returns null otherwise, so this card adds
 *  nothing to the DOM for resources without custom fields. */
function CustomFieldsBlock({ resource, values, onChange, }) {
    const { fields } = useFieldMetadata(resource);
    // Only render the Card when there are custom fields. Avoids an
    // empty "Custom fields" header on resources with none.
    if (fields.length === 0)
        return null;
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Custom fields" }), _jsx(CardDescription, { children: "Workspace-defined fields. Manage these in Settings \u2192 Custom fields." })] }), _jsx(CardContent, { children: _jsx(CustomFieldsSection, { resource: resource, values: values, onChange: onChange, title: "" }) })] }));
}
