# Portal Core Agent Context

Package/app id: `portal-core`
Target type: `package`  | Package kind: `app`
Location: `framework/builtin-plugins/portal-core`

## Purpose

Portal shell and self-service entrypoint backbone.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- audit-core
- auth-core
- org-tenant-core
- role-policy-core

## Provided capabilities

- portal.accounts

## Requested capabilities

- api.rest.mount
- data.write.portal
- ui.register.admin

## Core resources

### `portal.accounts`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `accountType` (Account Type) | Add a field description so agents understand what this value means.
- `createdAt` (Created) | Add a field description so agents understand what this value means.
- `homeRoute` (Home) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `lastSeenAt` (Last Seen At) | Add a field description so agents understand what this value means.
- `membershipStatus` (Membership) | Add a field description so agents understand what this value means.
- `primaryIdentityId` (Primary Identity Id) | Add a field description so agents understand what this value means.
- `selfServiceFeatures` (Self Service Features) | Add a field description so agents understand what this value means.
- `subjectId` (Subject) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.

## Core actions

### `portal.accounts.enable`

_Document what this action does in business terms._

Permission: `portal.accounts.enable`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

## Core workflows

_No workflows were discovered for this target._