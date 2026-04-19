# Library Authoring Guide

This guide is for people building **framework packages and shared libraries** in Gutu.

Use it when you are working inside:

- `framework/core/*`
- `framework/libraries/*`
- or a future reusable local library in a clean Gutu workspace

If you are building an installable business module instead, use [plugin-authoring.md](./plugin-authoring.md).

---

## What counts as a library

Use a framework package or library when the code is:

- reusable across multiple plugins or apps,
- part of the framework contract,
- a wrapper around third-party infrastructure or UI,
- a shared DSL,
- a typed runtime/service abstraction,
- or a safety boundary that prevents vendor sprawl from leaking everywhere.

Typical examples:

- routing wrappers
- query/cache helpers
- data-table wrappers
- form wrappers
- chart wrappers
- editor wrappers
- config/runtime helpers
- auth or DB adapters
- telemetry utilities

---

## Where library code lives

### Framework source repo

- `framework/core/*` for kernel/runtime/infrastructure packages
- `framework/libraries/*` for shared developer-facing libraries and wrappers

### Consumer workspace

- `libraries/*` for project-local shared packages
- `vendor/libraries/*` for future store-installed libraries

---

## Decide before you start

Use this quick rule:

| If you are building... | Use a library? | Why |
| --- | --- | --- |
| a reusable wrapper for a selected stack | yes | it protects the public API |
| a DSL or contract used by multiple modules | yes | it belongs in the framework layer |
| a one-off helper only one plugin needs | usually no | keep it local unless it becomes a pattern |
| business-domain workflows and data ownership | no | that belongs in a plugin |

---

## Core design rules

- keep the public API narrow and typed
- hide raw vendor details where possible
- export stable helpers instead of leaking internal implementation details
- prefer deterministic defaults over flexibility that creates ambiguity
- make it easy for AI agents and humans to discover the intended usage

### Strong rule

Do not add a new framework package just because one plugin needs a tiny helper.

Create a framework package when:

- multiple plugins need it,
- it defines a platform contract,
- it standardizes a stack choice,
- or it protects the rest of the repo from vendor sprawl.

---

## Good package responsibilities

| Package | Responsibility |
| --- | --- |
| `@platform/ui` | shared primitives, icons, toasts, empty/loading states |
| `@platform/data-table` | saved views, virtualization, bulk actions, selection |
| `@platform/form` | RHF + Zod integration, field registry, dirty guards |
| `@platform/chart` | ECharts presets and typed chart builders |
| `@platform/router` | typed routes, auth guards, safe deep links |
| `@platform/query` | query keys, invalidation, optimistic mutation helpers |

---

## How to structure a library package

A good framework package normally has:

- `src/index.ts` or `src/index.tsx` as the public entrypoint
- a narrow export surface
- `tests/unit/*` at minimum
- `docs/*` understanding docs if it is part of the repo’s understanding layer
- package metadata that explains the package purpose clearly

Things to avoid:

- re-exporting huge third-party APIs unless absolutely necessary
- exposing unstable internals as public helpers
- duplicating wrapper logic in multiple packages

---

## Wrapper-first philosophy

Gutu intentionally chooses framework wrappers over direct third-party imports in business code.

That means a library often exists to:

- lock a stack decision
- normalize defaults
- centralize patterns
- encode guardrails
- make generated code more predictable

Examples:

- `@platform/form` instead of raw React Hook Form in every plugin
- `@platform/query` instead of hand-rolled query/cache logic everywhere
- `@platform/chart` instead of direct chart-library imports in embedded admin plugins

---

## Public API discipline

When designing a package API:

1. decide what downstream code should import
2. decide what must stay internal
3. keep type names descriptive and stable
4. avoid forcing consumers to understand your third-party dependency
5. document the happy path first

Good signs:

- the package can be explained in one sentence
- downstream code needs only a few imports
- the default path is obvious

Bad signs:

- consumers need to know the entire underlying vendor library
- every caller needs custom setup
- there are too many equally valid entrypoints

---

## Testing guidance

Framework and shared libraries should have behavior tests, not just smoke tests.

Typical test layers:

- unit tests for pure helpers and public APIs
- contract tests for DSLs and schema behavior
- integration tests where wrappers touch HTTP, DB, shell, jobs, or provider seams

What to verify:

- public API behavior
- error handling
- deterministic defaults
- no leaking of raw vendor details when the wrapper is meant to hide them
- compatibility with the packages expected to consume the library

---

## Docs guidance

If the package is part of the repo understanding layer, make sure the docs explain:

- what the package is for
- who should use it
- what not to use it for
- what it wraps or standardizes
- which contracts or invariants it protects

Good companion docs usually include:

- a short overview
- one or two real examples
- edge cases or gotchas
- links to the next layer up that consumes it

---

## When not to create a library

Do not create a framework library when:

- the code is only for one plugin and is not yet a pattern
- the public API is still unclear
- you are just moving code around to look more “architected”
- the real problem is missing product logic, not missing framework structure

In those cases, keep it local first. Promote it only when it proves reusable.

---

## Quick checklist before you finish

- [ ] The package belongs in the framework or shared layer
- [ ] The public API is narrow and intentional
- [ ] Raw vendor details are hidden where appropriate
- [ ] Tests cover real behavior
- [ ] Docs explain purpose and usage clearly
- [ ] `bun run typecheck` and relevant tests pass
- [ ] `bun run ci:check` still passes when the package matters across the repo

---

## Related docs

- [README.md](../README.md)
- [plugin-authoring.md](./plugin-authoring.md)
- [admin-ui-stack.md](./admin-ui-stack.md)
- [Developer_DeepDive.md](./Developer_DeepDive.md)
