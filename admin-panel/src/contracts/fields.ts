import type { ReactNode } from "react";

/** FieldDescriptor — one entry in a form or list column set.
 *  Kept narrow and declarative so plugins can target it with `define…`.         */
export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "email"
  | "url"
  | "phone"
  | "boolean"
  | "date"
  | "datetime"
  | "enum"
  | "multi-enum"
  | "reference"
  | "json"
  | "custom";

export interface EnumOption {
  readonly value: string;
  readonly label: string;
  readonly intent?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
}

/** Runtime context passed to dynamic field predicates — has current user + role + permission helpers. */
export interface FieldPredicateContext {
  record: Record<string, unknown>;
  user?: { id?: string; roles?: readonly string[]; email?: string };
  /** True if the user has the named permission on the current resource. */
  hasPermission?: (perm: string) => boolean;
}

export interface FieldDescriptor {
  /** Field name on the record. */
  readonly name: string;
  /** Display label. Falls back to titlecased name. */
  readonly label?: string;
  readonly kind: FieldKind;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly placeholder?: string;
  readonly help?: string;
  readonly options?: readonly EnumOption[];
  /** For "reference" — the resource id to resolve the display value from. */
  readonly referenceTo?: string;
  /** For "currency" — default ISO-4217 code. */
  readonly currency?: string;
  /** For custom fields — render callback (receives value + change handler). */
  readonly render?: (ctx: FieldRenderContext) => ReactNode;
  /** Client-side validator — returns an error string or null. */
  readonly validate?: (value: unknown, record: Record<string, unknown>) => string | null;
  /** Hide from forms but keep in list views (e.g. computed read-only fields). */
  readonly formHidden?: boolean;
  readonly listHidden?: boolean;

  /* ---- ERPNext-parity dynamic controls ---- */

  /** Show this field only when this predicate returns true (given the record
   *  being edited). Use for conditional visibility — e.g. "if status ===
   *  'cancelled' then show reason". */
  readonly visibleWhen?: (ctx: FieldPredicateContext) => boolean;
  /** Mark required dynamically based on other fields. */
  readonly requiredWhen?: (ctx: FieldPredicateContext) => boolean;
  /** Mark readonly dynamically. */
  readonly readonlyWhen?: (ctx: FieldPredicateContext) => boolean;
  /** Field-level view permission. When false, the field is hidden. */
  readonly canView?: (ctx: FieldPredicateContext) => boolean;
  /** Field-level edit permission. When false, rendered as read-only. */
  readonly canEdit?: (ctx: FieldPredicateContext) => boolean;
  /** Default value when creating a new record (field-level default,
   *  alternative to form-level `defaults`). Can be a value or a function of
   *  the partial record being constructed. */
  readonly defaultValue?:
    | unknown
    | ((record: Record<string, unknown>) => unknown);
  /** Description / long-form help shown below the field. */
  readonly description?: string;
  /** Placeholder unit (e.g. "kg", "%") shown after the input. */
  readonly unit?: string;
  /** Grid column span for this field inside its section (1-3). Defaults to
   *  1 inside a 3-col section. Use `"full"` for full-width. */
  readonly colSpan?: 1 | 2 | 3 | "full";
}

export interface FieldRenderContext {
  value: unknown;
  record: Record<string, unknown>;
  onChange: (next: unknown) => void;
  disabled?: boolean;
  invalid?: boolean;
}
