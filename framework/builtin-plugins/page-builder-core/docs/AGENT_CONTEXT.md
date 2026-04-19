# Page Builder Core Agent Context

Package/app id: `page-builder-core`
Target type: `package`  | Package kind: `app`
Location: `framework/builtin-plugins/page-builder-core`

## Purpose

Layout, block, and builder canvas backbone.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- audit-core
- auth-core
- org-tenant-core
- role-policy-core

## Provided capabilities

- page-builder.layouts

## Requested capabilities

- api.rest.mount
- data.write.page-builder
- ui.register.admin

## Core resources

### `page-builder.layouts`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `createdAt` (Created) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `label` (Label) | Add a field description so agents understand what this value means.
- `status` (Status) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.

## Core actions

### `page-builder.layouts.compose`

_Document what this action does in business terms._

Permission: `page-builder.layouts.compose`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

## Core workflows

_No workflows were discovered for this target._