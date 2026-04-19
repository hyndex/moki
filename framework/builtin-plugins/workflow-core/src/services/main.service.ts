import { getWorkflowTransition } from "@platform/jobs";
import { normalizeActionInput } from "@platform/schema";
import type { WorkflowDefinitionKey } from "../workflows/catalog";
import { workflowDefinitions } from "../workflows/catalog";

export type DomainActionInput = {
  instanceId: string;
  tenantId: string;
  definitionKey: WorkflowDefinitionKey;
  currentState:
    | "draft"
    | "pending_approval"
    | "approved"
    | "rejected"
    | "editor_review"
    | "scheduled"
    | "published"
    | "security_review"
    | "granted"
    | "revoked"
    | "archived";
  transition: "submit" | "approve" | "reject" | "reopen" | "publish" | "archive" | "revoke";
  actorRole: "requester" | "approver" | "admin";
  reason?: string | undefined;
};

type WorkflowTransitionResult = {
  ok: true;
  nextState:
    | "draft"
    | "pending_approval"
    | "approved"
    | "rejected"
    | "editor_review"
    | "scheduled"
    | "published"
    | "security_review"
    | "granted"
    | "revoked"
    | "archived";
  approvalStatus: "not-required" | "pending" | "approved" | "rejected";
  auditEventType: string;
  sideEffects: Array<"notify-approver" | "notify-requester" | "enqueue-followup" | "publish-artifact" | "revoke-access">;
};

export function transitionWorkflowInstance(input: DomainActionInput): WorkflowTransitionResult {
  normalizeActionInput(input);

  if (input.actorRole === "requester" && ["approve", "reject", "revoke"].includes(input.transition)) {
    throw new Error(`role ${input.actorRole} cannot execute transition ${input.transition}`);
  }

  const workflow = workflowDefinitions[input.definitionKey];
  const resolvedNextState = getWorkflowTransition(workflow, input.currentState, input.transition);
  if (!resolvedNextState) {
    throw new Error(
      `invalid transition ${input.transition} from ${input.currentState} for workflow ${input.definitionKey}`
    );
  }
  const nextState = resolvedNextState as WorkflowTransitionResult["nextState"];

  const approvalStatus =
    nextState === "pending_approval" || nextState === "editor_review" || nextState === "security_review"
      ? "pending"
      : nextState === "approved" || nextState === "published" || nextState === "granted"
        ? "approved"
        : nextState === "rejected"
          ? "rejected"
          : "not-required";

  const sideEffects: WorkflowTransitionResult["sideEffects"] = [];
  if (approvalStatus === "pending") {
    sideEffects.push("notify-approver");
  }
  if (approvalStatus === "approved") {
    sideEffects.push("notify-requester", "enqueue-followup");
  }
  if (nextState === "published") {
    sideEffects.push("publish-artifact");
  }
  if (nextState === "revoked") {
    sideEffects.push("revoke-access");
  }

  return {
    ok: true,
    nextState,
    approvalStatus,
    auditEventType: `workflow.instance.${input.transition}`,
    sideEffects
  };
}
