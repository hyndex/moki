import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createUnderstandingDocPack,
  type ActionSummary,
  type ResourceFieldSummary,
  type ResourceSummary,
  type UnderstandingDocFilename,
  understandingDocFilenames,
  type UnderstandingSubjectSummary,
  type UnderstandingValidationMessage,
  validateUnderstandingDocPack,
  type WorkflowSummary
} from "@platform/agent-understanding";

const workspaceRoots = [
  "apps",
  join("framework", "core"),
  join("framework", "libraries"),
  join("framework", "builtin-plugins"),
  join("plugins", "domain"),
  join("plugins", "feature-packs"),
  join("plugins", "connectors"),
  join("plugins", "migrations"),
  join("plugins", "verticals"),
  join("plugins", "bundles")
] as const;

type TargetLocation = {
  dir: string;
  targetType: "package" | "app";
};

type ManifestLike = {
  id: string;
  displayName: string;
  description: string;
  targetType: "package" | "app";
  packageKind?: string | undefined;
  dependsOn: string[];
  providesCapabilities: string[];
  requestedCapabilities: string[];
};

type ResourceDefinitionLike = {
  id: string;
  description?: string | undefined;
  businessPurpose?: string | undefined;
  invariants?: string[] | undefined;
  lifecycleNotes?: string[] | undefined;
  actors?: string[] | undefined;
  contract?: unknown;
  fields: Record<string, {
    label?: string | undefined;
    description?: string | undefined;
    businessMeaning?: string | undefined;
    example?: string | undefined;
    constraints?: string[] | undefined;
    sensitive?: boolean | undefined;
    sourceOfTruth?: boolean | undefined;
    requiredForFlows?: string[] | undefined;
  }>;
};

type ActionDefinitionLike = {
  id: string;
  permission: string;
  description?: string | undefined;
  businessPurpose?: string | undefined;
  preconditions?: string[] | undefined;
  mandatorySteps?: string[] | undefined;
  sideEffects?: string[] | undefined;
  postconditions?: string[] | undefined;
  failureModes?: string[] | undefined;
  forbiddenShortcuts?: string[] | undefined;
};

type WorkflowDefinitionLike = {
  id: string;
  initialState: string;
  description?: string | undefined;
  businessPurpose?: string | undefined;
  actors?: string[] | undefined;
  invariants?: string[] | undefined;
  mandatorySteps?: string[] | undefined;
  stateDescriptions?: Record<string, {
    description?: string | undefined;
    entryCriteria?: string[] | undefined;
    exitCriteria?: string[] | undefined;
  }> | undefined;
  transitionDescriptions?: Record<string, string> | undefined;
  states: Record<string, { on?: Record<string, string> }>;
};

export type UnderstandingIndex = {
  generatedAt: string;
  root: string;
  targets: UnderstandingSubjectSummary[];
};

export type UnderstandingValidationResult = {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  targets: Array<{
    id: string;
    location: string;
    messages: UnderstandingValidationMessage[];
  }>;
};

export async function scaffoldUnderstandingDocs(
  root: string,
  options: { all?: boolean | undefined; target?: string | undefined; overwrite?: boolean | undefined }
): Promise<{ targets: string[]; filesWritten: string[] }> {
  const summaries = await loadUnderstandingSummaries(root, options);
  const filesWritten: string[] = [];

  for (const summary of summaries) {
    const docsDir = resolve(root, summary.location, "docs");
    mkdirSync(docsDir, { recursive: true });
    const pack = createUnderstandingDocPack(summary);
    for (const [filename, body] of Object.entries(pack) as Array<[UnderstandingDocFilename, string]>) {
      const absolutePath = join(docsDir, filename);
      if (!options.overwrite && existsSync(absolutePath)) {
        continue;
      }
      writeFileSync(absolutePath, body, "utf8");
      filesWritten.push(relative(root, absolutePath));
    }
  }

  return {
    targets: summaries.map((summary) => summary.location),
    filesWritten
  };
}

export async function buildUnderstandingIndex(
  root: string,
  options: { all?: boolean | undefined; target?: string | undefined; out?: string | undefined }
): Promise<UnderstandingIndex> {
  const targets = await loadUnderstandingSummaries(root, options);
  const index: UnderstandingIndex = {
    generatedAt: new Date().toISOString(),
    root,
    targets
  };

  if (options.out) {
    const absoluteOutput = resolve(root, options.out);
    mkdirSync(dirname(absoluteOutput), { recursive: true });
    writeFileSync(absoluteOutput, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  }

  return index;
}

export async function validateUnderstandingDocs(
  root: string,
  options: { all?: boolean | undefined; target?: string | undefined; strict?: boolean | undefined }
): Promise<UnderstandingValidationResult> {
  const summaries = await loadUnderstandingSummaries(root, options);
  const strict = options.strict ?? false;
  const targetResults = summaries.map((summary) => {
    const docsDir = resolve(root, summary.location, "docs");
    const presentFiles = existsSync(docsDir)
      ? readdirSync(docsDir).filter((entry) => understandingDocFilenames.includes(entry as UnderstandingDocFilename))
      : [];
    const messages = [
      ...validateUnderstandingDocPack(presentFiles),
      ...validateSummary(summary, strict)
    ];

    return {
      id: summary.id,
      location: summary.location,
      messages
    };
  });

  const errorCount = targetResults.reduce(
    (count, target) => count + target.messages.filter((message) => message.severity === "error").length,
    0
  );
  const warningCount = targetResults.reduce(
    (count, target) => count + target.messages.filter((message) => message.severity === "warning").length,
    0
  );

  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    targets: targetResults
  };
}

export async function loadUnderstandingSummaries(
  root: string,
  options: { all?: boolean | undefined; target?: string | undefined }
): Promise<UnderstandingSubjectSummary[]> {
  const targets = options.all
    ? discoverWorkspaceTargets(root)
    : [await resolveTarget(root, options.target)];
  const summaries: UnderstandingSubjectSummary[] = [];
  for (const target of targets) {
    summaries.push(await loadUnderstandingSummary(root, target));
  }
  return summaries.sort((left, right) => left.location.localeCompare(right.location));
}

async function resolveTarget(root: string, selector?: string): Promise<TargetLocation> {
  if (!selector) {
    return discoverTargetFromDirectory(root, root);
  }

  const explicitPath = resolve(root, selector);
  if (existsSync(explicitPath)) {
    return discoverTargetFromDirectory(root, explicitPath);
  }

  const targets = discoverWorkspaceTargets(root);
  for (const target of targets) {
    if (relative(root, target.dir) === selector || target.dir.endsWith(`/${selector}`)) {
      return target;
    }
  }

  for (const target of targets) {
    const manifest = await loadManifestLike(root, target);
    if (manifest.id === selector || manifest.displayName === selector) {
      return target;
    }
  }

  throw new Error(`Unable to resolve target '${selector}'.`);
}

function discoverTargetFromDirectory(root: string, candidate: string): TargetLocation {
  const targets = discoverWorkspaceTargets(root)
    .filter((target) => candidate === target.dir || candidate.startsWith(`${target.dir}/`))
    .sort((left, right) => right.dir.length - left.dir.length);
  const nearestTarget = targets[0];
  if (nearestTarget) {
    return nearestTarget;
  }
  throw new Error(`Directory '${candidate}' is not a recognized app or package target.`);
}

function discoverWorkspaceTargets(root: string): TargetLocation[] {
  const targets: TargetLocation[] = [];
  for (const workspaceRoot of workspaceRoots) {
    const absoluteRoot = resolve(root, workspaceRoot);
    if (!existsSync(absoluteRoot)) {
      continue;
    }
    for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const dir = join(absoluteRoot, entry.name);
      if (!existsSync(join(dir, "package.ts")) && !existsSync(join(dir, "package.json"))) {
        continue;
      }
      targets.push({
        dir,
        targetType: workspaceRoot === "apps" ? "app" : "package"
      });
    }
  }
  return targets.sort((left, right) => left.dir.localeCompare(right.dir));
}

async function loadUnderstandingSummary(root: string, target: TargetLocation): Promise<UnderstandingSubjectSummary> {
  const manifest = await loadManifestLike(root, target);
  const artifacts = await collectArtifacts(target.dir);

  return {
    id: manifest.id,
    displayName: manifest.displayName,
    description: manifest.description,
    location: relative(root, target.dir),
    targetType: manifest.targetType,
    packageKind: manifest.packageKind,
    dependsOn: manifest.dependsOn,
    providesCapabilities: manifest.providesCapabilities,
    requestedCapabilities: manifest.requestedCapabilities,
    resources: artifacts.resources,
    actions: artifacts.actions,
    workflows: artifacts.workflows
  };
}

async function loadManifestLike(root: string, target: TargetLocation): Promise<ManifestLike> {
  const manifestPath = join(target.dir, "package.ts");
  if (existsSync(manifestPath)) {
    const manifestModule = await importModule(manifestPath);
    const manifest = manifestModule?.default as Partial<ManifestLike> & {
      kind?: string | undefined;
      dependsOn?: string[] | undefined;
      providesCapabilities?: string[] | undefined;
      requestedCapabilities?: string[] | undefined;
    };
    return {
      id: manifest.id ?? relative(root, target.dir),
      displayName: manifest.displayName ?? humanizeIdentifier(manifest.id ?? target.dir),
      description: manifest.description ?? `Document the purpose of ${manifest.id ?? relative(root, target.dir)}.`,
      targetType: target.targetType,
      packageKind: manifest.kind,
      dependsOn: manifest.dependsOn ?? [],
      providesCapabilities: manifest.providesCapabilities ?? [],
      requestedCapabilities: manifest.requestedCapabilities ?? []
    };
  }

  const sourceIndexPath = join(target.dir, "src", "index.ts");
  if (existsSync(sourceIndexPath)) {
    const sourceModule = await importModule(sourceIndexPath);
    const packageId = typeof sourceModule?.packageId === "string" ? sourceModule.packageId : undefined;
    const packageDisplayName =
      typeof sourceModule?.packageDisplayName === "string" ? sourceModule.packageDisplayName : undefined;
    const packageDescription =
      typeof sourceModule?.packageDescription === "string" ? sourceModule.packageDescription : undefined;

    if (packageId || packageDisplayName || packageDescription) {
      return {
        id: packageId ?? relative(root, target.dir),
        displayName: packageDisplayName ?? humanizeIdentifier(packageId ?? target.dir),
        description: packageDescription ?? `Document the purpose of ${packageId ?? relative(root, target.dir)}.`,
        targetType: target.targetType,
        packageKind: inferPackageKind(target.dir),
        dependsOn: [],
        providesCapabilities: [],
        requestedCapabilities: []
      };
    }
  }

  const packageJsonPath = join(target.dir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    name?: string | undefined;
    description?: string | undefined;
  };

  return {
    id: packageJson.name ?? relative(root, target.dir),
    displayName: humanizeIdentifier(packageJson.name?.split("/").at(-1) ?? target.dir.split("/").at(-1) ?? "App"),
    description:
      packageJson.description ??
      `Document what the app at ${relative(root, target.dir)} exists to demonstrate or operate.`,
    targetType: target.targetType,
    packageKind: inferPackageKind(target.dir),
    dependsOn: [],
    providesCapabilities: [],
    requestedCapabilities: []
  };
}

async function collectArtifacts(dir: string): Promise<{
  resources: ResourceSummary[];
  actions: ActionSummary[];
  workflows: WorkflowSummary[];
}> {
  const resourceMap = new Map<string, ResourceSummary>();
  const actionMap = new Map<string, ActionSummary>();
  const workflowMap = new Map<string, WorkflowSummary>();
  const srcDir = join(dir, "src");
  if (!existsSync(srcDir)) {
    return {
      resources: [],
      actions: [],
      workflows: []
    };
  }

  const candidateFiles = walkDirectory(srcDir).filter((file) => {
    const normalized = file.replaceAll("\\", "/");
    return (
      normalized.endsWith(".action.ts") ||
      normalized.endsWith(".resource.ts") ||
      normalized.includes("/actions/") ||
      normalized.includes("/resources/") ||
      normalized.includes("/workflows/")
    );
  });

  for (const absolutePath of candidateFiles) {
    const imported = await importModule(absolutePath);
    for (const exported of Object.values(imported ?? {})) {
      collectExportedArtifacts(exported, resourceMap, actionMap, workflowMap);
    }
  }

  return {
    resources: [...resourceMap.values()].sort((left, right) => left.id.localeCompare(right.id)),
    actions: [...actionMap.values()].sort((left, right) => left.id.localeCompare(right.id)),
    workflows: [...workflowMap.values()].sort((left, right) => left.id.localeCompare(right.id))
  };
}

function collectExportedArtifacts(
  candidate: unknown,
  resourceMap: Map<string, ResourceSummary>,
  actionMap: Map<string, ActionSummary>,
  workflowMap: Map<string, WorkflowSummary>
) {
  if (!candidate) {
    return;
  }
  if (Array.isArray(candidate)) {
    for (const value of candidate) {
      collectExportedArtifacts(value, resourceMap, actionMap, workflowMap);
    }
    return;
  }
  if (isResourceDefinition(candidate)) {
    resourceMap.set(candidate.id, toResourceSummary(candidate));
    return;
  }
  if (isActionDefinition(candidate)) {
    actionMap.set(candidate.id, toActionSummary(candidate));
    return;
  }
  if (isWorkflowDefinition(candidate)) {
    workflowMap.set(candidate.id, toWorkflowSummary(candidate));
    return;
  }
  if (typeof candidate === "object") {
    for (const value of Object.values(candidate)) {
      collectExportedArtifacts(value, resourceMap, actionMap, workflowMap);
    }
  }
}

function toResourceSummary(resource: ResourceDefinitionLike): ResourceSummary {
  const contractFieldNames = extractObjectShapeKeys(resource.contract);
  const fieldNames = [...new Set([...Object.keys(resource.fields), ...contractFieldNames])].sort((left, right) =>
    left.localeCompare(right)
  );

  return {
    id: resource.id,
    description: resource.description,
    businessPurpose: resource.businessPurpose,
    invariants: resource.invariants,
    lifecycleNotes: resource.lifecycleNotes,
    actors: resource.actors,
    fields: fieldNames.map((fieldName) => toFieldSummary(fieldName, resource.fields[fieldName]))
  };
}

function toFieldSummary(fieldName: string, field: ResourceDefinitionLike["fields"][string] | undefined): ResourceFieldSummary {
  return {
    name: fieldName,
    label: field?.label ?? humanizeIdentifier(fieldName),
    description: field?.description,
    businessMeaning: field?.businessMeaning,
    example: field?.example,
    constraints: field?.constraints,
    sensitive: field?.sensitive,
    sourceOfTruth: field?.sourceOfTruth,
    requiredForFlows: field?.requiredForFlows
  };
}

function toActionSummary(action: ActionDefinitionLike): ActionSummary {
  return {
    id: action.id,
    permission: action.permission,
    description: action.description,
    businessPurpose: action.businessPurpose,
    preconditions: action.preconditions,
    mandatorySteps: action.mandatorySteps,
    sideEffects: action.sideEffects,
    postconditions: action.postconditions,
    failureModes: action.failureModes,
    forbiddenShortcuts: action.forbiddenShortcuts
  };
}

function toWorkflowSummary(workflow: WorkflowDefinitionLike): WorkflowSummary {
  return {
    id: workflow.id,
    initialState: workflow.initialState,
    description: workflow.description,
    businessPurpose: workflow.businessPurpose,
    actors: workflow.actors,
    invariants: workflow.invariants,
    mandatorySteps: workflow.mandatorySteps,
    stateDescriptions: workflow.stateDescriptions,
    transitionDescriptions: workflow.transitionDescriptions,
    states: workflow.states
  };
}

function validateSummary(summary: UnderstandingSubjectSummary, strict: boolean): UnderstandingValidationMessage[] {
  const messages: UnderstandingValidationMessage[] = [];
  if (summary.description.trim().length === 0) {
    messages.push({
      severity: "error",
      code: "missing_target_description",
      message: `Target '${summary.id}' is missing a top-level description.`
    });
  }

  for (const resource of summary.resources) {
    if (!resource.description) {
      messages.push({
        severity: strict ? "error" : "warning",
        code: "missing_resource_description",
        message: `Resource '${resource.id}' should declare a description.`
      });
    }
    for (const field of resource.fields) {
      if (!field.description) {
        messages.push({
          severity: strict ? "error" : "warning",
          code: "missing_field_description",
          message: `Field '${resource.id}.${field.name}' should declare a description.`
        });
      }
    }
  }

  for (const action of summary.actions) {
    if (!action.description) {
      messages.push({
        severity: strict ? "error" : "warning",
        code: "missing_action_description",
        message: `Action '${action.id}' should declare a description.`
      });
    }
  }

  for (const workflow of summary.workflows) {
    if (!workflow.description) {
      messages.push({
        severity: strict ? "error" : "warning",
        code: "missing_workflow_description",
        message: `Workflow '${workflow.id}' should declare a description.`
      });
    }
  }

  return messages;
}

function isResourceDefinition(candidate: unknown): candidate is ResourceDefinitionLike {
  return Boolean(
    candidate &&
      typeof candidate === "object" &&
      "id" in candidate &&
      typeof candidate.id === "string" &&
      "fields" in candidate &&
      typeof candidate.fields === "object" &&
      candidate.fields &&
      "admin" in candidate &&
      "portal" in candidate
  );
}

function isActionDefinition(candidate: unknown): candidate is ActionDefinitionLike {
  return Boolean(
    candidate &&
      typeof candidate === "object" &&
      "id" in candidate &&
      typeof candidate.id === "string" &&
      "permission" in candidate &&
      typeof candidate.permission === "string" &&
      "input" in candidate &&
      "output" in candidate &&
      "handler" in candidate
  );
}

function isWorkflowDefinition(candidate: unknown): candidate is WorkflowDefinitionLike {
  return Boolean(
    candidate &&
      typeof candidate === "object" &&
      "id" in candidate &&
      typeof candidate.id === "string" &&
      "initialState" in candidate &&
      typeof candidate.initialState === "string" &&
      "states" in candidate &&
      typeof candidate.states === "object" &&
      candidate.states
  );
}

function extractObjectShapeKeys(contract: unknown): string[] {
  if (!contract || typeof contract !== "object") {
    return [];
  }
  const directShape = (contract as { shape?: unknown }).shape;
  if (directShape && typeof directShape === "object") {
    return Object.keys(directShape as Record<string, unknown>);
  }
  const definitionShape = (contract as { _def?: { shape?: unknown } })._def?.shape;
  const resolvedShape =
    typeof definitionShape === "function"
      ? (definitionShape as () => unknown)()
      : definitionShape;
  if (resolvedShape && typeof resolvedShape === "object") {
    return Object.keys(resolvedShape as Record<string, unknown>);
  }
  return [];
}

function walkDirectory(root: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "tests" || entry.name.startsWith(".")) {
        continue;
      }
      files.push(...walkDirectory(absolutePath));
      continue;
    }
    if (entry.isFile() && (absolutePath.endsWith(".ts") || absolutePath.endsWith(".tsx"))) {
      files.push(absolutePath);
    }
  }
  return files;
}

async function importModule(absolutePath: string): Promise<Record<string, unknown> | null> {
  try {
    const stat = statSync(absolutePath);
    return (await import(`${pathToFileURL(absolutePath).href}?mtime=${stat.mtimeMs}`)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function humanizeIdentifier(value: string): string {
  const normalized = value
    .split(/[/.:-]/g)
    .filter(Boolean)
    .at(-1) ?? value;

  return normalized
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(" ");
}

function inferPackageKind(targetDir: string): string | undefined {
  const normalized = targetDir.replaceAll("\\", "/");
  if (normalized.includes("/framework/core/")) {
    return "framework-core";
  }
  if (normalized.includes("/framework/libraries/")) {
    return "framework-library";
  }
  if (normalized.includes("/framework/builtin-plugins/")) {
    return "builtin-plugin";
  }
  if (normalized.includes("/apps/")) {
    return "app";
  }
  return "plugin";
}
