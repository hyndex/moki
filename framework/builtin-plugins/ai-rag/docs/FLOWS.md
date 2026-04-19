# AI RAG Flows

## Happy paths

_No workflows were discovered for this target._

## Action-level flows

### `ai.memory.ingest`

_Document what this action does in business terms._

Permission: `ai.memory.ingest`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

### `ai.memory.reindex`

_Document what this action does in business terms._

Permission: `ai.memory.reindex`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

### `ai.memory.retrieve`

_Document what this action does in business terms._

Permission: `ai.memory.read`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

## Cross-package interactions

- Describe upstream triggers, downstream side effects, notifications, and jobs.
- Document when this target depends on auth, approvals, billing, or data freshness from another package.
- Document how failures recover and who owns reconciliation.