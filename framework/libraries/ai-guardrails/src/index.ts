import type { ToolContract } from "@platform/ai";

export const packageId = "ai-guardrails" as const;
export const packageDisplayName = "AI Guardrails" as const;
export const packageDescription = "Prompt sanitization, tool risk checks, PII redaction, and output moderation." as const;

export type SafetyCheck = {
  id: string;
  kind: "prompt" | "tool" | "output";
  severity: "info" | "warning" | "blocking";
  message: string;
  code: string;
};

export type GuardrailPolicy = {
  id: string;
  blockedPromptSubstrings?: string[] | undefined;
  blockedToolIds?: string[] | undefined;
  requireApprovalAbove?: ToolContract["riskLevel"] | undefined;
  piiPatterns?: RegExp[] | undefined;
  maxOutputCharacters?: number | undefined;
};

export type PromptSanitizationResult = {
  sanitizedPrompt: string;
  blocked: boolean;
  checks: SafetyCheck[];
  redactions: Array<{ kind: "prompt-injection" | "pii"; value: string }>;
};

export type ToolRiskAssessment = {
  toolId: string;
  allowed: boolean;
  requiresApproval: boolean;
  checks: SafetyCheck[];
};

export type OutputModerationResult = {
  outputText: string;
  blocked: boolean;
  checks: SafetyCheck[];
  redactions: Array<{ kind: "pii" | "policy"; value: string }>;
};

export class GuardrailViolationError extends Error {
  readonly checks: SafetyCheck[];

  constructor(message: string, checks: SafetyCheck[]) {
    super(message);
    this.name = "GuardrailViolationError";
    this.checks = checks;
  }
}

export function defineGuardrailPolicy(policy: GuardrailPolicy): GuardrailPolicy {
  return Object.freeze({
    ...policy,
    ...(policy.blockedPromptSubstrings
      ? { blockedPromptSubstrings: [...policy.blockedPromptSubstrings].sort((left, right) => left.localeCompare(right)) }
      : {}),
    ...(policy.blockedToolIds ? { blockedToolIds: [...policy.blockedToolIds].sort((left, right) => left.localeCompare(right)) } : {}),
    ...(policy.piiPatterns ? { piiPatterns: [...policy.piiPatterns] } : {})
  });
}

export function sanitizePrompt(prompt: string, policy: GuardrailPolicy): PromptSanitizationResult {
  const checks: SafetyCheck[] = [];
  const redactions: PromptSanitizationResult["redactions"] = [];
  let sanitizedPrompt = prompt;

  for (const substring of policy.blockedPromptSubstrings ?? []) {
    if (sanitizedPrompt.toLowerCase().includes(substring.toLowerCase())) {
      checks.push({
        id: `${policy.id}:prompt:${substring}`,
        kind: "prompt",
        severity: "blocking",
        code: "guardrail.prompt.blocked-substring",
        message: `Prompt includes blocked substring '${substring}'.`
      });
      redactions.push({
        kind: "prompt-injection",
        value: substring
      });
      sanitizedPrompt = sanitizedPrompt.replaceAll(substring, "[redacted]");
    }
  }

  for (const pattern of policy.piiPatterns ?? []) {
    sanitizedPrompt = sanitizedPrompt.replace(pattern, (match) => {
      redactions.push({
        kind: "pii",
        value: match
      });
      checks.push({
        id: `${policy.id}:prompt:pii:${redactions.length}`,
        kind: "prompt",
        severity: "warning",
        code: "guardrail.prompt.pii-redacted",
        message: "Prompt contained a PII-like value that was redacted."
      });
      return "[pii-redacted]";
    });
  }

  return {
    sanitizedPrompt,
    blocked: checks.some((check) => check.severity === "blocking"),
    checks,
    redactions
  };
}

export function evaluateToolRisk(tool: ToolContract, policy: GuardrailPolicy): ToolRiskAssessment {
  const checks: SafetyCheck[] = [];
  let allowed = true;

  if (tool.policies.includes("tool.deny") || policy.blockedToolIds?.includes(tool.id)) {
    allowed = false;
    checks.push({
      id: `${policy.id}:tool:deny:${tool.id}`,
      kind: "tool",
      severity: "blocking",
      code: "guardrail.tool.denied",
      message: `Tool '${tool.id}' is blocked by policy.`
    });
  }

  const requiresApproval =
    tool.approvalMode === "required" ||
    tool.policies.includes("tool.require_approval") ||
    compareRiskLevel(tool.riskLevel, policy.requireApprovalAbove ?? "critical") >= 0;

  if (requiresApproval) {
    checks.push({
      id: `${policy.id}:tool:approval:${tool.id}`,
      kind: "tool",
      severity: "warning",
      code: "guardrail.tool.approval-required",
      message: `Tool '${tool.id}' requires approval before execution.`
    });
  }

  return {
    toolId: tool.id,
    allowed,
    requiresApproval,
    checks
  };
}

export function moderateOutput(outputText: string, policy: GuardrailPolicy): OutputModerationResult {
  const checks: SafetyCheck[] = [];
  const redactions: OutputModerationResult["redactions"] = [];
  let moderated = outputText;

  for (const pattern of policy.piiPatterns ?? []) {
    moderated = moderated.replace(pattern, (match) => {
      redactions.push({
        kind: "pii",
        value: match
      });
      checks.push({
        id: `${policy.id}:output:pii:${redactions.length}`,
        kind: "output",
        severity: "warning",
        code: "guardrail.output.pii-redacted",
        message: "Output contained a PII-like value that was redacted."
      });
      return "[pii-redacted]";
    });
  }

  if (policy.maxOutputCharacters !== undefined && moderated.length > policy.maxOutputCharacters) {
    moderated = `${moderated.slice(0, policy.maxOutputCharacters)}…`;
    checks.push({
      id: `${policy.id}:output:max-length`,
      kind: "output",
      severity: "warning",
      code: "guardrail.output.max-length",
      message: "Output exceeded the configured maximum length and was truncated."
    });
    redactions.push({
      kind: "policy",
      value: "truncated"
    });
  }

  return {
    outputText: moderated,
    blocked: checks.some((check) => check.severity === "blocking"),
    checks,
    redactions
  };
}

export function assertGuardrails(checks: SafetyCheck[]): void {
  const blockingChecks = checks.filter((check) => check.severity === "blocking");
  if (blockingChecks.length > 0) {
    throw new GuardrailViolationError("guardrail policy blocked execution", blockingChecks);
  }
}

function compareRiskLevel(left: ToolContract["riskLevel"], right: ToolContract["riskLevel"]): number {
  return riskLevelOrder[left] - riskLevelOrder[right];
}

const riskLevelOrder: Record<ToolContract["riskLevel"], number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3
};
