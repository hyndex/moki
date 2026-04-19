import type { ResourceDefinition } from "@platform/schema";

import { createAsyncFieldValidationAdapter as createUiAsyncFieldValidationAdapter, createDirtyStateGuard as createUiDirtyStateGuard } from "@platform/form";

export const packageId = "admin-formview" as const;
export const packageDisplayName = "Admin Form View" as const;
export const packageDescription = "Form/detail DSLs and resource-derived admin form helpers." as const;

export type FormSectionDefinition = {
  section: string;
  fields: string[];
  readonly?: boolean | undefined;
};

export type FieldVisibilityRule = {
  field: string;
  permission: string;
  whenDenied?: "hidden" | "readonly" | "masked";
};

export type FieldMaskRule = {
  field: string;
  mask: "partial" | "full";
};

export type FormActionDefinition = {
  id: string;
  action: string;
  permission?: string | undefined;
};

export type FormViewDefinition = {
  id: string;
  resource: string;
  layout: FormSectionDefinition[];
  actions: FormActionDefinition[];
  fieldRules?: FieldVisibilityRule[] | undefined;
  maskRules?: FieldMaskRule[] | undefined;
};

export type DetailViewDefinition = {
  id: string;
  resource: string;
  layout: FormSectionDefinition[];
  fieldRules?: FieldVisibilityRule[] | undefined;
  maskRules?: FieldMaskRule[] | undefined;
};

export function defineFormView(definition: FormViewDefinition): FormViewDefinition {
  return Object.freeze({
    ...definition,
    layout: [...definition.layout].sort((left, right) => left.section.localeCompare(right.section)),
    actions: [...definition.actions].sort((left, right) => left.id.localeCompare(right.id)),
    fieldRules: [...(definition.fieldRules ?? [])].sort((left, right) => left.field.localeCompare(right.field)),
    maskRules: [...(definition.maskRules ?? [])].sort((left, right) => left.field.localeCompare(right.field))
  });
}

export function defineDetailView(definition: DetailViewDefinition): DetailViewDefinition {
  return Object.freeze({
    ...definition,
    layout: [...definition.layout].sort((left, right) => left.section.localeCompare(right.section)),
    fieldRules: [...(definition.fieldRules ?? [])].sort((left, right) => left.field.localeCompare(right.field)),
    maskRules: [...(definition.maskRules ?? [])].sort((left, right) => left.field.localeCompare(right.field))
  });
}

export function createDirtyStateGuard<TValues>(initial: TValues) {
  return createUiDirtyStateGuard(initial);
}

export function createAsyncFieldValidationAdapter<TValue>(
  validate: Parameters<typeof createUiAsyncFieldValidationAdapter<TValue>>[0]
) {
  return createUiAsyncFieldValidationAdapter(validate);
}

export function createFormViewFromResource(resource: ResourceDefinition): FormViewDefinition {
  const allFields = Object.keys(resource.fields);
  const metadataFields = allFields.filter((field) => field.endsWith("At") || field === "id" || field === "tenantId");
  const primaryFields = allFields.filter((field) => !metadataFields.includes(field));

  return defineFormView({
    id: `${resource.id}.auto-form`,
    resource: resource.id,
    layout: [
      {
        section: "Basics",
        fields: primaryFields
      },
      {
        section: "Metadata",
        fields: metadataFields,
        readonly: true
      }
    ],
    actions: []
  });
}

export function createDetailViewFromResource(resource: ResourceDefinition): DetailViewDefinition {
  const form = createFormViewFromResource(resource);
  return defineDetailView({
    id: `${resource.id}.auto-detail`,
    resource: resource.id,
    layout: form.layout.map((section) => ({
      ...section,
      readonly: true
    }))
  });
}
