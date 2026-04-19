# AI Evals Agent Context

Package/app id: `ai-evals`
Target type: `package`  | Package kind: `ai-pack`
Location: `framework/builtin-plugins/ai-evals`

## Purpose

Eval datasets, judges, regression baselines, and release-grade AI review.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- ai-core
- audit-core
- jobs-core

## Provided capabilities

- ai.evals
- ai.release-gates

## Requested capabilities

- api.rest.mount
- data.write.ai
- jobs.execute.ai
- ui.register.admin

## Core resources

### `ai.eval-datasets`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `caseCount` (Cases) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `label` (Dataset) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.
- `updatedAt` (Updated) | Add a field description so agents understand what this value means.

### `ai.eval-runs`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `averageScore` (Average score) | Add a field description so agents understand what this value means.
- `completedAt` (Completed) | Add a field description so agents understand what this value means.
- `datasetId` (Dataset) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `passRate` (Pass rate) | Add a field description so agents understand what this value means.
- `status` (Status) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.

## Core actions

### `ai.evals.compare`

_Document what this action does in business terms._

Permission: `ai.evals.read`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

### `ai.evals.run`

_Document what this action does in business terms._

Permission: `ai.evals.run`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

## Core workflows

_No workflows were discovered for this target._