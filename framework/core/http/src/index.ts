export const packageId = "http" as const;
export const packageDisplayName = "HTTP" as const;
export const packageDescription = "Bun-native HTTP gateway and request context helpers." as const;

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "OPTIONS";

export type RequestContext = {
  requestId: string;
  actorId?: string | undefined;
  tenantId?: string | undefined;
  pluginId?: string | undefined;
  traceId?: string | undefined;
  params: Record<string, string>;
  query: URLSearchParams;
  startedAt: string;
  signal: AbortSignal;
  routeId?: string | undefined;
};

export type HttpRouteDefinition = {
  id: string;
  method: HttpMethod;
  path: string;
  timeoutMs?: number | undefined;
  handler: (request: Request, context: RequestContext) => Promise<Response> | Response;
};

export type HttpMiddleware = (
  request: Request,
  context: RequestContext,
  next: (request: Request, context: RequestContext) => Promise<Response>
) => Promise<Response> | Response;

export type RequestParser<TValue> = (request: Request) => Promise<TValue>;

export type HttpErrorMapper = (error: unknown, context: RequestContext) => Response;

export type HttpServerDefinition = {
  name: string;
  routes: HttpRouteDefinition[];
  middleware?: HttpMiddleware[] | undefined;
  errorMapper?: HttpErrorMapper | undefined;
  defaultTimeoutMs?: number | undefined;
  healthPath?: string | undefined;
  readinessPath?: string | undefined;
  readinessCheck?: (() => Promise<void> | void) | undefined;
};

export type MatchedHttpRoute = {
  route: HttpRouteDefinition;
  params: Record<string, string>;
};

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown> | undefined;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function defineRoute(definition: HttpRouteDefinition): HttpRouteDefinition {
  return Object.freeze(definition);
}

export function defineHttpServer(definition: HttpServerDefinition): HttpServerDefinition {
  const routeIds = definition.routes.map((route) => route.id);
  if (new Set(routeIds).size !== routeIds.length) {
    throw new Error("HTTP route ids must be unique");
  }

  return Object.freeze({
    ...definition,
    routes: [...definition.routes].sort(compareRoutes),
    middleware: [...(definition.middleware ?? [])]
  });
}

export function createRequestContext(
  request: Request,
  overrides: Partial<RequestContext> = {},
  params: Record<string, string> = {}
): RequestContext {
  return {
    requestId: request.headers.get("x-request-id") ?? overrides.requestId ?? crypto.randomUUID(),
    actorId: request.headers.get("x-actor-id") ?? overrides.actorId,
    tenantId: request.headers.get("x-tenant-id") ?? overrides.tenantId,
    pluginId: request.headers.get("x-plugin-id") ?? overrides.pluginId,
    traceId: request.headers.get("x-trace-id") ?? overrides.traceId,
    params,
    query: new URL(request.url).searchParams,
    startedAt: overrides.startedAt ?? new Date().toISOString(),
    signal: overrides.signal ?? request.signal,
    routeId: overrides.routeId
  };
}

export function createHttpHandler(definition: HttpServerDefinition): (request: Request) => Promise<Response> {
  const server = defineHttpServer(definition);
  const middleware = server.middleware ?? [];
  const errorMapper = server.errorMapper ?? defaultHttpErrorMapper;

  return async (request: Request) => {
    const url = new URL(request.url);

    if (url.pathname === (server.healthPath ?? "/healthz")) {
      return jsonResponse({ ok: true, service: server.name });
    }

    if (url.pathname === (server.readinessPath ?? "/readyz")) {
      try {
        await server.readinessCheck?.();
        return jsonResponse({ ok: true, service: server.name, ready: true });
      } catch (error) {
        return errorMapper(
          error instanceof HttpError ? error : new HttpError(503, "http.not-ready", "Service is not ready"),
          createRequestContext(request)
        );
      }
    }

    const matchedRoute = matchHttpRoute(server.routes, request.method as HttpMethod, url.pathname);
    const initialContext = createRequestContext(request, {
      routeId: matchedRoute?.route.id
    }, matchedRoute?.params ?? {});

    if (!matchedRoute) {
      return errorMapper(new HttpError(404, "http.route.not-found", `No route matches ${request.method} ${url.pathname}`), initialContext);
    }

    const timeoutMs = matchedRoute.route.timeoutMs ?? server.defaultTimeoutMs ?? 30_000;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const controller = new AbortController();
    const cleanupAbort = bindAbortSignals([request.signal, timeoutSignal], controller);
    const baseContext = {
      ...initialContext,
      params: matchedRoute.params,
      signal: controller.signal
    } satisfies RequestContext;

    const dispatch = composeMiddleware(middleware, async (nextRequest, nextContext) => matchedRoute.route.handler(nextRequest, nextContext));

    try {
      return await Promise.race([
        dispatch(request, baseContext),
        new Promise<Response>((_, reject) => {
          controller.signal.addEventListener(
            "abort",
            () => {
              reject(new HttpError(504, "http.timeout", `Route '${matchedRoute.route.id}' exceeded ${timeoutMs}ms`));
            },
            { once: true }
          );
        })
      ]);
    } catch (error) {
      if (controller.signal.aborted) {
        return errorMapper(new HttpError(504, "http.timeout", `Route '${matchedRoute.route.id}' exceeded ${timeoutMs}ms`), baseContext);
      }
      return errorMapper(error, baseContext);
    } finally {
      cleanupAbort();
    }
  };
}

export function startHttpServer(
  definition: HttpServerDefinition,
  options: Record<string, unknown> = {}
): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    ...((options as unknown) as Parameters<typeof Bun.serve>[0]),
    fetch: createHttpHandler(definition)
  } as Parameters<typeof Bun.serve>[0]);
}

export function matchHttpRoute(
  routes: HttpRouteDefinition[],
  method: HttpMethod,
  pathname: string
): MatchedHttpRoute | undefined {
  const normalizedPath = normalizePath(pathname);
  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }
    const params = matchPath(route.path, normalizedPath);
    if (params) {
      return {
        route,
        params
      };
    }
  }
  return undefined;
}

export async function parseJsonBody<TValue>(request: Request): Promise<TValue> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(415, "http.body.unsupported-media-type", "Request body must be application/json");
  }
  try {
    return (await request.json()) as TValue;
  } catch (error) {
    throw new HttpError(400, "http.body.invalid-json", "Request body is not valid JSON", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function parseTextBody(request: Request): Promise<string> {
  return request.text();
}

export function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export function problemResponse(error: {
  status: number;
  code: string;
  message: string;
  requestId?: string | undefined;
  details?: Record<string, unknown> | undefined;
}): Response {
  return jsonResponse(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.requestId ? { requestId: error.requestId } : {}),
        ...(error.details ? { details: error.details } : {})
      }
    },
    error.status
  );
}

export function defaultHttpErrorMapper(error: unknown, context: RequestContext): Response {
  if (error instanceof HttpError) {
    return problemResponse({
      status: error.status,
      code: error.code,
      message: error.message,
      requestId: context.requestId,
      details: error.details
    });
  }

  const message = error instanceof Error ? error.message : "Unexpected HTTP error";
  return problemResponse({
    status: 500,
    code: "http.internal-error",
    message,
    requestId: context.requestId
  });
}

function composeMiddleware(
  middleware: HttpMiddleware[],
  terminal: (request: Request, context: RequestContext) => Promise<Response>
): (request: Request, context: RequestContext) => Promise<Response> {
  return middleware.reduceRight<(request: Request, context: RequestContext) => Promise<Response>>(
    (next, currentMiddleware) => async (request, context) => currentMiddleware(request, context, next),
    terminal
  );
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternSegments = normalizePath(pattern).split("/").filter(Boolean);
  const pathSegments = normalizePath(pathname).split("/").filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (const [index, patternSegment] of patternSegments.entries()) {
    const pathSegment = pathSegments[index];
    if (!pathSegment) {
      return null;
    }

    if (patternSegment.startsWith(":")) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      continue;
    }

    if (patternSegment !== pathSegment) {
      return null;
    }
  }

  return params;
}

function bindAbortSignals(signals: AbortSignal[], controller: AbortController): () => void {
  const listeners = signals.map((signal) => {
    const listener = () => {
      controller.abort(signal.reason);
    };
    signal.addEventListener("abort", listener, { once: true });
    if (signal.aborted) {
      controller.abort(signal.reason);
    }
    return { signal, listener };
  });

  return () => {
    for (const { signal, listener } of listeners) {
      signal.removeEventListener("abort", listener);
    }
  };
}

function compareRoutes(left: HttpRouteDefinition, right: HttpRouteDefinition): number {
  const pathComparison = left.path.localeCompare(right.path);
  if (pathComparison !== 0) {
    return pathComparison;
  }
  return left.method.localeCompare(right.method);
}

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}
