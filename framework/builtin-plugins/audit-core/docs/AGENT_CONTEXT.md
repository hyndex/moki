# Audit Core Agent Context

Package/app id: `audit-core`
Target type: `package`  | Package kind: `app`
Location: `framework/builtin-plugins/audit-core`

## Purpose

Canonical audit trail and sensitive action history.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- auth-core
- org-tenant-core

## Provided capabilities

- audit.events

## Requested capabilities

- api.rest.mount
- data.write.audit
- ui.register.admin

## Core resources

### `audit.events`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `actionId` (Action) | Add a field description so agents understand what this value means.
- `actorId` (Actor) | Add a field description so agents understand what this value means.
- `createdAt` (Created) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `severity` (Severity) | Add a field description so agents understand what this value means.
- `status` (Status) | Add a field description so agents understand what this value means.
- `targetId` (Target Id) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.

## Core actions

### `audit.events.record`

_Document what this action does in business terms._

Permission: `audit.events.record`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

## Core workflows

_No workflows were discovered for this target._