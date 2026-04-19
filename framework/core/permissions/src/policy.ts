export type PolicyRule = {
  permission: string;
  allowIf: string[];
  requireReason?: boolean;
  audit?: boolean;
};

export type PolicyDefinition = {
  id: string;
  rules: PolicyRule[];
};

export type PolicyEvaluationInput = {
  permission: string;
  actorClaims: string[];
  reason?: string;
};

export function definePolicy(policy: PolicyDefinition): PolicyDefinition {
  return Object.freeze({
    ...policy,
    rules: [...policy.rules].sort((left, right) => left.permission.localeCompare(right.permission))
  });
}

export function evaluatePolicy(policy: PolicyDefinition, input: PolicyEvaluationInput): boolean {
  const matchingRule = policy.rules.find((rule) => rule.permission === input.permission);
  if (!matchingRule) {
    return false;
  }

  if (matchingRule.requireReason && !input.reason) {
    return false;
  }

  return matchingRule.allowIf.some((claim) => input.actorClaims.includes(claim));
}
