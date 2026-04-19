# Workflow Core Glossary

## Terms

### workflow.instances

Durable workflow instance record used to track approval and publication processes across the platform.

- `approvalStatus`: Current approval posture for the workflow instance.
- `assignedRole`: Add the field meaning and how operators use it.
- `createdAt`: Creation timestamp for the workflow instance.
- `currentState`: Current workflow state for the instance.
- `definitionKey`: Workflow template that governs the instance.
- `dueAt`: Optional due date for the current review or approval step.
- `id`: Add the field meaning and how operators use it.
- `lastTransitionAt`: Add the field meaning and how operators use it.
- `subjectId`: Add the field meaning and how operators use it.
- `subjectType`: Domain object type that the workflow instance governs.
- `tenantId`: Add the field meaning and how operators use it.


## Domain shortcuts to avoid

- Expand internal jargon that would confuse a new engineer or an AI agent.
- Document terms that are similar but not interchangeable.
- Call out any overloaded words such as account, order, customer, approval, or publish.