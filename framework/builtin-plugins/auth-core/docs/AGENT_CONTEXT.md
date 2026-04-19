# Auth Core Agent Context

Package/app id: `auth-core`
Target type: `package`  | Package kind: `app`
Location: `framework/builtin-plugins/auth-core`

## Purpose

Canonical identity and session backbone.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- _No declared dependencies._

## Provided capabilities

- auth.identities

## Requested capabilities

- api.rest.mount
- data.write.auth
- ui.register.admin

## Core resources

### `auth.identities`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `authProvider` (Provider) | Add a field description so agents understand what this value means.
- `createdAt` (Created) | Add a field description so agents understand what this value means.
- `displayName` (Display Name) | Add a field description so agents understand what this value means.
- `email` (Email) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `lastAuthenticatedAt` (Last Authenticated At) | Add a field description so agents understand what this value means.
- `status` (Status) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.

## Core actions

### `auth.identities.provision`

_Document what this action does in business terms._

Permission: `auth.identities.provision`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

## Core workflows

_No workflows were discovered for this target._