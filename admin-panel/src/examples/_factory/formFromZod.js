import { defineFormView } from "@/builders";
export function formViewFromZod(args) {
    const excluded = new Set(args.exclude ?? ["id"]);
    const shape = args.schema.shape;
    const fields = [];
    for (const [name, zod] of Object.entries(shape)) {
        if (excluded.has(name))
            continue;
        const base = inferField(name, zod);
        const override = args.overrides?.[name] ?? {};
        fields.push({ ...base, ...override });
    }
    const section = {
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
function inferField(name, zod) {
    const required = !zod.isOptional();
    const innerType = unwrap(zod);
    const label = humanize(name);
    const base = {
        name,
        label,
        kind: zodKind(innerType, name),
        required,
    };
    // Enum options
    if (innerType._def.typeName === "ZodEnum") {
        const vals = innerType._def.values;
        return {
            ...base,
            options: vals.map((v) => ({ value: v, label: humanize(v) })),
        };
    }
    // Multi-enum — array of strings with optional enum discriminator
    if (innerType._def.typeName === "ZodArray") {
        const inner = innerType._def.type;
        if (inner._def.typeName === "ZodEnum") {
            const vals = inner._def.values;
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
function unwrap(zod) {
    const def = zod._def;
    if (!def || !def.innerType)
        return zod;
    if (def.typeName === "ZodOptional" ||
        def.typeName === "ZodNullable" ||
        def.typeName === "ZodDefault") {
        return unwrap(def.innerType);
    }
    return zod;
}
function zodKind(zod, name) {
    const t = zod._def.typeName;
    switch (t) {
        case "ZodString": {
            // name-based sniffing for common patterns
            const lc = name.toLowerCase();
            if (lc === "email")
                return "email";
            if (lc.includes("url") || lc === "website" || lc === "domain")
                return "url";
            if (lc.includes("phone"))
                return "phone";
            if (lc.endsWith("at") || lc.endsWith("date") || lc.endsWith("day"))
                return "date";
            if (lc === "description" ||
                lc === "notes" ||
                lc === "body" ||
                lc === "bio" ||
                lc === "memo")
                return "textarea";
            return "text";
        }
        case "ZodNumber":
            if (name.toLowerCase().includes("amount") ||
                name.toLowerCase().includes("price") ||
                name.toLowerCase().includes("revenue") ||
                name.toLowerCase().includes("value") ||
                name.toLowerCase().includes("budget") ||
                name.toLowerCase().includes("spent") ||
                name.toLowerCase().includes("cost") ||
                name.toLowerCase().includes("limit"))
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
function humanize(s) {
    return s
        .replace(/([A-Z])/g, " $1")
        .replace(/[-_]/g, " ")
        .replace(/^./, (c) => c.toUpperCase())
        .replace(/\s+/g, " ")
        .trim();
}
