# Role Policy Core Agent Context

Package/app id: `role-policy-core`
Target type: `package`  | Package kind: `app`
Location: `framework/builtin-plugins/role-policy-core`

## Purpose

RBAC and ABAC policy management backbone.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- auth-core
- org-tenant-core

## Provided capabilities

- roles.grants

## Requested capabilities

- api.rest.mount
- data.write.roles
- ui.register.admin

## Core resources

### `roles.grants`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `createdAt` (Created) | Add a field description so agents understand what this value means.
- `effect` (Effect) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `permission` (Permission) | Add a field description so agents understand what this value means.
- `status` (Status) | Add a field description so agents understand what this value means.
- `subjectId` (Subject Id) | Add a field description so agents understand what this value means.
- `subjectType` (Subject Type) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.

## Core actions

### `roles.grants.assign`

_Document what this action does in business terms._

Permission: `roles.grants.assign`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

## Core workflows

_No workflows were discovered for this target._