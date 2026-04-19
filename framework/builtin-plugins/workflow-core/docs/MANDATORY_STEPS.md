# Workflow Core Mandatory Steps

## Never skip

- Evaluate the workflow definition before applying the transition.
- Emit audit metadata and workflow side effects after each successful transition.
- Every access request starts in draft and must be submitted for review before approval.
- Revocation must remain available after a grant.
- Draft content must be submitted for editor review.
- Scheduled content must pass through publish before becoming live.
- Invoice drafts must be submitted before approvers can act.
- Only approved invoices may be archived.

## Human approvals and checkpoints

- Document when approvals are required, who can grant them, and what evidence must be present.

## Observability and audit

- Document the records, events, or notifications that must exist after each sensitive step.

## Agent operating notes

- Agents may recommend actions, but they must follow the same mandatory steps and approval gates as humans.
- Agents must never invent missing business facts; they should ask for clarification or cite the knowledge source.