# Jobs Core Agent Context

Package/app id: `jobs-core`
Target type: `package`  | Package kind: `app`
Location: `framework/builtin-plugins/jobs-core`

## Purpose

Background jobs, schedules, and execution metadata.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- audit-core
- auth-core
- org-tenant-core
- role-policy-core

## Provided capabilities

- jobs.executions

## Requested capabilities

- api.rest.mount
- data.write.jobs
- ui.register.admin

## Core resources

### `jobs.executions`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `concurrency` (Concurrency) | Add a field description so agents understand what this value means.
- `createdAt` (Created) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `jobKey` (Job) | Add a field description so agents understand what this value means.
- `lastError` (Last Error) | Add a field description so agents understand what this value means.
- `queue` (Queue) | Add a field description so agents understand what this value means.
- `retries` (Retries) | Add a field description so agents understand what this value means.
- `schedule` (Schedule) | Add a field description so agents understand what this value means.
- `status` (Status) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.
- `timeoutMs` (Timeout Ms) | Add a field description so agents understand what this value means.
- `visibleAt` (Visible At) | Add a field description so agents understand what this value means.

## Core actions

### `jobs.executions.schedule`

_Document what this action does in business terms._

Permission: `jobs.executions.schedule`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

## Core workflows

_No workflows were discovered for this target._