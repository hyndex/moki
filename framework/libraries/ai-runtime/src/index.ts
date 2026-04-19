import { createHash } from "node:crypto";

import type { ToolContract } from "@platform/ai";

export const packageId = "ai-runtime" as const;
export const packageDisplayName = "AI Runtime" as const;
export const packageDescription = "Durable agent runtime contracts, checkpoints, replay, and budget enforcement." as const;

export type AgentStepStatus = "queued" | "running" | "waiting-approval" | "completed" | "failed" | "cancelled";

export type AgentStepKind = "plan" | "model" | "tool" | "approval" | "memory" | "workflow";

export type ApprovalCheckpointState = "pending" | "approved" | "rejected" | "expired";

export type AgentCapabilityProfile = {
  toolIds: string[];
  readModelIds?: string[] | undefined;
  memoryCollectionIds?: string[] | undefined;
  promptTemplateIds?: string[] | undefined;
  deniedToolIds?: string[] | undefined;
};

export type AgentBudgetPolicy = {
  maxSteps: number;
  maxToolCalls: number;
  maxInputTokens?: number | undefined;
  maxOutputTokens?: number | undefined;
  maxTotalTokens?: number | undefined;
  maxEstimatedCostUsd?: number | undefined;
  maxRuntimeMs?: number | undefined;
};

export type AgentFailurePolicy = {
  maxRetryAttempts: number;
  retryableCodes: string[];
  pauseOnApprovalRequired: boolean;
  failOnReplayMismatch: boolean;
  failOnGuardrailBlock: boolean;
};

export type ApprovalCheckpoint = {
  id: string;
  runId: string;
  stepId: string;
  reason: string;
  requestedAt: string;
  expiresAt?: string | undefined;
  state: ApprovalCheckpointState;
  toolId?: string | undefined;
  approvedAt?: string | undefined;
  approverId?: string | undefined;
  decisionNote?: string | undefined;
};

export type AgentStep = {
  id: string;
  kind: AgentStepKind;
  status: AgentStepStatus;
  summary: string;
  startedAt: string;
  completedAt?: string | undefined;
  correlationId?: string | undefined;
  toolId?: string | undefined;
  approvalCheckpointId?: string | undefined;
  input?: Record<string, unknown> | undefined;
  output?: Record<string, unknown> | undefined;
  errorCode?: string | undefined;
};

export type PromptTemplate = {
  id: string;
  label: string;
  body: string;
  version: string;
};

export type PromptVersion = {
  id: string;
  templateId: string;
  version: string;
  body: string;
  createdAt: string;
  changelog?: string | undefined;
};

export type AgentDefinition = {
  id: string;
  label: string;
  description: string;
  defaultModelId: string;
  capabilities: AgentCapabilityProfile;
  budget: AgentBudgetPolicy;
  failurePolicy: AgentFailurePolicy;
  promptTemplateId?: string | undefined;
};

export type AgentRunRequest = {
  agentId: string;
  tenantId: string;
  packageId: string;
  prompt: string;
  tools: ToolContract[];
  actorId?: string | undefined;
  serviceIdentityId?: string | undefined;
  modelId?: string | undefined;
  correlationId?: string | undefined;
  promptVersionId?: string | undefined;
  memorySnapshotRefs?: string[] | undefined;
  modelRoutingProfileId?: string | undefined;
  policyDecisions?: string[] | undefined;
  context?: Record<string, unknown> | undefined;
};

export type AgentRunUsage = {
  stepCount: number;
  toolCallCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  runtimeMs: number;
};

export type AgentRunStatus = "queued" | "running" | "waiting-approval" | "completed" | "failed" | "cancelled";

export type AgentRunRecord = {
  id: string;
  agentId: string;
  tenantId: string;
  packageId: string;
  prompt: string;
  status: AgentRunStatus;
  startedAt: string;
  completedAt?: string | undefined;
  actorId?: string | undefined;
  serviceIdentityId?: string | undefined;
  modelId: string;
  correlationId: string;
  tools: ToolContract[];
  allowedToolIds: string[];
  budget: AgentBudgetPolicy;
  failurePolicy: AgentFailurePolicy;
  checkpoints: ApprovalCheckpoint[];
  steps: AgentStep[];
  usage: AgentRunUsage;
  promptVersionId?: string | undefined;
  memorySnapshotRefs: string[];
  modelRoutingProfileId?: string | undefined;
  policyDecisions: string[];
  replayFingerprint: string;
  replaySnapshot: {
    toolSchema: Record<string, { inputSchema: Record<string, unknown>; outputSchema: Record<string, unknown> }>;
    policyDecisions: string[];
    memorySnapshotRefs: string[];
    promptVersionId?: string | undefined;
    modelRoutingProfileId?: string | undefined;
  };
};

export class AgentToolDeniedError extends Error {
  readonly toolId: string;

  constructor(toolId: string) {
    super(`Tool '${toolId}' is not allowed for this agent run`);
    this.name = "AgentToolDeniedError";
    this.toolId = toolId;
  }
}

export class AgentBudgetExceededError extends Error {
  readonly budget: AgentBudgetPolicy;
  readonly usage: AgentRunUsage;

  constructor(message: string, budget: AgentBudgetPolicy, usage: AgentRunUsage) {
    super(message);
    this.name = "AgentBudgetExceededError";
    this.budget = budget;
    this.usage = usage;
  }
}

export class AgentReplayMismatchError extends Error {
  readonly expectedFingerprint: string;
  readonly actualFingerprint: string;

  constructor(expectedFingerprint: string, actualFingerprint: string) {
    super(`Replay mismatch: expected ${expectedFingerprint}, found ${actualFingerprint}`);
    this.name = "AgentReplayMismatchError";
    this.expectedFingerprint = expectedFingerprint;
    this.actualFingerprint = actualFingerprint;
  }
}

export function defineAgent(definition: AgentDefinition): AgentDefinition {
  return Object.freeze({
    ...definition,
    capabilities: {
      toolIds: [...definition.capabilities.toolIds].sort((left, right) => left.localeCompare(right)),
      ...(definition.capabilities.readModelIds ? { readModelIds: [...definition.capabilities.readModelIds].sort((left, right) => left.localeCompare(right)) } : {}),
      ...(definition.capabilities.memoryCollectionIds
        ? { memoryCollectionIds: [...definition.capabilities.memoryCollectionIds].sort((left, right) => left.localeCompare(right)) }
        : {}),
      ...(definition.capabilities.promptTemplateIds
        ? { promptTemplateIds: [...definition.capabilities.promptTemplateIds].sort((left, right) => left.localeCompare(right)) }
        : {}),
      ...(definition.capabilities.deniedToolIds
        ? { deniedToolIds: [...definition.capabilities.deniedToolIds].sort((left, right) => left.localeCompare(right)) }
        : {})
    },
    budget: { ...definition.budget },
    failurePolicy: {
      ...definition.failurePolicy,
      retryableCodes: [...definition.failurePolicy.retryableCodes].sort((left, right) => left.localeCompare(right))
    }
  });
}

export function createAgentRunRecord(
  definition: AgentDefinition,
  request: AgentRunRequest,
  options: {
    runId?: string | undefined;
    startedAt?: string | Date | undefined;
  } = {}
): AgentRunRecord {
  const startedAt = normalizeTimestamp(options.startedAt ?? new Date());
  const allowedToolIds = definition.capabilities.toolIds.filter((toolId) => !definition.capabilities.deniedToolIds?.includes(toolId));
  const replaySnapshot = createReplaySnapshot(request.tools, {
    policyDecisions: request.policyDecisions ?? [],
    memorySnapshotRefs: request.memorySnapshotRefs ?? [],
    ...(request.promptVersionId ? { promptVersionId: request.promptVersionId } : {}),
    ...(request.modelRoutingProfileId ? { modelRoutingProfileId: request.modelRoutingProfileId } : {})
  });

  return Object.freeze({
    id: options.runId ?? `${request.agentId}:run:${startedAt}`,
    agentId: request.agentId,
    tenantId: request.tenantId,
    packageId: request.packageId,
    prompt: request.prompt,
    status: "queued",
    startedAt,
    ...(request.actorId ? { actorId: request.actorId } : {}),
    ...(request.serviceIdentityId ? { serviceIdentityId: request.serviceIdentityId } : {}),
    modelId: request.modelId ?? definition.defaultModelId,
    correlationId: request.correlationId ?? `${request.tenantId}:${request.agentId}:${startedAt}`,
    tools: [...request.tools],
    allowedToolIds,
    budget: { ...definition.budget },
    failurePolicy: {
      ...definition.failurePolicy,
      retryableCodes: [...definition.failurePolicy.retryableCodes]
    },
    checkpoints: [],
    steps: [],
    usage: {
      stepCount: 0,
      toolCallCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      runtimeMs: 0
    },
    ...(request.promptVersionId ? { promptVersionId: request.promptVersionId } : {}),
    memorySnapshotRefs: [...(request.memorySnapshotRefs ?? [])],
    ...(request.modelRoutingProfileId ? { modelRoutingProfileId: request.modelRoutingProfileId } : {}),
    policyDecisions: [...(request.policyDecisions ?? [])],
    replayFingerprint: createReplayFingerprint({
      promptVersionId: request.promptVersionId,
      modelRoutingProfileId: request.modelRoutingProfileId,
      tools: request.tools,
      memorySnapshotRefs: request.memorySnapshotRefs ?? [],
      policyDecisions: request.policyDecisions ?? []
    }),
    replaySnapshot
  });
}

export function appendAgentStep(
  run: AgentRunRecord,
  step: Omit<AgentStep, "startedAt"> & { startedAt?: string | Date | undefined }
): AgentRunRecord {
  const normalizedStep: AgentStep = {
    ...step,
    startedAt: normalizeTimestamp(step.startedAt ?? new Date())
  };

  return Object.freeze({
    ...run,
    status: normalizedStep.status === "waiting-approval" ? "waiting-approval" : run.status === "queued" ? "running" : run.status,
    steps: [...run.steps, normalizedStep],
    usage: {
      ...run.usage,
      stepCount: run.usage.stepCount + 1,
      toolCallCount: run.usage.toolCallCount + (normalizedStep.kind === "tool" ? 1 : 0)
    }
  });
}

export function pauseAgentRunForApproval(
  run: AgentRunRecord,
  input: {
    stepId: string;
    reason: string;
    toolId?: string | undefined;
    checkpointId?: string | undefined;
    requestedAt?: string | Date | undefined;
    expiresAt?: string | Date | undefined;
  }
): AgentRunRecord {
  const checkpoint: ApprovalCheckpoint = {
    id: input.checkpointId ?? `${run.id}:approval:${run.checkpoints.length + 1}`,
    runId: run.id,
    stepId: input.stepId,
    reason: input.reason,
    requestedAt: normalizeTimestamp(input.requestedAt ?? new Date()),
    ...(input.expiresAt ? { expiresAt: normalizeTimestamp(input.expiresAt) } : {}),
    state: "pending",
    ...(input.toolId ? { toolId: input.toolId } : {})
  };

  return Object.freeze({
    ...run,
    status: "waiting-approval",
    checkpoints: [...run.checkpoints, checkpoint]
  });
}

export function approveCheckpoint(
  run: AgentRunRecord,
  checkpointId: string,
  input: {
    approverId: string;
    approvedAt?: string | Date | undefined;
    decisionNote?: string | undefined;
  }
): AgentRunRecord {
  return Object.freeze({
    ...run,
    status: "running",
    checkpoints: run.checkpoints.map((checkpoint) =>
      checkpoint.id === checkpointId
        ? {
            ...checkpoint,
            state: "approved" as const,
            approverId: input.approverId,
            approvedAt: normalizeTimestamp(input.approvedAt ?? new Date()),
            ...(input.decisionNote ? { decisionNote: input.decisionNote } : {})
          }
        : checkpoint
    )
  });
}

export function rejectCheckpoint(
  run: AgentRunRecord,
  checkpointId: string,
  input: {
    approverId: string;
    rejectedAt?: string | Date | undefined;
    decisionNote?: string | undefined;
  }
): AgentRunRecord {
  return Object.freeze({
    ...run,
    status: "failed",
    completedAt: normalizeTimestamp(input.rejectedAt ?? new Date()),
    checkpoints: run.checkpoints.map((checkpoint) =>
      checkpoint.id === checkpointId
        ? {
            ...checkpoint,
            state: "rejected" as const,
            approverId: input.approverId,
            approvedAt: normalizeTimestamp(input.rejectedAt ?? new Date()),
            ...(input.decisionNote ? { decisionNote: input.decisionNote } : {})
          }
        : checkpoint
    )
  });
}

export function resumeAgentRun(run: AgentRunRecord): AgentRunRecord {
  return Object.freeze({
    ...run,
    status: run.status === "waiting-approval" ? "running" : run.status
  });
}

export function completeAgentRun(run: AgentRunRecord, completedAt: string | Date = new Date()): AgentRunRecord {
  return Object.freeze({
    ...run,
    status: "completed",
    completedAt: normalizeTimestamp(completedAt)
  });
}

export function failAgentRun(run: AgentRunRecord, completedAt: string | Date = new Date()): AgentRunRecord {
  return Object.freeze({
    ...run,
    status: "failed",
    completedAt: normalizeTimestamp(completedAt)
  });
}

export function cancelAgentRun(run: AgentRunRecord, completedAt: string | Date = new Date()): AgentRunRecord {
  return Object.freeze({
    ...run,
    status: "cancelled",
    completedAt: normalizeTimestamp(completedAt)
  });
}

export function consumeBudget(
  run: AgentRunRecord,
  delta: Partial<Omit<AgentRunUsage, "stepCount" | "toolCallCount">> & {
    stepCount?: number | undefined;
    toolCallCount?: number | undefined;
  }
): AgentRunRecord {
  const nextUsage: AgentRunUsage = {
    stepCount: run.usage.stepCount + (delta.stepCount ?? 0),
    toolCallCount: run.usage.toolCallCount + (delta.toolCallCount ?? 0),
    inputTokens: run.usage.inputTokens + (delta.inputTokens ?? 0),
    outputTokens: run.usage.outputTokens + (delta.outputTokens ?? 0),
    estimatedCostUsd: Number((run.usage.estimatedCostUsd + (delta.estimatedCostUsd ?? 0)).toFixed(6)),
    runtimeMs: run.usage.runtimeMs + (delta.runtimeMs ?? 0)
  };

  assertBudgetWithinLimits(run.budget, nextUsage);

  return Object.freeze({
    ...run,
    usage: nextUsage
  });
}

export function assertToolAllowed(run: AgentRunRecord, toolId: string): void {
  if (!run.allowedToolIds.includes(toolId)) {
    throw new AgentToolDeniedError(toolId);
  }
}

export function assertReplayFingerprint(run: AgentRunRecord, fingerprint: string): void {
  if (run.replayFingerprint !== fingerprint) {
    throw new AgentReplayMismatchError(run.replayFingerprint, fingerprint);
  }
}

export function createReplayFingerprint(input: {
  promptVersionId?: string | undefined;
  modelRoutingProfileId?: string | undefined;
  tools: ToolContract[];
  memorySnapshotRefs: string[];
  policyDecisions: string[];
}): string {
  const serialized = JSON.stringify({
    promptVersionId: input.promptVersionId ?? null,
    modelRoutingProfileId: input.modelRoutingProfileId ?? null,
    tools: input.tools
      .map((tool) => ({
        id: tool.id,
        permission: tool.permission,
        approvalMode: tool.approvalMode,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    memorySnapshotRefs: [...input.memorySnapshotRefs].sort((left, right) => left.localeCompare(right)),
    policyDecisions: [...input.policyDecisions].sort((left, right) => left.localeCompare(right))
  });

  return createHash("sha256").update(serialized).digest("hex");
}

function createReplaySnapshot(
  tools: ToolContract[],
  input: {
    policyDecisions: string[];
    memorySnapshotRefs: string[];
    promptVersionId?: string | undefined;
    modelRoutingProfileId?: string | undefined;
  }
): AgentRunRecord["replaySnapshot"] {
  return {
    toolSchema: Object.fromEntries(
      [...tools]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((tool) => [
          tool.id,
          {
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema
          }
        ])
    ),
    policyDecisions: [...input.policyDecisions].sort((left, right) => left.localeCompare(right)),
    memorySnapshotRefs: [...input.memorySnapshotRefs].sort((left, right) => left.localeCompare(right)),
    ...(input.promptVersionId ? { promptVersionId: input.promptVersionId } : {}),
    ...(input.modelRoutingProfileId ? { modelRoutingProfileId: input.modelRoutingProfileId } : {})
  };
}

function assertBudgetWithinLimits(budget: AgentBudgetPolicy, usage: AgentRunUsage): void {
  if (usage.stepCount > budget.maxSteps) {
    throw new AgentBudgetExceededError("step budget exceeded", budget, usage);
  }
  if (usage.toolCallCount > budget.maxToolCalls) {
    throw new AgentBudgetExceededError("tool-call budget exceeded", budget, usage);
  }
  if (budget.maxInputTokens !== undefined && usage.inputTokens > budget.maxInputTokens) {
    throw new AgentBudgetExceededError("input token budget exceeded", budget, usage);
  }
  if (budget.maxOutputTokens !== undefined && usage.outputTokens > budget.maxOutputTokens) {
    throw new AgentBudgetExceededError("output token budget exceeded", budget, usage);
  }
  if (budget.maxTotalTokens !== undefined && usage.inputTokens + usage.outputTokens > budget.maxTotalTokens) {
    throw new AgentBudgetExceededError("total token budget exceeded", budget, usage);
  }
  if (budget.maxEstimatedCostUsd !== undefined && usage.estimatedCostUsd > budget.maxEstimatedCostUsd) {
    throw new AgentBudgetExceededError("cost budget exceeded", budget, usage);
  }
  if (budget.maxRuntimeMs !== undefined && usage.runtimeMs > budget.maxRuntimeMs) {
    throw new AgentBudgetExceededError("runtime budget exceeded", budget, usage);
  }
}

function normalizeTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
