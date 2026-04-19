import { defineAction } from "@platform/schema";
import { z } from "zod";
import { transitionWorkflowInstance } from "../services/main.service";
import { workflowDefinitionKeys } from "../workflows/catalog";

const workflowDefinitionKeySchema = z.enum(workflowDefinitionKeys);
const workflowTransitionSchema = z.enum(["submit", "approve", "reject", "reopen", "publish", "archive", "revoke"]);
const workflowStateSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "editor_review",
  "scheduled",
  "published",
  "security_review",
  "granted",
  "revoked",
  "archived"
]);

export const transitionWorkflowInstanceAction = defineAction({
  id: "workflow.instances.transition",
  description: "Apply a governed transition to a workflow instance.",
  businessPurpose: "Move workflows forward in a safe, auditable way while preserving approval and notification side effects.",
  preconditions: [
    "The supplied current state must match the persisted workflow state.",
    "The acting role must be allowed to perform the requested transition."
  ],
  mandatorySteps: [
    "Evaluate the workflow definition before applying the transition.",
    "Emit audit metadata and workflow side effects after each successful transition."
  ],
  sideEffects: [
    "Returns notification and follow-up instructions for downstream systems.",
    "Produces an audit event type tied to the transition."
  ],
  postconditions: [
    "The returned next state is always valid for the workflow definition.",
    "Approval status reflects the new workflow state."
  ],
  failureModes: [
    "Transition fails if the current state and requested transition are incompatible."
  ],
  forbiddenShortcuts: [
    "Do not patch workflow state directly in storage.",
    "Do not skip approval-driven transitions just because an admin initiated the request."
  ],
  input: z.object({
    instanceId: z.string().uuid(),
    tenantId: z.string().uuid(),
    definitionKey: workflowDefinitionKeySchema,
    currentState: workflowStateSchema,
    transition: workflowTransitionSchema,
    actorRole: z.enum(["requester", "approver", "admin"]),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextState: workflowStateSchema,
    approvalStatus: z.enum(["not-required", "pending", "approved", "rejected"]),
    auditEventType: z.string(),
    sideEffects: z.array(z.enum(["notify-approver", "notify-requester", "enqueue-followup", "publish-artifact", "revoke-access"]))
  }),
  permission: "workflow.instances.transition",
  idempotent: true,
  audit: true,
  handler: ({ input }) => transitionWorkflowInstance(input)
});
