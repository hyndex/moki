import { SQL } from "bun";
import { Database } from "bun:sqlite";
import { drizzle as drizzleBunSql } from "drizzle-orm/bun-sql";
import { drizzle as drizzleSqlite } from "drizzle-orm/bun-sqlite";

import { type PackageManifest, ValidationError } from "@platform/kernel";

export const packageId = "db-drizzle" as const;
export const packageDisplayName = "DB Drizzle" as const;
export const packageDescription = "Drizzle-first database contracts and role-aware context." as const;

export const platformSchemaValues = [
  "core",
  "identity",
  "crm",
  "finance",
  "inventory",
  "content",
  "support",
  "learning",
  "streaming",
  "booking",
  "audit",
  "api"
] as const;

export type PlatformSchema = (typeof platformSchemaValues)[number];

export const dbRoleClassValues = [
  "app_migrator",
  "app_runtime",
  "app_jobs",
  "app_readonly",
  "backup_restore",
  "plugin_runtime"
] as const;

export type DbRoleClass = (typeof dbRoleClassValues)[number];

export type PostgresDatabaseConfig = {
  engine: "postgres";
  connectionString: string;
  maxConnections?: number | undefined;
  role: DbRoleClass;
  packageId?: string | undefined;
  tenantId?: string | undefined;
};

export type SqliteDatabaseConfig = {
  engine: "sqlite";
  fileName?: string;
  readonly?: boolean | undefined;
  role: DbRoleClass;
  packageId?: string | undefined;
  tenantId?: string | undefined;
};

export type PlatformDatabaseConfig = PostgresDatabaseConfig | SqliteDatabaseConfig;

export type PlatformDatabaseClient =
  | {
      engine: "postgres";
      role: DbRoleClass;
      packageId?: string | undefined;
      tenantId?: string | undefined;
      raw: SQL;
      db: ReturnType<typeof drizzleBunSql>;
      close(): Promise<void>;
    }
  | {
      engine: "sqlite";
      role: DbRoleClass;
      packageId?: string | undefined;
      tenantId?: string | undefined;
      raw: Database;
      db: ReturnType<typeof drizzleSqlite>;
      close(): Promise<void>;
    };

export type DatabaseAccessRequest = {
  manifest: Pick<PackageManifest, "id" | "kind" | "trustTier" | "isolationProfile">;
  role: DbRoleClass;
};

export type PlatformDatabaseContext = {
  client: PlatformDatabaseClient;
  actorId?: string | undefined;
  tenantId?: string | undefined;
  requestId?: string | undefined;
  packageId?: string | undefined;
};

export type TenantColumns = {
  idColumn: string;
  tenantIdColumn: string;
  createdAtColumn: string;
  updatedAtColumn: string;
};

export type RoleDescriptor = {
  roleName: string;
  grantSql: string[];
};

export type TenantScopedTable = {
  schema: string;
  table: string;
  tenantColumn?: string | undefined;
  forceRls?: boolean | undefined;
};

export type ApiProjectionDefinition = {
  viewName: string;
  sourceSchema: string;
  sourceTable: string;
  columns: string[];
  where?: string | undefined;
  securityBarrier?: boolean | undefined;
  securityInvoker?: boolean | undefined;
};

export type QueryScopeMode = "explicit-tenant" | "context-tenant" | "global";

export type QueryConventionDefinition = {
  id: string;
  scope: QueryScopeMode;
  defaultOrderBy?: string[] | undefined;
  emitsEvents?: boolean | undefined;
  performsPermissionChecks?: boolean | undefined;
};

export type QueryConvention = {
  id: string;
  scope: QueryScopeMode;
  defaultOrderBy: string[];
};

export type QueryExecutionContext = {
  tenantId?: string | undefined;
};

export function createDbClient(config: PlatformDatabaseConfig): PlatformDatabaseClient {
  if (config.engine === "postgres") {
    const raw = config.maxConnections
      ? new SQL(config.connectionString, { max: config.maxConnections })
      : new SQL(config.connectionString, {});
    return {
      engine: "postgres",
      role: config.role,
      raw,
      db: drizzleBunSql(raw),
      ...(config.packageId ? { packageId: config.packageId } : {}),
      ...(config.tenantId ? { tenantId: config.tenantId } : {}),
      async close() {
        await raw.close();
      }
    };
  }

  const sqliteOptions = config.readonly ? { readonly: true } : undefined;
  const raw = new Database(config.fileName ?? ":memory:", sqliteOptions);
  return {
    engine: "sqlite",
    role: config.role,
    raw,
    db: drizzleSqlite(raw),
    ...(config.packageId ? { packageId: config.packageId } : {}),
    ...(config.tenantId ? { tenantId: config.tenantId } : {}),
    close() {
      raw.close();
      return Promise.resolve();
    }
  };
}

export function createDbContext(input: {
  client: PlatformDatabaseClient;
  actorId?: string;
  tenantId?: string;
  requestId?: string;
  packageId?: string;
}): PlatformDatabaseContext {
  return Object.freeze({
    client: input.client,
    actorId: input.actorId,
    tenantId: input.tenantId ?? input.client.tenantId,
    requestId: input.requestId,
    packageId: input.packageId ?? input.client.packageId
  });
}

export async function withTransaction<TResult>(
  context: PlatformDatabaseContext,
  callback: (transaction: PlatformDatabaseContext) => Promise<TResult> | TResult
): Promise<TResult> {
  if (context.client.engine === "postgres") {
    return context.client.db.transaction(async (db) =>
      callback({
        ...context,
        client: {
          ...context.client,
          db
        } as unknown as PlatformDatabaseClient
      })
    );
  }

  return Promise.resolve(callback(context));
}

export async function executeSql(client: PlatformDatabaseClient, statement: string): Promise<void> {
  if (client.engine === "sqlite") {
    client.raw.exec(statement);
    return;
  }

  await client.raw.unsafe(statement);
}

export function assertDirectDbAccessAllowed(request: DatabaseAccessRequest): void {
  const { manifest, role } = request;

  if (manifest.trustTier === "unknown") {
    throw new ValidationError(`Package '${manifest.id}' cannot access the database directly`, [
      {
        code: "db-unknown-plugin",
        message: "unknown plugins may not receive direct database access",
        path: "trustTier",
        packageId: manifest.id
      }
    ]);
  }

  if (manifest.isolationProfile === "declarative-only") {
    throw new ValidationError(`Package '${manifest.id}' is declarative only`, [
      {
        code: "db-declarative-only",
        message: "declarative packages may not execute direct database operations",
        path: "isolationProfile",
        packageId: manifest.id
      }
    ]);
  }

  if (role === "plugin_runtime" && manifest.isolationProfile === "same-process-trusted") {
    throw new ValidationError(`Package '${manifest.id}' cannot use plugin runtime credentials`, [
      {
        code: "db-role-mismatch",
        message: "same-process packages must use shared platform roles instead of plugin-specific credentials",
        path: "role",
        packageId: manifest.id
      }
    ]);
  }
}

export function selectDatabaseRole(request: DatabaseAccessRequest): string {
  assertDirectDbAccessAllowed(request);
  if (request.role === "plugin_runtime") {
    return `plugin_${request.manifest.id.replace(/-/g, "_")}_runtime`;
  }
  return request.role;
}

export function createTenantScopedColumns(overrides: Partial<TenantColumns> = {}): TenantColumns {
  return {
    idColumn: overrides.idColumn ?? "id",
    tenantIdColumn: overrides.tenantIdColumn ?? "tenant_id",
    createdAtColumn: overrides.createdAtColumn ?? "created_at",
    updatedAtColumn: overrides.updatedAtColumn ?? "updated_at"
  };
}

export function defineQueryConvention(definition: QueryConventionDefinition): QueryConvention {
  if (definition.emitsEvents) {
    throw new ValidationError(`Query module '${definition.id}' cannot publish domain events`, [
      {
        code: "query-events-forbidden",
        message: "query modules may not publish domain events",
        path: "emitsEvents",
        packageId
      }
    ]);
  }

  if (definition.performsPermissionChecks) {
    throw new ValidationError(`Query module '${definition.id}' cannot evaluate permissions`, [
      {
        code: "query-permissions-forbidden",
        message: "query modules may not perform permission checks",
        path: "performsPermissionChecks",
        packageId
      }
    ]);
  }

  return Object.freeze({
    id: definition.id,
    scope: definition.scope,
    defaultOrderBy: [...new Set(definition.defaultOrderBy ?? [])].sort((left, right) => left.localeCompare(right))
  });
}

export function assertQueryContext(
  convention: QueryConvention,
  context: QueryExecutionContext
): QueryExecutionContext {
  if (convention.scope !== "global" && !context.tenantId) {
    throw new ValidationError(`Query module '${convention.id}' requires an explicit tenant context`, [
      {
        code: "query-tenant-required",
        message: "tenant scoping must be explicit or guaranteed by request context",
        path: "tenantId",
        packageId
      }
    ]);
  }

  return context;
}

export function buildTenantWhereSql(columnName: string, tenantId: string): string {
  return `${columnName} = '${escapeSqlLiteral(tenantId)}'`;
}

export function normalizeQueryWindow(input: {
  limit?: number | undefined;
  offset?: number | undefined;
  maxLimit?: number | undefined;
}): {
  limit: number;
  offset: number;
} {
  const maxLimit = input.maxLimit ?? 100;
  const limit = Math.min(Math.max(input.limit ?? 25, 1), maxLimit);
  const offset = Math.max(input.offset ?? 0, 0);
  return {
    limit,
    offset
  };
}

export function buildRlsPolicySql(tableName: string, tenantColumn = "tenant_id"): string[] {
  return [
    `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`,
    `CREATE POLICY ${tableName.replace(/\W+/g, "_")}_tenant_isolation ON ${tableName} USING (${tenantColumn} = current_setting('app.tenant_id', true));`
  ];
}

export function buildApiViewName(sourceSchema: string, sourceTable: string, suffix = "projection"): string {
  return `${sourceSchema}_${sourceTable}_${suffix}`.replace(/[^a-zA-Z0-9_]+/g, "_").toLowerCase();
}

export function buildTransactionLocalSettingsSql(input: {
  tenantId: string;
  actorId?: string | undefined;
  userId?: string | undefined;
  requestId?: string | undefined;
}): string[] {
  const statements = [`SELECT set_config('app.tenant_id', '${escapeSqlLiteral(input.tenantId)}', true);`];
  if (input.actorId) {
    statements.push(`SELECT set_config('app.actor_id', '${escapeSqlLiteral(input.actorId)}', true);`);
  }
  if (input.userId) {
    statements.push(`SELECT set_config('app.user_id', '${escapeSqlLiteral(input.userId)}', true);`);
  }
  if (input.requestId) {
    statements.push(`SELECT set_config('app.request_id', '${escapeSqlLiteral(input.requestId)}', true);`);
  }
  return statements;
}

export function buildApiProjectionSql(projection: ApiProjectionDefinition): string[] {
  const columns = projection.columns.map((column) => `"${column}"`).join(", ");
  const whereClause = projection.where ? ` WHERE ${projection.where}` : "";
  const securityBarrier = projection.securityBarrier ?? true;
  const securityInvoker = projection.securityInvoker ?? false;

  return [
    "CREATE SCHEMA IF NOT EXISTS api;",
    `CREATE OR REPLACE VIEW api.${projection.viewName} WITH (security_barrier=${securityBarrier ? "true" : "false"}, security_invoker=${securityInvoker ? "true" : "false"}) AS SELECT ${columns} FROM ${projection.sourceSchema}.${projection.sourceTable}${whereClause};`
  ];
}

export function buildApiSchemaGrantSql(pluginId: string, viewNames: string[]): string[] {
  const roleName = `plugin_${pluginId.replace(/-/g, "_")}_runtime`;
  return [
    `GRANT USAGE ON SCHEMA api TO ${roleName};`,
    ...viewNames.map((viewName) => `GRANT SELECT ON api.${viewName} TO ${roleName};`)
  ];
}

export function buildApiSchemaConventionsSql(): string[] {
  return [
    "CREATE SCHEMA IF NOT EXISTS api;",
    "REVOKE ALL ON SCHEMA api FROM PUBLIC;",
    "COMMENT ON SCHEMA api IS 'Curated read models and audited procedures for isolated runtimes.';"
  ];
}

export function buildPostgresBootstrapSql(options: {
  pluginIds?: string[] | undefined;
  tenantTables?: TenantScopedTable[] | undefined;
  apiProjections?: ApiProjectionDefinition[] | undefined;
} = {}): string[] {
  const pluginIds = [...(options.pluginIds ?? [])].sort((left, right) => left.localeCompare(right));
  const tenantTables = [...(options.tenantTables ?? [])].sort((left, right) =>
    `${left.schema}.${left.table}`.localeCompare(`${right.schema}.${right.table}`)
  );
  const apiProjections = [...(options.apiProjections ?? [])].sort((left, right) => left.viewName.localeCompare(right.viewName));

  const statements = [
    ...dbRoleClassValues.flatMap((roleClass) =>
      buildCreateRoleIfMissingSql(roleClass === "plugin_runtime" ? "plugin_template_runtime" : roleClass)
    ),
    "REVOKE CREATE ON SCHEMA public FROM PUBLIC;",
    "REVOKE ALL ON SCHEMA public FROM PUBLIC;",
    ...platformSchemaValues.flatMap((schemaName) => buildCreateSchemaSql(schemaName)),
    ...buildApiSchemaConventionsSql(),
    ...platformSchemaValues.flatMap((schemaName) => buildRuntimeGrantSql(schemaName)),
    ...buildContextSetterFunctionSql(),
    ...tenantTables.flatMap((table) => buildTenantTableSecuritySql(table)),
    ...apiProjections.flatMap((projection) => buildApiProjectionSql(projection)),
    ...pluginIds.flatMap((pluginId) => {
      const roleName = `plugin_${pluginId.replace(/-/g, "_")}_runtime`;
      return [
        ...buildCreateRoleIfMissingSql(roleName),
        ...buildApiSchemaGrantSql(pluginId, apiProjections.map((projection) => projection.viewName))
      ];
    })
  ];

  return [...new Set(statements)];
}

export function buildRoleDescriptors(pluginId?: string): RoleDescriptor[] {
  return [
    {
      roleName: "app_migrator",
      grantSql: [
        "GRANT USAGE ON SCHEMA public TO app_migrator;",
        "GRANT CREATE, ALTER, DROP ON SCHEMA public TO app_migrator;"
      ]
    },
    {
      roleName: "app_runtime",
      grantSql: [
        "GRANT USAGE ON SCHEMA public TO app_runtime;",
        "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;"
      ]
    },
    {
      roleName: "app_jobs",
      grantSql: [
        "GRANT USAGE ON SCHEMA public TO app_jobs;",
        "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_jobs;"
      ]
    },
    {
      roleName: "app_readonly",
      grantSql: [
        "GRANT USAGE ON SCHEMA public TO app_readonly;",
        "GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;"
      ]
    },
    {
      roleName: "backup_restore",
      grantSql: [
        "GRANT CONNECT ON DATABASE app TO backup_restore;",
        "GRANT USAGE ON SCHEMA public TO backup_restore;"
      ]
    },
    ...(pluginId
      ? [
          {
            roleName: `plugin_${pluginId.replace(/-/g, "_")}_runtime`,
            grantSql: [
              `GRANT USAGE ON SCHEMA api TO plugin_${pluginId.replace(/-/g, "_")}_runtime;`,
              `GRANT SELECT ON ALL TABLES IN SCHEMA api TO plugin_${pluginId.replace(/-/g, "_")}_runtime;`
            ]
          }
        ]
      : [])
  ];
}

function buildCreateSchemaSql(schemaName: string): string[] {
  return [
    `CREATE SCHEMA IF NOT EXISTS ${schemaName};`,
    `REVOKE ALL ON SCHEMA ${schemaName} FROM PUBLIC;`,
    `GRANT USAGE ON SCHEMA ${schemaName} TO app_migrator;`
  ];
}

function buildRuntimeGrantSql(schemaName: string): string[] {
  return [
    `GRANT USAGE ON SCHEMA ${schemaName} TO app_runtime, app_jobs, app_readonly;`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schemaName} TO app_runtime;`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schemaName} TO app_jobs;`,
    `GRANT SELECT ON ALL TABLES IN SCHEMA ${schemaName} TO app_readonly;`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_jobs;`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} GRANT SELECT ON TABLES TO app_readonly;`
  ];
}

function buildContextSetterFunctionSql(): string[] {
  return [
    "CREATE OR REPLACE FUNCTION core.set_request_context(p_tenant_id text, p_actor_id text DEFAULT NULL, p_user_id text DEFAULT NULL, p_request_id text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_catalog AS $$ BEGIN PERFORM set_config('app.tenant_id', p_tenant_id, true); IF p_actor_id IS NOT NULL THEN PERFORM set_config('app.actor_id', p_actor_id, true); END IF; IF p_user_id IS NOT NULL THEN PERFORM set_config('app.user_id', p_user_id, true); END IF; IF p_request_id IS NOT NULL THEN PERFORM set_config('app.request_id', p_request_id, true); END IF; END; $$;",
    "REVOKE ALL ON FUNCTION core.set_request_context(text, text, text, text) FROM PUBLIC;",
    "GRANT EXECUTE ON FUNCTION core.set_request_context(text, text, text, text) TO app_runtime, app_jobs;"
  ];
}

function buildTenantTableSecuritySql(table: TenantScopedTable): string[] {
  const qualifiedTable = `${table.schema}.${table.table}`;
  return [
    ...buildRlsPolicySql(qualifiedTable, table.tenantColumn ?? "tenant_id"),
    ...(table.forceRls ? [`ALTER TABLE ${qualifiedTable} FORCE ROW LEVEL SECURITY;`] : [])
  ];
}

function buildCreateRoleIfMissingSql(roleName: string): string[] {
  return [
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${escapeSqlLiteral(roleName)}') THEN CREATE ROLE ${roleName} NOLOGIN; END IF; END $$;`
  ];
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}
