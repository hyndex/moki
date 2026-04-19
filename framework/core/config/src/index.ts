import type * as z from "zod";

export const packageId = "config" as const;
export const packageDisplayName = "Config" as const;
export const packageDescription = "Typed platform configuration loaders." as const;

const SECRET_REFERENCE = Symbol.for("platform.config.secret-ref");

export type ConfigSecretReference = {
  readonly [SECRET_REFERENCE]: true;
  readonly ref: string;
};

export type ConfigSourceKind = "inline" | "env" | "file" | "computed";

export type ConfigSource<TValue extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  kind: ConfigSourceKind;
  load(): Promise<TValue> | TValue;
};

export type ConfigSecretResolver = (reference: string) => Promise<string> | string;

export type ConfigLayerInput<TValue extends Record<string, unknown> = Record<string, unknown>> =
  | ConfigSource<TValue>
  | TValue;

export type ConfigValidationIssue = {
  path: string;
  message: string;
  code: string;
};

export type ConfigResolutionOptions<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  profile?: string | undefined;
  layers?: ConfigLayerInput[] | undefined;
  env?: Record<string, string | undefined> | undefined;
  secretResolver?: ConfigSecretResolver | undefined;
  redactKeys?: string[] | undefined;
};

export type ResolvedConfig<TValue = unknown> = {
  profile: string;
  value: Readonly<TValue>;
  sources: ReadonlyArray<{ id: string; kind: ConfigSourceKind | "inline"; keys: string[] }>;
  redactedSnapshot: Readonly<Record<string, unknown>>;
};

export class ConfigValidationError extends Error {
  readonly issues: ConfigValidationIssue[];

  constructor(issues: ConfigValidationIssue[]) {
    super(`Configuration validation failed with ${issues.length} issue(s)`);
    this.name = "ConfigValidationError";
    this.issues = issues;
  }
}

export function defineConfigSchema<TSchema extends z.ZodTypeAny>(schema: TSchema): TSchema {
  return schema;
}

export function defineConfigSource<TValue extends Record<string, unknown>>(source: ConfigSource<TValue>): ConfigSource<TValue> {
  return Object.freeze(source);
}

export function secretRef(reference: string): ConfigSecretReference {
  return Object.freeze({
    [SECRET_REFERENCE]: true as const,
    ref: reference
  });
}

export async function resolveConfig<TSchema extends z.ZodTypeAny>({
  schema,
  profile = "default",
  layers = [],
  env = process.env,
  secretResolver,
  redactKeys = ["password", "secret", "token", "key"]
}: ConfigResolutionOptions<TSchema>): Promise<ResolvedConfig<z.infer<TSchema>>> {
  const normalizedLayers: ConfigLayerInput[] = [
    defineConfigSource({
      id: "env",
      kind: "env",
      load: () => envToObject(env)
    }),
    ...layers
  ];

  const sourceMetadata: Array<{ id: string; kind: ConfigSourceKind | "inline"; keys: string[] }> = [];
  let merged: Record<string, unknown> = {};

  for (const [index, layer] of normalizedLayers.entries()) {
    const loaded = await loadLayer(layer);
    const resolved = await resolveSecretsInObject(loaded, secretResolver);
    merged = mergeConfigLayers(merged, resolved);
    sourceMetadata.push({
      id: isConfigSource(layer) ? layer.id : `inline:${index}`,
      kind: isConfigSource(layer) ? layer.kind : "inline",
      keys: Object.keys(resolved).sort((left, right) => left.localeCompare(right))
    });
  }

  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    throw new ConfigValidationError(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message
      }))
    );
  }

  const value = deepFreeze(parsed.data) as Readonly<z.infer<TSchema>>;
  return Object.freeze({
    profile,
    value,
    sources: Object.freeze(sourceMetadata),
    redactedSnapshot: Object.freeze(redactObject(value as Record<string, unknown>, redactKeys))
  });
}

export async function loadConfig<TSchema extends z.ZodTypeAny>(
  options: ConfigResolutionOptions<TSchema>
): Promise<z.infer<TSchema>> {
  const resolved = await resolveConfig(options);
  return resolved.value as z.infer<TSchema>;
}

export function mergeConfigLayers<TValue extends Record<string, unknown>>(...layers: TValue[]): TValue {
  return layers.reduce<TValue>((accumulator, layer) => deepMerge(accumulator, layer), {} as TValue);
}

function isConfigSource<TValue extends Record<string, unknown>>(value: ConfigLayerInput<TValue>): value is ConfigSource<TValue> {
  return typeof value === "object" && value !== null && "id" in value && "kind" in value && "load" in value;
}

async function loadLayer<TValue extends Record<string, unknown>>(layer: ConfigLayerInput<TValue>): Promise<TValue> {
  if (isConfigSource(layer)) {
    return layer.load();
  }
  return layer;
}

async function resolveSecretsInObject(
  value: Record<string, unknown>,
  secretResolver?: ConfigSecretResolver
): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(value).map(async ([key, currentValue]) => [key, await resolveSecretValue(currentValue, secretResolver)] as const)
  );
  return Object.fromEntries(entries);
}

async function resolveSecretValue(value: unknown, secretResolver?: ConfigSecretResolver): Promise<unknown> {
  if (isSecretReference(value)) {
    if (!secretResolver) {
      throw new ConfigValidationError([
        {
          path: value.ref,
          code: "missing-secret-resolver",
          message: `Secret reference '${value.ref}' requires a resolver`
        }
      ]);
    }
    return secretResolver(value.ref);
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((entry) => resolveSecretValue(entry, secretResolver)));
  }

  if (isPlainObject(value)) {
    return resolveSecretsInObject(value, secretResolver);
  }

  return value;
}

function deepMerge<TValue extends Record<string, unknown>>(left: TValue, right: TValue): TValue {
  const result: Record<string, unknown> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value);
      continue;
    }
    result[key] = value;
  }
  return result as TValue;
}

function redactObject(value: Record<string, unknown>, redactKeys: string[]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, currentValue]) => {
        if (shouldRedactKey(key, redactKeys)) {
          return [key, "[redacted]"];
        }
        if (Array.isArray(currentValue)) {
          const redactedItems = (currentValue as unknown[]).map((entry) =>
            isPlainObject(entry) ? redactObject(entry, redactKeys) : entry
          );
          return [key, redactedItems];
        }
        if (isPlainObject(currentValue)) {
          return [key, redactObject(currentValue, redactKeys)];
        }
        return [key, currentValue];
      })
  );
}

function envToObject(env: Record<string, string | undefined>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value])
  );
}

function isSecretReference(value: unknown): value is ConfigSecretReference {
  return typeof value === "object" && value !== null && SECRET_REFERENCE in value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shouldRedactKey(key: string, redactKeys: string[]): boolean {
  const normalizedKey = key.toLowerCase();
  return redactKeys.some((entry) => normalizedKey.includes(entry.toLowerCase()));
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry);
    }
    return Object.freeze(value);
  }

  if (isPlainObject(value)) {
    for (const nestedValue of Object.values(value)) {
      deepFreeze(nestedValue);
    }
    return Object.freeze(value);
  }

  return value;
}
