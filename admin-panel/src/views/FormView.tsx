import * as React from "react";
import { z } from "zod";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import * as Icons from "lucide-react";
import type { FormView as FormViewDef, FormSection } from "@/contracts/views";
import type { FieldDescriptor, FieldPredicateContext } from "@/contracts/fields";
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
import { usePropertySetters, type ResourceOverrides, type FieldOverrides } from "@/runtime/usePropertySetters";

export interface FormViewRendererProps {
  view: FormViewDef;
  /** Record id when editing; undefined when creating. */
  id?: string;
  /** Where to return after save/cancel. */
  returnPath: string;
  basePath: string;
}

export function FormViewRenderer({
  view,
  id,
  returnPath,
  basePath,
}: FormViewRendererProps) {
  const runtime = useRuntime();
  const { data: existing, loading, error } = useRecord(view.resource, id);
  // Tenant-scoped property setter overrides (label/required/readonly/
  // hidden/helpText/defaultValue/options/section/position/printHidden).
  // These compose with — and override — the static FieldDescriptor
  // contract from the plugin schema. Empty when no overrides exist.
  const { overrides: propertyOverrides } = usePropertySetters(view.resource);

  // Initial values merge defaults, section field-level defaultValue, and existing record.
  const initialDefaults = React.useMemo(() => {
    const base: Record<string, unknown> = { ...(view.defaults ?? {}) };
    for (const section of view.sections) {
      for (const f of section.fields) {
        if (f.defaultValue !== undefined && base[f.name] === undefined) {
          base[f.name] =
            typeof f.defaultValue === "function"
              ? (f.defaultValue as (r: Record<string, unknown>) => unknown)(base)
              : f.defaultValue;
        }
      }
    }
    return base;
  }, [view]);

  const [values, setValues] = React.useState<Record<string, unknown>>(
    initialDefaults,
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  // Section collapse state — key: section.id. Seeded from `collapsible` flag.
  const [collapsedMap, setCollapsedMap] = React.useState<Record<string, boolean>>(
    () => {
      const m: Record<string, boolean> = {};
      for (const s of view.sections) {
        if (s.collapsible === "collapsed") m[s.id] = true;
      }
      return m;
    },
  );

  React.useEffect(() => {
    if (existing) {
      setValues(existing);
      setDirty(false);
    } else if (!id) {
      setValues(initialDefaults);
    }
  }, [existing, id, initialDefaults]);

  if (error)
    return (
      <ErrorState
        error={error}
        title="Record failed to load"
        onRetry={() => runtime.resources.refresh(view.resource)}
      />
    );

  const setField = (name: string, value: unknown) => {
    setDirty(true);
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: "" }));
  };

  const predicateCtx = (record: Record<string, unknown>): FieldPredicateContext => ({
    record,
    // user + hasPermission resolution delegated to runtime.permissions when
    // available at request time. For now we surface record only — predicates
    // operate on record shape, which covers the bulk of ERPNext-parity
    // use cases (conditional visibility, required-when, etc.).
    user: undefined,
    hasPermission: undefined,
  });

  const handleSubmit = async (evt?: React.FormEvent) => {
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
      } else {
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
    } catch (err) {
      runtime.actions.toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Unknown error.",
        intent: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSection = (sid: string) =>
    setCollapsedMap((m) => ({ ...m, [sid]: !m[sid] }));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <PageHeader
        title={id ? view.title : `New ${view.title}`}
        description={view.description}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              iconLeft={<Settings2 className="h-3.5 w-3.5" />}
              onClick={() => {
                // Open the customization settings deep-linked to this
                // resource. Hash-based routing in the shell preserves
                // the user's place; closing returns here.
                window.location.hash = `/settings/property-setters?resource=${encodeURIComponent(view.resource)}`;
              }}
              title="Customize this form (property setters, custom fields, naming series, print formats)"
            >
              Customize
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigateTo(returnPath)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={!dirty && !!id}
            >
              {id ? "Save changes" : "Create"}
            </Button>
          </>
        }
      />

      {/* Custom fields rendered AFTER the Zod-derived sections so they
          appear at the bottom of the form. Auto-fetched per resource;
          empty render when no custom fields exist for this resource. */}
      <CustomFieldsBlock
        resource={view.resource}
        values={values}
        onChange={setField}
      />
      {view.sections.map((section) => {
        const ctx = predicateCtx(values);
        if (section.visibleWhen && !section.visibleWhen({ record: values, user: ctx.user })) {
          return null;
        }
        const collapsible = Boolean(section.collapsible);
        const collapsed = collapsible && collapsedMap[section.id];
        const SectionIcon = section.icon
          ? ((Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
              section.icon
            ])
          : null;
        return (
          <Card key={section.id}>
            {(section.title || section.description) && (
              <CardHeader
                className={cn(collapsible && "cursor-pointer select-none")}
                onClick={collapsible ? () => toggleSection(section.id) : undefined}
              >
                <div className="flex items-start gap-2 w-full">
                  {collapsible && (
                    <span className="mt-0.5 text-text-muted">
                      {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  )}
                  {SectionIcon && (
                    <SectionIcon className="h-4 w-4 text-text-muted mt-0.5" />
                  )}
                  <div className="flex-1">
                    {section.title && <CardTitle>{section.title}</CardTitle>}
                    {section.description && (
                      <CardDescription>{section.description}</CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
            )}
            {!collapsed && (
              <CardContent>
                <SectionFields
                  section={section}
                  values={values}
                  errors={errors}
                  loading={loading && !!id}
                  ctx={ctx}
                  onFieldChange={setField}
                  propertyOverrides={propertyOverrides}
                />
              </CardContent>
            )}
          </Card>
        );
      })}
    </form>
  );
}

function SectionFields({
  section,
  values,
  errors,
  loading,
  ctx,
  onFieldChange,
  propertyOverrides,
}: {
  section: FormSection;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  loading: boolean;
  ctx: FieldPredicateContext;
  onFieldChange: (name: string, value: unknown) => void;
  propertyOverrides?: ResourceOverrides;
}) {
  // Apply tenant-scoped property setter overrides on top of the static
  // descriptors. We don't mutate the field descriptor in place — we
  // produce a new {field, ov} pair so the original schema stays
  // canonical. Order: filter hidden → sort by overridden position →
  // render with overridden label/required/etc.
  const augmented = section.fields
    .map((f) => ({ field: f, ov: propertyOverrides?.[f.name] ?? {} as FieldOverrides }))
    .filter(({ field, ov }) => {
      if (ov.hidden === true) return false;
      return isFieldVisible(field, ctx);
    })
    .sort((a, b) => {
      const pa = typeof a.ov.position === "number" ? a.ov.position : Number.POSITIVE_INFINITY;
      const pb = typeof b.ov.position === "number" ? b.ov.position : Number.POSITIVE_INFINITY;
      return pa - pb;
    });
  return (
    <div
      className={cn(
        "grid gap-4",
        section.columns === 3
          ? "grid-cols-1 md:grid-cols-3"
          : section.columns === 2
            ? "grid-cols-1 md:grid-cols-2"
            : "grid-cols-1",
      )}
    >
      {augmented.map(({ field: f, ov }) => {
        // Effective label / required / readonly / help text fold in any
        // tenant-scoped property setter overrides.
        const effectiveLabel = (typeof ov.label === "string" ? ov.label : f.label) ?? humanize(f.name);
        const baseRequired = f.required || (f.requiredWhen ? f.requiredWhen(ctx) : false);
        const required = typeof ov.required === "boolean" ? ov.required : baseRequired;
        const baseReadonly =
          f.readonly ||
          (f.readonlyWhen ? f.readonlyWhen(ctx) : false) ||
          (f.canEdit ? !f.canEdit(ctx) : false);
        const fieldReadonly = typeof ov.readonly === "boolean" ? ov.readonly : baseReadonly;
        const helpText = typeof ov.helpText === "string" ? ov.helpText : (f.description ?? f.help);
        const overriddenOptions =
          ov.options && Array.isArray(ov.options)
            ? (ov.options as Array<{ value: string; label: string; color?: string }>)
            : undefined;
        return (
          <div
            key={f.name}
            className={cn(
              f.colSpan === "full" && "md:col-span-full",
              f.colSpan === 2 && "md:col-span-2",
              f.colSpan === 3 && "md:col-span-3",
            )}
          >
            <FormField
              label={effectiveLabel}
              required={required}
              help={helpText}
              error={errors[f.name]}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <FieldInput
                    field={{
                      ...f,
                      label: effectiveLabel,
                      required,
                      readonly: fieldReadonly,
                      ...(overriddenOptions ? { options: overriddenOptions } : {}),
                      ...(ov.defaultValue !== undefined ? { defaultValue: ov.defaultValue } : {}),
                    }}
                    value={values[f.name]}
                    onChange={(v) => onFieldChange(f.name, v)}
                    record={values}
                    invalid={!!errors[f.name]}
                    disabled={loading || fieldReadonly}
                  />
                </div>
                {f.unit && (
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    {f.unit}
                  </span>
                )}
              </div>
            </FormField>
          </div>
        );
      })}
    </div>
  );
}

function isFieldVisible(
  f: FieldDescriptor,
  ctx: FieldPredicateContext,
): boolean {
  if (f.formHidden) return false;
  if (f.canView && !f.canView(ctx)) return false;
  if (f.visibleWhen && !f.visibleWhen(ctx)) return false;
  return true;
}

function validateForm(
  view: FormViewDef,
  values: Record<string, unknown>,
  ctx: FieldPredicateContext,
): {
  ok: boolean;
  errors: Record<string, string>;
  cleaned: Record<string, unknown>;
} {
  const errors: Record<string, string> = {};
  const cleaned: Record<string, unknown> = { ...values };

  for (const section of view.sections) {
    if (
      section.visibleWhen &&
      !section.visibleWhen({ record: values, user: ctx.user })
    )
      continue;

    for (const f of section.fields) {
      if (!isFieldVisible(f, ctx)) continue;
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
        } catch {
          errors[f.name] = "Invalid JSON";
        }
      }
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, cleaned };
}

function humanize(field: string): string {
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
function CustomFieldsBlock({
  resource,
  values,
  onChange,
}: {
  resource: string;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const { fields } = useFieldMetadata(resource);
  // Only render the Card when there are custom fields. Avoids an
  // empty "Custom fields" header on resources with none.
  if (fields.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom fields</CardTitle>
        <CardDescription>
          Workspace-defined fields. Manage these in Settings → Custom fields.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CustomFieldsSection
          resource={resource}
          values={values}
          onChange={onChange}
          title=""
        />
      </CardContent>
    </Card>
  );
}
