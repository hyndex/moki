import {
  GraphQLID,
  type GraphQLFieldConfigMap,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  Kind,
  graphql
} from "graphql";
import { createYoga } from "graphql-yoga";

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
import { type ActionDefinition, type ResourceDefinition, executeAction } from "@platform/schema";

export const packageId = "api-graphql" as const;
export const packageDisplayName = "API GraphQL" as const;
export const packageDescription = "Optional GraphQL Yoga adapter over the platform graph." as const;

export type GraphqlContext = {
  grants: string[];
  actorId?: string;
  tenantId?: string;
  requestId?: string;
};

export type GraphqlJsonValue =
  | null
  | boolean
  | number
  | string
  | GraphqlJsonValue[]
  | { [key: string]: GraphqlJsonValue };

export type GraphqlResourceResolvers = {
  list?: (context: GraphqlContext) => Promise<GraphqlJsonValue[]> | GraphqlJsonValue[];
  get?: (id: string, context: GraphqlContext) => Promise<GraphqlJsonValue | null> | GraphqlJsonValue | null;
};

type YogaServer = ReturnType<typeof createYoga<{ req: Request }>>;

export type GraphqlAdapter = {
  enabled: boolean;
  schema: GraphQLSchema | null;
  yoga: YogaServer | null;
  resources: ResourceDefinition[];
  actions: ActionDefinition[];
};

export type GraphqlHttpContextFactory = (
  request: Request,
  context: HttpRequestContext
) => Promise<GraphqlContext> | GraphqlContext;

const JsonScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON payloads generated from platform contracts.",
  serialize(value) {
    return value;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast): unknown {
    switch (ast.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.INT:
      case Kind.FLOAT:
        return Number(ast.value);
      case Kind.NULL:
        return null;
      case Kind.OBJECT:
        return Object.fromEntries(ast.fields.map((field) => [field.name.value, JsonScalar.parseLiteral(field.value, {})]));
      case Kind.LIST:
        return ast.values.map((value) => JsonScalar.parseLiteral(value, {}));
      default:
        return null;
    }
  }
});

export function createGraphqlAdapter(input: {
  resources: ResourceDefinition[];
  actions: ActionDefinition[];
  resourceResolvers?: Record<string, GraphqlResourceResolvers>;
  enabled?: boolean;
}): GraphqlAdapter {
  const enabled = input.enabled ?? true;
  if (!enabled) {
    return {
      enabled: false,
      schema: null,
      yoga: null,
      resources: [],
      actions: []
    };
  }

  const queryFields: GraphQLFieldConfigMap<unknown, GraphqlContext> = input.resources.reduce<
    GraphQLFieldConfigMap<unknown, GraphqlContext>
  >((fields, resource) => {
    const safeName = toGraphqlName(resource.id);
    const resolvers = input.resourceResolvers?.[resource.id];

    fields[safeName] = {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(JsonScalar))),
      resolve: (_source: unknown, _args: Record<string, unknown>, context: GraphqlContext) => {
        assertGrant(`${resource.id}.read`, context.grants);
        return resolvers?.list?.(context) ?? [];
      }
    };

    fields[`${safeName}_by_id`] = {
      type: JsonScalar,
      args: {
        id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve: (_source: unknown, args: { id: string }, context: GraphqlContext) => {
        assertGrant(`${resource.id}.read`, context.grants);
        return resolvers?.get?.(args.id, context) ?? null;
      }
    };

    return fields;
  }, {});

  const mutationFields: GraphQLFieldConfigMap<unknown, GraphqlContext> = input.actions.reduce<
    GraphQLFieldConfigMap<unknown, GraphqlContext>
  >((fields, action) => {
    fields[toGraphqlName(action.id)] = {
      type: JsonScalar,
      args: {
        input: { type: new GraphQLNonNull(JsonScalar) }
      },
      resolve: async (_source: unknown, args: { input: unknown }, context: GraphqlContext) => {
        assertGrant(action.permission, context.grants);
        return executeAction(action, args.input, {
          ctx: {
            actorId: context.actorId,
            tenantId: context.tenantId,
            requestId: context.requestId
          }
        });
      }
    };

    return fields;
  }, {});

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields:
        Object.keys(queryFields).length > 0
          ? queryFields
          : ({
              platform_status: {
                type: JsonScalar,
                resolve: () => "ok"
              }
            } satisfies GraphQLFieldConfigMap<unknown, GraphqlContext>)
    }),
    ...(Object.keys(mutationFields).length > 0
      ? {
          mutation: new GraphQLObjectType({
            name: "Mutation",
            fields: mutationFields
          })
        }
      : {})
  });

  return {
    enabled: true,
    schema,
    yoga: createYoga<{
      req: Request;
    }>({
      schema,
      graphqlEndpoint: "/graphql",
      maskedErrors: false
    }),
    resources: [...input.resources],
    actions: [...input.actions]
  };
}

export async function executeGraphql(
  adapter: GraphqlAdapter,
  input: {
    source: string;
    variableValues?: Record<string, unknown>;
    contextValue: GraphqlContext;
  }
): Promise<Awaited<ReturnType<typeof graphql>>> {
  if (!adapter.enabled || !adapter.schema) {
    throw new ValidationError("GraphQL adapter is disabled", [
      {
        code: "graphql-disabled",
        message: "GraphQL support is not enabled",
        path: "enabled"
      }
    ]);
  }

  return graphql({
    schema: adapter.schema,
    source: input.source,
    variableValues: input.variableValues,
    contextValue: input.contextValue
  });
}

export function toGraphqlName(id: string): string {
  const sanitized = id.replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(sanitized) ? sanitized : `p_${sanitized}`;
}

export function createGraphqlContextFromHttpRequest(request: Request, context: HttpRequestContext): GraphqlContext {
  return {
    grants: parseGrantHeader(request.headers.get("x-grants")),
    ...(context.actorId ? { actorId: context.actorId } : {}),
    ...(context.tenantId ? { tenantId: context.tenantId } : {}),
    requestId: context.requestId
  };
}

export function createGraphqlHttpServer(input: {
  name: string;
  adapter: GraphqlAdapter;
  endpoint?: string | undefined;
  resolveContext?: GraphqlHttpContextFactory | undefined;
  middleware?: HttpMiddleware[] | undefined;
  errorMapper?: HttpErrorMapper | undefined;
  defaultTimeoutMs?: number | undefined;
  healthPath?: string | undefined;
  readinessPath?: string | undefined;
  readinessCheck?: (() => Promise<void> | void) | undefined;
}): HttpServerDefinition {
  const endpoint = input.endpoint ?? "/graphql";
  const routes = !input.adapter.enabled
    ? []
    : [
        defineHttpRoute({
          id: "graphql.get",
          method: "GET",
          path: endpoint,
          handler: async (request, context) => {
            const url = new URL(request.url);
            const query = url.searchParams.get("query");
            if (!query) {
              throw new HttpError(400, "graphql.query.missing", "GraphQL GET requests require a query parameter");
            }

            const variableValues = parseVariables(url.searchParams.get("variables"));
            const result = await executeGraphql(input.adapter, {
              source: query,
              contextValue: await (input.resolveContext ?? createGraphqlContextFromHttpRequest)(request, context),
              ...(variableValues ? { variableValues } : {})
            });
            return jsonResponse(result);
          }
        }),
        defineHttpRoute({
          id: "graphql.post",
          method: "POST",
          path: endpoint,
          handler: async (request, context) => {
            const body = await parseJsonBody<{
              query?: string;
              variables?: Record<string, unknown>;
            }>(request);
            if (!body.query) {
              throw new HttpError(400, "graphql.query.missing", "GraphQL POST requests require a query field");
            }

            const result = await executeGraphql(input.adapter, {
              source: body.query,
              ...(body.variables ? { variableValues: body.variables } : {}),
              contextValue: await (input.resolveContext ?? createGraphqlContextFromHttpRequest)(request, context)
            });
            return jsonResponse(result);
          }
        })
      ];

  return defineHttpServer({
    name: input.name,
    routes,
    middleware: input.middleware,
    errorMapper: input.errorMapper,
    defaultTimeoutMs: input.defaultTimeoutMs,
    healthPath: input.healthPath,
    readinessPath: input.readinessPath,
    readinessCheck: input.readinessCheck
  });
}

function assertGrant(permission: string, grants: string[]): void {
  if (!grants.includes(permission)) {
    throw new ValidationError(`Missing permission '${permission}'`, [
      {
        code: "graphql-permission-denied",
        message: `permission '${permission}' is required`,
        path: "grants"
      }
    ]);
  }
}

function parseGrantHeader(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function parseVariables(value: string | null): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch (error) {
    throw new HttpError(400, "graphql.variables.invalid", "GraphQL variables must be valid JSON", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}
