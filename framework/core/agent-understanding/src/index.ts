export const packageId = "agent-understanding" as const;
export const packageDisplayName = "Agent Understanding" as const;
export const packageDescription =
  "Semantic metadata, documentation pack templates, and validation helpers for AI-readable system understanding." as const;

export const understandingDocFilenames = [
  "AGENT_CONTEXT.md",
  "BUSINESS_RULES.md",
  "FLOWS.md",
  "GLOSSARY.md",
  "EDGE_CASES.md",
  "MANDATORY_STEPS.md"
] as const;

export type UnderstandingDocFilename = (typeof understandingDocFilenames)[number];

export type ResourceFieldUnderstanding = {
  description?: string | undefined;
  businessMeaning?: string | undefined;
  example?: string | undefined;
  constraints?: string[] | undefined;
  sensitive?: boolean | undefined;
  sourceOfTruth?: boolean | undefined;
  requiredForFlows?: string[] | undefined;
};

export type ResourceUnderstanding = {
  description?: string | undefined;
  businessPurpose?: string | undefined;
  invariants?: string[] | undefined;
  lifecycleNotes?: string[] | undefined;
  actors?: string[] | undefined;
};

export type ActionUnderstanding = {
  description?: string | undefined;
  businessPurpose?: string | undefined;
  preconditions?: string[] | undefined;
  mandatorySteps?: string[] | undefined;
  sideEffects?: string[] | undefined;
  postconditions?: string[] | undefined;
  failureModes?: string[] | undefined;
  forbiddenShortcuts?: string[] | undefined;
};

export type WorkflowStateUnderstanding = {
  description?: string | undefined;
  entryCriteria?: string[] | undefined;
  exitCriteria?: string[] | undefined;
};

export type WorkflowUnderstanding = {
  description?: string | undefined;
  businessPurpose?: string | undefined;
  actors?: string[] | undefined;
  invariants?: string[] | undefined;
  mandatorySteps?: string[] | undefined;
  stateDescriptions?: Record<string, WorkflowStateUnderstanding> | undefined;
  transitionDescriptions?: Record<string, string> | undefined;
};

export type ResourceFieldSummary = {
  name: string;
  label?: string | undefined;
  description?: string | undefined;
  businessMeaning?: string | undefined;
  example?: string | undefined;
  constraints?: string[] | undefined;
  sensitive?: boolean | undefined;
  sourceOfTruth?: boolean | undefined;
  requiredForFlows?: string[] | undefined;
};

export type ResourceSummary = {
  id: string;
  description?: string | undefined;
  businessPurpose?: string | undefined;
  invariants?: string[] | undefined;
  lifecycleNotes?: string[] | undefined;
  actors?: string[] | undefined;
  fields: ResourceFieldSummary[];
};

export type ActionSummary = {
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

export type WorkflowSummary = {
  id: string;
  initialState: string;
  description?: string | undefined;
  businessPurpose?: string | undefined;
  actors?: string[] | undefined;
  invariants?: string[] | undefined;
  mandatorySteps?: string[] | undefined;
  stateDescriptions?: Record<string, WorkflowStateUnderstanding> | undefined;
  transitionDescriptions?: Record<string, string> | undefined;
  states: Record<string, { on?: Record<string, string> }>;
};

export type UnderstandingSubjectSummary = {
  id: string;
  displayName: string;
  description: string;
  location: string;
  targetType: "package" | "app";
  packageKind?: string | undefined;
  dependsOn: string[];
  providesCapabilities: string[];
  requestedCapabilities: string[];
  resources: ResourceSummary[];
  actions: ActionSummary[];
  workflows: WorkflowSummary[];
};

export type UnderstandingValidationMessage = {
  severity: "error" | "warning";
  code: string;
  message: string;
  file?: string | undefined;
};

export function createUnderstandingDocPack(summary: UnderstandingSubjectSummary): Record<UnderstandingDocFilename, string> {
  const capabilityLine = renderList(summary.providesCapabilities, "- _No declared capabilities._");
  const requestedCapabilityLine = renderList(summary.requestedCapabilities, "- _No requested capabilities._");
  const dependencyLine = renderList(summary.dependsOn, "- _No declared dependencies._");
  const resourceSections =
    summary.resources.length > 0
      ? summary.resources
          .map((resource) =>
            [
              `### \`${resource.id}\``,
              "",
              resource.description ?? "_Add a concise description for why this resource exists._",
              "",
              `Business purpose: ${resource.businessPurpose ?? "_Document the operational purpose of this resource._"}`,
              "",
              "Key fields:",
              renderFieldList(resource.fields)
            ].join("\n")
          )
          .join("\n\n")
      : "_No resources were discovered for this target._";
  const actionSections =
    summary.actions.length > 0
      ? summary.actions
          .map((action) =>
            [
              `### \`${action.id}\``,
              "",
              action.description ?? "_Document what this action does in business terms._",
              "",
              `Permission: \`${action.permission}\``,
              "",
              `Business purpose: ${action.businessPurpose ?? "_Explain why operators or automation invoke this action._"}`,
              "",
              "Preconditions:",
              renderList(action.preconditions, "- _Document the checks that must pass before this action runs._"),
              "",
              "Side effects:",
              renderList(action.sideEffects, "- _Document emitted events, writes, notifications, and follow-up jobs._"),
              "",
              "Forbidden shortcuts:",
              renderList(action.forbiddenShortcuts, "- _Document any paths agents must never bypass._")
            ].join("\n")
          )
          .join("\n\n")
      : "_No actions were discovered for this target._";
  const workflowSections =
    summary.workflows.length > 0
      ? summary.workflows
          .map((workflow) =>
            [
              `### \`${workflow.id}\``,
              "",
              workflow.description ?? "_Describe the workflow in operator language, not just technical state names._",
              "",
              `Initial state: \`${workflow.initialState}\``,
              "",
              `Business purpose: ${workflow.businessPurpose ?? "_Explain what business process this workflow protects._"}`,
              "",
              "Mandatory steps:",
              renderList(
                workflow.mandatorySteps,
                "- _Document approvals, reviews, notifications, or downstream tasks that must never be skipped._"
              ),
              "",
              "States and transitions:",
              renderWorkflowStates(workflow)
            ].join("\n")
          )
          .join("\n\n")
      : "_No workflows were discovered for this target._";

  return {
    "AGENT_CONTEXT.md": [
      `# ${summary.displayName} Agent Context`,
      "",
      `Package/app id: \`${summary.id}\``,
      `Target type: \`${summary.targetType}\`${summary.packageKind ? `  ` : ""}${summary.packageKind ? `| Package kind: \`${summary.packageKind}\`` : ""}`,
      `Location: \`${summary.location}\``,
      "",
      "## Purpose",
      "",
      summary.description,
      "",
      "## System role",
      "",
      "Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.",
      "",
      "## Declared dependencies",
      "",
      dependencyLine,
      "",
      "## Provided capabilities",
      "",
      capabilityLine,
      "",
      "## Requested capabilities",
      "",
      requestedCapabilityLine,
      "",
      "## Core resources",
      "",
      resourceSections,
      "",
      "## Core actions",
      "",
      actionSections,
      "",
      "## Core workflows",
      "",
      workflowSections
    ].join("\n"),
    "BUSINESS_RULES.md": [
      `# ${summary.displayName} Business Rules`,
      "",
      "## Invariants",
      "",
      renderList(
        uniqueDefined(summary.resources.flatMap((resource) => resource.invariants ?? [])),
        "- _Document business truths that must always hold._"
      ),
      "",
      "## Lifecycle notes",
      "",
      renderList(
        uniqueDefined(summary.resources.flatMap((resource) => resource.lifecycleNotes ?? [])),
        "- _Document retention, activation, archival, and reversal rules._"
      ),
      "",
      "## Actor expectations",
      "",
      renderList(
        uniqueDefined(summary.resources.flatMap((resource) => resource.actors ?? [])),
        "- _Document which actor types are expected to read, create, review, approve, or reconcile data here._"
      ),
      "",
      "## Decision boundaries",
      "",
      "- Document which decisions are automated, which are recommendation-only, and which always require a human or approval checkpoint.",
      "- Document which policies or compliance rules override convenience.",
      "- Document what counts as a safe retry versus a risky duplicate."
    ].join("\n"),
    "FLOWS.md": [
      `# ${summary.displayName} Flows`,
      "",
      "## Happy paths",
      "",
      workflowSections,
      "",
      "## Action-level flows",
      "",
      actionSections,
      "",
      "## Cross-package interactions",
      "",
      "- Describe upstream triggers, downstream side effects, notifications, and jobs.",
      "- Document when this target depends on auth, approvals, billing, or data freshness from another package.",
      "- Document how failures recover and who owns reconciliation."
    ].join("\n"),
    "GLOSSARY.md": [
      `# ${summary.displayName} Glossary`,
      "",
      "## Terms",
      "",
      ...renderGlossary(summary),
      "",
      "## Domain shortcuts to avoid",
      "",
      "- Expand internal jargon that would confuse a new engineer or an AI agent.",
      "- Document terms that are similar but not interchangeable.",
      "- Call out any overloaded words such as account, order, customer, approval, or publish."
    ].join("\n"),
    "EDGE_CASES.md": [
      `# ${summary.displayName} Edge Cases`,
      "",
      "## Known failure modes",
      "",
      renderList(
        uniqueDefined(summary.actions.flatMap((action) => action.failureModes ?? [])),
        "- _Document validation failures, stale state, race conditions, retries, and external dependency failures._"
      ),
      "",
      "## Data anomalies",
      "",
      "- Describe partial imports, duplicate records, missing references, stale approvals, and replay hazards.",
      "- Document what the system should do when upstream data is delayed or contradictory.",
      "",
      "## Recovery expectations",
      "",
      "- Document whether operators should retry, reopen, reconcile manually, or escalate.",
      "- Document the audit trail, notification, or compensation step expected after failures."
    ].join("\n"),
    "MANDATORY_STEPS.md": [
      `# ${summary.displayName} Mandatory Steps`,
      "",
      "## Never skip",
      "",
      renderList(
        uniqueDefined([
          ...summary.actions.flatMap((action) => action.mandatorySteps ?? []),
          ...summary.workflows.flatMap((workflow) => workflow.mandatorySteps ?? [])
        ]),
        "- _Document the sequence requirements that must always be followed._"
      ),
      "",
      "## Human approvals and checkpoints",
      "",
      "- Document when approvals are required, who can grant them, and what evidence must be present.",
      "",
      "## Observability and audit",
      "",
      "- Document the records, events, or notifications that must exist after each sensitive step.",
      "",
      "## Agent operating notes",
      "",
      "- Agents may recommend actions, but they must follow the same mandatory steps and approval gates as humans.",
      "- Agents must never invent missing business facts; they should ask for clarification or cite the knowledge source."
    ].join("\n")
  };
}

export function validateUnderstandingDocPack(presentFiles: string[]): UnderstandingValidationMessage[] {
  const fileSet = new Set(presentFiles);
  return understandingDocFilenames.flatMap((filename) =>
    fileSet.has(filename)
      ? []
      : [
          {
            severity: "error" as const,
            code: "missing_doc_pack_file",
            message: `Missing required understanding document '${filename}'.`,
            file: filename
          }
        ]
  );
}

function renderList(values: readonly string[] | undefined, fallback: string): string {
  if (!values || values.length === 0) {
    return fallback;
  }
  return values.map((value) => `- ${value}`).join("\n");
}

function renderFieldList(fields: ResourceFieldSummary[]): string {
  if (fields.length === 0) {
    return "- _No fields were discovered for this resource._";
  }
  return fields
    .map((field) => {
      const segments = [
        `\`${field.name}\`${field.label ? ` (${field.label})` : ""}`,
        field.description ?? "Add a field description so agents understand what this value means.",
        field.businessMeaning ? `Business meaning: ${field.businessMeaning}` : undefined,
        field.example ? `Example: ${field.example}` : undefined,
        field.sensitive ? "Sensitive: yes" : undefined,
        field.sourceOfTruth ? "Source of truth: yes" : undefined,
        field.constraints && field.constraints.length > 0 ? `Constraints: ${field.constraints.join("; ")}` : undefined,
        field.requiredForFlows && field.requiredForFlows.length > 0
          ? `Required for flows: ${field.requiredForFlows.join(", ")}`
          : undefined
      ].filter(Boolean);
      return `- ${segments.join(" | ")}`;
    })
    .join("\n");
}

function renderWorkflowStates(workflow: WorkflowSummary): string {
  return Object.entries(workflow.states)
    .map(([stateKey, state]) => {
      const stateDescription = workflow.stateDescriptions?.[stateKey];
      const transitions = Object.entries(state.on ?? {})
        .map(([event, nextState]) => {
          const transitionDescription = workflow.transitionDescriptions?.[`${stateKey}.${event}`];
          return `  - \`${event}\` -> \`${nextState}\`${transitionDescription ? `: ${transitionDescription}` : ""}`;
        })
        .join("\n");

      return [
        `- \`${stateKey}\`${stateDescription?.description ? `: ${stateDescription.description}` : ""}`,
        stateDescription?.entryCriteria && stateDescription.entryCriteria.length > 0
          ? `  - Entry criteria: ${stateDescription.entryCriteria.join("; ")}`
          : undefined,
        stateDescription?.exitCriteria && stateDescription.exitCriteria.length > 0
          ? `  - Exit criteria: ${stateDescription.exitCriteria.join("; ")}`
          : undefined,
        transitions || "  - No outgoing transitions."
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
}

function renderGlossary(summary: UnderstandingSubjectSummary): string[] {
  const lines: string[] = [];
  for (const resource of summary.resources) {
    lines.push(`### ${resource.id}`);
    lines.push("");
    lines.push(resource.description ?? "_Define this entity in plain business language._");
    lines.push("");
    if (resource.fields.length > 0) {
      for (const field of resource.fields) {
        lines.push(`- \`${field.name}\`: ${field.description ?? "Add the field meaning and how operators use it."}`);
      }
      lines.push("");
    }
  }
  if (lines.length === 0) {
    return ["- _No domain glossary entries were discovered yet. Add the key nouns used by operators, workflows, and policies._"];
  }
  return lines;
}

function uniqueDefined(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}
