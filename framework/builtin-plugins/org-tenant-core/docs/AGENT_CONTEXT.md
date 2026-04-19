# Org Tenant Core Agent Context

Package/app id: `org-tenant-core`
Target type: `package`  | Package kind: `app`
Location: `framework/builtin-plugins/org-tenant-core`

## Purpose

Tenant and organization graph management.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- auth-core

## Provided capabilities

- org.tenants

## Requested capabilities

- api.rest.mount
- data.write.org
- ui.register.admin

## Core resources

### `org.tenants`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `billingPlan` (Billing Plan) | Add a field description so agents understand what this value means.
- `createdAt` (Created) | Add a field description so agents understand what this value means.
- `displayName` (Display Name) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `slug` (Slug) | Add a field description so agents understand what this value means.
- `status` (Status) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.

## Core actions

### `org.tenants.activate`

_Document what this action does in business terms._

Permission: `org.tenants.activate`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

## Core workflows

_No workflows were discovered for this target._