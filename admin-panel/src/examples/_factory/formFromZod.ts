import type { ZodTypeAny } from "zod";
import { z } from "zod";
import type { FormView, FormSection } from "@/contracts/views";
import type { FieldDescriptor, FieldKind } from "@/contracts/fields";
import { defineFormView } from "@/builders";

/** Auto-generate a FormView from a Zod object schema.
 *
 *  Used for hand-rolled `defineResource({ schema })` resources (e.g. the CRM
 *  and Sales extended resources) that need a "New…" form without writing
 *  every field by hand.
 *
 *  Each Zod shape entry becomes a FieldDescriptor. The `overrides` map lets
 *  callers tweak labels, widgets, enum options, placeholders, etc. without
 *  re-declaring the whole field list.
 */

export interface FormFromZodArgs {
  /** Form view id — by convention `<resource>.form`. */
  id: string;
  /** Form title shown in the header. */
  title: string;
  description?: string;
  /** Resource id this form operates on. */
  resource: string;
  /** The Zod object schema for the resource. */
  schema: z.ZodObject<Record<string, ZodTypeAny>>;
  /** Per-field overrides keyed by field name. */
  overrides?: Record<string, Partial<FieldDescriptor>>;
  /** Fields to exclude from the form entirely (e.g. `id`, computed fields). */
  exclude?: readonly string[];
  /** Defaults when creating a new record. */
  defaults?: Record<string, unknown>;
  /** Section title shown above the fields. */
  sectionTitle?: string;
  /** Number of columns for the form grid. Default 2. */
  columns?: 1 | 2 | 3;
}

export function formViewFromZod(args: FormFromZodArgs): FormView {
  const excluded = new Set(args.exclude ?? ["id"]);
  const shape = args.schema.shape;
  const fields: FieldDescriptor[] = [];

  for (const [name, zod] of Object.entries(shape)) {
    if (excluded.has(name)) continue;
    const base = inferField(name, zod);
    const override = args.overrides?.[name] ?? {};
    fields.push({ ...base, ...override });
  }

  const section: FormSection = {
    id: "details",
    title: args.sectionTitle ?? "Details",
    columns: args.columns ?? 2,
    fields,
  };

  return defineFormView({
    id: args.id,
    title: args.title,
    description: args.description,
    resource: args.resource,
    defaults: args.defaults,
    sections: [section],
  });
}

/* ---- Zod → FieldDescriptor ---- */

function inferField(name: string, zod: ZodTypeAny): FieldDescriptor {
  const required = !zod.isOptional();
  const innerType = unwrap(zod);

  const label = humanize(name);
  const base: FieldDescriptor = {
    name,
    label,
    kind: zodKind(innerType, name),
    required,
  };

  // Enum options
  if (innerType._def.typeName === "ZodEnum") {
    const vals = innerType._def.values as string[];
    return {
      ...base,
      options: vals.map((v) => ({ value: v, label: humanize(v) })),
    };
  }

  // Multi-enum — array of strings with optional enum discriminator
  if (innerType._def.typeName === "ZodArray") {
    const inner = innerType._def.type;
    if (inner._def.typeName === "ZodEnum") {
      const vals = inner._def.values as string[];
      return {
        ...base,
        kind: "multi-enum",
        options: vals.map((v) => ({ value: v, label: humanize(v) })),
      };
    }
    // Array of strings → tag-style text input (fallback to json/textarea for now)
    return { ...base, kind: "json" };
  }

  return base;
}

/** Peel z.optional / z.nullable / z.default wrappers. */
function unwrap(zod: ZodTypeAny): ZodTypeAny {
  const def = (zod as unknown as { _def: { typeName: string; innerType?: ZodTypeAny } })._def;
  if (!def || !def.innerType) return zod;
  if (
    def.typeName === "ZodOptional" ||
    def.typeName === "ZodNullable" ||
    def.typeName === "ZodDefault"
  ) {
    return unwrap(def.innerType);
  }
  return zod;
}

function zodKind(zod: ZodTypeAny, name: string): FieldKind {
  const t = (zod as unknown as { _def: { typeName: string } })._def.typeName;
  switch (t) {
    case "ZodString": {
      // name-based sniffing for common patterns
      const lc = name.toLowerCase();
      if (lc === "email") return "email";
      if (lc.includes("url") || lc === "website" || lc === "domain") return "url";
      if (lc.includes("phone")) return "phone";
      if (lc.endsWith("at") || lc.endsWith("date") || lc.endsWith("day")) return "date";
      if (
        lc === "description" ||
        lc === "notes" ||
        lc === "body" ||
        lc === "bio" ||
        lc === "memo"
      )
        return "textarea";
      return "text";
    }
    case "ZodNumber":
      if (
        name.toLowerCase().includes("amount") ||
        name.toLowerCase().includes("price") ||
        name.toLowerCase().includes("revenue") ||
        name.toLowerCase().includes("value") ||
        name.toLowerCase().includes("budget") ||
        name.toLowerCase().includes("spent") ||
        name.toLowerCase().includes("cost") ||
        name.toLowerCase().includes("limit")
      )
        return "currency";
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodDate":
      return "datetime";
    case "ZodEnum":
    case "ZodNativeEnum":
      return "enum";
    case "ZodArray":
      return "multi-enum";
    case "ZodObject":
      return "json";
    default:
      return "text";
  }
}

function humanize(s: string): string {
  return s
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}
