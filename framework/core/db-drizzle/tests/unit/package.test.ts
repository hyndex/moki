import { describe, expect, it } from "bun:test";
import {
  assertDirectDbAccessAllowed,
  buildApiProjectionSql,
  buildApiSchemaConventionsSql,
  buildApiSchemaGrantSql,
  buildApiViewName,
  buildPostgresBootstrapSql,
  buildRlsPolicySql,
  buildTenantWhereSql,
  buildTransactionLocalSettingsSql,
  buildRoleDescriptors,
  createDbClient,
  createTenantScopedColumns,
  defineQueryConvention,
  assertQueryContext,
  normalizeQueryWindow,
  packageId,
  selectDatabaseRole
} from "../../src";

describe("db-drizzle", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("db-drizzle");
  });

  it("creates a sqlite client for local execution", async () => {
    const client = createDbClient({
      engine: "sqlite",
      role: "app_runtime"
    });

    expect(client.engine).toBe("sqlite");
    await client.close();
  });

  it("builds default tenant-scoped column names", () => {
    expect(createTenantScopedColumns()).toEqual({
      idColumn: "id",
      tenantIdColumn: "tenant_id",
      createdAtColumn: "created_at",
      updatedAtColumn: "updated_at"
    });
  });

  it("generates RLS bootstrap SQL", () => {
    expect(buildRlsPolicySql("crm_contacts")).toEqual([
      "ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;",
      "CREATE POLICY crm_contacts_tenant_isolation ON crm_contacts USING (tenant_id = current_setting('app.tenant_id', true));"
    ]);
  });

  it("rejects unknown plugins requesting direct db access", () => {
    expect(() =>
      assertDirectDbAccessAllowed({
        manifest: {
          id: "community-pack",
          kind: "feature-pack",
          trustTier: "unknown",
          isolationProfile: "sidecar"
        },
        role: "plugin_runtime"
      })
    ).toThrow("cannot access the database directly");
  });

  it("maps isolated plugin runtime roles to narrow role names", () => {
    expect(
      selectDatabaseRole({
        manifest: {
          id: "stripe-adapter",
          kind: "connector",
          trustTier: "partner-reviewed",
          isolationProfile: "sidecar"
        },
        role: "plugin_runtime"
      })
    ).toBe("plugin_stripe_adapter_runtime");
  });

  it("publishes the standard platform role descriptors", () => {
    const descriptors = buildRoleDescriptors("reports-export");
    expect(descriptors.map((entry) => entry.roleName)).toContain("plugin_reports_export_runtime");
    expect(descriptors.map((entry) => entry.roleName)).toContain("app_runtime");
  });

  it("renders transaction-local tenant and actor settings", () => {
    expect(
      buildTransactionLocalSettingsSql({
        tenantId: "tenant_123",
        actorId: "user_456",
        requestId: "req_789"
      })
    ).toEqual([
      "SELECT set_config('app.tenant_id', 'tenant_123', true);",
      "SELECT set_config('app.actor_id', 'user_456', true);",
      "SELECT set_config('app.request_id', 'req_789', true);"
    ]);
  });

  it("builds api schema projection helpers", () => {
    const viewName = buildApiViewName("crm", "contacts", "summary");
    expect(viewName).toBe("crm_contacts_summary");
    expect(
      buildApiProjectionSql({
        viewName,
        sourceSchema: "crm",
        sourceTable: "contacts",
        columns: ["id", "tenant_id", "email"],
        where: "status <> 'inactive'"
      })
    ).toEqual([
      "CREATE SCHEMA IF NOT EXISTS api;",
      "CREATE OR REPLACE VIEW api.crm_contacts_summary WITH (security_barrier=true, security_invoker=false) AS SELECT \"id\", \"tenant_id\", \"email\" FROM crm.contacts WHERE status <> 'inactive';"
    ]);
  });

  it("grants curated api views to plugin runtime roles", () => {
    expect(buildApiSchemaGrantSql("slack-adapter", ["crm_contacts_summary"])).toEqual([
      "GRANT USAGE ON SCHEMA api TO plugin_slack_adapter_runtime;",
      "GRANT SELECT ON api.crm_contacts_summary TO plugin_slack_adapter_runtime;"
    ]);
    expect(buildApiSchemaConventionsSql()[0]).toBe("CREATE SCHEMA IF NOT EXISTS api;");
  });

  it("renders bootstrap SQL for roles, schemas, RLS, and api views", () => {
    const sql = buildPostgresBootstrapSql({
      pluginIds: ["slack-adapter"],
      tenantTables: [
        {
          schema: "crm",
          table: "contacts",
          forceRls: true
        }
      ],
      apiProjections: [
        {
          viewName: "crm_contacts_summary",
          sourceSchema: "crm",
          sourceTable: "contacts",
          columns: ["id", "tenant_id", "email"]
        }
      ]
    });

    expect(sql).toContain("CREATE SCHEMA IF NOT EXISTS crm;");
    expect(sql).toContain("ALTER TABLE crm.contacts FORCE ROW LEVEL SECURITY;");
    expect(sql).toContain(
      "CREATE OR REPLACE VIEW api.crm_contacts_summary WITH (security_barrier=true, security_invoker=false) AS SELECT \"id\", \"tenant_id\", \"email\" FROM crm.contacts;"
    );
    expect(sql).toContain("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'plugin_slack_adapter_runtime') THEN CREATE ROLE plugin_slack_adapter_runtime NOLOGIN; END IF; END $$;");
  });

  it("defines read query conventions without permission logic or event emission", () => {
    const convention = defineQueryConvention({
      id: "crm.contacts.list",
      scope: "explicit-tenant",
      defaultOrderBy: ["email", "created_at"]
    });

    expect(convention).toEqual({
      id: "crm.contacts.list",
      scope: "explicit-tenant",
      defaultOrderBy: ["created_at", "email"]
    });
    expect(buildTenantWhereSql("tenant_id", "tenant_123")).toBe("tenant_id = 'tenant_123'");
    expect(normalizeQueryWindow({ limit: 500, offset: -10, maxLimit: 200 })).toEqual({
      limit: 200,
      offset: 0
    });
    expect(assertQueryContext(convention, { tenantId: "tenant_123" })).toEqual({
      tenantId: "tenant_123"
    });
  });

  it("rejects unscoped read modules and forbidden query behavior", () => {
    expect(() =>
      defineQueryConvention({
        id: "crm.contacts.list",
        scope: "explicit-tenant",
        emitsEvents: true
      })
    ).toThrow("cannot publish domain events");

    const convention = defineQueryConvention({
      id: "crm.contacts.list",
      scope: "context-tenant"
    });

    expect(() => assertQueryContext(convention, {})).toThrow("requires an explicit tenant context");
  });
});
