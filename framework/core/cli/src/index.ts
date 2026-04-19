import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { defineGuardrailPolicy, sanitizePrompt } from "@platform/ai-guardrails";
import { createMcpServerFromContracts } from "@platform/ai-mcp";
import { createUnderstandingDocPack } from "@platform/agent-understanding";
import {
  aiCoreActions,
  aiCoreResources,
  approvalFixtures,
  approveAgentCheckpointDecision,
  promptFixtures,
  replayFixtures,
  submitAgentRun
} from "@plugins/ai-core";
import {
  baselineFixture,
  compareEvalRunScenario,
  datasetFixture,
  runEvalDatasetScenario
} from "@plugins/ai-evals";
import {
  aiEvalActions,
  aiEvalResources
} from "@plugins/ai-evals";
import {
  aiRagActions,
  aiRagResources,
  ingestMemoryDocument,
  reindexMemoryCollection
} from "@plugins/ai-rag";

import {
  buildUnderstandingIndex,
  scaffoldUnderstandingDocs,
  validateUnderstandingDocs
} from "./understanding";
import { initGutuWorkspace } from "./project";

export const packageId = "cli" as const;
export const packageDisplayName = "CLI" as const;
export const packageDescription =
  "Terminal command surface for Gutu scaffolding, AI operations, registry workflows, and system understanding tools." as const;

export type CliIo = {
  cwd: string;
  env: Record<string, string | undefined>;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream | { write(chunk: string): unknown };
  stderr: NodeJS.WriteStream | { write(chunk: string): unknown };
};

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  const [command, subcommand, ...rest] = argv;

  if (!command || command === "help" || command === "--help") {
    write(io.stdout, helpText());
    return 0;
  }

  try {
    if (command === "init" || command === "new") {
      const initArgs = [subcommand, ...rest].filter((entry): entry is string => Boolean(entry));
      const target = readInitTarget(initArgs) ?? optionalFlag(initArgs, "--target") ?? "gutu-project";
      return commandSuccess(
        io,
        initGutuWorkspace(io.cwd, {
          target,
          frameworkSource: optionalFlag(initArgs, "--framework-source"),
          frameworkMode: readFlag(initArgs, "--framework-mode", "symlink") as "symlink" | "copy",
          force: readFlag(initArgs, "--force", "false") === "true"
        })
      );
    }

    if (command === "docs" && subcommand === "scaffold") {
      return commandSuccess(
        io,
        await scaffoldUnderstandingDocs(io.cwd, {
          all: hasFlag(rest, "--all"),
          target: optionalFlag(rest, "--target"),
          overwrite: readFlag(rest, "--overwrite", "false") === "true"
        })
      );
    }

    if (command === "docs" && subcommand === "index") {
      return commandSuccess(
        io,
        await buildUnderstandingIndex(io.cwd, {
          all: hasFlag(rest, "--all"),
          target: optionalFlag(rest, "--target"),
          out: optionalFlag(rest, "--out") ?? "docs/agent-understanding.index.json"
        })
      );
    }

    if (command === "docs" && subcommand === "validate") {
      const result = await validateUnderstandingDocs(io.cwd, {
        all: hasFlag(rest, "--all"),
        target: optionalFlag(rest, "--target"),
        strict: readFlag(rest, "--strict", "false") === "true"
      });
      return result.ok ? commandSuccess(io, result) : commandFailure(io, JSON.stringify(result, null, 2));
    }

    if (command === "agent" && subcommand === "run") {
      return commandSuccess(io, submitAgentRun({
        tenantId: readFlag(rest, "--tenant", "tenant-platform"),
        actorId: readFlag(rest, "--actor", "actor-admin"),
        agentId: readFlag(rest, "--agent", "ops-triage-agent"),
        promptVersionId: readFlag(rest, "--prompt-version", promptFixtures.versions[0]?.id ?? "prompt-version:ops-triage:v4"),
        goal: readFlag(rest, "--goal", "Summarize open escalations and propose the next safe actions."),
        allowedToolIds: readMultiFlag(rest, "--tool", ["crm.contacts.list"])
      }));
    }

    if (command === "agent" && subcommand === "replay") {
      const runId = readFlag(rest, "--run", replayFixtures[0]?.runId ?? "");
      const replay = replayFixtures.find((fixture) => fixture.runId === runId);
      if (!replay) {
        return commandFailure(io, `Unknown replay fixture '${runId}'.`);
      }
      return commandSuccess(io, replay);
    }

    if (command === "agent" && subcommand === "approve") {
      return commandSuccess(io, approveAgentCheckpointDecision({
        tenantId: readFlag(rest, "--tenant", "tenant-platform"),
        actorId: readFlag(rest, "--actor", "actor-admin"),
        runId: readFlag(rest, "--run", approvalFixtures[0]?.runId ?? "run:ops-triage:002"),
        checkpointId: readFlag(rest, "--checkpoint", approvalFixtures[0]?.id ?? "checkpoint:ops-triage:002"),
        approved: readFlag(rest, "--approved", "true") !== "false",
        note: optionalFlag(rest, "--note")
      }));
    }

    if (command === "prompt" && subcommand === "validate") {
      const body = readFlag(rest, "--body", promptFixtures.versions[0]?.body ?? "");
      return commandSuccess(io, sanitizePrompt(body, createCliPromptPolicy()));
    }

    if (command === "prompt" && subcommand === "diff") {
      const leftId = readFlag(rest, "--left", promptFixtures.versions[1]?.id ?? "");
      const rightId = readFlag(rest, "--right", promptFixtures.versions[0]?.id ?? "");
      const left = promptFixtures.versions.find((version) => version.id === leftId);
      const right = promptFixtures.versions.find((version) => version.id === rightId);
      if (!left || !right) {
        return commandFailure(io, "Unknown prompt version id.");
      }
      return commandSuccess(io, diffPromptBodies(left.body, right.body));
    }

    if (command === "memory" && subcommand === "ingest") {
      return commandSuccess(io, ingestMemoryDocument({
        tenantId: readFlag(rest, "--tenant", "tenant-platform"),
        collectionId: readFlag(rest, "--collection", "memory-collection:ops"),
        title: readFlag(rest, "--title", "Operator note"),
        body: readFlag(rest, "--body", "Capture operator notes, sources, and risk flags for the next shift handoff."),
        sourceObjectId: readFlag(rest, "--source-object", "manual-note"),
        sourceKind: readFlag(rest, "--source-kind", "operator-note"),
        classification: readFlag(rest, "--classification", "internal") as "public" | "internal" | "restricted" | "confidential"
      }));
    }

    if (command === "memory" && subcommand === "reindex") {
      return commandSuccess(io, reindexMemoryCollection({
        tenantId: readFlag(rest, "--tenant", "tenant-platform"),
        collectionId: readFlag(rest, "--collection", "memory-collection:ops")
      }));
    }

    if (command === "eval" && subcommand === "run") {
      return commandSuccess(io, runEvalDatasetScenario({
        tenantId: readFlag(rest, "--tenant", "tenant-platform"),
        datasetId: readFlag(rest, "--dataset", datasetFixture.id),
        candidateLabel: readFlag(rest, "--label", "candidate")
      }));
    }

    if (command === "eval" && subcommand === "compare") {
      return commandSuccess(io, compareEvalRunScenario({
        tenantId: readFlag(rest, "--tenant", "tenant-platform"),
        baselineId: readFlag(rest, "--baseline", baselineFixture.id),
        candidateRunId: readFlag(rest, "--candidate", "eval-run:ops-safety:candidate")
      }));
    }

    if (command === "mcp" && subcommand === "serve") {
      return commandSuccess(io, {
        transport: "stdio",
        server: buildMcpServer()
      });
    }

    if (command === "mcp" && subcommand === "inspect") {
      const server = buildMcpServer();
      const toolId = optionalFlag(rest, "--tool");
      const resourceId = optionalFlag(rest, "--resource");
      if (toolId) {
        const tool = server.tools.find((entry) => entry.id === toolId);
        return tool ? commandSuccess(io, tool) : commandFailure(io, `Unknown MCP tool '${toolId}'.`);
      }
      if (resourceId) {
        const resource = server.resources.find((entry) => entry.id === resourceId);
        return resource ? commandSuccess(io, resource) : commandFailure(io, `Unknown MCP resource '${resourceId}'.`);
      }
      return commandSuccess(io, server);
    }

    if (command === "make" && subcommand === "ai-pack") {
      const packId = readFlag(rest, "--id", "");
      if (!packId) {
        return commandFailure(io, "Missing required flag --id for `gutu make ai-pack`.");
      }
      const target = scaffoldAiPack(io.cwd, packId);
      return commandSuccess(io, {
        ok: true,
        target
      });
    }

    return commandFailure(io, `Unknown command '${[command, subcommand].filter(Boolean).join(" ")}'.`);
  } catch (error) {
    return commandFailure(io, error instanceof Error ? error.message : String(error));
  }
}

export function scaffoldAiPack(cwd: string, packId: string): string {
  const slug = packId.trim();
  if (!slug) {
    throw new Error("AI pack id must not be empty.");
  }

  const target = resolve(cwd, "plugins", "feature-packs", slug);
  const files: Record<string, string> = {
    "package.ts": createAiPackManifest(slug),
    "package.json": createAiPackPackageJson(slug),
    "tsconfig.json": `{\n  "extends": "../../../tsconfig.base.json",\n  "compilerOptions": {\n    "noEmit": true\n  },\n  "include": [\n    "src/**/*.ts",\n    "src/**/*.tsx",\n    "tests/**/*.ts",\n    "tests/**/*.tsx",\n    "package.ts"\n  ]\n}\n`,
    "tsconfig.build.json": `{\n  "extends": "./tsconfig.json",\n  "compilerOptions": {\n    "noEmit": false,\n    "outDir": "./dist"\n  },\n  "exclude": [\n    "tests"\n  ]\n}\n`,
    "src/index.ts": `export { default as manifest } from "../package";\n`,
    "src/ui/admin/main.page.tsx": `import React from "react";\n\nexport function ${toComponentName(slug)}AdminPage() {\n  return (\n    <section data-plugin-page="${slug}">\n      <h1>${slug}</h1>\n      <p>Describe the agent role, prompt versions, tools, and approvals for this AI pack.</p>\n    </section>\n  );\n}\n`,
    "tests/unit/package.test.ts": `import { describe, expect, it } from "bun:test";\nimport manifest from "../../package";\n\ndescribe("plugin manifest", () => {\n  it("keeps a stable package id", () => {\n    expect(manifest.id).toBe("${slug}");\n  });\n});\n`
  };

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = join(target, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    if (!existsSync(absolutePath)) {
      writeFileSync(absolutePath, contents, "utf8");
    }
  }

  const docPack = createUnderstandingDocPack({
    id: slug,
    displayName: toComponentName(slug).replace(/([a-z])([A-Z])/g, "$1 $2"),
    description: "AI pack scaffold generated by Gutu CLI.",
    location: relativeFromCwd(cwd, target),
    targetType: "package",
    packageKind: "ai-pack",
    dependsOn: ["ai-core"],
    providesCapabilities: [`ai.custom.${slug}`],
    requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.ai"],
    resources: [],
    actions: [],
    workflows: []
  });

  for (const [relativePath, contents] of Object.entries(docPack)) {
    const absolutePath = join(target, "docs", relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    if (!existsSync(absolutePath)) {
      writeFileSync(absolutePath, contents, "utf8");
    }
  }

  return target;
}

function buildMcpServer() {
  return createMcpServerFromContracts({
    id: "gutu-ai",
    label: "Gutu AI",
    actions: [...aiCoreActions, ...aiRagActions, ...aiEvalActions],
    resources: [...aiCoreResources, ...aiRagResources, ...aiEvalResources],
    prompts: promptFixtures.versions.map((version) => ({
      id: version.id,
      title: version.templateId,
      description: version.changelog ?? "Prompt version",
      version: version.version,
      arguments: []
    }))
  });
}

function createCliPromptPolicy() {
  return defineGuardrailPolicy({
    id: "gutu-cli.prompt-validation",
    blockedPromptSubstrings: ["ignore all previous instructions", "leak secrets"],
    piiPatterns: [/\b\d{12,19}\b/g],
    maxOutputCharacters: 1000
  });
}

function diffPromptBodies(left: string, right: string) {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const added = rightLines.filter((line) => !leftLines.includes(line));
  const removed = leftLines.filter((line) => !rightLines.includes(line));

  return {
    added,
    removed
  };
}

function createAiPackManifest(slug: string): string {
  return `import { definePackage } from "@platform/kernel";\n\nexport default definePackage({\n  id: "${slug}",\n  kind: "ai-pack",\n  version: "0.1.0",\n  displayName: "${slug}",\n  description: "AI pack scaffold generated by Gutu CLI.",\n  compatibility: {\n    framework: "^0.1.0",\n    runtime: "bun>=1.3.12",\n    db: ["postgres", "sqlite"]\n  },\n  extends: ["ai-core"],\n  dependsOn: ["ai-core"],\n  providesCapabilities: ["ai.custom.${slug}"],\n  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.ai"],\n  ownsData: ["ai.${slug}"],\n  extendsData: [],\n  slotClaims: []\n});\n`;
}

function createAiPackPackageJson(slug: string): string {
  return `{\n  "name": "@plugins/${slug}",\n  "version": "0.1.0",\n  "private": false,\n  "type": "module",\n  "main": "./dist/index.js",\n  "types": "./dist/index.d.ts",\n  "exports": {\n    ".": {\n      "types": "./dist/index.d.ts",\n      "default": "./dist/index.js"\n    }\n  },\n  "scripts": {\n    "build": "bunx tsc -p tsconfig.build.json",\n    "typecheck": "bunx tsc -p tsconfig.json --noEmit",\n    "lint": "bunx eslint .",\n    "test": "bun test"\n  },\n  "dependencies": {\n    "@platform/kernel": "workspace:*",\n    "@plugins/ai-core": "workspace:*",\n    "react": "^19.1.0"\n  }\n}\n`;
}

function toComponentName(slug: string): string {
  return slug
    .split(/[-_./]+/g)
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join("");
}

function readFlag(args: string[], flag: string, fallback: string): string {
  const index = args.indexOf(flag);
  if (index === -1) {
    return fallback;
  }
  return args[index + 1] ?? fallback;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function readInitTarget(args: string[]): string | undefined {
  const valueFlags = new Set(["--target", "--framework-source", "--framework-mode", "--force"]);

  for (let index = 0; index < args.length; index += 1) {
    const entry = args[index];
    if (!entry) {
      continue;
    }

    if (entry.startsWith("--")) {
      if (valueFlags.has(entry)) {
        index += 1;
      }
      continue;
    }

    return entry;
  }

  return undefined;
}

function optionalFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function readMultiFlag(args: string[], flag: string, fallback: string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) {
      values.push(args[index + 1]!);
      index += 1;
    }
  }
  return values.length > 0 ? values : fallback;
}

function commandSuccess(io: CliIo, payload: unknown): number {
  write(io.stdout, `${JSON.stringify(payload, null, 2)}\n`);
  return 0;
}

function commandFailure(io: CliIo, message: string): number {
  write(io.stderr, `${message}\n`);
  return 1;
}

function write(stream: CliIo["stdout"] | CliIo["stderr"], text: string) {
  stream.write(text);
}

function helpText(): string {
  return [
    "gutu init [target] [--framework-source <path>] [--framework-mode symlink|copy] [--force true|false]",
    "gutu docs scaffold [--all | --target <path-or-id>] [--overwrite true|false]",
    "gutu docs index [--all | --target <path-or-id>] [--out <path>]",
    "gutu docs validate [--all | --target <path-or-id>] [--strict true|false]",
    "gutu agent run --tenant <id> --actor <id> --agent <id> --prompt-version <id> --goal <text> [--tool <id>]",
    "gutu agent replay --run <id>",
    "gutu agent approve --run <id> --checkpoint <id> [--approved true|false] [--note <text>]",
    "gutu prompt validate --body <text>",
    "gutu prompt diff --left <prompt-version-id> --right <prompt-version-id>",
    "gutu memory ingest --tenant <id> --collection <id> --title <title> --body <text>",
    "gutu memory reindex --tenant <id> --collection <id>",
    "gutu eval run --tenant <id> --dataset <id> --label <candidate>",
    "gutu eval compare --tenant <id> --baseline <id> --candidate <id>",
    "gutu mcp serve",
    "gutu mcp inspect [--tool <id> | --resource <id>]",
    "gutu make ai-pack --id <slug>"
  ].join("\n");
}

function relativeFromCwd(cwd: string, target: string): string {
  const relativePath = target.replace(`${resolve(cwd)}/`, "");
  return relativePath.length > 0 ? relativePath : ".";
}
