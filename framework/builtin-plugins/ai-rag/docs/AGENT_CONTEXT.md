# AI RAG Agent Context

Package/app id: `ai-rag`
Target type: `package`  | Package kind: `ai-pack`
Location: `framework/builtin-plugins/ai-rag`

## Purpose

Tenant-safe memory collections, retrieval diagnostics, and grounded knowledge pipelines.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- ai-core
- jobs-core
- knowledge-core

## Provided capabilities

- ai.memory
- ai.retrieval

## Requested capabilities

- ai.tool.execute
- api.rest.mount
- data.write.ai
- jobs.execute.ai
- ui.register.admin

## Core resources

### `ai.memory-collections`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `classification` (Classification) | Add a field description so agents understand what this value means.
- `documentCount` (Documents) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `label` (Label) | Add a field description so agents understand what this value means.
- `sourcePlugin` (Source) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.
- `updatedAt` (Updated) | Add a field description so agents understand what this value means.

### `ai.memory-documents`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `classification` (Classification) | Add a field description so agents understand what this value means.
- `collectionId` (Collection Id) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `sourceKind` (Source kind) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.
- `title` (Title) | Add a field description so agents understand what this value means.
- `updatedAt` (Updated) | Add a field description so agents understand what this value means.

## Core actions

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

## Core workflows

_No workflows were discovered for this target._