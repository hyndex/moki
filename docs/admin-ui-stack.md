# Admin UI Stack

This document records the canonical frontend stack and wrapper taxonomy for plugins that register into the shared admin UI.

## Canonical Defaults

- React
- TanStack Router via `@platform/router`
- TanStack Query via `@platform/query`
- TanStack Table and TanStack Virtual via `@platform/data-table`
- React Hook Form and Zod via `@platform/form` and `@platform/contracts`
- Radix primitives and shadcn-style composition via `@platform/ui`
- Lucide-backed icon resolution via `@platform/ui`
- Sonner-backed toasts via `@platform/ui`
- cmdk-backed command palette via `@platform/command-palette`
- date-fns-backed date formatting via `@platform/ui`
- ECharts via `@platform/chart`
- Tiptap via `@platform/editor`
- React Email via `@platform/email-templates`

## Public Wrapper Taxonomy

The canonical public wrapper surface for admin-registered plugins is:

- `@platform/ui`
- `@platform/router`
- `@platform/query`
- `@platform/data-table`
- `@platform/form`
- `@platform/chart`
- `@platform/editor`
- `@platform/layout`
- `@platform/contracts`
- `@platform/telemetry-ui`
- `@platform/command-palette`

Legacy `ui-*` packages remain supported as compatibility layers inside the framework, but new admin-plugin implementation should target the canonical names above.

## Policy

- Embedded admin plugins must use platform wrappers first.
- Raw TanStack, React Hook Form, Radix, Lucide, Sonner, cmdk, date-fns, ECharts, and Tiptap imports are forbidden in admin-registered plugin surfaces.
- Exceptions are allowed only for declared isolated zones and builder or studio packages.
- ECharts remains the shared chart engine for the admin framework; Recharts is not the shared default in this repository.

## Enforcement

The repository enforces the policy in two ways:

- `eslint.config.mjs` rejects raw admin-stack imports in admin-registered plugin UI files.
- `framework/libraries/contracts/tests/contracts/admin-plugin-imports.test.ts` scans admin-plugin UI sources and fails if they bypass platform wrappers.

## Representative Packages

- `@platform/ui` wraps the shared Radix/shadcn-style primitives, icons, toasts, and date helpers.
- `@platform/data-table` wraps list/table state, saved views, permissions, and virtualization.
- `@platform/chart` exposes ECharts preset builders and the shared chart surface.
- `@platform/command-palette` provides the cmdk-backed admin command palette.
- `@platform/layout` provides workspace shell regions and split-panel builder layouts.
- `@platform/telemetry-ui` records page, widget, action, and command-palette telemetry through the shell providers.

## Admin-Registered Plugin Rule

If a plugin contributes admin pages, widgets, reports, builders, commands, search providers, or launchable zones, it should treat the wrapper packages above as the stable frontend contract and avoid choosing its own arbitrary UI stack.
