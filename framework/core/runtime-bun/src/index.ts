import { readFile } from "node:fs/promises";

export const packageId = "runtime-bun" as const;
export const packageDisplayName = "Runtime Bun" as const;
export const packageDescription = "Bun runtime wrapper utilities and environment helpers." as const;

export type RuntimeCapabilityName =
  | "bun-runtime"
  | "bun-serve"
  | "bun-file"
  | "bun-sql"
  | "bun-spawn"
  | "abort-timeout";

export type RuntimeInfo = {
  version: string;
  revision: string;
  platform: string;
  arch: string;
  capabilities: RuntimeCapabilities;
};

export type RuntimeCapabilities = Record<RuntimeCapabilityName, boolean>;

export type RuntimeLifecycleHook = () => Promise<void> | void;

export type RuntimeLifecycleHooks = {
  onStart(hook: RuntimeLifecycleHook): () => void;
  onShutdown(hook: RuntimeLifecycleHook): () => void;
  startup(): Promise<void>;
  shutdown(): Promise<void>;
  readonly state: "idle" | "starting" | "running" | "stopping" | "stopped";
};

export type RuntimeEnvSnapshotOptions = {
  env?: Record<string, string | undefined>;
  include?: string[] | undefined;
  exclude?: string[] | undefined;
  redact?: string[] | undefined;
};

export type RuntimeEnvSnapshot = {
  values: Readonly<Record<string, string>>;
  redacted: Readonly<Record<string, string>>;
};

export type FetchWithTimeoutOptions = RequestInit & {
  timeoutMs?: number | undefined;
  allowHosts?: string[] | undefined;
  fetchImpl?: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | undefined;
};

export class RuntimeError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RuntimeError";
    this.code = code;
  }
}

export class MissingEnvironmentVariableError extends RuntimeError {
  readonly variableName: string;

  constructor(variableName: string) {
    super("runtime.env.missing", `Missing required environment variable '${variableName}'`);
    this.name = "MissingEnvironmentVariableError";
    this.variableName = variableName;
  }
}

export class RuntimeCapabilityError extends RuntimeError {
  readonly capability: RuntimeCapabilityName;

  constructor(capability: RuntimeCapabilityName) {
    super("runtime.capability.missing", `Runtime capability '${capability}' is not available`);
    this.name = "RuntimeCapabilityError";
    this.capability = capability;
  }
}

export class RuntimeTimeoutError extends RuntimeError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super("runtime.timeout", `Operation exceeded timeout of ${timeoutMs}ms`);
    this.name = "RuntimeTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class RuntimeFetchHostError extends RuntimeError {
  readonly host: string;

  constructor(host: string) {
    super("runtime.fetch.host", `Host '${host}' is not allowed by the runtime allowlist`);
    this.name = "RuntimeFetchHostError";
    this.host = host;
  }
}

export function hasBunRuntime(): boolean {
  return typeof Bun !== "undefined";
}

export function getRuntimeCapabilities(): RuntimeCapabilities {
  return Object.freeze({
    "bun-runtime": hasBunRuntime(),
    "bun-serve": typeof Bun !== "undefined" && typeof Bun.serve === "function",
    "bun-file": typeof Bun !== "undefined" && typeof Bun.file === "function",
    "bun-sql": typeof Bun !== "undefined" && "SQL" in Bun,
    "bun-spawn": typeof Bun !== "undefined" && typeof Bun.spawn === "function",
    "abort-timeout": typeof AbortSignal.timeout === "function"
  });
}

export function getRuntimeInfo(): RuntimeInfo {
  return {
    version: typeof Bun !== "undefined" ? Bun.version : "unknown",
    revision: typeof Bun !== "undefined" ? Bun.revision : "unknown",
    platform: process.platform,
    arch: process.arch,
    capabilities: getRuntimeCapabilities()
  };
}

export function assertRuntimeCapability(capability: RuntimeCapabilityName): true {
  if (!getRuntimeCapabilities()[capability]) {
    throw new RuntimeCapabilityError(capability);
  }
  return true;
}

export function getOptionalEnv(
  name: string,
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const value = env[name];
  return value === undefined || value === "" ? undefined : value;
}

export function getEnv(
  name: string,
  fallback?: string,
  env: Record<string, string | undefined> = process.env
): string {
  const value = getOptionalEnv(name, env);
  if (value !== undefined) {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new MissingEnvironmentVariableError(name);
}

export function createDeterministicEnvSnapshot(options: RuntimeEnvSnapshotOptions = {}): RuntimeEnvSnapshot {
  const env = options.env ?? process.env;
  const include = options.include ? new Set(options.include) : null;
  const exclude = new Set(options.exclude ?? []);
  const redactPatterns = options.redact ?? ["password", "secret", "token", "key"];

  const values = Object.fromEntries(
    Object.entries(env)
      .filter(([key, value]) => value !== undefined && (!include || include.has(key)) && !exclude.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, String(value)])
  );

  const redacted = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, shouldRedact(key, redactPatterns) ? "[redacted]" : value])
  );

  return Object.freeze({
    values: Object.freeze(values),
    redacted: Object.freeze(redacted)
  });
}

export async function readTextFile(filePath: string): Promise<string> {
  if (typeof Bun !== "undefined" && typeof Bun.file === "function") {
    return Bun.file(filePath).text();
  }
  return readFile(filePath, "utf8");
}

export async function readJsonFile<TValue>(filePath: string): Promise<TValue> {
  return JSON.parse(await readTextFile(filePath)) as TValue;
}

export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  assertPositiveTimeout(timeoutMs);
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => {
    controller.abort(new RuntimeTimeoutError(timeoutMs));
  }, timeoutMs);
  return controller.signal;
}

export async function withTimeout<TValue>(
  operation: (signal: AbortSignal) => Promise<TValue> | TValue,
  timeoutMs: number
): Promise<TValue> {
  const signal = createTimeoutSignal(timeoutMs);
  try {
    return await operation(signal);
  } catch (error) {
    if (signal.aborted) {
      throw new RuntimeTimeoutError(timeoutMs);
    }
    throw error;
  }
}

export async function fetchWithTimeout(input: RequestInfo | URL, options: FetchWithTimeoutOptions = {}): Promise<Response> {
  const { timeoutMs = 30_000, allowHosts, fetchImpl = fetch, signal, ...requestInit } = options;
  const target = typeof input === "string" || input instanceof URL ? new URL(String(input)) : new URL(input.url);
  assertAllowedHost(target, allowHosts);

  const controller = new AbortController();
  const signals = [signal, createTimeoutSignal(timeoutMs), controller.signal].filter(Boolean) as AbortSignal[];
  const cleanup = bindAbortSignals(signals, controller);

  try {
    return await fetchImpl(input, {
      ...requestInit,
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new RuntimeTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    cleanup();
  }
}

export async function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (milliseconds < 0) {
    throw new RuntimeError("runtime.sleep.invalid", "sleep duration must be non-negative");
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, milliseconds);

    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(
        signal?.reason instanceof Error ? signal.reason : new RuntimeError("runtime.sleep.aborted", "sleep aborted")
      );
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function createRuntimeLifecycleHooks(): RuntimeLifecycleHooks {
  const startupHooks: RuntimeLifecycleHook[] = [];
  const shutdownHooks: RuntimeLifecycleHook[] = [];
  let state: RuntimeLifecycleHooks["state"] = "idle";

  return {
    get state() {
      return state;
    },
    onStart(hook) {
      startupHooks.push(hook);
      return () => removeHook(startupHooks, hook);
    },
    onShutdown(hook) {
      shutdownHooks.push(hook);
      return () => removeHook(shutdownHooks, hook);
    },
    async startup() {
      if (state === "running") {
        return;
      }
      state = "starting";
      for (const hook of startupHooks) {
        await hook();
      }
      state = "running";
    },
    async shutdown() {
      if (state === "stopped") {
        return;
      }
      state = "stopping";
      for (const hook of [...shutdownHooks].reverse()) {
        await hook();
      }
      state = "stopped";
    }
  };
}

function assertAllowedHost(target: URL, allowHosts?: string[]): void {
  if (!allowHosts || allowHosts.length === 0) {
    return;
  }

  const normalizedAllowedHosts = allowHosts.map((entry) => entry.toLowerCase());
  if (!normalizedAllowedHosts.includes(target.host.toLowerCase())) {
    throw new RuntimeFetchHostError(target.host);
  }
}

function bindAbortSignals(signals: AbortSignal[], controller: AbortController): () => void {
  const listeners = signals.map((currentSignal) => {
    const listener = () => {
      controller.abort(currentSignal.reason);
    };
    currentSignal.addEventListener("abort", listener, { once: true });
    if (currentSignal.aborted) {
      controller.abort(currentSignal.reason);
    }
    return { currentSignal, listener };
  });

  return () => {
    for (const { currentSignal, listener } of listeners) {
      currentSignal.removeEventListener("abort", listener);
    }
  };
}

function removeHook(collection: RuntimeLifecycleHook[], hook: RuntimeLifecycleHook): void {
  const index = collection.indexOf(hook);
  if (index >= 0) {
    collection.splice(index, 1);
  }
}

function shouldRedact(key: string, patterns: string[]): boolean {
  const normalizedKey = key.toLowerCase();
  return patterns.some((pattern) => normalizedKey.includes(pattern.toLowerCase()));
}

function assertPositiveTimeout(timeoutMs: number): void {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RuntimeError("runtime.timeout.invalid", "timeoutMs must be a positive finite number");
  }
}
