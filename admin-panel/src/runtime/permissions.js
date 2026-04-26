function evalLeaf(leaf, record) {
    const v = record[leaf.field];
    switch (leaf.op) {
        case "eq": return v === leaf.value;
        case "neq": return v !== leaf.value;
        case "lt": return typeof v === "number" && typeof leaf.value === "number" && v < leaf.value;
        case "lte": return typeof v === "number" && typeof leaf.value === "number" && v <= leaf.value;
        case "gt": return typeof v === "number" && typeof leaf.value === "number" && v > leaf.value;
        case "gte": return typeof v === "number" && typeof leaf.value === "number" && v >= leaf.value;
        case "in": return Array.isArray(leaf.value) && leaf.value.includes(v);
        case "nin": return Array.isArray(leaf.value) && !leaf.value.includes(v);
        case "contains": return typeof v === "string" && typeof leaf.value === "string" && v.includes(leaf.value);
        case "null": return v === null || v === undefined;
        case "not_null": return v !== null && v !== undefined;
        default: return false;
    }
}
function evalCondition(tree, record) {
    if ("and" in tree)
        return tree.and.every((c) => evalCondition(c, record));
    if ("or" in tree)
        return tree.or.some((c) => evalCondition(c, record));
    if ("not" in tree)
        return !evalCondition(tree.not, record);
    return evalLeaf(tree, record);
}
function ruleApplies(rule, resource, verb, ctx) {
    if (rule.resource !== "*" && rule.resource !== resource)
        return false;
    if (!rule.verbs.includes(verb))
        return false;
    if (!rule.roles.some((r) => r === "*" || ctx.roles.includes(r)))
        return false;
    if (rule.scope === "own" && ctx.record) {
        const owner = ctx.record.ownerUserId ?? ctx.record.createdBy ?? ctx.record.owner;
        if (owner !== ctx.userId)
            return false;
    }
    if (rule.scope === "team" && ctx.record) {
        const teamId = ctx.record.teamId;
        if (typeof teamId === "string" && !(ctx.teamIds ?? []).includes(teamId))
            return false;
    }
    if (rule.condition && ctx.record && !evalCondition(rule.condition, ctx.record))
        return false;
    return true;
}
export class PermissionEvaluatorImpl {
    rules = [];
    constructor(initial = []) {
        this.rules.push(...initial);
    }
    can(resource, verb, ctx) {
        for (const rule of this.rules) {
            if (ruleApplies(rule, resource, verb, ctx)) {
                return { allowed: true };
            }
        }
        const matching = this.rules.filter((r) => r.resource === resource && r.verbs.includes(verb));
        const requiredRoles = Array.from(new Set(matching.flatMap((r) => r.roles).filter((r) => r !== "*")));
        return {
            allowed: false,
            reason: requiredRoles.length > 0
                ? `Requires role: ${requiredRoles.join(" or ")}`
                : `No policy grants ${verb} on ${resource}`,
            requiredRoles,
        };
    }
    fieldMask(resource, ctx) {
        const hidden = new Set();
        const readOnly = new Set();
        for (const rule of this.rules) {
            if (rule.resource !== resource && rule.resource !== "*")
                continue;
            if (!rule.roles.some((r) => r === "*" || ctx.roles.includes(r)))
                continue;
            for (const h of rule.fieldMask?.hidden ?? [])
                hidden.add(h);
            for (const r of rule.fieldMask?.readOnly ?? [])
                readOnly.add(r);
        }
        return { hidden: [...hidden], readOnly: [...readOnly] };
    }
    register(rules) {
        this.rules.push(...rules);
    }
}
/** Default permissive rules — every authenticated user can view+create+edit
 *  their own records, admins can do everything, viewers read-only. */
export const DEFAULT_POLICY_RULES = [
    { resource: "*", verbs: ["view", "create", "edit", "delete", "bulk", "export", "approve"], scope: "global", roles: ["admin"] },
    { resource: "*", verbs: ["view", "create", "edit", "export"], scope: "tenant", roles: ["member"] },
    { resource: "*", verbs: ["view", "export"], scope: "tenant", roles: ["viewer"] },
];
export function createPermissionEvaluator(rules = DEFAULT_POLICY_RULES) {
    return new PermissionEvaluatorImpl(rules);
}
