# Workflow Core Agent Context

Package/app id: `workflow-core`
Target type: `package`  | Package kind: `app`
Location: `framework/builtin-plugins/workflow-core`

## Purpose

Explicit workflows and approval state machines.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- audit-core
- auth-core
- org-tenant-core
- role-policy-core

## Provided capabilities

- workflow.instances

## Requested capabilities

- api.rest.mount
- data.write.workflow
- ui.register.admin

## Core resources

### `workflow.instances`

Durable workflow instance record used to track approval and publication processes across the platform.

Business purpose: Give operators and automation a single governed view of every active or historical workflow instance.

Key fields:
- `approvalStatus` (Approval) | Current approval posture for the workflow instance. | Business meaning: Tells operators whether the instance is waiting on review or already resolved.
- `assignedRole` (Assigned Role) | Add a field description so agents understand what this value means.
- `createdAt` (Created) | Creation timestamp for the workflow instance. | Business meaning: Used for queue ordering, SLA measurement, and audit trails.
- `currentState` (State) | Current workflow state for the instance. | Business meaning: Determines the next allowed transitions and visible operator actions. | Required for flows: workflow-review, workflow-escalation
- `definitionKey` (Workflow) | Workflow template that governs the instance. | Business meaning: Identifies which state machine and policy rules apply.
- `dueAt` (Due) | Optional due date for the current review or approval step. | Business meaning: Supports escalation, reminders, and queue prioritization.
- `id` (Id) | Add a field description so agents understand what this value means.
- `lastTransitionAt` (Last Transition At) | Add a field description so agents understand what this value means.
- `subjectId` (Subject Id) | Add a field description so agents understand what this value means.
- `subjectType` (Subject Type) | Domain object type that the workflow instance governs. | Business meaning: Helps operators understand whether the workflow is for content, invoices, or access requests.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.

## Core actions

### `workflow.instances.transition`

Apply a governed transition to a workflow instance.

Permission: `workflow.instances.transition`

Business purpose: Move workflows forward in a safe, auditable way while preserving approval and notification side effects.

Preconditions:
- The supplied current state must match the persisted workflow state.
- The acting role must be allowed to perform the requested transition.

Side effects:
- Returns notification and follow-up instructions for downstream systems.
- Produces an audit event type tied to the transition.

Forbidden shortcuts:
- Do not patch workflow state directly in storage.
- Do not skip approval-driven transitions just because an admin initiated the request.

## Core workflows

### `access-review`

Review and grant sensitive access only after security review.

Initial state: `draft`

Business purpose: Protect privileged access changes with explicit security approval and revocation paths.

Mandatory steps:
- Every access request starts in draft and must be submitted for review before approval.
- Revocation must remain available after a grant.

States and transitions:
- `draft`: The access request is being prepared by the requester.
  - `submit` -> `security_review`: Sends the request into security review.
- `security_review`: Security is evaluating the request and its risk posture.
  - `approve` -> `granted`: Grants the access after review.
  - `reject` -> `rejected`: Rejects the request and closes the review cycle.
- `granted`: Access has been granted and is actively in force.
  - `revoke` -> `revoked`: Removes access after it has been granted.
- `rejected`: The request was denied and may be reopened for correction.
  - `reopen` -> `draft`: Returns the request to draft for correction and resubmission.
- `revoked`: Previously granted access has been removed.
  - No outgoing transitions.

### `content-publication`

Editorial review and publication workflow for governed content.

Initial state: `draft`

Business purpose: Prevent content from reaching publication without editorial review and scheduled release control.

Mandatory steps:
- Draft content must be submitted for editor review.
- Scheduled content must pass through publish before becoming live.

States and transitions:
- `draft`: Content is being prepared by the author.
  - `submit` -> `editor_review`: Moves the draft into editorial review.
- `editor_review`: Editors are checking readiness, accuracy, and compliance.
  - `approve` -> `scheduled`: Approves content for scheduling.
  - `reject` -> `rejected`: Rejects content for revision.
- `scheduled`: Content is approved and waiting for publication.
  - `publish` -> `published`: Publishes approved content.
- `published`: Content is live and visible to the intended audience.
  - `archive` -> `archived`: Archives live content.
- `rejected`: Editorial review failed and the content must be revised.
  - `reopen` -> `draft`: Returns rejected content to draft.
- `archived`: Content is no longer active but remains in history.
  - No outgoing transitions.

### `invoice-approval`

Finance approval flow for invoices before they are finalized.

Initial state: `draft`

Business purpose: Ensure invoices are reviewed before final approval and archival.

Mandatory steps:
- Invoice drafts must be submitted before approvers can act.
- Only approved invoices may be archived.

States and transitions:
- `draft`: Invoice is being prepared and has not yet entered approval.
  - `submit` -> `pending_approval`: Queues the invoice for approval.
- `pending_approval`: Invoice is waiting for finance approval.
  - `approve` -> `approved`: Approves the invoice for finalization.
  - `reject` -> `rejected`: Rejects the invoice for correction.
- `approved`: Invoice has been approved and is ready for finalization.
  - `archive` -> `archived`: Archives the approved invoice.
- `rejected`: Invoice was rejected and must be corrected.
  - `reopen` -> `draft`: Returns the invoice to draft.
- `archived`: Invoice has been finalized and archived.
  - No outgoing transitions.