# Files Core Agent Context

Package/app id: `files-core`
Target type: `package`  | Package kind: `app`
Location: `framework/builtin-plugins/files-core`

## Purpose

File references and storage abstractions.

## System role

Describe how this target fits into the larger product, which teams depend on it, and which business outcomes it is responsible for.

## Declared dependencies

- audit-core
- auth-core
- org-tenant-core
- role-policy-core

## Provided capabilities

- files.assets

## Requested capabilities

- api.rest.mount
- data.write.files
- ui.register.admin

## Core resources

### `files.assets`

_Add a concise description for why this resource exists._

Business purpose: _Document the operational purpose of this resource._

Key fields:
- `bytes` (Bytes) | Add a field description so agents understand what this value means.
- `checksum` (Checksum) | Add a field description so agents understand what this value means.
- `contentType` (Content Type) | Add a field description so agents understand what this value means.
- `createdAt` (Created) | Add a field description so agents understand what this value means.
- `fileName` (File Name) | Add a field description so agents understand what this value means.
- `id` (Id) | Add a field description so agents understand what this value means.
- `malwareStatus` (Malware) | Add a field description so agents understand what this value means.
- `objectKey` (Object Key) | Add a field description so agents understand what this value means.
- `status` (Status) | Add a field description so agents understand what this value means.
- `storageAdapter` (Storage Adapter) | Add a field description so agents understand what this value means.
- `tenantId` (Tenant Id) | Add a field description so agents understand what this value means.
- `visibility` (Visibility) | Add a field description so agents understand what this value means.

## Core actions

### `files.assets.register`

_Document what this action does in business terms._

Permission: `files.assets.register`

Business purpose: _Explain why operators or automation invoke this action._

Preconditions:
- _Document the checks that must pass before this action runs._

Side effects:
- _Document emitted events, writes, notifications, and follow-up jobs._

Forbidden shortcuts:
- _Document any paths agents must never bypass._

## Core workflows

_No workflows were discovered for this target._