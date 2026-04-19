import type * as z from "zod";
import type { ActionUnderstanding } from "@platform/agent-understanding";

import { ValidationError } from "@platform/kernel";

export type ActionExecutionContext = {
  input: unknown;
  ctx?: Record<string, unknown>;
  services?: Record<string, unknown>;
};

export type ActionAiRiskLevel = "low" | "moderate" | "high" | "critical";

export type ActionAiApprovalMode = "none" | "required" | "conditional";

export type ActionAiToolPolicy = "tool.allow" | "tool.require_approval" | "tool.deny" | "tool.redact_output";

export type ActionAiGroundingInput = {
  sourceId: string;
  label?: string | undefined;
  required?: boolean | undefined;
  freshnessWindowMs?: number | undefined;
};

export type ActionAiReplayMetadata = {
  deterministic: boolean;
  includeInputHash?: boolean | undefined;
  includeOutputHash?: boolean | undefined;
  note?: string | undefined;
};

export type ActionAiMetadata = {
  purpose: string;
  riskLevel: ActionAiRiskLevel;
  approvalMode: ActionAiApprovalMode;
  toolPolicies?: ActionAiToolPolicy[] | undefined;
  groundingInputs?: ActionAiGroundingInput[] | undefined;
  resultSummaryHint?: string | undefined;
  outputRedactionPathHints?: string[] | undefined;
  replay?: ActionAiReplayMetadata | undefined;
};

export type ActionHandler<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny> = (
  context: Omit<ActionExecutionContext, "input"> & { input: z.infer<TInput> }
) => Promise<z.infer<TOutput>> | z.infer<TOutput>;

export type ActionDefinition<TInput extends z.ZodTypeAny = z.ZodTypeAny, TOutput extends z.ZodTypeAny = z.ZodTypeAny> = {
  id: string;
  description?: string | undefined;
  businessPurpose?: string | undefined;
  preconditions?: string[] | undefined;
  mandatorySteps?: string[] | undefined;
  sideEffects?: string[] | undefined;
  postconditions?: string[] | undefined;
  failureModes?: string[] | undefined;
  forbiddenShortcuts?: string[] | undefined;
  input: TInput;
  output: TOutput;
  permission: string;
  idempotent: boolean;
  audit: boolean;
  ai?: ActionAiMetadata | undefined;
  handler: ActionHandler<TInput, TOutput>;
} & ActionUnderstanding;

export function defineAction<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
  definition: ActionDefinition<TInput, TOutput>
): ActionDefinition<TInput, TOutput> {
  return Object.freeze(definition);
}

export function createActionRegistry(actions: ActionDefinition[]): Map<string, ActionDefinition> {
  return new Map(actions.map((action) => [action.id, action]));
}

export async function executeAction<TInput extends z.ZodTypeAny, TOutput extends z.ZodTypeAny>(
  definition: ActionDefinition<TInput, TOutput>,
  input: unknown,
  context: Omit<ActionExecutionContext, "input"> = {}
): Promise<z.infer<TOutput>> {
  const parsedInput = definition.input.safeParse(input);
  if (!parsedInput.success) {
    throw new ValidationError(`Action input validation failed for ${definition.id}`, parsedInput.error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.join(".")
    })));
  }

  const output = await definition.handler({ ...context, input: parsedInput.data });
  const parsedOutput = definition.output.safeParse(output);
  if (!parsedOutput.success) {
    throw new ValidationError(`Action output validation failed for ${definition.id}`, parsedOutput.error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.join(".")
    })));
  }

  return parsedOutput.data;
}
