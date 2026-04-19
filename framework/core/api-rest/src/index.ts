import { createHmac, timingSafeEqual } from "node:crypto";

import { createToolContract } from "@platform/ai";
import {
  HttpError,
  type HttpErrorMapper,
  type HttpMiddleware,
  type HttpServerDefinition,
  type RequestContext as HttpRequestContext,
  defineHttpServer,
  defineRoute as defineHttpRoute,
  jsonResponse,
  parseJsonBody
} from "@platform/http";
import { ValidationError } from "@platform/kernel";
import { type ActionDefinition, type ResourceDefinition, executeAction, toJsonSchema } from "@platform/schema";
import { z } from "zod";

export const packageId = "api-rest" as const;
export const packageDisplayName = "API Rest" as const;
export const packageDescription = "REST route generation from resource and action metadata." as const;

export type RestMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type RestRouteDefinition = {
  id: string;
  method: RestMethod;
  path: string;
  permission: string;
  kind: "resource" | "action";
  resourceId?: string;
  actionId?: string;
  operationId: string;
};

export type RestRequestContext = {
  grants: string[];
  actorId?: string;
  tenantId?: string;
  requestId?: string;
};

export type RestJsonValue =
  | null
  | boolean
  | number
  | string
  | RestJsonValue[]
  | { [key: string]: RestJsonValue };

export type ResourceHandlers = {
  list?: (context: RestRequestContext) => Promise<RestJsonValue[]> | RestJsonValue[];
  get?: (id: string, context: RestRequestContext) => Promise<RestJsonValue | null> | RestJsonValue | null;
  create?: (body: unknown, context: RestRequestContext) => Promise<RestJsonValue> | RestJsonValue;
  update?: (id: string, body: unknown, context: RestRequestContext) => Promise<RestJsonValue> | RestJsonValue;
  delete?: (id: string, context: RestRequestContext) => Promise<RestJsonValue> | RestJsonValue;
};

export type RestApiDefinition = {
  basePath: string;
  resources: ResourceDefinition[];
  actions: ActionDefinition[];
  routes: RestRouteDefinition[];
  handlers: Record<string, ResourceHandlers>;
};

export type RestExecutionRequest = {
  method: RestMethod;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
  context: RestRequestContext;
};

export type WebhookEnvelope = {
  event: string;
  payload: string;
  signature: string;
  timestamp: string;
  idempotencyKey: string;
};

export type RestHttpContextFactory = (
  request: Request,
  context: HttpRequestContext
) => Promise<RestRequestContext> | RestRequestContext;

export function createRestApi(input: {
  resources: ResourceDefinition[];
  actions: ActionDefinition[];
  resourceHandlers?: Record<string, ResourceHandlers>;
  basePath?: string;
  allowDeleteResources?: string[];
}): RestApiDefinition {
  const basePath = input.basePath ?? "/api/v1";
  const routes: RestRouteDefinition[] = [];
  const allowDeletes = new Set(input.allowDeleteResources ?? []);

  for (const resource of input.resources) {
    const resourcePath = `${basePath}/${resource.id.split(".").join("/")}`;
    routes.push(
      {
        id: `${resource.id}.list`,
        method: "GET",
        path: resourcePath,
        permission: `${resource.id}.read`,
        kind: "resource",
        resourceId: resource.id,
        operationId: `${resource.id}.list`
      },
      {
        id: `${resource.id}.get`,
        method: "GET",
        path: `${resourcePath}/:id`,
        permission: `${resource.id}.read`,
        kind: "resource",
        resourceId: resource.id,
        operationId: `${resource.id}.get`
      },
      {
        id: `${resource.id}.create`,
        method: "POST",
        path: resourcePath,
        permission: `${resource.id}.write`,
        kind: "resource",
        resourceId: resource.id,
        operationId: `${resource.id}.create`
      },
      {
        id: `${resource.id}.update`,
        method: "PATCH",
        path: `${resourcePath}/:id`,
        permission: `${resource.id}.write`,
        kind: "resource",
        resourceId: resource.id,
        operationId: `${resource.id}.update`
      }
    );

    if (allowDeletes.has(resource.id)) {
      routes.push({
        id: `${resource.id}.delete`,
        method: "DELETE",
        path: `${resourcePath}/:id`,
        permission: `${resource.id}.delete`,
        kind: "resource",
        resourceId: resource.id,
        operationId: `${resource.id}.delete`
      });
    }
  }

  for (const action of input.actions) {
    routes.push({
      id: action.id,
      method: "POST",
      path: buildActionPath(action.id, basePath),
      permission: action.permission,
      kind: "action",
      actionId: action.id,
      operationId: action.id
    });
  }

  return Object.freeze({
    basePath,
    resources: [...input.resources],
    actions: [...input.actions],
    routes: routes.sort(compareRoutes),
    handlers: input.resourceHandlers ?? {}
  });
}

export async function executeRestRequest(api: RestApiDefinition, request: RestExecutionRequest): Promise<unknown> {
  const matchedRoute = matchRestRoute(api, request.method, request.path);
  if (!matchedRoute) {
    throw new ValidationError(`No REST route matches ${request.method} ${request.path}`, [
      {
        code: "rest-route-not-found",
        message: "route not found",
        path: "path"
      }
    ]);
  }

  const route = matchedRoute.route;
  const params = request.params ?? matchedRoute.params;
  assertRoutePermission(route.permission, request.context.grants);

  if (route.kind === "action") {
    const action = api.actions.find((entry) => entry.id === route.actionId);
    if (!action) {
      throw new ValidationError(`Action '${route.actionId}' is not registered`, [
        {
          code: "rest-action-not-found",
          message: "action not found",
          path: "actionId"
        }
      ]);
    }

    return executeAction(action, request.body, {
      ctx: {
        actorId: request.context.actorId,
        tenantId: request.context.tenantId,
        requestId: request.context.requestId
      }
    });
  }

  const resource = api.resources.find((entry) => entry.id === route.resourceId);
  if (!resource) {
    throw new ValidationError(`Resource '${route.resourceId}' is not registered`, [
      {
        code: "rest-resource-not-found",
        message: "resource not found",
        path: "resourceId"
      }
    ]);
  }

  const handlers = api.handlers[resource.id];
  const id = params.id;

  if (route.id.endsWith(".list")) {
    const result = await handlers?.list?.(request.context);
    return validatePublicResponse(`${resource.id}.list`, z.array(resource.contract), result ?? []);
  }

  if (route.id.endsWith(".get")) {
    if (!id) {
      throw missingPathParamError("id");
    }
    const result = await handlers?.get?.(id, request.context);
    if (result === null || result === undefined) {
      return null;
    }
    return validatePublicResponse(`${resource.id}.get`, resource.contract, result);
  }

  if (route.id.endsWith(".create")) {
    const result = await handlers?.create?.(request.body, request.context);
    return validatePublicResponse(`${resource.id}.create`, resource.contract, result);
  }

  if (route.id.endsWith(".update")) {
    if (!id) {
      throw missingPathParamError("id");
    }
    const result = await handlers?.update?.(id, request.body, request.context);
    return validatePublicResponse(`${resource.id}.update`, resource.contract, result);
  }

  if (!id) {
    throw missingPathParamError("id");
  }
  return handlers?.delete?.(id, request.context) ?? { ok: true };
}

export function createRestContextFromHttpRequest(request: Request, context: HttpRequestContext): RestRequestContext {
  return {
    grants: parseGrantHeader(request.headers.get("x-grants")),
    ...(context.actorId ? { actorId: context.actorId } : {}),
    ...(context.tenantId ? { tenantId: context.tenantId } : {}),
    requestId: context.requestId
  };
}

export function createRestHttpServer(input: {
  name: string;
  api: RestApiDefinition;
  resolveContext?: RestHttpContextFactory | undefined;
  middleware?: HttpMiddleware[] | undefined;
  errorMapper?: HttpErrorMapper | undefined;
  defaultTimeoutMs?: number | undefined;
  healthPath?: string | undefined;
  readinessPath?: string | undefined;
  readinessCheck?: (() => Promise<void> | void) | undefined;
}): HttpServerDefinition {
  return defineHttpServer({
    name: input.name,
    middleware: input.middleware,
    errorMapper: input.errorMapper,
    defaultTimeoutMs: input.defaultTimeoutMs,
    healthPath: input.healthPath,
    readinessPath: input.readinessPath,
    readinessCheck: input.readinessCheck,
    routes: input.api.routes.map((route) =>
      defineHttpRoute({
        id: route.id,
        method: route.method,
        path: route.path,
        handler: async (request, context) => {
          const restContext = await (input.resolveContext ?? createRestContextFromHttpRequest)(request, context);
          const body = await parseRestRequestBody(request);

          try {
            const result = await executeRestRequest(input.api, {
              method: route.method,
              path: new URL(request.url).pathname,
              params: context.params,
              body,
              context: restContext
            });
            return jsonResponse(result);
          } catch (error) {
            throw normalizeRestHttpError(error);
          }
        }
      })
    )
  });
}

export function buildOpenApiDocument(
  api: RestApiDefinition,
  metadata: {
    title: string;
    version: string;
    description?: string;
  }
): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of api.routes) {
    const methodKey = route.method.toLowerCase();
    const normalizedPath = route.path.replaceAll(":id", "{id}");
    const existingPath = paths[normalizedPath] ?? {};
    if (route.kind === "action") {
      const action = api.actions.find((entry) => entry.id === route.actionId);
      if (!action) {
        continue;
      }

      existingPath[methodKey] = {
        operationId: route.operationId,
        tags: ["actions"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: toJsonSchema(action.input)
            }
          }
        },
        responses: {
          "200": {
            description: "Successful action response",
            content: {
              "application/json": {
                schema: toJsonSchema(action.output)
              }
            }
          }
        }
      };
      paths[normalizedPath] = existingPath;
      continue;
    }

    const resource = api.resources.find((entry) => entry.id === route.resourceId);
    if (!resource) {
      continue;
    }

    const responseSchema = route.id.endsWith(".list") ? toJsonSchema(z.array(resource.contract)) : toJsonSchema(resource.contract);
    const resourceOperation: Record<string, unknown> = {
      operationId: route.operationId,
      tags: [resource.id],
      responses: {
        "200": {
          description: "Successful resource response",
          content: {
            "application/json": {
              schema: responseSchema
            }
          }
        }
      }
    };

    if (route.method === "POST" || route.method === "PATCH") {
      resourceOperation.requestBody = {
        required: true,
        content: {
            "application/json": {
              schema: toJsonSchema(resource.contract)
            }
          }
      };
    }

    existingPath[methodKey] = resourceOperation;

    paths[normalizedPath] = existingPath;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: metadata.title,
      version: metadata.version,
      description: metadata.description ?? ""
    },
    paths
  };
}

export function createActionToolContracts(actions: ActionDefinition[]): ReturnType<typeof createToolContract>[] {
  return actions.map((action) => createToolContract(action));
}

export function createWebhookEnvelope(input: {
  event: string;
  payload: string;
  secret: string;
  idempotencyKey: string;
  timestamp?: string;
}): WebhookEnvelope {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const signature = signWebhookPayload({
    secret: input.secret,
    timestamp,
    payload: input.payload
  });
  return {
    event: input.event,
    payload: input.payload,
    timestamp,
    signature,
    idempotencyKey: input.idempotencyKey
  };
}

export function signWebhookPayload(input: {
  secret: string;
  timestamp: string;
  payload: string;
}): string {
  return createHmac("sha256", input.secret).update(`${input.timestamp}.${input.payload}`).digest("hex");
}

export function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string;
  payload: string;
  signature: string;
}): boolean {
  const expected = Buffer.from(signWebhookPayload(input), "utf8");
  const received = Buffer.from(input.signature, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function buildActionPath(actionId: string, basePath = "/api/v1"): string {
  return `${basePath}/actions/${actionId}`;
}

export function assertRoutePermission(permission: string, grants: string[]): void {
  if (!grants.includes(permission)) {
    throw new ValidationError(`Missing permission '${permission}'`, [
      {
        code: "rest-permission-denied",
        message: `permission '${permission}' is required`,
        path: "grants"
      }
    ]);
  }
}

export function matchRestRoute(
  api: RestApiDefinition,
  method: RestMethod,
  path: string
): { route: RestRouteDefinition; params: Record<string, string> } | undefined {
  const normalizedPath = normalizeRestPath(path);
  for (const route of api.routes) {
    if (route.method !== method) {
      continue;
    }

    const params = matchRestPath(route.path, normalizedPath);
    if (params) {
      return {
        route,
        params
      };
    }
  }

  return undefined;
}

function validatePublicResponse(routeId: string, schema: z.ZodTypeAny, value: unknown): unknown {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(`Response validation failed for ${routeId}`, parsed.error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.join(".")
    })));
  }
  return parsed.data;
}

function missingPathParamError(param: string): ValidationError {
  return new ValidationError(`Missing required path param '${param}'`, [
    {
      code: "rest-path-param",
      message: `path param '${param}' is required`,
      path: param
    }
  ]);
}

function compareRoutes(left: RestRouteDefinition, right: RestRouteDefinition): number {
  const pathComparison = left.path.localeCompare(right.path);
  if (pathComparison !== 0) {
    return pathComparison;
  }
  return left.method.localeCompare(right.method);
}

async function parseRestRequestBody(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "DELETE") {
    return undefined;
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return parseJsonBody(request);
  }

  const contentLength = request.headers.get("content-length");
  if (!contentType && (!contentLength || contentLength === "0")) {
    return undefined;
  }

  return request.text();
}

function normalizeRestHttpError(error: unknown): unknown {
  if (!(error instanceof ValidationError)) {
    return error;
  }

  const issueCodes = new Set(error.issues.map((issue) => issue.code));
  if (issueCodes.has("rest-permission-denied")) {
    return new HttpError(403, "rest.permission-denied", error.message, {
      issues: error.issues
    });
  }

  if (issueCodes.has("rest-route-not-found")) {
    return new HttpError(404, "rest.route-not-found", error.message, {
      issues: error.issues
    });
  }

  return new HttpError(400, "rest.validation", error.message, {
    issues: error.issues
  });
}

function parseGrantHeader(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function matchRestPath(pattern: string, pathname: string): Record<string, string> | null {
  const patternSegments = normalizeRestPath(pattern).split("/").filter(Boolean);
  const pathSegments = normalizeRestPath(pathname).split("/").filter(Boolean);

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

function normalizeRestPath(pathname: string): string {
  const [path] = pathname.split(/[?#]/);
  if (!path || path === "/") {
    return "/";
  }
  return path.endsWith("/") ? path.slice(0, -1) : path;
}
