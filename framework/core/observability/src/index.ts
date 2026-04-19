import { SpanStatusCode, context, propagation, trace } from "@opentelemetry/api";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK, type NodeSDKConfiguration } from "@opentelemetry/sdk-node";

export const packageId = "observability" as const;
export const packageDisplayName = "Observability" as const;
export const packageDescription = "OpenTelemetry wrapper and telemetry helpers." as const;

export type TelemetryContext = {
  requestId: string;
  pluginId?: string | undefined;
  tenantId?: string | undefined;
  actorId?: string | undefined;
  bundleId?: string | undefined;
  shellId?: string | undefined;
  environment?: string | undefined;
  releaseId?: string | undefined;
  jobId?: string | undefined;
  queue?: string | undefined;
};

export type TelemetryBootstrapOptions = {
  serviceName: string;
  environment?: string | undefined;
  releaseId?: string | undefined;
  resourceAttributes?: Record<string, string> | undefined;
  sdkConfig?: Omit<NodeSDKConfiguration, "resource"> | undefined;
};

export type TelemetryBootstrap = {
  sdk: NodeSDK;
  resourceAttributes: Readonly<Record<string, string>>;
  start(): Promise<void>;
  shutdown(): Promise<void>;
  readonly started: boolean;
};

export function createTelemetryContext(input: TelemetryContext): Readonly<TelemetryContext> {
  return Object.freeze({
    ...input
  });
}

export function buildSpanAttributes(dimensions: TelemetryContext): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dimensions)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, String(value)])
  );
}

export function createTelemetryBootstrap(options: TelemetryBootstrapOptions): TelemetryBootstrap {
  const resourceAttributes = Object.freeze({
    "service.name": options.serviceName,
    ...(options.environment ? { "deployment.environment": options.environment } : {}),
    ...(options.releaseId ? { "service.version": options.releaseId } : {}),
    ...(options.resourceAttributes ?? {})
  });
  const sdk = new NodeSDK({
    ...(options.sdkConfig ?? {}),
    resource: resourceFromAttributes(resourceAttributes)
  });

  let started = false;
  return {
    sdk,
    resourceAttributes,
    get started() {
      return started;
    },
    async start() {
      await Promise.resolve(sdk.start());
      started = true;
    },
    async shutdown() {
      await sdk.shutdown();
      started = false;
    }
  };
}

export async function withSpan<TValue>(
  name: string,
  dimensions: TelemetryContext,
  operation: () => Promise<TValue> | TValue
): Promise<TValue> {
  const tracer = trace.getTracer("platform");
  const span = tracer.startSpan(name, {
    attributes: buildSpanAttributes(dimensions)
  });

  try {
    const result = await context.with(trace.setSpan(context.active(), span), operation);
    span.setStatus({
      code: SpanStatusCode.OK
    });
    return result;
  } catch (error) {
    recordSpanError(span, error);
    throw error;
  } finally {
    span.end();
  }
}

export function recordSpanError(span: { recordException(error: Error): void; setStatus(input: { code: SpanStatusCode; message?: string }): void }, error: unknown): void {
  const exception = error instanceof Error ? error : new Error(String(error));
  span.recordException(exception);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: exception.message
  });
}

export function injectTelemetryHeaders(activeContext = context.active()): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(activeContext, carrier);
  return carrier;
}

export function extractTelemetryContext(headers: Headers | Record<string, string>, activeContext = context.active()) {
  const carrier = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
  return propagation.extract(activeContext, carrier);
}
