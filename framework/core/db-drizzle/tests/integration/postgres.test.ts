import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import {
  buildPostgresBootstrapSql,
  createDbClient,
  executeSql,
  type PlatformDatabaseClient
} from "../../src";

const postgresUrl =
  process.env.TEST_POSTGRES_URL ?? process.env.DATABASE_TEST_URL ?? process.env.DATABASE_URL;

const describeIfPostgres = postgresUrl ? describe : describe.skip;

describeIfPostgres("db-drizzle postgres integration", () => {
  let adminClient: PlatformDatabaseClient | null = null;
  let pluginClient: PlatformDatabaseClient | null = null;
  let runtimeClient: PlatformDatabaseClient | null = null;

  const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
  const tableName = `it_contacts_${suffix}`;
  const viewName = `crm_${tableName}_summary`;
  const pluginId = `probe-${suffix}`;
  const pluginRole = `plugin_probe_${suffix}_runtime`;
  const pluginLogin = `probe_login_${suffix}`;
  const runtimeLogin = `runtime_login_${suffix}`;
  const tenantAlpha = "tenant-alpha";
  const tenantBeta = "tenant-beta";

  beforeAll(async () => {
    if (!postgresUrl) {
      return;
    }

    adminClient = createDbClient({
      engine: "postgres",
      connectionString: postgresUrl,
      maxConnections: 1,
      role: "app_migrator"
    });

    await applySql(adminClient, [
      "CREATE SCHEMA IF NOT EXISTS crm;",
      `DROP VIEW IF EXISTS api.${viewName};`,
      `DROP TABLE IF EXISTS crm.${tableName} CASCADE;`,
      dropOwnedIfExistsSql(pluginRole),
      dropOwnedIfExistsSql(pluginLogin),
      dropOwnedIfExistsSql(runtimeLogin),
      `DROP ROLE IF EXISTS ${pluginRole};`,
      `DROP ROLE IF EXISTS ${pluginLogin};`,
      `DROP ROLE IF EXISTS ${runtimeLogin};`,
      `CREATE TABLE crm.${tableName} (id text PRIMARY KEY, tenant_id text NOT NULL, email text NOT NULL, status text NOT NULL);`,
      `INSERT INTO crm.${tableName} (id, tenant_id, email, status) VALUES ('alpha_row', '${tenantAlpha}', 'alpha@example.com', 'active');`,
      `INSERT INTO crm.${tableName} (id, tenant_id, email, status) VALUES ('beta_row', '${tenantBeta}', 'beta@example.com', 'active');`
    ]);

    await applySql(
      adminClient,
      buildPostgresBootstrapSql({
        pluginIds: [pluginId],
        tenantTables: [{ schema: "crm", table: tableName, forceRls: true }],
        apiProjections: [
          {
            viewName,
            sourceSchema: "crm",
            sourceTable: tableName,
            columns: ["id", "tenant_id", "email", "status"]
          }
        ]
      })
    );

    await applySql(adminClient, [
      `ALTER TABLE crm.${tableName} OWNER TO app_migrator;`,
      `ALTER VIEW api.${viewName} OWNER TO app_migrator;`,
      `CREATE ROLE ${pluginLogin} LOGIN;`,
      `GRANT ${pluginRole} TO ${pluginLogin};`,
      `CREATE ROLE ${runtimeLogin} LOGIN;`,
      `GRANT app_runtime TO ${runtimeLogin};`
    ]);

    pluginClient = createDbClient({
      engine: "postgres",
      connectionString: postgresUrl,
      maxConnections: 1,
      role: "plugin_runtime"
    });

    runtimeClient = createDbClient({
      engine: "postgres",
      connectionString: postgresUrl,
      maxConnections: 1,
      role: "app_runtime"
    });

    await executeSql(requireClient(pluginClient), `SET SESSION AUTHORIZATION ${pluginLogin};`);
    await executeSql(requireClient(runtimeClient), `SET SESSION AUTHORIZATION ${runtimeLogin};`);
  });

  afterAll(async () => {
    await pluginClient?.close();
    await runtimeClient?.close();

    if (adminClient) {
      await applySql(adminClient, [
        `DROP VIEW IF EXISTS api.${viewName};`,
        `DROP TABLE IF EXISTS crm.${tableName} CASCADE;`,
        dropOwnedIfExistsSql(pluginRole),
        dropOwnedIfExistsSql(pluginLogin),
        dropOwnedIfExistsSql(runtimeLogin),
        `DROP ROLE IF EXISTS ${pluginRole};`,
        `DROP ROLE IF EXISTS ${pluginLogin};`,
        `DROP ROLE IF EXISTS ${runtimeLogin};`
      ]);
      await adminClient.close();
    }
  });

  it("creates roles, policies, and curated grants for isolated runtimes", async () => {
    const roles = await queryRows(adminClient, `SELECT rolname FROM pg_roles WHERE rolname IN ('app_runtime', '${pluginRole}') ORDER BY rolname;`);
    expect(roles.map((row) => row.rolname)).toEqual(["app_runtime", pluginRole]);

    const policies = await queryRows(
      adminClient,
      `SELECT policyname FROM pg_policies WHERE schemaname = 'crm' AND tablename = '${tableName}';`
    );
    expect(policies.map((row) => row.policyname)).toContain(`crm_${tableName}_tenant_isolation`);

    const grants = await queryRows(
      adminClient,
      `SELECT privilege_type FROM information_schema.role_table_grants WHERE grantee = '${pluginRole}' AND table_schema = 'api' AND table_name = '${viewName}' ORDER BY privilege_type;`
    );
    expect(grants.map((row) => row.privilege_type)).toContain("SELECT");
  });

  it("allows plugin runtimes to query curated api views but denies base-table reads", async () => {
    const pluginRowsWithoutTenant = await queryRows(pluginClient, `SELECT id FROM api.${viewName};`);
    expect(pluginRowsWithoutTenant).toHaveLength(0);

    await executeSql(requireClient(pluginClient), "BEGIN;");
    await queryRows(pluginClient, `SELECT set_config('app.tenant_id', '${tenantAlpha}', true) AS tenant_id;`);
    const pluginRowsWithTenant = await queryRows(
      pluginClient,
      `SELECT id, tenant_id, email, status FROM api.${viewName} ORDER BY id;`
    );
    await executeSql(requireClient(pluginClient), "ROLLBACK;");

    expect(pluginRowsWithTenant).toEqual([
      {
        id: "alpha_row",
        tenant_id: tenantAlpha,
        email: "alpha@example.com",
        status: "active"
      }
    ]);

    let baseTableErrorMessage = "";
    try {
      await queryRows(pluginClient, `SELECT id FROM crm.${tableName};`);
    } catch (error) {
      baseTableErrorMessage = getErrorMessage(error);
    }

    expect(baseTableErrorMessage).toContain("permission denied");
  });

  it("enforces tenant RLS for app runtime queries after request context is set", async () => {
    const rowsWithoutTenant = await queryRows(
      runtimeClient,
      `SELECT id FROM crm.${tableName} ORDER BY id;`
    );
    expect(rowsWithoutTenant).toHaveLength(0);

    await executeSql(requireClient(runtimeClient), "BEGIN;");
    await queryRows(
      runtimeClient,
      `SELECT core.set_request_context('${tenantAlpha}', 'actor-alpha', 'user-alpha', 'req-alpha');`
    );
    const scopedRows = await queryRows(
      runtimeClient,
      `SELECT id, tenant_id, email, status FROM crm.${tableName} ORDER BY id;`
    );
    await executeSql(requireClient(runtimeClient), "ROLLBACK;");
    expect(scopedRows).toEqual([
      {
        id: "alpha_row",
        tenant_id: tenantAlpha,
        email: "alpha@example.com",
        status: "active"
      }
    ]);
  });
});

async function applySql(client: PlatformDatabaseClient | null, statements: string[]): Promise<void> {
  if (!client) {
    throw new Error("missing postgres client");
  }

  for (const statement of statements) {
    await executeSql(client, statement);
  }
}

async function queryRows(
  client: PlatformDatabaseClient | null,
  statement: string
): Promise<Array<Record<string, string>>> {
  if (!client || client.engine !== "postgres") {
    throw new Error("postgres client is required");
  }

  return await client.raw.unsafe(statement);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function dropOwnedIfExistsSql(roleName: string): string {
  return `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${roleName}') THEN EXECUTE 'DROP OWNED BY ${roleName}'; END IF; END $$;`;
}

function requireClient(client: PlatformDatabaseClient | null): PlatformDatabaseClient {
  if (!client) {
    throw new Error("postgres client is required");
  }

  return client;
}
