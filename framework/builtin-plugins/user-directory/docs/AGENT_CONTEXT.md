# User Directory Agent Context

Package/app id: `user-directory`
Target type: `package`  | Package kind: `app`
Location: `framework/builtin-plugins/user-directory`

## Purpose

Internal person and directory backbone.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- audit-core
- auth-core
- org-tenant-core
- role-policy-core

## Provided capabilities

- directory.people

## Requested capabilities

- api.rest.mount
- data.write.directory
- ui.register.admin

## Core resources

### `directory.people`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `createdAt` (Created) | Add a field description so agents understand what this value means.
- `email` (Email) | Add a field description so agents understand what this value means.
- `employmentType` (Employment Type) | Add a field description so agents understand what this value means.
- `fullName` (Full Name) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `status` (Status) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.

## Core actions

### `directory.people.register`

_Document what this action does in business terms._

Permission: `directory.people.register`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

## Core workflows

_No workflows were discovered for this target._