import type { ActionDefinition } from "@platform/schema";
import { toJsonSchema } from "@platform/schema";

export const packageId = "ai" as const;
export const packageDisplayName = "AI" as const;
export const packageDescription = "AI provider contract helpers and tool orchestration types." as const;

export type ToolPolicy = "tool.allow" | "tool.require_approval" | "tool.deny" | "tool.redact_output";

export type ToolContract = {
  id: string;
  description: string;
  sourceActionId: string;
  permission: string;
  idempotent: boolean;
  audit: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  riskLevel: "low" | "moderate" | "high" | "critical";
  approvalMode: "none" | "required" | "conditional";
  policies: ToolPolicy[];
  groundingInputs: Array<{
    sourceId: string;
    label?: string | undefined;
    required: boolean;
    freshnessWindowMs?: number | undefined;
  }>;
  resultSummaryHint?: string | undefined;
  outputRedactionPathHints: string[];
  replay: {
    deterministic: boolean;
    includeInputHash: boolean;
    includeOutputHash: boolean;
    note?: string | undefined;
  };
};

export type ToolExecutionRequest = {
  toolId: string;
  input: Record<string, unknown>;
};

export type ToolExecutionResult = {
  toolId: string;
  output: Record<string, unknown>;
  redacted?: boolean | undefined;
};

export type GuardrailHook = (input: {
  modelId: string;
  prompt: string;
  tools: ToolContract[];
}) => Promise<void> | void;

export type ModelDefinition = {
  id: string;
  provider: string;
  timeoutMs?: number | undefined;
  routingProfileId?: string | undefined;
};

export type ModelInvocationRequest = {
  modelId: string;
  prompt: string;
  systemPrompt?: string | undefined;
  tools?: ToolContract[] | undefined;
  timeoutMs?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type ModelInvocationResult = {
  modelId: string;
  provider: string;
  outputText: string;
  toolCalls: ToolExecutionRequest[];
  usage?: {
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    totalTokens?: number | undefined;
    estimatedCostUsd?: number | undefined;
  } | undefined;
};

export type AiProviderAdapter = {
  id: string;
  invoke(request: ModelInvocationRequest & { model: ModelDefinition; signal: AbortSignal }): Promise<ModelInvocationResult>;
};

export type ModelRegistry = {
  models: ReadonlyMap<string, ModelDefinition>;
  register(model: ModelDefinition): ModelRegistry;
  get(modelId: string): ModelDefinition;
};

export class AiProviderError extends Error {
  readonly code: string;
  readonly retriable: boolean;

  constructor(code: string, message: string, retriable = false) {
    super(message);
    this.name = "AiProviderError";
    this.code = code;
    this.retriable = retriable;
  }
}

export function createToolContract(action: ActionDefinition, description = action.id): ToolContract {
  const aiMetadata = action.ai;
  const outputRedactionPathHints = [...(aiMetadata?.outputRedactionPathHints ?? [])];
  const policies = normalizeToolPolicies(aiMetadata?.toolPolicies ?? [], {
    approvalMode: aiMetadata?.approvalMode ?? "none",
    hasOutputRedactionHints: outputRedactionPathHints.length > 0
  });

  return {
    id: action.id,
    description,
    sourceActionId: action.id,
    permission: action.permission,
    idempotent: action.idempotent,
    audit: action.audit,
    inputSchema: toJsonSchema(action.input),
    outputSchema: toJsonSchema(action.output),
    riskLevel: aiMetadata?.riskLevel ?? "moderate",
    approvalMode: aiMetadata?.approvalMode ?? "none",
    policies,
    groundingInputs: [...(aiMetadata?.groundingInputs ?? [])].map((groundingInput) => ({
      sourceId: groundingInput.sourceId,
      ...(groundingInput.label ? { label: groundingInput.label } : {}),
      required: groundingInput.required ?? false,
      ...(groundingInput.freshnessWindowMs !== undefined ? { freshnessWindowMs: groundingInput.freshnessWindowMs } : {})
    })),
    ...(aiMetadata?.resultSummaryHint ? { resultSummaryHint: aiMetadata.resultSummaryHint } : {}),
    outputRedactionPathHints,
    replay: {
      deterministic: aiMetadata?.replay?.deterministic ?? action.idempotent,
      includeInputHash: aiMetadata?.replay?.includeInputHash ?? true,
      includeOutputHash: aiMetadata?.replay?.includeOutputHash ?? action.audit,
      ...(aiMetadata?.replay?.note ? { note: aiMetadata.replay.note } : {})
    }
  };
}

export function createModelRegistry(models: ModelDefinition[] = []): ModelRegistry {
  const registry = new Map(models.map((model) => [model.id, model]));
  return {
    get models() {
      return registry;
    },
    register(model) {
      if (registry.has(model.id)) {
        throw new Error(`Model '${model.id}' is already registered`);
      }
      registry.set(model.id, model);
      return this;
    },
    get(modelId) {
      const model = registry.get(modelId);
      if (!model) {
        throw new Error(`Model '${modelId}' is not registered`);
      }
      return model;
    }
  };
}

export async function invokeModel(input: {
  registry: ModelRegistry;
  providers: Record<string, AiProviderAdapter>;
  request: ModelInvocationRequest;
  guardrails?: GuardrailHook[] | undefined;
  retryAttempts?: number | undefined;
}): Promise<ModelInvocationResult> {
  const model = input.registry.get(input.request.modelId);
  const provider = input.providers[model.provider];
  if (!provider) {
    throw new AiProviderError("ai.provider.missing", `Provider '${model.provider}' is not registered`);
  }

  await runGuardrails(input.guardrails ?? [], {
    modelId: model.id,
    prompt: input.request.prompt,
    tools: input.request.tools ?? []
  });

  const timeoutMs = input.request.timeoutMs ?? model.timeoutMs ?? 30_000;
  const attempts = input.retryAttempts ?? 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      return await Promise.race([
        provider.invoke({
          ...input.request,
          model,
          signal
        }),
        new Promise<never>((_, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              reject(new AiProviderError("ai.provider.timeout", `model '${model.id}' exceeded ${timeoutMs}ms`, true));
            },
            { once: true }
          );
        })
      ]);
    } catch (error) {
      const normalizedError =
        error instanceof AiProviderError ? error : new AiProviderError("ai.provider.invoke", error instanceof Error ? error.message : String(error));
      if (attempt >= attempts || !normalizedError.retriable) {
        throw normalizedError;
      }
    }
  }

  throw new AiProviderError("ai.provider.unreachable", "provider invocation exhausted retries");
}

export async function runGuardrails(guardrails: GuardrailHook[], input: Parameters<GuardrailHook>[0]): Promise<void> {
  for (const guardrail of guardrails) {
    await guardrail(input);
  }
}

export function createProviderError(code: string, message: string, retriable = false): AiProviderError {
  return new AiProviderError(code, message, retriable);
}

export function normalizeToolPolicies(
  policies: ToolPolicy[],
  options: {
    approvalMode: ToolContract["approvalMode"];
    hasOutputRedactionHints?: boolean | undefined;
  }
): ToolPolicy[] {
  const normalized = new Set<ToolPolicy>(policies);
  normalized.add("tool.allow");

  if (options.approvalMode === "required") {
    normalized.add("tool.require_approval");
  }

  if (options.hasOutputRedactionHints) {
    normalized.add("tool.redact_output");
  }

  if (normalized.has("tool.deny")) {
    return ["tool.deny"];
  }

  return [...normalized].sort((left, right) => left.localeCompare(right));
}

export function toolRequiresApproval(tool: Pick<ToolContract, "approvalMode" | "policies">): boolean {
  return tool.approvalMode === "required" || tool.policies.includes("tool.require_approval");
}

export function toolIsDenied(tool: Pick<ToolContract, "policies">): boolean {
  return tool.policies.includes("tool.deny");
}

export function toolRequiresOutputRedaction(tool: Pick<ToolContract, "policies" | "outputRedactionPathHints">): boolean {
  return tool.policies.includes("tool.redact_output") || tool.outputRedactionPathHints.length > 0;
}
