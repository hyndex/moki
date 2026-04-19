import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const corePlatformPackageIds = new Set([
  "kernel",
  "runtime-bun",
  "http",
  "config",
  "schema",
  "api-rest",
  "api-graphql",
  "db-drizzle",
  "migrate",
  "auth",
  "auth-admin",
  "permissions",
  "plugin-solver",
  "jobs",
  "jobs-bullmq",
  "events",
  "logger",
  "observability"
]);

const foundationPlugins = [
  plugin("auth-core", "foundations", "app", "Auth Core", "Canonical identity and session backbone.", "auth.identities", "Identity", "provision", []),
  plugin("user-directory", "foundations", "app", "User Directory", "Internal person and directory backbone.", "directory.people", "Person", "register", ["auth-core", "org-tenant-core", "role-policy-core", "audit-core"]),
  plugin("org-tenant-core", "foundations", "app", "Org Tenant Core", "Tenant and organization graph management.", "org.tenants", "Tenant", "activate", ["auth-core"]),
  plugin("role-policy-core", "foundations", "app", "Role Policy Core", "RBAC and ABAC policy management backbone.", "roles.grants", "Grant", "assign", ["auth-core", "org-tenant-core"]),
  plugin("audit-core", "foundations", "app", "Audit Core", "Canonical audit trail and sensitive action history.", "audit.events", "AuditEvent", "record", ["auth-core", "org-tenant-core"]),
  plugin("workflow-core", "foundations", "app", "Workflow Core", "Explicit workflows and approval state machines.", "workflow.instances", "WorkflowInstance", "advance"),
  plugin("jobs-core", "foundations", "app", "Jobs Core", "Background jobs, schedules, and execution metadata.", "jobs.executions", "JobExecution", "schedule"),
  plugin("files-core", "foundations", "app", "Files Core", "File references and storage abstractions.", "files.assets", "FileAsset", "register"),
  plugin("notifications-core", "foundations", "app", "Notifications Core", "Outbound and in-app notifications.", "notifications.messages", "NotificationMessage", "queue"),
  plugin("search-core", "foundations", "app", "Search Core", "Typed search indexing and query abstractions.", "search.documents", "SearchDocument", "index"),
  plugin("dashboard-core", "foundations", "app", "Dashboard Core", "Dashboard, widget, and saved view backbone.", "dashboard.views", "DashboardView", "publish"),
  plugin("portal-core", "foundations", "app", "Portal Core", "Portal shell and self-service entrypoint backbone.", "portal.accounts", "PortalAccount", "enable"),
  plugin("content-core", "foundations", "app", "Content Core", "Pages, posts, and content type backbone.", "content.entries", "ContentEntry", "publish"),
  plugin("page-builder-core", "foundations", "app", "Page Builder Core", "Layout, block, and builder canvas backbone.", "page-builder.layouts", "Layout", "compose"),
  plugin("knowledge-core", "foundations", "app", "Knowledge Core", "Knowledge base, docs, and article tree backbone.", "knowledge.articles", "KnowledgeArticle", "publish"),
  plugin("forms-core", "foundations", "app", "Forms Core", "Dynamic forms and submissions backbone.", "forms.submissions", "FormSubmission", "submit"),
  plugin("community-core", "foundations", "app", "Community Core", "Community, groups, and membership backbone.", "community.memberships", "Membership", "enroll"),
  plugin("document-core", "foundations", "app", "Document Core", "Document lifecycle and generated document backbone.", "document.records", "DocumentRecord", "finalize"),
  plugin("template-core", "foundations", "app", "Template Core", "Reusable templates for content, messages, and workflows.", "template.records", "TemplateRecord", "version")
];

const domainPlugins = [];
const featurePacks = [];
const connectors = [];
const migrationPacks = [];
const verticals = [];
const bundles = [];

const platformPackages = [
  platformPackage("kernel", "Kernel", "Platform kernel, manifest DSLs, registries, and package contracts."),
  platformPackage("runtime-bun", "Runtime Bun", "Bun runtime wrapper utilities and environment helpers."),
  platformPackage("http", "HTTP", "Bun-native HTTP gateway and request context helpers."),
  platformPackage("config", "Config", "Typed platform configuration loaders."),
  platformPackage("schema", "Schema", "Resource, action, and contract DSLs."),
  platformPackage("api-rest", "API Rest", "REST route generation from resource and action metadata."),
  platformPackage("api-graphql", "API GraphQL", "Optional GraphQL Yoga adapter over the platform graph."),
  platformPackage("db-drizzle", "DB Drizzle", "Drizzle-first database contracts and role-aware context."),
  platformPackage("migrate", "Migrate", "Ordered migration planning and execution support."),
  platformPackage("auth", "Auth", "Better Auth wrapper and platform auth contracts."),
  platformPackage("auth-admin", "Auth Admin", "Administrative auth operations wrappers."),
  platformPackage("permissions", "Permissions", "Trust, permission, and policy engine contracts."),
  platformPackage("plugin-solver", "Plugin Solver", "Dependency resolution, ownership validation, and activation planning."),
  platformPackage("ui-shell", "UI Shell", "Admin, portal, and site shell composition."),
  platformPackage("ui-router", "UI Router", "TanStack Router wrapper APIs."),
  platformPackage("ui-query", "UI Query", "TanStack Query wrapper APIs."),
  platformPackage("ui-form", "UI Form", "React Hook Form wrapper APIs."),
  platformPackage("ui-table", "UI Table", "TanStack Table wrapper APIs."),
  platformPackage("ui-kit", "UI Kit", "Shared Radix and shell primitives."),
  platformPackage("ui-editor", "UI Editor", "Tiptap wrapper APIs."),
  platformPackage("ui-zone-next", "UI Zone Next", "Next.js product zone adapter."),
  platformPackage("ui-zone-static", "UI Zone Static", "Static React zone adapter."),
  platformPackage("jobs", "Jobs", "Queue-agnostic jobs and workflow execution contracts."),
  platformPackage("jobs-bullmq", "Jobs BullMQ", "BullMQ adapter for platform jobs."),
  platformPackage("events", "Events", "Typed domain events and outbox contracts."),
  platformPackage("logger", "Logger", "Structured Pino logging wrapper."),
  platformPackage("observability", "Observability", "OpenTelemetry wrapper and telemetry helpers."),
  platformPackage("email-templates", "Email Templates", "React Email wrapper and template helpers."),
  platformPackage("search", "Search", "Search abstraction layer."),
  platformPackage("geo", "Geo", "Geo abstraction and provider contracts."),
  platformPackage("analytics", "Analytics", "Metrics, marts, and analytics helper layer."),
  platformPackage("ai", "AI", "AI provider contract helpers and tool orchestration types.")
];

const apps = [
  appPackage("docs", "Documentation app for platform references and package maps."),
  appPackage("examples", "Example app collection for golden reference scenarios."),
  appPackage("playground", "Developer playground for local package composition."),
  appPackage("platform-dev-console", "Developer console for inspecting manifests and bundle resolution.")
];

for (const app of apps) {
  createApp(app);
}

for (const pkg of platformPackages) {
  createPlatformPackage(pkg);
}

for (const pack of foundationPlugins) {
  createPluginPackage(pack);
}

for (const pack of domainPlugins) {
  createPluginPackage(pack);
}

for (const pack of featurePacks) {
  createPluginPackage(pack);
}

for (const pack of connectors) {
  createConnectorPackage(pack);
}

for (const pack of migrationPacks) {
  createMigrationPackage(pack);
}

for (const pack of verticals) {
  createPluginPackage(pack);
}

for (const pack of bundles) {
  createBundlePackage(pack);
}

console.log("Workspace scaffolding complete.");

function plugin(id, group, kind, displayName, description, primaryDomain, entityName, actionVerb, dependsOn = ["auth-core", "org-tenant-core", "role-policy-core", "audit-core"]) {
  return {
    id,
    group,
    kind,
    displayName,
    description,
    primaryDomain,
    entityName,
    actionVerb,
    dependsOn: dependsOn.filter((dependencyId) => dependencyId !== id)
  };
}

function connector(id, displayName, description, capability, dependsOn, hosts, secrets) {
  return { id, displayName, description, capability, dependsOn, hosts, secrets };
}

function migration(id, displayName, sourceSystem, targetDomains, dependsOn) {
  return { id, displayName, sourceSystem, targetDomains, dependsOn };
}

function bundle(id, displayName, includes, optionalIncludes = []) {
  return { id, displayName, includes, optionalIncludes };
}

function platformPackage(id, displayName, description) {
  return {
    id,
    displayName,
    description,
    scope: corePlatformPackageIds.has(id) ? "core" : "libraries"
  };
}

function appPackage(id, description) {
  return { id, description };
}

function createApp(meta) {
  const appDir = path.join(rootDir, "apps", meta.id);
  const pkgName = `@apps/${meta.id}`;
  writePackageCommonFiles(appDir, pkgName, "0.1.0", {
    private: true,
    description: meta.description,
    scripts: {
      build: "bunx tsc -p tsconfig.build.json",
      typecheck: "bunx tsc -p tsconfig.json --noEmit",
      lint: "bunx eslint .",
      test: "bun test",
      "test:unit": "bun test tests/unit"
    },
    dependencies: {
      react: "^19.1.0",
      "react-dom": "^19.1.0",
      "@platform/kernel": "workspace:*"
    }
  });
  write(appDir, "src/index.ts", `export const appId = "${meta.id}";\n`);
  write(
    appDir,
    "src/App.tsx",
    [
      'import React from "react";',
      "",
      `export function App() {`,
      "  return (",
      '    <main data-app-root="true">',
      `      <h1>${meta.id}</h1>`,
      `      <p>${meta.description}</p>`,
      "    </main>",
      "  );",
      "}"
    ].join("\n")
  );
  write(
    appDir,
    "tests/unit/app.test.ts",
    [
      'import { describe, expect, it } from "bun:test";',
      'import { appId } from "../../src/index";',
      "",
      'describe("app scaffold", () => {',
      '  it("exposes a stable app id", () => {',
      `    expect(appId).toBe("${meta.id}");`,
      "  });",
      "});"
    ].join("\n")
  );
  writeUnderstandingDocs(appDir, {
    title: pascal(meta.id),
    id: meta.id,
    description: meta.description,
    resources: [],
    actions: [],
    workflows: []
  });
}

function createPlatformPackage(meta) {
  const dir = path.join(rootDir, "framework", meta.scope, meta.id);
  const pkgName = `@platform/${meta.id}`;
  writePackageCommonFiles(dir, pkgName, "0.1.0", {
    description: meta.description,
    scripts: {
      build: "bunx tsc -p tsconfig.build.json",
      typecheck: "bunx tsc -p tsconfig.json --noEmit",
      lint: "bunx eslint .",
      test: "bun test",
      "test:unit": "bun test tests/unit"
    }
  });
  write(
    dir,
    "src/index.ts",
    [
      `export const packageId = "${meta.id}" as const;`,
      `export const packageDisplayName = "${meta.displayName}" as const;`,
      `export const packageDescription = "${meta.description}" as const;`
    ].join("\n")
  );
  write(
    dir,
    "tests/unit/package.test.ts",
    [
      'import { describe, expect, it } from "bun:test";',
      'import { packageId } from "../../src";',
      "",
      'describe("platform package scaffold", () => {',
      '  it("exposes a stable package id", () => {',
      `    expect(packageId).toBe("${meta.id}");`,
      "  });",
      "});"
    ].join("\n")
  );
  writeUnderstandingDocs(dir, {
    title: meta.displayName,
    id: meta.id,
    description: meta.description,
    resources: [],
    actions: [],
    workflows: []
  });
}

function createPluginPackage(meta) {
  const dir =
    meta.group === "foundations"
      ? path.join(rootDir, "framework", "builtin-plugins", meta.id)
      : path.join(rootDir, "plugins", meta.group, meta.id);
  const pkgName = `@plugins/${meta.id}`;
  const namespace = meta.primaryDomain.split(".")[0];
  const resourceName = `${pascal(meta.entityName)}Resource`;
  const serviceFn = `${camel(meta.actionVerb)}${pascal(meta.entityName)}`;
  const actionConst = `${camel(meta.actionVerb)}${pascal(meta.entityName)}Action`;
  const policyConst = `${camel(namespace)}Policy`;
  const tableName = toSnake(meta.id.replace(/-(core|pack)$/g, ""));
  const internalDeps = dedupe([
    "@platform/kernel",
    "@platform/schema",
    "@platform/permissions",
    "@platform/ui-shell",
    ...meta.dependsOn.map((id) => `@plugins/${id}`)
  ]);

  writePackageCommonFiles(dir, pkgName, "0.1.0", {
    description: meta.description,
    scripts: {
      build: "bunx tsc -p tsconfig.build.json",
      typecheck: "bunx tsc -p tsconfig.json --noEmit",
      lint: "bunx eslint .",
      test: "bun test",
      "test:unit": "bun test tests/unit",
      "test:contracts": "bun test tests/contracts"
    },
    dependencies: {
      ...Object.fromEntries(internalDeps.map((dep) => [dep, "workspace:*"])),
      "drizzle-orm": "^0.43.1",
      react: "^19.1.0",
      zod: "^4.0.0"
    }
  });

  write(
    dir,
    "package.ts",
    [
      'import { definePackage } from "@platform/kernel";',
      "",
      "export default definePackage({",
      `  id: "${meta.id}",`,
      `  kind: "${meta.kind}",`,
      '  version: "0.1.0",',
      `  displayName: "${meta.displayName}",`,
      `  description: "${meta.description}",`,
      `  extends: ${meta.kind === "feature-pack" ? JSON.stringify([meta.dependsOn[0]]) : "[]"},`,
      `  dependsOn: ${JSON.stringify(meta.dependsOn)},`,
      "  optionalWith: [],",
      "  conflictsWith: [],",
      `  providesCapabilities: ["${meta.primaryDomain}"],`,
      `  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.${namespace}"],`,
      `  ownsData: ["${meta.primaryDomain}"],`,
      "  extendsData: [],",
      "  slotClaims: [],",
      '  trustTier: "first-party",',
      '  reviewTier: "R1",',
      '  isolationProfile: "same-process-trusted",',
      "  compatibility: {",
      '    framework: "^0.1.0",',
      '    runtime: "bun>=1.3.12",',
      '    db: ["postgres", "sqlite"]',
      "  }",
      "});"
    ].join("\n")
  );

  write(
    dir,
    "src/resources/main.resource.ts",
    [
      'import { defineResource } from "@platform/schema";',
      'import { z } from "zod";',
      'import { domainRecords } from "../../db/schema";',
      "",
      `export const ${resourceName} = defineResource({`,
      `  id: "${meta.primaryDomain}",`,
      `  description: "${meta.entityName} record for ${meta.displayName} business workflows.",`,
      `  businessPurpose: "Provide a governed ${meta.entityName.toLowerCase()} surface for ${meta.displayName} operators and automation.",`,
      `  invariants: ["Every ${meta.entityName.toLowerCase()} belongs to one tenant."],`,
      "  table: domainRecords,",
      "  contract: z.object({",
      '    id: z.string().uuid(),',
      '    tenantId: z.string().uuid(),',
      `    label: z.string().min(2).describe("${meta.entityName} label"),`,
      '    status: z.enum(["draft", "active", "inactive"]),',
      '    createdAt: z.string()',
      "  }),",
      "  fields: {",
      `    label: { searchable: true, sortable: true, label: "Label", description: "Primary operator label for the ${meta.entityName.toLowerCase()}." },`,
      `    status: { filter: "select", label: "Status", description: "Lifecycle status for the ${meta.entityName.toLowerCase()}." },`,
      `    createdAt: { sortable: true, label: "Created", description: "Timestamp when the ${meta.entityName.toLowerCase()} was created." }`,
      "  },",
      "  admin: {",
      "    autoCrud: true,",
      '    defaultColumns: ["label", "status", "createdAt"]',
      "  },",
      "  portal: { enabled: false }",
      "});"
    ].join("\n")
  );

  write(
    dir,
    "src/actions/default.action.ts",
    [
      'import { defineAction } from "@platform/schema";',
      'import { z } from "zod";',
      `import { ${serviceFn} } from "../services/main.service";`,
      "",
      `export const ${actionConst} = defineAction({`,
      `  id: "${meta.primaryDomain}.${meta.actionVerb}",`,
      `  description: "${pascal(meta.actionVerb)} a ${meta.entityName.toLowerCase()} in ${meta.displayName}.",`,
      `  businessPurpose: "Give operators a governed way to ${meta.actionVerb} the ${meta.entityName.toLowerCase()} lifecycle.",`,
      `  preconditions: ["The acting user must hold ${meta.primaryDomain}.${meta.actionVerb} permission."],`,
      `  sideEffects: ["Produces an auditable ${meta.primaryDomain}.${meta.actionVerb} result."],`,
      "  input: z.object({",
      '    id: z.string().uuid(),',
      '    tenantId: z.string().uuid(),',
      '    reason: z.string().min(3).optional()',
      "  }),",
      "  output: z.object({",
      '    ok: z.literal(true),',
      '    nextStatus: z.enum(["active", "inactive"])',
      "  }),",
      `  permission: "${meta.primaryDomain}.${meta.actionVerb}",`,
      "  idempotent: true,",
      "  audit: true,",
      "  handler: async ({ input }) => {",
      `    return ${serviceFn}(input);`,
      "  }",
      "});"
    ].join("\n")
  );

  write(
    dir,
    "src/policies/default.policy.ts",
    [
      'import { definePolicy } from "@platform/permissions";',
      "",
      `export const ${policyConst} = definePolicy({`,
      `  id: "${meta.id}.default",`,
      "  rules: [",
      "    {",
      `      permission: "${meta.primaryDomain}.read",`,
      '      allowIf: ["role:admin", "role:operator"]',
      "    },",
      "    {",
      `      permission: "${meta.primaryDomain}.${meta.actionVerb}",`,
      '      allowIf: ["role:admin"],',
      "      requireReason: true,",
      "      audit: true",
      "    }",
      "  ]",
      "});"
    ].join("\n")
  );

  write(
    dir,
    "src/services/main.service.ts",
    [
      'import { normalizeActionInput } from "@platform/schema";',
      "",
      "export type DomainActionInput = {",
      "  id: string;",
      "  tenantId: string;",
      "  reason?: string | undefined;",
      "};",
      "",
      `export async function ${serviceFn}(input: DomainActionInput): Promise<{ ok: true; nextStatus: "active" | "inactive" }> {`,
      "  normalizeActionInput(input);",
      '  const nextStatus = "inactive" as const;',
      "  return { ok: true, nextStatus };",
      "}"
    ].join("\n")
  );

  write(
    dir,
    "src/ui/admin/main.page.tsx",
    [
      'import React from "react";',
      "",
      `export function ${pascal(meta.id)}AdminPage() {`,
      "  return (",
      `    <section data-plugin-page="${meta.id}">`,
      `      <h1>${meta.displayName}</h1>`,
      `      <p>${meta.description}</p>`,
      "    </section>",
      "  );",
      "}"
    ].join("\n")
  );

  write(
    dir,
    "src/ui/surfaces.ts",
    [
      'import { defineUiSurface } from "@platform/ui-shell";',
      `import { ${pascal(meta.id)}AdminPage } from "./admin/main.page";`,
      "",
      "export const uiSurface = defineUiSurface({",
      "  embeddedPages: [",
      "    {",
      '      shell: "admin",',
      `      route: "/admin/${meta.id}",`,
      `      component: ${pascal(meta.id)}AdminPage,`,
      `      permission: "${meta.primaryDomain}.read"`,
      "    }",
      "  ],",
      "  widgets: []",
      "});"
    ].join("\n")
  );

  write(
    dir,
    "src/index.ts",
    [
      `export { ${resourceName} } from "./resources/main.resource";`,
      `export { ${actionConst} } from "./actions/default.action";`,
      `export { ${policyConst} } from "./policies/default.policy";`,
      `export { ${serviceFn} } from "./services/main.service";`,
      'export { uiSurface } from "./ui/surfaces";',
      'export { default as manifest } from "../package";'
    ].join("\n")
  );

  write(
    dir,
    "db/schema.ts",
    [
      'import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";',
      "",
      `export const domainRecords = pgTable("${tableName}_records", {`,
      '  id: uuid("id").primaryKey(),',
      '  tenantId: uuid("tenant_id").notNull(),',
      '  label: text("label").notNull(),',
      '  status: text("status").notNull(),',
      '  createdAt: timestamp("created_at").notNull().defaultNow()',
      "});"
    ].join("\n")
  );

  write(
    dir,
    "tests/unit/package.test.ts",
    [
      'import { describe, expect, it } from "bun:test";',
      'import manifest from "../../package";',
      "",
      'describe("plugin manifest", () => {',
      '  it("keeps a stable package id and primary capability", () => {',
      `    expect(manifest.id).toBe("${meta.id}");`,
      `    expect(manifest.providesCapabilities).toContain("${meta.primaryDomain}");`,
      "  });",
      "});"
    ].join("\n")
  );

  write(
    dir,
    "tests/contracts/ui-surface.test.ts",
    [
      'import { describe, expect, it } from "bun:test";',
      'import { uiSurface } from "../../src/ui/surfaces";',
      "",
      'describe("ui surface registration", () => {',
      '  it("registers a single admin embedded page", () => {',
      "    expect(uiSurface.embeddedPages).toHaveLength(1);",
      `    expect(uiSurface.embeddedPages[0]?.route).toBe("/admin/${meta.id}");`,
      "  });",
      "});"
    ].join("\n")
  );
  writeUnderstandingDocs(dir, {
    title: meta.displayName,
    id: meta.id,
    description: meta.description,
    resources: [meta.primaryDomain],
    actions: [`${meta.primaryDomain}.${meta.actionVerb}`],
    workflows: []
  });
}

function createConnectorPackage(meta) {
  const dir = path.join(rootDir, "plugins", "connectors", meta.id);
  const pkgName = `@plugins/${meta.id}`;
  writePackageCommonFiles(dir, pkgName, "0.1.0", {
    description: meta.description,
    scripts: {
      build: "bunx tsc -p tsconfig.build.json",
      typecheck: "bunx tsc -p tsconfig.json --noEmit",
      lint: "bunx eslint .",
      test: "bun test",
      "test:unit": "bun test tests/unit",
      "test:integration": "bun test tests/integration"
    },
    dependencies: {
      "@platform/kernel": "workspace:*",
      "@platform/http": "workspace:*",
      "@platform/permissions": "workspace:*",
      zod: "^4.0.0"
    }
  });

  write(
    dir,
    "package.ts",
    [
      'import { defineConnector } from "@platform/kernel";',
      "",
      "export default defineConnector({",
      `  id: "${meta.id}",`,
      '  kind: "connector",',
      '  version: "0.1.0",',
      `  displayName: "${meta.displayName}",`,
      `  description: "${meta.description}",`,
      `  dependsOn: ${JSON.stringify(meta.dependsOn)},`,
      `  requestedCapabilities: ["network.egress", "secrets.read", "webhooks.receive", "${meta.capability}"],`,
      `  requestedHosts: ${JSON.stringify(meta.hosts)},`,
      "  connector: {",
      `    provider: "${meta.id.replace(/-adapter$/, "")}",`,
      `    secrets: ${JSON.stringify(meta.secrets)},`,
      "    webhooks: [",
      "      {",
      '        event: "default.event",',
      `        route: "/webhooks/${meta.id}/default-event"`,
      "      }",
      "    ]",
      "  },",
      '  trustTier: "partner-reviewed",',
      '  reviewTier: "R2",',
      '  isolationProfile: "sidecar",',
      "  compatibility: { framework: '^0.1.0', runtime: 'bun>=1.3.12', db: ['postgres', 'sqlite'] }",
      "});"
    ].join("\n")
  );

  write(
    dir,
    "src/provider/client.ts",
    [
      'export type ProviderRequest = { path: string; method: "GET" | "POST"; body?: string | undefined };',
      "",
      "export function createProviderRequest(path: string, body?: string): ProviderRequest {",
      '  return { path, method: body ? "POST" : "GET", body };',
      "}"
    ].join("\n")
  );

  write(
    dir,
    "src/provider/mappers.ts",
    [
      "export function mapProviderPayload<TInput extends Record<string, unknown>>(payload: TInput) {",
      "  return { ...payload, mappedAt: new Date(0).toISOString() };",
      "}"
    ].join("\n")
  );

  write(
    dir,
    "src/provider/webhooks.ts",
    [
      'export async function verifyWebhookSignature(secret: string, signature: string, payload: string): Promise<boolean> {',
      "  const key = await crypto.subtle.importKey(",
      '    "raw",',
      '    new TextEncoder().encode(secret),',
      '    { name: "HMAC", hash: "SHA-256" },',
      "    false,",
      '    ["sign"]',
      "  );",
      '  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));',
      "  const encoded = Buffer.from(signed).toString('hex');",
      "  return encoded === signature;",
      "}"
    ].join("\n")
  );

  write(
    dir,
    "src/index.ts",
    [
      'export { createProviderRequest } from "./provider/client";',
      'export { mapProviderPayload } from "./provider/mappers";',
      'export { verifyWebhookSignature } from "./provider/webhooks";',
      'export { default as manifest } from "../package";'
    ].join("\n")
  );

  write(
    dir,
    "tests/unit/connector.test.ts",
    [
      'import { describe, expect, it } from "bun:test";',
      'import manifest from "../../package";',
      "",
      'describe("connector manifest", () => {',
      '  it("declares hosts and secrets", () => {',
      `    expect(manifest.id).toBe("${meta.id}");`,
      "    expect(manifest.requestedHosts.length).toBeGreaterThan(0);",
      "    expect(manifest.connector.secrets.length).toBeGreaterThan(0);",
      "  });",
      "});"
    ].join("\n")
  );

  write(
    dir,
    "tests/integration/webhook.test.ts",
    [
      'import { describe, expect, it } from "bun:test";',
      'import { verifyWebhookSignature } from "../../src/provider/webhooks";',
      "",
      'describe("webhook signature verification", () => {',
      '  it("accepts matching signatures", async () => {',
      '    const secret = "top-secret";',
      '    const payload = "{\\"ok\\":true}";',
      "    const key = await crypto.subtle.importKey(",
      '      "raw",',
      '      new TextEncoder().encode(secret),',
      '      { name: "HMAC", hash: "SHA-256" },',
      "      false,",
      '      ["sign"]',
      "    );",
      '    const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));',
      "    const signature = Buffer.from(signatureBuffer).toString('hex');",
      "    await expect(verifyWebhookSignature(secret, signature, payload)).resolves.toBe(true);",
      "  });",
      "});"
    ].join("\n")
  );
  writeUnderstandingDocs(dir, {
    title: meta.displayName,
    id: meta.id,
    description: meta.description,
    resources: [],
    actions: ["provider request", "payload mapping", "webhook verification"],
    workflows: []
  });
}

function createMigrationPackage(meta) {
  const dir = path.join(rootDir, "plugins", "migrations", meta.id);
  const pkgName = `@plugins/${meta.id}`;
  writePackageCommonFiles(dir, pkgName, "0.1.0", {
    description: `Migration pack for ${meta.sourceSystem}.`,
    scripts: {
      build: "bunx tsc -p tsconfig.build.json",
      typecheck: "bunx tsc -p tsconfig.json --noEmit",
      lint: "bunx eslint .",
      test: "bun test",
      "test:unit": "bun test tests/unit",
      "test:migrations": "bun test tests/migrations"
    },
    dependencies: {
      "@platform/kernel": "workspace:*",
      zod: "^4.0.0"
    }
  });

  write(
    dir,
    "package.ts",
    [
      'import { defineMigrationPack } from "@platform/kernel";',
      "",
      "export default defineMigrationPack({",
      `  id: "${meta.id}",`,
      '  kind: "migration-pack",',
      '  version: "0.1.0",',
      `  displayName: "${meta.displayName}",`,
      `  description: "Migration pack for ${meta.sourceSystem}.",`,
      `  dependsOn: ${JSON.stringify(meta.dependsOn)},`,
      `  sourceSystem: "${meta.sourceSystem}",`,
      `  targetDomains: ${JSON.stringify(meta.targetDomains)},`,
      '  phases: ["discover", "map", "dry-run", "delta-sync", "cutover", "reconcile"],',
      '  trustTier: "first-party",',
      '  reviewTier: "R2",',
      '  isolationProfile: "sidecar",',
      "  compatibility: { framework: '^0.1.0', runtime: 'bun>=1.3.12', db: ['postgres', 'sqlite'] }",
      "});"
    ].join("\n")
  );

  write(dir, "src/discover/index.ts", "export function discoverSource() { return { discovered: true as const }; }\n");
  write(dir, "src/map/index.ts", `export function mapFields() { return ${JSON.stringify(meta.targetDomains)}; }\n`);
  write(dir, "src/import/index.ts", "export function importRecords(dryRun = true) { return { dryRun, importedCount: dryRun ? 0 : 1 }; }\n");
  write(dir, "src/reconcile/index.ts", "export function reconcileImport() { return { reconciled: true as const }; }\n");
  write(dir, "src/cutover/index.ts", "export function planCutover() { return { ready: true as const }; }\n");
  write(
    dir,
    "src/index.ts",
    [
      'export { discoverSource } from "./discover";',
      'export { mapFields } from "./map";',
      'export { importRecords } from "./import";',
      'export { reconcileImport } from "./reconcile";',
      'export { planCutover } from "./cutover";',
      'export { default as manifest } from "../package";'
    ].join("\n")
  );
  write(
    dir,
    "tests/unit/migration.test.ts",
    [
      'import { describe, expect, it } from "bun:test";',
      'import manifest from "../../package";',
      "",
      'describe("migration manifest", () => {',
      '  it("declares target domains", () => {',
      `    expect(manifest.sourceSystem).toBe("${meta.sourceSystem}");`,
      `    expect(manifest.targetDomains).toEqual(${JSON.stringify(meta.targetDomains)});`,
      "  });",
      "});"
    ].join("\n")
  );
  write(
    dir,
    "tests/migrations/dry-run.test.ts",
    [
      'import { describe, expect, it } from "bun:test";',
      'import { importRecords } from "../../src/import";',
      "",
      'describe("migration dry run", () => {',
      '  it("does not import records during dry-run", () => {',
      "    expect(importRecords(true)).toEqual({ dryRun: true, importedCount: 0 });",
      "  });",
      "});"
    ].join("\n")
  );
  writeUnderstandingDocs(dir, {
    title: meta.displayName,
    id: meta.id,
    description: `Migration pack for ${meta.sourceSystem}.`,
    resources: meta.targetDomains,
    actions: ["discover source", "map fields", "import records", "reconcile import", "plan cutover"],
    workflows: ["discover -> map -> dry-run -> delta-sync -> cutover -> reconcile"]
  });
}

function createBundlePackage(meta) {
  const dir = path.join(rootDir, "plugins", "bundles", meta.id);
  const pkgName = `@plugins/${meta.id}`;
  writePackageCommonFiles(dir, pkgName, "0.1.0", {
    description: `${meta.displayName} bundle.`,
    scripts: {
      build: "bunx tsc -p tsconfig.build.json",
      typecheck: "bunx tsc -p tsconfig.json --noEmit",
      lint: "bunx eslint .",
      test: "bun test",
      "test:contracts": "bun test tests/contracts"
    },
    dependencies: {
      "@platform/kernel": "workspace:*"
    }
  });
  write(
    dir,
    "package.ts",
    [
      'import { defineBundle } from "@platform/kernel";',
      "",
      "export default defineBundle({",
      `  id: "${meta.id}",`,
      '  kind: "bundle",',
      '  version: "0.1.0",',
      `  displayName: "${meta.displayName}",`,
      `  includes: ${JSON.stringify(meta.includes)},`,
      `  optionalIncludes: ${JSON.stringify(meta.optionalIncludes)},`,
      "  compatibility: { framework: '^0.1.0', runtime: 'bun>=1.3.12', db: ['postgres', 'sqlite'] }",
      "});"
    ].join("\n")
  );
  write(
    dir,
    "bundle.lock.ts",
    [
      `export const bundleMembers = ${JSON.stringify(meta.includes, null, 2)} as const;`,
      `export const optionalBundleMembers = ${JSON.stringify(meta.optionalIncludes, null, 2)} as const;`
    ].join("\n")
  );
  write(
    dir,
    "src/index.ts",
    ['export { default as manifest } from "../package";', 'export * from "../bundle.lock";'].join("\n")
  );
  write(
    dir,
    "tests/contracts/bundle.test.ts",
    [
      'import { describe, expect, it } from "bun:test";',
      'import manifest from "../../package";',
      "",
      'describe("bundle contract", () => {',
      '  it("keeps required members explicit", () => {',
      `    expect(manifest.id).toBe("${meta.id}");`,
      "    expect(manifest.includes.length).toBeGreaterThan(0);",
      "  });",
      "});"
    ].join("\n")
  );
  writeUnderstandingDocs(dir, {
    title: meta.displayName,
    id: meta.id,
    description: `${meta.displayName} bundle.`,
    resources: meta.includes,
    actions: [],
    workflows: []
  });
}

function writePackageCommonFiles(dir, name, version, { private: isPrivate = false, description, scripts, dependencies = {} }) {
  const relativeRoot = path.relative(dir, rootDir) || ".";

  write(
    dir,
    "package.json",
    JSON.stringify(
      {
        name,
        version,
        private: isPrivate,
        description,
        type: "module",
        main: "./dist/index.js",
        types: "./dist/index.d.ts",
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            default: "./dist/index.js"
          }
        },
        scripts,
        dependencies
      },
      null,
      2
    ) + "\n"
  );

  write(
    dir,
    "tsconfig.json",
    JSON.stringify(
      {
        extends: `${relativeRoot}/tsconfig.base.json`,
        compilerOptions: {
          noEmit: true
        },
        include: ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx", "package.ts", "db/**/*.ts", "bundle.lock.ts"]
      },
      null,
      2
    ) + "\n"
  );

  write(
    dir,
    "tsconfig.build.json",
    JSON.stringify(
      {
        extends: "./tsconfig.json",
        compilerOptions: {
          noEmit: false,
          outDir: "./dist",
          rootDir: "."
        },
        exclude: ["tests"]
      },
      null,
      2
    ) + "\n"
  );
}

function writeUnderstandingDocs(dir, meta) {
  write(
    dir,
    "docs/AGENT_CONTEXT.md",
    [
      `# ${meta.title} Agent Context`,
      "",
      `Package/app id: \`${meta.id}\``,
      "",
      "## Purpose",
      "",
      meta.description,
      "",
      "## Resources",
      "",
      meta.resources.length > 0 ? meta.resources.map((value) => `- ${value}`).join("\n") : "- Add the core business entities here.",
      "",
      "## Actions",
      "",
      meta.actions.length > 0 ? meta.actions.map((value) => `- ${value}`).join("\n") : "- Add the core operator or automation actions here.",
      "",
      "## Workflows",
      "",
      meta.workflows.length > 0 ? meta.workflows.map((value) => `- ${value}`).join("\n") : "- Add the important review, publish, approval, or delivery workflows here."
    ].join("\n")
  );
  write(
    dir,
    "docs/BUSINESS_RULES.md",
    `# ${meta.title} Business Rules\n\n- Document invariants, approvals, and things that must never be bypassed.\n`
  );
  write(
    dir,
    "docs/FLOWS.md",
    `# ${meta.title} Flows\n\n- Document happy paths, exception paths, and cross-package dependencies.\n`
  );
  write(
    dir,
    "docs/GLOSSARY.md",
    `# ${meta.title} Glossary\n\n- Define the key nouns, statuses, and domain terms used by this module.\n`
  );
  write(
    dir,
    "docs/EDGE_CASES.md",
    `# ${meta.title} Edge Cases\n\n- Document anomalies, failure modes, retries, and reconciliation guidance.\n`
  );
  write(
    dir,
    "docs/MANDATORY_STEPS.md",
    `# ${meta.title} Mandatory Steps\n\n- Document steps that humans and agents must never skip.\n`
  );
}

function write(dir, relativePath, content) {
  const absolutePath = path.join(dir, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function pascal(value) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function camel(value) {
  const converted = pascal(value);
  return converted.charAt(0).toLowerCase() + converted.slice(1);
}

function toSnake(value) {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function dedupe(values) {
  return [...new Set(values)];
}
