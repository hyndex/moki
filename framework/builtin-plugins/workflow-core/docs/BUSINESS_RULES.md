# Workflow Core Business Rules

## Invariants

- Each workflow instance belongs to one tenant and one workflow definition.
- State transitions must remain auditable and replayable.

## Lifecycle notes

- Instances move between explicit states only through declared transitions.
- Approval status and due dates drive operator queues and reminders.

## Actor expectations

- requester
- approver
- admin

## Decision boundaries

- Document which decisions are automated, which are recommendation-only, and which always require a human or approval checkpoint.
- Document which policies or compliance rules override convenience.
- Document what counts as a safe retry versus a risky duplicate.