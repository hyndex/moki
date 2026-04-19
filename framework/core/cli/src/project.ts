import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { createUnderstandingDocPack } from "@platform/agent-understanding";

export type InitWorkspaceOptions = {
  target: string;
  frameworkSource?: string | undefined;
  frameworkMode?: "symlink" | "copy" | undefined;
  force?: boolean | undefined;
};

export type InitWorkspaceResult = {
  ok: true;
  projectRoot: string;
  frameworkSource: string;
  frameworkMode: "symlink" | "copy";
  starterPluginId: string;
  starterAppId: string;
  nextSteps: string[];
};

const frameworkDistributionEntries = [
  "framework",
  "tooling",
  "docs",
  "README.md",
  "Goal.md",
  "Developer_DeepDive.md",
  "package.json",
  "tsconfig.base.json",
  "tsconfig.json",
  "bunfig.toml",
  "eslint.config.mjs",
  "prettier.config.mjs"
] as const;

export function initGutuWorkspace(cwd: string, options: InitWorkspaceOptions): InitWorkspaceResult {
  const projectRoot = resolve(cwd, options.target);
  const frameworkSource = resolve(options.frameworkSource ?? detectFrameworkSourceRoot());
  const frameworkMode = options.frameworkMode ?? "symlink";

  prepareTargetDirectory(projectRoot, options.force ?? false);
  ensureFrameworkSource(frameworkSource);

  const projectName = slugifyName(projectRoot.split("/").filter(Boolean).at(-1) ?? "gutu-project");
  const starterPluginId = `${projectName}-core`;
  const starterAppId = `${projectName}-studio`;

  mkdirSync(projectRoot, { recursive: true });
  writeProjectFiles(projectRoot, {
    projectName,
    frameworkMode,
    frameworkSource,
    starterPluginId,
    starterAppId
  });

  vendorFrameworkDistribution(projectRoot, frameworkSource, frameworkMode);
  writeStarterPlugin(projectRoot, starterPluginId);
  writeStarterApp(projectRoot, starterAppId, starterPluginId);
  writeProjectMetadata(projectRoot, {
    projectName,
    frameworkMode,
    starterPluginId,
    starterAppId
  });

  return {
    ok: true,
    projectRoot,
    frameworkSource,
    frameworkMode,
    starterPluginId,
    starterAppId,
    nextSteps: [
      `cd ${projectRoot}`,
      "bun install",
      "bun run docs:scaffold",
      "bun run ci:check"
    ]
  };
}

function detectFrameworkSourceRoot(): string {
  let cursor = resolve(import.meta.dir);

  for (let depth = 0; depth < 8; depth += 1) {
    if (frameworkDistributionEntries.every((entry) => existsSync(join(cursor, entry)))) {
      return cursor;
    }

    const parent = dirname(cursor);
    if (parent === cursor) {
      break;
    }
    cursor = parent;
  }

  return resolve(import.meta.dir, "../../../../");
}

function prepareTargetDirectory(projectRoot: string, force: boolean) {
  if (!existsSync(projectRoot)) {
    return;
  }

  const entries = readdirSync(projectRoot);
  if (entries.length === 0) {
    return;
  }

  if (!force) {
    throw new Error(`Target directory '${projectRoot}' already exists and is not empty. Use --force true to overwrite it.`);
  }

  rmSync(projectRoot, { recursive: true, force: true });
}

function ensureFrameworkSource(frameworkSource: string) {
  for (const entry of frameworkDistributionEntries) {
    if (!existsSync(join(frameworkSource, entry))) {
      throw new Error(`Framework source '${frameworkSource}' is missing required entry '${entry}'.`);
    }
  }
}

function writeProjectFiles(
  projectRoot: string,
  input: {
    projectName: string;
    frameworkMode: "symlink" | "copy";
    frameworkSource: string;
    starterPluginId: string;
    starterAppId: string;
  }
) {
  const files: Record<string, string> = {
    ".gitignore": createGitignore(),
    "README.md": createProjectReadme(input.projectName, input.starterPluginId, input.starterAppId),
    "package.json": createProjectPackageJson(input.projectName),
    "bunfig.toml": createProjectBunfig(),
    "tsconfig.json": createProjectTsconfig(),
    "tsconfig.base.json": createProjectTsconfigBase(),
    "gutu.project.json": createProjectManifestJson(input.projectName, input.frameworkMode),
    "docs/README.md": createProjectDocsReadme(input.projectName),
    "vendor/plugins/.gitkeep": "",
    "vendor/libraries/.gitkeep": "",
    ".gutu/state/.gitkeep": "",
    ".gutu/cache/.gitkeep": ""
  };

  for (const [relativePath, contents] of Object.entries(files)) {
    write(projectRoot, relativePath, contents);
  }
}

function vendorFrameworkDistribution(projectRoot: string, frameworkSource: string, mode: "symlink" | "copy") {
  const vendorRoot = join(projectRoot, "vendor", "framework", "gutu");
  mkdirSync(vendorRoot, { recursive: true });

  for (const entry of frameworkDistributionEntries) {
    const sourcePath = join(frameworkSource, entry);
    const targetPath = join(vendorRoot, entry);

    if (mode === "symlink") {
      const relativeTarget = relative(dirname(targetPath), sourcePath) || ".";
      symlinkSync(relativeTarget, targetPath, lstatSync(sourcePath).isDirectory() ? "dir" : "file");
      continue;
    }

    if (lstatSync(sourcePath).isDirectory()) {
      cpSync(sourcePath, targetPath, {
        recursive: true,
        filter: (source) => {
          const relativeSource = relative(frameworkSource, source);
          if (!relativeSource) {
            return true;
          }

          const topLevel = relativeSource.split(/[\\/]/g)[0];
          if (topLevel === "node_modules" || topLevel === "coverage" || topLevel === "artifacts") {
            return false;
          }

          return !relativeSource.endsWith(".tsbuildinfo");
        }
      });
    } else {
      mkdirSync(dirname(targetPath), { recursive: true });
      cpSync(sourcePath, targetPath);
    }
  }
}

function writeStarterPlugin(projectRoot: string, pluginId: string) {
  const pluginDir = join(projectRoot, "plugins", pluginId);
  const displayName = toDisplayName(pluginId);

  const files: Record<string, string> = {
    "package.ts": `import { definePackage } from "@platform/kernel";\n\nexport default definePackage({\n  id: "${pluginId}",\n  kind: "app",\n  version: "0.1.0",\n  displayName: "${displayName}",\n  description: "Starter business plugin for the ${displayName} project workspace.",\n  dependsOn: ["auth-core", "org-tenant-core", "role-policy-core", "audit-core"],\n  providesCapabilities: ["${pluginId}.manage"],\n  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.${pluginId}"],\n  ownsData: ["${pluginId}.records"],\n  extendsData: [],\n  slotClaims: [],\n  trustTier: "first-party",\n  reviewTier: "R1",\n  isolationProfile: "same-process-trusted",\n  compatibility: {\n    framework: "^0.1.0",\n    runtime: "bun>=1.3.12",\n    db: ["postgres", "sqlite"]\n  }\n});\n`,
    "package.json": `{\n  "name": "@plugins/${pluginId}",\n  "version": "0.1.0",\n  "private": true,\n  "type": "module",\n  "main": "./dist/index.js",\n  "types": "./dist/index.d.ts",\n  "exports": {\n    ".": {\n      "types": "./dist/index.d.ts",\n      "default": "./dist/index.js"\n    }\n  },\n  "scripts": {\n    "build": "bunx tsc -p tsconfig.build.json",\n    "typecheck": "bunx tsc -p tsconfig.json --noEmit",\n    "lint": "bunx eslint .",\n    "test": "bun test",\n    "test:unit": "bun test tests/unit"\n  },\n  "dependencies": {\n    "@platform/admin-contracts": "workspace:*",\n    "@platform/kernel": "workspace:*",\n    "@platform/schema": "workspace:*",\n    "react": "^19.1.0",\n    "zod": "^4.0.0"\n  }\n}\n`,
    "tsconfig.json": `{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "noEmit": true\n  },\n  "include": [\n    "src/**/*.ts",\n    "src/**/*.tsx",\n    "tests/**/*.ts",\n    "tests/**/*.tsx",\n    "package.ts"\n  ]\n}\n`,
    "tsconfig.build.json": `{\n  "extends": "./tsconfig.json",\n  "compilerOptions": {\n    "noEmit": false,\n    "outDir": "./dist"\n  },\n  "exclude": [\n    "tests"\n  ]\n}\n`,
    "src/index.ts": `export { default as manifest } from "../package";\nexport * from "./resources/main.resource";\nexport * from "./actions/default.action";\nexport * from "./ui/admin.contributions";\n`,
    "src/resources/main.resource.ts": `import { defineResource } from "@platform/schema";\nimport { z } from "zod";\n\nexport const ${toComponentName(pluginId)}RecordResource = defineResource({\n  id: "${pluginId}.records",\n  description: "Primary tenant-scoped record used by the ${displayName} product module.",\n  businessPurpose: "Gives the team one canonical business record to extend without inventing structure from scratch.",\n  invariants: [\n    "Every record belongs to exactly one tenant.",\n    "Archived records remain visible in audit history."\n  ],\n  actors: ["operator", "manager", "automation"],\n  table: { name: "${pluginId.replace(/-/g, "_")}_records" },\n  contract: z.object({\n    id: z.string().uuid(),\n    tenantId: z.string().uuid(),\n    label: z.string().min(2),\n    status: z.enum(["draft", "active", "archived"]),\n    createdAt: z.string()\n  }),\n  fields: {\n    label: {\n      label: "Label",\n      searchable: true,\n      sortable: true,\n      description: "Short operator-facing title for the record.",\n      businessMeaning: "The primary display value used in list views, reports, and approvals.",\n      sourceOfTruth: true\n    },\n    status: {\n      label: "Status",\n      filter: "select",\n      description: "Operational lifecycle stage for the record.",\n      requiredForFlows: ["activation", "archival"]\n    },\n    createdAt: {\n      label: "Created",\n      sortable: true,\n      description: "When the record was first created."\n    }\n  },\n  admin: {\n    autoCrud: true,\n    defaultColumns: ["label", "status", "createdAt"]\n  },\n  portal: {\n    enabled: false\n  }\n});\n`,
    "src/actions/default.action.ts": `import { defineAction } from "@platform/schema";\nimport { z } from "zod";\n\nexport const publish${toComponentName(pluginId)}RecordAction = defineAction({\n  id: "${pluginId}.records.publish",\n  description: "Moves a record into the active state with audit visibility.",\n  businessPurpose: "Provides a safe, explicit command for promoting a draft record into active operations.",\n  permission: "${pluginId}.records.publish",\n  idempotent: true,\n  audit: true,\n  input: z.object({\n    id: z.string().uuid(),\n    tenantId: z.string().uuid(),\n    reason: z.string().min(3).optional()\n  }),\n  output: z.object({\n    ok: z.literal(true),\n    nextStatus: z.literal("active")\n  }),\n  preconditions: [\n    "The caller must have publish permission for the current tenant.",\n    "The record must already exist."\n  ],\n  mandatorySteps: [\n    "Capture why the record is being activated.",\n    "Emit an audit event for the status transition."\n  ],\n  sideEffects: [\n    "The record appears in active default views."\n  ],\n  postconditions: [\n    "Operators can discover the record through the admin workbench."\n  ],\n  failureModes: [\n    "Permission denied.",\n    "Unknown record."\n  ],\n  forbiddenShortcuts: [\n    "Do not update the status directly without going through the action."\n  ],\n  handler: async () => ({\n    ok: true,\n    nextStatus: "active"\n  })\n});\n`,
    "src/ui/admin/main.page.tsx": `import React from "react";\n\nexport function ${toComponentName(pluginId)}AdminPage() {\n  return (\n    <section data-plugin-page="${pluginId}">\n      <h1>${displayName}</h1>\n      <p>Start shaping the real operator experience for this product module here.</p>\n    </section>\n  );\n}\n`,
    "src/ui/admin.contributions.ts": `import {\n  defineAdminNav,\n  defineCommand,\n  definePage,\n  defineSearchProvider,\n  defineWidget,\n  defineWorkspace,\n  type AdminContributionRegistry\n} from "@platform/admin-contracts";\n\nimport { ${toComponentName(pluginId)}AdminPage } from "./admin/main.page";\n\nexport const adminContributions: Pick<\n  AdminContributionRegistry,\n  "workspaces" | "nav" | "pages" | "widgets" | "commands" | "searchProviders"\n> = {\n  workspaces: [\n    defineWorkspace({\n      id: "${pluginId}",\n      label: "${displayName}",\n      icon: "sparkles",\n      description: "Starter workspace for the ${displayName} module.",\n      permission: "${pluginId}.records.read",\n      homePath: "/admin/workspace/${pluginId}",\n      cards: ["${pluginId}.records.status"],\n      quickActions: ["${pluginId}.open.home"]\n    })\n  ],\n  nav: [\n    defineAdminNav({\n      workspace: "${pluginId}",\n      group: "records",\n      items: [\n        {\n          id: "${pluginId}.records",\n          label: "Records",\n          icon: "folder-open",\n          to: "/admin/${pluginId}/records",\n          permission: "${pluginId}.records.read"\n        }\n      ]\n    })\n  ],\n  pages: [\n    definePage({\n      id: "${pluginId}.home",\n      kind: "list",\n      route: "/admin/${pluginId}/records",\n      label: "${displayName} Records",\n      workspace: "${pluginId}",\n      permission: "${pluginId}.records.read",\n      component: ${toComponentName(pluginId)}AdminPage\n    })\n  ],\n  widgets: [\n    defineWidget({\n      id: "${pluginId}.records.status",\n      kind: "status",\n      shell: "admin",\n      slot: "dashboard.${pluginId}",\n      permission: "${pluginId}.records.read",\n      title: "${displayName} Status"\n    })\n  ],\n  commands: [\n    defineCommand({\n      id: "${pluginId}.open.home",\n      label: "Open ${displayName}",\n      permission: "${pluginId}.records.read",\n      href: "/admin/${pluginId}/records",\n      keywords: ["${pluginId}", "${displayName.toLowerCase()}", "records"]\n    })\n  ],\n  searchProviders: [\n    defineSearchProvider({\n      id: "${pluginId}.search",\n      scopes: ["records"],\n      permission: "${pluginId}.records.read",\n      search(query) {\n        return [\n          {\n            id: "${pluginId}:records",\n            label: "${displayName} Records",\n            href: "/admin/${pluginId}/records",\n            kind: "page",\n            description: "Starter search result for the generated workspace."\n          }\n        ].filter((entry) => query.trim().length === 0 || entry.label.toLowerCase().includes(query.trim().toLowerCase()));\n      }\n    })\n  ]\n};\n`,
    "tests/unit/package.test.ts": `import { describe, expect, it } from "bun:test";\n\nimport manifest from "../../package";\n\ndescribe("starter plugin manifest", () => {\n  it("keeps a stable package id", () => {\n    expect(manifest.id).toBe("${pluginId}");\n  });\n});\n`
  };

  for (const [relativePath, contents] of Object.entries(files)) {
    write(pluginDir, relativePath, contents);
  }

  const docPack = createUnderstandingDocPack({
    id: pluginId,
    displayName,
    description: `Starter business plugin for the ${displayName} project workspace.`,
    location: `plugins/${pluginId}`,
    targetType: "package",
    packageKind: "app",
    dependsOn: ["auth-core", "org-tenant-core", "role-policy-core", "audit-core"],
    providesCapabilities: [`${pluginId}.manage`],
    requestedCapabilities: ["ui.register.admin", "api.rest.mount", `data.write.${pluginId}`],
    resources: [
      {
        id: `${pluginId}.records`,
        description: "Primary tenant-scoped record used by the starter project.",
        businessPurpose: "Gives the team a clean default entity to extend.",
        invariants: ["Every record belongs to one tenant."],
        actors: ["operator", "manager", "automation"],
        fields: [
          {
            name: "label",
            label: "Label",
            description: "Short operator-facing title for the record.",
            businessMeaning: "Primary human-readable value."
          },
          {
            name: "status",
            label: "Status",
            description: "Current lifecycle stage of the record."
          },
          {
            name: "createdAt",
            label: "Created",
            description: "When the record was created."
          }
        ]
      }
    ],
    actions: [
      {
        id: `${pluginId}.records.publish`,
        permission: `${pluginId}.records.publish`,
        description: "Moves a record into the active state.",
        businessPurpose: "Provides a safe command for activation.",
        preconditions: ["The record must already exist."],
        mandatorySteps: ["Record why the activation happened."],
        sideEffects: ["The record appears in active views."],
        postconditions: ["The record is discoverable in the admin workbench."],
        failureModes: ["Permission denied.", "Unknown record."],
        forbiddenShortcuts: ["Do not write the status directly in storage."]
      }
    ],
    workflows: []
  });

  for (const [relativePath, contents] of Object.entries(docPack)) {
    write(pluginDir, join("docs", relativePath), contents);
  }
}

function writeStarterApp(projectRoot: string, appId: string, pluginId: string) {
  const appDir = join(projectRoot, "apps", appId);
  const displayName = toDisplayName(appId);

  const files: Record<string, string> = {
    "package.json": `{\n  "name": "@apps/${appId}",\n  "version": "0.1.0",\n  "private": true,\n  "type": "module",\n  "main": "./dist/index.js",\n  "types": "./dist/index.d.ts",\n  "exports": {\n    ".": {\n      "types": "./dist/index.d.ts",\n      "default": "./dist/index.js"\n    }\n  },\n  "scripts": {\n    "build": "bunx tsc -p tsconfig.build.json",\n    "typecheck": "bunx tsc -p tsconfig.json --noEmit",\n    "lint": "bunx eslint .",\n    "test": "bun test",\n    "test:unit": "bun test tests/unit"\n  },\n  "dependencies": {\n    "@plugins/${pluginId}": "workspace:*",\n    "react": "^19.1.0",\n    "react-dom": "^19.1.0"\n  }\n}\n`,
    "tsconfig.json": `{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": {\n    "noEmit": true\n  },\n  "include": [\n    "src/**/*.ts",\n    "src/**/*.tsx",\n    "tests/**/*.ts",\n    "tests/**/*.tsx"\n  ]\n}\n`,
    "tsconfig.build.json": `{\n  "extends": "./tsconfig.json",\n  "compilerOptions": {\n    "noEmit": false,\n    "outDir": "./dist"\n  },\n  "exclude": [\n    "tests"\n  ]\n}\n`,
    "src/index.ts": `export const appId = "${appId}" as const;\nexport const starterPluginId = "${pluginId}" as const;\n`,
    "src/App.tsx": `import React from "react";\n\nexport function App() {\n  return (\n    <main data-app-root="${appId}">\n      <h1>${displayName}</h1>\n      <p>This app is your clean runnable host. Wire routes, shells, and plugin composition here.</p>\n      <p>The starter plugin currently lives at <code>@plugins/${pluginId}</code>.</p>\n    </main>\n  );\n}\n`,
    "tests/unit/app.test.ts": `import { describe, expect, it } from "bun:test";\n\nimport { appId, starterPluginId } from "../../src";\n\ndescribe("starter app", () => {\n  it("keeps stable ids", () => {\n    expect(appId).toBe("${appId}");\n    expect(starterPluginId).toBe("${pluginId}");\n  });\n});\n`
  };

  for (const [relativePath, contents] of Object.entries(files)) {
    write(appDir, relativePath, contents);
  }
}

function writeProjectMetadata(
  projectRoot: string,
  input: {
    projectName: string;
    frameworkMode: "symlink" | "copy";
    starterPluginId: string;
    starterAppId: string;
  }
) {
  write(
    projectRoot,
    "docs/PROJECT_CONTEXT.md",
    [
      `# ${toDisplayName(input.projectName)} Project Context`,
      "",
      "This file is for the product team.",
      "",
      "Use it to explain:",
      "",
      "- what this project is trying to build,",
      "- who the primary users are,",
      "- which workflows are mandatory,",
      "- which business rules an agent must understand before making changes,",
      "- and what should never be bypassed.",
      "",
      "## Starter modules",
      "",
      `- App host: \`${input.starterAppId}\``,
      `- Starter plugin: \`${input.starterPluginId}\``,
      `- Framework vendor mode: \`${input.frameworkMode}\``
    ].join("\n")
  );
}

function createProjectPackageJson(projectName: string): string {
  return `{\n  "name": "@workspace/${projectName}",\n  "private": true,\n  "type": "module",\n  "packageManager": "bun@1.3.12",\n  "workspaces": [\n    "apps/*",\n    "libraries/*",\n    "plugins/*",\n    "vendor/plugins/*",\n    "vendor/libraries/*",\n    "vendor/framework/gutu/framework/core/*",\n    "vendor/framework/gutu/framework/libraries/*",\n    "vendor/framework/gutu/framework/builtin-plugins/*"\n  ],\n  "scripts": {\n    "gutu": "bun run vendor/framework/gutu/framework/core/cli/src/bin.ts",\n    "platform": "bun run vendor/framework/gutu/framework/core/cli/src/bin.ts",\n    "build": "bun run vendor/framework/gutu/tooling/scripts/workspace-task.mjs build",\n    "typecheck": "bun run vendor/framework/gutu/tooling/scripts/workspace-task.mjs typecheck",\n    "lint": "bun run vendor/framework/gutu/tooling/scripts/workspace-task.mjs lint",\n    "test": "bun run vendor/framework/gutu/tooling/scripts/workspace-task.mjs test",\n    "test:unit": "bun run vendor/framework/gutu/tooling/scripts/workspace-task.mjs test:unit",\n    "test:integration": "bun run vendor/framework/gutu/tooling/scripts/workspace-task.mjs test:integration",\n    "test:e2e": "bun run vendor/framework/gutu/tooling/scripts/workspace-task.mjs test:e2e",\n    "test:contracts": "bun run vendor/framework/gutu/tooling/scripts/workspace-task.mjs test:contracts",\n    "test:migrations": "bun run vendor/framework/gutu/tooling/scripts/workspace-task.mjs test:migrations",\n    "coverage:report": "bun run vendor/framework/gutu/tooling/scripts/workspace-coverage.mjs",\n    "docs:scaffold": "bun run gutu -- docs scaffold --all",\n    "docs:index": "bun run gutu -- docs index --all --out docs/agent-understanding.index.json",\n    "docs:validate": "bun run gutu -- docs validate --all",\n    "ci:check": "bun run build && bun run typecheck && bun run lint && bun run docs:validate && bun run test && bun run test:integration && bun run test:contracts && bun run test:migrations && bun run test:e2e"\n  }\n}\n`;
}

function createProjectBunfig(): string {
  return `[install]\nsaveTextLockfile = true\nexact = false\n\n[test]\npreload = ["./vendor/framework/gutu/tooling/test/register-env.ts"]\n`;
}

function createProjectTsconfig(): string {
  return `{\n  "extends": "./tsconfig.base.json",\n  "compilerOptions": {\n    "noEmit": true\n  },\n  "include": [\n    "apps/**/*.ts",\n    "apps/**/*.tsx",\n    "libraries/**/*.ts",\n    "libraries/**/*.tsx",\n    "plugins/**/*.ts",\n    "plugins/**/*.tsx",\n    "vendor/plugins/**/*.ts",\n    "vendor/plugins/**/*.tsx",\n    "vendor/libraries/**/*.ts",\n    "vendor/libraries/**/*.tsx"\n  ],\n  "exclude": [\n    "node_modules",\n    "dist",\n    "coverage",\n    "artifacts",\n    ".gutu"\n  ]\n}\n`;
}

function createProjectTsconfigBase(): string {
  return `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "ESNext",\n    "moduleResolution": "Bundler",\n    "moduleDetection": "force",\n    "lib": ["ES2023", "DOM", "DOM.Iterable"],\n    "jsx": "react-jsx",\n    "strict": true,\n    "noImplicitAny": true,\n    "noUncheckedIndexedAccess": true,\n    "noImplicitOverride": true,\n    "useUnknownInCatchVariables": true,\n    "exactOptionalPropertyTypes": true,\n    "forceConsistentCasingInFileNames": true,\n    "skipLibCheck": true,\n    "verbatimModuleSyntax": true,\n    "resolveJsonModule": true,\n    "allowSyntheticDefaultImports": true,\n    "esModuleInterop": true,\n    "declaration": true,\n    "declarationMap": true,\n    "sourceMap": true,\n    "incremental": true,\n    "types": ["bun-types", "node", "react", "react-dom"],\n    "baseUrl": ".",\n    "paths": {\n      "@platform/*": [\n        "vendor/framework/gutu/framework/core/*/src/index.ts",\n        "vendor/framework/gutu/framework/core/*/src/index.tsx",\n        "vendor/framework/gutu/framework/libraries/*/src/index.ts",\n        "vendor/framework/gutu/framework/libraries/*/src/index.tsx"\n      ],\n      "@plugins/*": [\n        "plugins/*/src/index.ts",\n        "plugins/*/src/index.tsx",\n        "vendor/plugins/*/src/index.ts",\n        "vendor/plugins/*/src/index.tsx",\n        "vendor/framework/gutu/framework/builtin-plugins/*/src/index.ts",\n        "vendor/framework/gutu/framework/builtin-plugins/*/src/index.tsx"\n      ],\n      "@apps/*": [\n        "apps/*/src/index.ts",\n        "apps/*/src/index.tsx"\n      ]\n    }\n  },\n  "exclude": [\n    "node_modules",\n    "dist",\n    "coverage",\n    "artifacts",\n    ".gutu"\n  ]\n}\n`;
}

function createProjectManifestJson(projectName: string, frameworkMode: "symlink" | "copy"): string {
  return `${JSON.stringify(
    {
      name: projectName,
      framework: {
        name: "gutu",
        vendorPath: "vendor/framework/gutu",
        mode: frameworkMode
      },
      workspace: {
        appsDir: "apps",
        librariesDir: "libraries",
        pluginsDir: "plugins",
        vendorPluginsDir: "vendor/plugins",
        vendorLibrariesDir: "vendor/libraries"
      },
      docs: {
        understandingIndex: "docs/agent-understanding.index.json"
      }
    },
    null,
    2
  )}\n`;
}

function createGitignore(): string {
  return `node_modules/\ndist/\ncoverage/\nartifacts/\nplaywright-report/\ntest-results/\n.gutu/cache/\n.gutu/state/\n*.tsbuildinfo\n.DS_Store\n`;
}

function createProjectReadme(projectName: string, starterPluginId: string, starterAppId: string): string {
  const displayName = toDisplayName(projectName);
  return `# ${displayName}\n\nThis is a clean Gutu project workspace.\n\n## Layout\n\n- \`apps/*\` for runnable hosts and verification apps\n- \`plugins/*\` for project-specific business modules\n- \`libraries/*\` for local shared code if you need it later\n- \`vendor/framework/gutu\` for the vendored framework distribution\n- \`vendor/plugins/*\` and \`vendor/libraries/*\` for future store-installed extensions\n- \`docs/*\` for project context and agent understanding material\n\n## Starter content\n\n- app host: \`${starterAppId}\`\n- business plugin: \`${starterPluginId}\`\n\n## First steps\n\n\`\`\`bash\nbun install\nbun run docs:scaffold\nbun run docs:index\nbun run ci:check\n\`\`\`\n\n## Useful commands\n\n- \`bun run gutu -- --help\`\n- \`bun run gutu -- docs validate --all\`\n- \`bun run gutu -- init ../another-project\`\n- \`bun run build\`\n- \`bun run ci:check\`\n`;
}

function createProjectDocsReadme(projectName: string): string {
  return `# ${toDisplayName(projectName)} Docs\n\nPut project-level product context here.\n\nGood places to start:\n\n- \`PROJECT_CONTEXT.md\` for the overall business story\n- generated understanding docs in each plugin package\n- run \`bun run docs:index\` to build a repo-wide machine-readable understanding map\n`;
}

function write(root: string, relativePath: string, contents: string) {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
}

function slugifyName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "gutu-project";
}

function toDisplayName(slug: string): string {
  return slug
    .split(/[-_./]+/g)
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");
}

function toComponentName(slug: string): string {
  return slug
    .split(/[-_./]+/g)
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join("");
}
