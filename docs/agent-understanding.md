# Agent Understanding Layer

The framework now includes a dedicated **agent understanding layer**.

Its job is to make the system understandable before anyone tries to automate, extend, or refactor it.

This layer is intentionally separate from orchestration:

- **understanding** explains the system
- **orchestration** decides what work to do with that understanding

The framework supports the first directly. The second still belongs to the caller, operator, or agent runtime.

## Why It Exists

Code shape alone is not enough for safe AI-assisted work.

An agent can usually infer:

- syntax
- imports
- schemas
- route wiring
- package relationships

What it often cannot infer reliably from code alone is:

- why a model exists
- what a field means in business terms
- which workflow steps are mandatory
- what must never be skipped
- which edge cases matter
- what side effects an action has

This layer solves that by adding:

1. inline semantic metadata on resources, actions, and workflows
2. required Markdown doc packs for apps, packages, and plugins
3. a machine-readable repository-wide understanding index

## What Is Included

### Inline semantic metadata

The following framework contracts now support business-facing understanding metadata:

- `defineResource(...)`
- `defineAction(...)`
- `defineWorkflow(...)`

This lets the framework capture meaning, not just shape.

### Required doc pack

Each app, framework package, library, and plugin can carry a standard understanding pack under its local `docs/` directory.

Required filenames:

- `AGENT_CONTEXT.md`
- `BUSINESS_RULES.md`
- `FLOWS.md`
- `GLOSSARY.md`
- `EDGE_CASES.md`
- `MANDATORY_STEPS.md`

### Machine-readable index

The framework can generate a repository-wide understanding map at:

- [docs/agent-understanding.index.json](/Users/chinmoybhuyan/Desktop/Personal/Framework/docs/agent-understanding.index.json)

This is intended for:

- AI preflight context loading
- search and summarization
- business graph generation
- drift detection
- tooling that needs more than free-form Markdown

## Contract Shape

### Resource metadata

```ts
defineResource({
  id: "crm.accounts",
  description: "A customer or prospect organization tracked for ownership, pipeline, and service history.",
  businessPurpose: "Acts as the primary commercial relationship record across CRM, sales, support, and billing flows.",
  invariants: [
    "An account must always belong to exactly one tenant.",
    "Archived accounts remain referenceable for reporting and audit."
  ],
  fields: {
    name: {
      label: "Account name",
      description: "Human-readable commercial name used by operators in list, detail, and approval flows.",
      businessMeaning: "This is the canonical display name for the organization.",
      sourceOfTruth: true,
      requiredForFlows: ["lead-conversion", "account-review"]
    }
  }
})
```

### Action metadata

```ts
defineAction({
  id: "crm.accounts.archive",
  description: "Marks an account as inactive for operational use while preserving history.",
  businessPurpose: "Prevents new operational work on an obsolete account without deleting audit or billing references.",
  preconditions: [
    "The caller must have archive permission.",
    "The account must exist in the current tenant."
  ],
  mandatorySteps: [
    "Record the archival reason.",
    "Emit an audit event."
  ],
  sideEffects: [
    "The account stops appearing in active list defaults."
  ],
  forbiddenShortcuts: [
    "Do not hard-delete the record as a substitute for archival."
  ]
})
```

### Workflow metadata

```ts
defineWorkflow({
  id: "workflow.approvals.default",
  description: "Routes an operational request through review, approval, and completion states.",
  businessPurpose: "Ensures high-risk actions are reviewed before they mutate protected state.",
  actors: ["requester", "reviewer", "approver"],
  invariants: [
    "A completed request cannot return to draft.",
    "Approval must be recorded before the protected action executes."
  ],
  mandatorySteps: [
    "Capture the approval decision.",
    "Emit audit evidence.",
    "Notify the requester."
  ],
  stateDescriptions: {
    draft: "The request is being prepared and is not yet reviewable.",
    pending_approval: "The request is waiting for an authorized approver.",
    approved: "Approval was granted and downstream work may proceed."
  }
})
```

## Required Doc Pack Semantics

### `AGENT_CONTEXT.md`

Explain:

- what the package exists to do
- which actors use it
- which other packages it depends on
- what the package is responsible for

### `BUSINESS_RULES.md`

Capture:

- invariants
- forbidden shortcuts
- approval requirements
- policy-sensitive behavior
- domain rules that should not be reconstructed from guesswork

### `FLOWS.md`

Describe:

- the major workflows
- order of operations
- branching paths
- upstream and downstream dependencies
- recovery paths

### `GLOSSARY.md`

Define:

- important business terms
- overloaded vocabulary
- state names
- domain-specific abbreviations

### `EDGE_CASES.md`

Document:

- failure scenarios
- unusual but valid paths
- stale data behavior
- race and conflict conditions
- degraded-mode rules

### `MANDATORY_STEPS.md`

List:

- required steps that must never be skipped
- what must happen before sensitive state changes
- what human, operator, or automation actions are non-negotiable

## CLI Workflow

### Scaffold the doc pack

```bash
bun run gutu -- docs scaffold --all
```

Target one package if needed:

```bash
bun run gutu -- docs scaffold --target framework/builtin-plugins/dashboard-core
```

### Build the understanding index

```bash
bun run gutu -- docs index --all --out docs/agent-understanding.index.json
```

### Validate the doc pack

```bash
bun run gutu -- docs validate --all
```

The root workspace also exposes:

- `bun run docs:scaffold`
- `bun run docs:index`
- `bun run docs:validate`

## CI Behavior

Understanding validation is now part of the root quality gate.

Current enforcement posture:

- missing required doc-pack files are **errors**
- incomplete semantic enrichment is surfaced as **warnings**

This makes the baseline mandatory everywhere now while leaving room for deeper semantic backfill across older packages.

## How This Helps AI Agents

An agent that reads:

- the package manifest
- resource, action, and workflow semantics
- the local doc pack
- the generated understanding index

can build a much stronger mental model of:

- business intent
- mandatory steps
- state transitions
- approval boundaries
- failure modes
- cross-package dependencies

That reduces hallucinated shortcuts and domain-breaking changes.

## Edge Cases

### Package has no local docs yet

Run:

```bash
bun run gutu -- docs scaffold --target <path>
```

### Package was renamed or moved

Re-run:

```bash
bun run gutu -- docs index --all --out docs/agent-understanding.index.json
```

### Inline semantics are still thin

Validation will stay green for the required baseline, but warnings will call out missing descriptions, missing side-effect notes, and weak workflow semantics.

## Recommended Team Rule

When changing a model, action, or workflow:

1. update the code contract
2. update the semantic metadata
3. update the local doc pack
4. re-run docs index and docs validate
5. only then treat the package as ready for AI-assisted work
