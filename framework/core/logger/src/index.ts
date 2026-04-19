import pino, { type Logger, type LoggerOptions } from "pino";

export const packageId = "logger" as const;
export const packageDisplayName = "Logger" as const;
export const packageDescription = "Structured Pino logging wrapper." as const;

export type LogContext = {
  requestId?: string | undefined;
  tenantId?: string | undefined;
  actorId?: string | undefined;
  pluginId?: string | undefined;
  jobId?: string | undefined;
  queue?: string | undefined;
  traceId?: string | undefined;
};

export type RedactionPolicy = {
  paths: string[];
  censor?: string | ((value: unknown, path: string[]) => unknown) | undefined;
};

export type PlatformLogger = Logger;

export function createRedactionPolicy(policy: Partial<RedactionPolicy> = {}): RedactionPolicy {
  return Object.freeze({
    paths: [...new Set(policy.paths ?? ["password", "secret", "token", "*.password", "*.secret", "*.token"])].sort((left, right) =>
      left.localeCompare(right)
    ),
    censor: policy.censor ?? "[redacted]"
  });
}

export function mergeRedactionPolicies(...policies: RedactionPolicy[]): RedactionPolicy {
  return createRedactionPolicy({
    paths: policies.flatMap((policy) => policy.paths),
    censor: policies.find((policy) => policy.censor)?.censor
  });
}

export function createPlatformLogger(options: LoggerOptions = {}): PlatformLogger {
  const redactionPolicy = normalizeRedactionPolicy(options.redact);
  return pino({
    level: options.level ?? "info",
    base: {
      service: "platform",
      ...options.base
    },
    timestamp: options.timestamp ?? false,
    redact: toPinoRedactionOptions(redactionPolicy),
    formatters: {
      level(label) {
        return { level: label };
      },
      log(object) {
        return sanitizeLogPayload(object);
      }
    }
  });
}

export function withLogContext<TContext extends LogContext>(logger: PlatformLogger, context: TContext): PlatformLogger {
  return logger.child(context);
}

export function createLogContext(input: LogContext): Readonly<LogContext> {
  return Object.freeze({
    ...input
  });
}

export function sanitizeLogPayload(payload: unknown, policy = createRedactionPolicy()): Record<string, unknown> {
  if (!isPlainObject(payload)) {
    return {
      value: payload
    };
  }

  return redactValue(payload, policy);
}

export function redactValue(value: Record<string, unknown>, policy: RedactionPolicy): Record<string, unknown> {
  return redactObject(value, policy);
}

function redactObject(value: Record<string, unknown>, policy: RedactionPolicy, parentPath?: string): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, currentValue]) => {
      const path = parentPath ? `${parentPath}.${key}` : key;
      if (shouldRedactKey(path, policy.paths)) {
        return [key, typeof policy.censor === "string" ? policy.censor : "[redacted]"];
      }
      if (currentValue instanceof Error) {
        return [key, serializeError(currentValue)];
      }
      if (Array.isArray(currentValue)) {
        const redactedItems = (currentValue as unknown[]).map((entry) =>
          isPlainObject(entry) ? redactObject(entry, policy, path) : entry instanceof Error ? serializeError(entry) : entry
        );
        return [
          key,
          redactedItems
        ];
      }
      if (isPlainObject(currentValue)) {
        return [key, redactObject(currentValue, policy, path)];
      }
      return [key, currentValue];
    })
  );
}

export function serializeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

function normalizeRedactionPolicy(redact: LoggerOptions["redact"]): RedactionPolicy {
  if (!redact || Array.isArray(redact) || "paths" in redact) {
    return mergeRedactionPolicies(createRedactionPolicy(), createRedactionPolicy(Array.isArray(redact) ? { paths: redact } : redact));
  }
  return createRedactionPolicy();
}

function toPinoRedactionOptions(policy: RedactionPolicy): NonNullable<LoggerOptions["redact"]> {
  return {
    paths: policy.paths,
    ...(policy.censor !== undefined ? { censor: policy.censor } : {})
  };
}

function shouldRedactKey(key: string, paths: string[]): boolean {
  const normalizedKey = key.toLowerCase();
  return paths.some((entry) => {
    const normalizedEntry = entry.toLowerCase();
    const wildcardEntry = normalizedEntry.replace("*.", "");
    return normalizedKey === normalizedEntry || normalizedKey.endsWith(`.${wildcardEntry}`) || normalizedKey === wildcardEntry;
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
