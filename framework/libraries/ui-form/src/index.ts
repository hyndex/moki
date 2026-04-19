import { zodResolver } from "@hookform/resolvers/zod";
import { type DefaultValues, type FieldValues, type UseFormReturn, useForm } from "react-hook-form";
import { z } from "zod";

export const packageId = "ui-form" as const;
export const packageDisplayName = "UI Form" as const;
export const packageDescription = "React Hook Form wrapper APIs." as const;

export type PlatformFormOptions<TValues extends FieldValues> = {
  schema: z.ZodType<TValues>;
  defaultValues?: DefaultValues<TValues> | undefined;
  onSubmit: (values: TValues) => Promise<void> | void;
};

export type PlatformFormResult<TValues extends FieldValues> = {
  form: UseFormReturn<TValues>;
  submit: ReturnType<UseFormReturn<TValues>["handleSubmit"]>;
};

export type SubmissionErrorMap = {
  formError?: string | undefined;
  fieldErrors: Record<string, string>;
};

export type PlatformFieldRegistryEntry = {
  kind: string;
  componentId: string;
  supportsReadonly?: boolean | undefined;
  supportsMasked?: boolean | undefined;
};

export type PlatformFieldRegistry = Map<string, PlatformFieldRegistryEntry>;

export type RelationFieldOption = {
  id: string;
  label: string;
  description?: string | undefined;
};

export function usePlatformForm<TValues extends FieldValues>(
  options: PlatformFormOptions<TValues>
): PlatformFormResult<TValues> {
  const form = useForm<TValues>({
    resolver: zodResolver(options.schema),
    ...(options.defaultValues === undefined ? {} : { defaultValues: options.defaultValues })
  });

  return {
    form,
    submit: form.handleSubmit(async (values) => options.onSubmit(values))
  };
}

export function createFormDefaults<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  values: Partial<z.infer<TSchema>>
): z.infer<TSchema> {
  return schema.parse(values);
}

export function mapSubmissionErrors(error: unknown): SubmissionErrorMap {
  if (error instanceof z.ZodError) {
    return {
      fieldErrors: Object.fromEntries(
        error.issues.map((issue) => [issue.path.join("."), issue.message])
      )
    };
  }

  if (typeof error === "object" && error !== null && "fieldErrors" in error) {
    const fieldErrors =
      typeof (error as { fieldErrors?: unknown }).fieldErrors === "object" &&
      (error as { fieldErrors?: unknown }).fieldErrors !== null
        ? Object.fromEntries(
            Object.entries((error as { fieldErrors: Record<string, unknown> }).fieldErrors).map(([key, value]) => [
              key,
              String(value)
            ])
          )
        : {};

    const formError =
      "formError" in error && typeof (error as { formError?: unknown }).formError === "string"
        ? (error as { formError: string }).formError
        : undefined;
    return {
      formError,
      fieldErrors
    };
  }

  if (error instanceof Error) {
    return {
      formError: error.message,
      fieldErrors: {}
    };
  }

  return {
    formError: "Unknown form submission error",
    fieldErrors: {}
  };
}

export function createFieldRegistry(entries: PlatformFieldRegistryEntry[]): PlatformFieldRegistry {
  return new Map(entries.map((entry) => [entry.kind, entry]));
}

export function createRelationFieldAdapter(input: {
  loadOptions: (query: string) => Promise<RelationFieldOption[]> | RelationFieldOption[];
  resolveLabel?: ((id: string) => Promise<string | undefined> | string | undefined) | undefined;
}) {
  return {
    async loadOptions(query: string) {
      return await input.loadOptions(query);
    },
    async resolveLabel(id: string) {
      if (!input.resolveLabel) {
        return undefined;
      }
      return await input.resolveLabel(id);
    }
  };
}

export function createAsyncFieldValidationAdapter<TValue>(
  validate: (value: TValue) => Promise<string | undefined> | string | undefined
) {
  return async (value: TValue) => {
    const result = await validate(value);
    return result ?? true;
  };
}

export function createDirtyStateGuard<TValues>(initial: TValues) {
  let baseline = stableSerialize(initial);
  return {
    isDirty(next: TValues): boolean {
      return stableSerialize(next) !== baseline;
    },
    reset(next: TValues): void {
      baseline = stableSerialize(next);
    }
  };
}

export function resolveFieldPresentation(input: {
  readOnly?: boolean | undefined;
  masked?: boolean | undefined;
}) {
  return {
    readOnly: input.readOnly ?? false,
    masked: input.masked ?? false
  };
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort());
}
