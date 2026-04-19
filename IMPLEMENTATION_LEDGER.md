# IMPLEMENTATION_LEDGER

Historical entries may reference optional plugin packages that were part of earlier implementation waves before the repository was narrowed to the framework-only Git baseline.

## 2026-04-20 10:35:00 IST - Framework-only repository cleanup

- Removed the checked-in optional plugin catalog from the framework distribution plan.
- Updated the framework workspace to ship only:
  - `framework/core`
  - `framework/libraries`
  - `framework/builtin-plugins`
  - verification apps and tooling
- Reworked the dev harness and browser E2E so they prove built-in framework surfaces only:
  - dashboard workbench
  - AI operator surfaces
  - page-builder zone behavior
  - restricted-preview governance
- Replaced bundle-resolution tests that depended on deleted optional packages with inline bundle manifests over built-in plugin manifests.
- Pruned workspace discovery and TypeScript path aliases so optional plugin trees are no longer treated as first-class workspaces in the shipped repository.
- Updated the workspace scaffolder so it no longer recreates the deleted optional plugin catalog.
- Reconciled handbook and tracking docs to describe `plugins/` as a future vendored/store install area rather than a checked-in source catalog.

## 2026-04-19 22:58:00 IST - Agent understanding layer implemented and wired into CI

- Added the new framework package:
  - `framework/core/agent-understanding`
- Extended framework contracts so business meaning can live next to system shape:
  - `@platform/schema` resource descriptions and field-level semantic metadata
  - `@platform/schema` action purpose, preconditions, mandatory-step, side-effect, and failure metadata
  - `@platform/jobs` workflow actors, invariants, mandatory steps, state meanings, and transition meanings
- Added CLI support in `@platform/cli` for:
  - `platform docs scaffold`
  - `platform docs index`
  - `platform docs validate`
- Added root workspace shortcuts:
  - `bun run docs:scaffold`
  - `bun run docs:index`
  - `bun run docs:validate`
- Added and generated the machine-readable repository understanding map:
  - `docs/agent-understanding.index.json`
- Scaffolded the required doc pack across the repository topology:
  - `AGENT_CONTEXT.md`
  - `BUSINESS_RULES.md`
  - `FLOWS.md`
  - `GLOSSARY.md`
  - `EDGE_CASES.md`
  - `MANDATORY_STEPS.md`
- Enriched representative package semantics in:
  - `plugins/domain/crm-core`
  - `framework/builtin-plugins/workflow-core`
  - `framework/builtin-plugins/ai-core`
- Updated the workspace scaffolder so newly generated apps, packages, plugins, connectors, migration packs, and bundles start with package descriptions, doc-pack files, and richer semantic metadata examples.
- Updated handbook and governance docs for the understanding layer:
  - `README.md`
  - `docs/agent-understanding.md`
  - `docs/README.md`
  - tracking and ADR documents
- Added `docs:validate` to the root `ci:check` gate so understanding coverage becomes a quality requirement.
- Commands run during the understanding wave:
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test framework/core/agent-understanding/tests/unit/package.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test framework/core/schema/tests/unit/schema.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test framework/core/jobs/tests/unit/package.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test framework/core/cli/tests/unit/package.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run platform -- docs scaffold --all`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run platform -- docs index --all --out docs/agent-understanding.index.json`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run platform -- docs validate --all`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run lint`
  - `dropdb --if-exists framework_platform_test && createdb framework_platform_test && export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run ci:check`
- Verification result:
  - targeted understanding, schema, workflow, and CLI tests passed
  - required doc-pack coverage is present repo-wide
  - repository understanding index generation succeeded
  - understanding validation is green with warning-level follow-up items for deeper legacy semantic backfill
  - the root quality gate now enforces understanding-doc presence
  - repo-wide lint passed after the CLI understanding-loader fix
  - the exact clean-shell root `ci:check` passed after the docs/README wave and package-local CLI cwd fix

## 2026-04-19 21:16:00 IST - Native AI-agent platform wave implemented

- Added the AI platform package family under `framework/libraries/`:
  - `ai-runtime`
  - `ai-memory`
  - `ai-guardrails`
  - `ai-evals`
  - `ai-mcp`
- Extended `@platform/schema` and `@platform/ai` so actions/resources can declare AI-facing tool metadata, approval modes, grounding inputs, output redaction rules, and replay metadata.
- Added AI governance review rules to `@platform/permissions` for:
  - runtime AI model/tool execution capabilities
  - memory export review
- Reworked the built-in AI batteries under `framework/builtin-plugins/`:
  - `ai-core`
  - `ai-rag`
  - `ai-evals`
- Added AI admin workbench surfaces for:
  - runs
  - prompts
  - approvals
  - replay
  - memory collections
  - retrieval diagnostics
  - eval runs
  - AI reports/widgets/commands/search
- Added the first `@platform/cli` implementation with AI-native commands:
  - `platform agent run`
  - `platform agent replay`
  - `platform agent approve`
  - `platform prompt validate`
  - `platform prompt diff`
  - `platform memory ingest`
  - `platform memory reindex`
  - `platform eval run`
  - `platform eval compare`
  - `platform mcp inspect`
  - `platform mcp serve`
  - `platform make ai-pack`
- Added the repo-native developer runner:
  - `bun run platform -- ...`
- Wired the AI batteries into `apps/platform-dev-console` so the browser harness now covers AI routes, widgets, reports, and viewer-denial behavior.
- Commands run during the AI wave:
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p framework/libraries/ai-runtime/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p framework/libraries/ai-memory/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p framework/libraries/ai-guardrails/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p framework/libraries/ai-evals/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p framework/libraries/ai-mcp/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p framework/builtin-plugins/ai-core/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p framework/builtin-plugins/ai-rag/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p framework/builtin-plugins/ai-evals/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p framework/core/cli/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p apps/platform-dev-console/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test framework/core/permissions/tests/unit/permissions.test.ts framework/libraries/ai/tests/unit/package.test.ts framework/libraries/ai-runtime/tests/unit/package.test.ts framework/libraries/ai-memory/tests/unit/package.test.ts framework/libraries/ai-guardrails/tests/unit/package.test.ts framework/libraries/ai-evals/tests/unit/package.test.ts framework/libraries/ai-mcp/tests/unit/package.test.ts framework/builtin-plugins/ai-core/tests/unit/package.test.ts framework/builtin-plugins/ai-core/tests/contracts/ui-surface.test.ts framework/builtin-plugins/ai-rag/tests/unit/package.test.ts framework/builtin-plugins/ai-rag/tests/contracts/ui-surface.test.ts framework/builtin-plugins/ai-evals/tests/unit/package.test.ts framework/builtin-plugins/ai-evals/tests/contracts/ui-surface.test.ts framework/core/cli/tests/unit/package.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run test:e2e` in `apps/platform-dev-console`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run platform -- --help`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run platform -- mcp inspect --tool ai.memory.retrieve`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run platform -- agent run --goal "Summarize open escalations with grounded next steps."`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run lint`
  - `dropdb --if-exists framework_platform_test && createdb framework_platform_test && export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run ci:check`
- Verification result:
  - targeted typechecks passed
  - targeted AI governance/library/plugin/CLI suites passed
  - browser AI workbench harness passed
  - repo-native `platform` runner worked for help, MCP inspection, and agent execution
  - fresh repo-wide lint passed after AI package cleanup
  - fresh exact clean-shell root `ci:check` passed after the AI platform wave

## 2026-04-18 17:46:50 IST - Initial baseline capture

- Repository contents discovered:
  - `Goal.md`
  - `Developer_DeepDive.md`
- Read both source documents completely.
- Extracted the mandatory implementation order, package taxonomy, DSL contracts, security posture, DB model, API model, UI model, bundle model, migration model, testing layers, and CI/release expectations.

## 2026-04-18 17:46:50 IST - Environment commands run

- `pwd && rg --files -g 'Goal.md' -g 'Developer_DeepDive.md' -g '!node_modules' -g '!dist' -g '!build' && rg --files -g '!node_modules' -g '!dist' -g '!build'`
- `ls -la`
- `wc -l Goal.md Developer_DeepDive.md`
- `du -h Goal.md Developer_DeepDive.md`
- `rg -n '^#{1,6} ' Goal.md`
- `rg -n '^#{1,6} ' Developer_DeepDive.md`
- `sed -n '1,3110p' Goal.md` in chunked reads
- `sed -n '1,2106p' Developer_DeepDive.md` in chunked reads
- `bun --version`
- `git status --short --branch`
- `date '+%Y-%m-%d %H:%M:%S %Z'`

## 2026-04-18 17:46:50 IST - Observed issues

- `bun --version` failed with `command not found`.
- `git status --short --branch` failed because the directory is not a git repository.

## 2026-04-18 17:46:50 IST - Decisions

- Begin with mandatory tracking artifacts before any workspace code.
- Treat Bun absence as an environment bootstrap task, not as permission to switch the platform contract away from Bun.
- Keep all incomplete scope explicit through `TASKS.md` and `TEST_MATRIX.md`.

## 2026-04-18 18:24:00 IST - Workspace foundation implemented

- Added root workspace/configuration files:
  - `.gitignore`
  - `package.json`
  - `bunfig.toml`
  - `tsconfig.base.json`
  - `tsconfig.json`
  - `eslint.config.mjs`
  - `prettier.config.mjs`
  - `.env.example`
  - `.env.test.example`
  - `tooling/scripts/workspace-task.mjs`
  - `tooling/test/register-env.ts`
- Added repository scaffolder:
  - `tooling/scripts/scaffold-workspace.mjs`
- Installed Bun via `curl -fsSL https://bun.sh/install | bash`
- Validated local Bun binary with `$HOME/.bun/bin/bun --version` -> `1.3.12`
- Executed scaffolder with:
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run tooling/scripts/scaffold-workspace.mjs`
- Generated the package/plugin/app workspace tree with 600+ files across:
  - platform packages
  - foundation plugins
  - domain plugins
  - feature packs
  - connectors
  - migration packs
  - verticals
  - bundles
  - apps
- Installed workspace dependencies with:
  - `export PATH="$HOME/.bun/bin:$PATH" && bun install`

## 2026-04-18 18:24:00 IST - Follow-up required

- Generated core packages are still scaffolds and must be replaced with real implementations before validation.
- Generated plugin/service code intentionally depends on the upcoming kernel/schema/permissions/UI exports.

## 2026-04-18 18:48:40 IST - Core platform packages implemented and verified

- Implemented real platform logic for:
  - `packages/kernel`
  - `packages/schema`
  - `packages/permissions`
  - `packages/plugin-solver`
  - `packages/db-drizzle`
  - `packages/migrate`
  - `packages/auth`
  - `packages/auth-admin`
  - `packages/api-rest`
  - `packages/api-graphql`
  - `packages/ui-router`
  - `packages/ui-query`
  - `packages/ui-form`
  - `packages/ui-table`
  - `packages/ui-kit`
  - `packages/ui-editor`
  - `packages/ui-zone-next`
  - `packages/ui-zone-static`
- Added or replaced package tests to cover:
  - manifest/registry behavior
  - permission/security rules
  - DB role/RLS helpers
  - migration ordering/dry-run/rollback
  - auth/impersonation/session context
  - REST/OpenAPI/webhook/AI tool generation
  - GraphQL adapter execution
  - UI route/query/form/table/editor/zone helpers
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test`
- Verification result:
  - typecheck passed
  - root test suite passed

## 2026-04-18 18:48:40 IST - Repository consistency fixes and bundle smoke coverage

- Added `README.md` with workspace/run instructions.
- Added `docs/README.md` and mirrored `docs/Goal.md` + `docs/Developer_DeepDive.md` to match the expected monorepo layout.
- Fixed generated plugin self-dependencies across `package.ts` and `package.json`.
- Normalized the foundation dependency graph to eliminate bundle-resolution cycles:
  - `auth-core`
  - `org-tenant-core`
  - `role-policy-core`
  - `audit-core`
  - `user-directory`
- Updated `tooling/scripts/scaffold-workspace.mjs` so future generations filter self-dependencies and preserve the corrected foundation graph.
- Added real workspace bundle resolution smoke tests in:
  - `packages/plugin-solver/tests/unit/workspace-bundles.test.ts`
- Commands run:
  - node-based normalization script for plugin manifests and package dependencies
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test packages/plugin-solver/tests/unit/workspace-bundles.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test`
- Verification result:
  - typecheck passed
  - root test suite passed with `314` passing tests

## 2026-04-18 19:11:23 IST - Foundation plugin hardening wave two completed

- Reworked the following foundation plugins from generic label/status scaffolds into domain-specific contracts with behavior-oriented unit tests:
  - `workflow-core`
  - `jobs-core`
  - `files-core`
  - `notifications-core`
  - `portal-core`
- Added explicit workflow definitions to `workflow-core` using `@platform/jobs` and enforced audited transition rules with approval-role guardrails.
- Added explicit queue job envelopes to `jobs-core` using `@platform/jobs`, plus scheduling metadata, observability keys, and concurrency/retry/timeout envelope checks.
- Added file registration security logic to `files-core`, including quarantine gating for risky uploads, object-key normalization checks, and storage-secret selection.
- Added provider-routing and delayed-delivery logic to `notifications-core`, including declared secret requirements and blocked/scheduled dispatch states.
- Added real portal account contracts to `portal-core`, enabled portal resource exposure, and registered canonical portal shell surfaces:
  - embedded portal page at `/portal/home`
  - portal summary widget at `portal.overview.summary`
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test plugins/foundations/workflow-core/tests/unit/package.test.ts plugins/foundations/jobs-core/tests/unit/package.test.ts plugins/foundations/files-core/tests/unit/package.test.ts plugins/foundations/notifications-core/tests/unit/package.test.ts plugins/foundations/portal-core/tests/unit/package.test.ts plugins/foundations/portal-core/tests/contracts/ui-surface.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test`
- Verification result:
  - workspace typecheck passed
  - targeted foundation tests passed
  - root test suite passed with `336` passing tests

## 2026-04-18 19:16:23 IST - Booking and scheduling slice hardened with concurrency coverage

- Reworked `scheduling-core` into a real availability/allocation package with:
  - buffered allocation windows
  - canonical writer metadata
  - deterministic allocation ledger keys
  - overlap detection helpers
- Reworked `booking-core` into a real reservation package with:
  - reservation holds
  - confirmation vs waitlist vs rejection states
  - deposit-aware confirmation rules
  - dependency on `scheduling-core` for canonical ledger and overlap logic
- Added an integration test that uses a canonical reservation writer to prove concurrent confirmations do not double-book the same slot.
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test plugins/domain/scheduling-core/tests/unit/package.test.ts plugins/domain/booking-core/tests/unit/package.test.ts plugins/domain/booking-core/tests/integration/concurrency.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test`
- Verification result:
  - workspace typecheck passed
  - targeted booking/scheduling tests passed
  - root test suite passed with `342` passing tests

## 2026-04-18 21:48:35 IST - Postgres security bootstrap and live DB verification added

- Expanded `@platform/db-drizzle` with:
  - generated Postgres bootstrap SQL for platform roles, schemas, curated `api` views, and tenant RLS
  - generated transaction-context SQL examples
  - optional pinned-connection Postgres client support for transaction-scoped context tests
- Added and rendered:
  - `tooling/scripts/render-postgres-assets.mjs`
  - `ops/postgres/platform-bootstrap.sql`
  - `ops/postgres/transaction-context.sql`
  - `ops/postgres/compose.yaml`
  - `ops/postgres/README.md`
- Added a live Postgres integration suite in `packages/db-drizzle/tests/integration/postgres.test.ts` that verifies:
  - role creation
  - curated `api` view grants
  - base-table denial for isolated runtimes
  - tenant RLS enforcement for runtime roles
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run db:render:postgres`
  - `dropdb --if-exists framework_platform_test && createdb framework_platform_test`
  - `export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun test packages/db-drizzle/tests/integration/postgres.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run test:integration`
- Verification result:
  - local Postgres integration suite passed
  - root integration runner passed with DB, connector, booking, CRM growth, and commerce checkout coverage

## 2026-04-18 21:48:35 IST - CRM growth and commerce revenue slices hardened

- Reworked the CRM/sales/marketing packages from baseline scaffolds into domain-specific contracts and tests:
  - `crm-core`
  - `sales-core`
  - `marketing-core`
- Reworked the commerce revenue path into domain-specific contracts and tests:
  - `catalog-core`
  - `pricing-core`
  - `commerce-core`
  - `payments-core`
- Added a cross-package integration flow in `plugins/domain/payments-core/tests/integration/checkout-flow.test.ts` that exercises:
  - catalog publication
  - pricing activation and quoting
  - order confirmation

## 2026-04-19 19:50:28 IST - Root handbook documentation rewrite completed

- Replaced the short root `README.md` runbook with a full platform handbook.
- Expanded the README to cover:
  - platform purpose and positioning
  - core principles and AI-first stance
  - architecture diagrams and request/install flows
  - workspace structure and package taxonomy
  - admin workbench model and canonical admin wrapper stack
  - getting started, command reference, Postgres verification, and release/security commands
  - package, plugin, app, connector, migration-pack, and bundle authoring guidance
  - security/governance posture, testing strategy, CI/release flow, and operational edge cases
- Kept the content aligned with the actual repository implementation by using live manifest, admin-contribution, connector, migration-pack, and bundle examples from the workspace.
- Commands run:
  - `sed -n '1,260p' README.md`
  - `sed -n '1,260p' package.json`
  - `sed -n '1,220p' docs/README.md`
  - `sed -n '1,240p' docs/admin-ui-stack.md`
  - `sed -n '1,240p' plugins/foundations/admin-shell-workbench/package.ts`
  - `sed -n '1,260p' packages/kernel/src/index.ts`
  - `sed -n '1,260p' tooling/scripts/scaffold-workspace.mjs`
  - `sed -n '1,220p' apps/platform-dev-console/package.json`
  - `rg -n "definePlugin|defineBundle|definePackage|defineResource|defineAction|defineConnector|defineMigrationPack|defineUiSurface|defineWorkspace|defineReport|defineBuilder" packages plugins -g '!**/dist/**'`
  - `sed -n '1,260p' packages/admin-contracts/src/types.ts`
  - `sed -n '1,280p' packages/admin-contracts/src/registry.ts`
  - `sed -n '1,220p' plugins/domain/crm-core/package.ts`
  - `sed -n '1,220p' plugins/domain/crm-core/src/resources/main.resource.ts`
  - `sed -n '1,220p' plugins/domain/crm-core/src/actions/default.action.ts`
  - `sed -n '1,260p' plugins/domain/crm-core/src/ui/admin.contributions.ts`
  - `sed -n '1,220p' plugins/connectors/s3-storage-adapter/package.ts`
  - `sed -n '1,220p' plugins/migrations/shopify-import/package.ts`
  - `sed -n '1,220p' plugins/bundles/admin-foundation/package.ts`
  - `sed -n '1,220p' packages/kernel/src/manifest.ts`
  - `wc -l README.md`
  - `sed -n '1,260p' README.md`
- Verification result:
  - documentation content inspected after rewrite
  - no runtime code changed, so no additional build/test gate was required for this documentation-only milestone

## 2026-04-19 20:18:35 IST - Repository topology restructured for framework distribution and root Git initialized

- Moved the monorepo from the older mixed `packages/` + `plugins/foundations/` shape into a distribution-oriented taxonomy:
  - `framework/core/` for engine/runtime/infrastructure packages
  - `framework/libraries/` for shared libraries, admin desk packages, UI wrappers, and compatibility layers
  - `framework/builtin-plugins/` for shipped default plugins such as auth, audit, dashboard, portal, and the admin shell
  - `plugins/` retained for optional/business extensions, connectors, migrations, verticals, and bundles
- Kept package identities stable:
  - `@platform/*` remained unchanged
  - `@plugins/*` remained unchanged
- Updated repository wiring to match the new topology:
  - root `package.json` workspaces
  - root `tsconfig.base.json` path aliases
  - `tooling/scripts/workspace-utils.mjs`
  - `tooling/scripts/render-postgres-assets.mjs`
  - `tooling/scripts/scaffold-workspace.mjs`
  - root and supporting docs
- Bulk-fixed framework package `tsconfig.json` files so their `extends` path still points back to the root after the extra directory depth introduced by `framework/core/*` and `framework/libraries/*`.
- Updated `.gitignore` so the cloned external reference repos under `ref/dashboard/ToolJet`, `ref/dashboard/frappe`, and `ref/dashboard/metabase` stay out of the root framework repository instead of becoming accidental embedded git repos.
- Initialized the root Git repository with `git init`.
- Commands run:
  - `find . -maxdepth 2 -type d | sort`
  - `rg -n '"workspaces"|apps/\\*|packages/\\*|plugins/' package.json tsconfig.base.json bunfig.toml tooling -g '!**/dist/**'`
  - `rg -n '@platform/|@plugins/|plugins/' packages plugins apps tooling -g '!**/dist/**' | head -n 300`
  - `rg -n "packages/|plugins/foundations|plugins/domain|plugins/feature-packs|plugins/connectors|plugins/migrations|plugins/verticals|plugins/bundles|framework/" tooling package.json tsconfig.base.json eslint.config.mjs docs README.md TASKS.md STATUS.md TEST_MATRIX.md ARCHITECTURE_DECISIONS.md RISK_REGISTER.md -g '!**/dist/**'`
  - `sed -n '1,260p' tooling/scripts/workspace-task.mjs`
  - `sed -n '1,260p' tooling/scripts/workspace-coverage.mjs`
  - `sed -n '1,260p' eslint.config.mjs`
  - `sed -n '1,220p' tooling/scripts/render-postgres-assets.mjs`
  - `sed -n '1,260p' tooling/scripts/workspace-utils.mjs`
  - `rg -n "createPlatformPackage|platformPackage\\(|createPluginPackage|createConnectorPackage|createMigrationPackage|createBundlePackage|path.join\\(rootDir, \\"packages\\"|path.join\\(rootDir, \\"plugins\\"" tooling/scripts/scaffold-workspace.mjs`
  - filesystem move command relocating `packages/*` and `plugins/foundations/*` into `framework/*`
  - bulk update of framework package `tsconfig.json` extends paths
  - `export PATH="$HOME/.bun/bin:$PATH" && bun install`
  - `export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run ci:check`
  - `git init`
  - `git status --short --branch`
  - `git status --short --ignored ref/dashboard`
- Failures encountered:
  - none; the root quality gate passed after the topology move once workspace config and package `tsconfig` bases were updated
- Verification result:
  - workspace install refreshed successfully under the new workspaces
  - exact clean-shell root `ci:check` passed after the restructure
  - root Git repository initialized cleanly
  - payment capture
- Commands run:
  - package-local `bun run lint`, `bun run typecheck`, and `bun test` in:
    - `plugins/domain/catalog-core`
    - `plugins/domain/pricing-core`
    - `plugins/domain/commerce-core`
    - `plugins/domain/payments-core`
- Verification result:
  - all four package-local verification runs passed

## 2026-04-18 22:00:36 IST - CI/release workflows added and repo-wide lint tail investigation started

- Added CI and release workflow definitions:
  - `.github/workflows/ci.yml`
  - `.github/workflows/release-readiness.yml`
- Added release pipeline documentation:
  - `docs/release-pipeline.md`
- Aligned environment/runbook files with the generated Postgres bootstrap defaults:
  - `.env.example`
  - `.env.test.example`
  - `README.md`
- Updated `tooling/scripts/workspace-task.mjs` so root phase-specific test commands auto-discover conventional test directories when a package script is absent.
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p tsconfig.json --noEmit`
  - `dropdb --if-exists framework_platform_test && createdb framework_platform_test && export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run test:integration`
  - `dropdb --if-exists framework_platform_test && createdb framework_platform_test && export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run ci:check`
  - repeated `export PATH="$HOME/.bun/bin:$PATH" && bun run lint` reruns while burning down repo-wide lint blockers
- Failures encountered during the repo-wide lint/CI rerun:
  - `packages/api-graphql/src/index.ts` strict typing / unsafe assignment lint failures
  - `packages/api-rest/src/index.ts` redundant `unknown` union lint failures
  - `packages/config/src/index.ts` type-only import lint failure
  - `packages/jobs/src/index.ts` type-only import lint failure
  - `packages/kernel/src/manifest.ts` unsafe stringification lint failure
  - `packages/schema/*` type-only import / unsafe-return / async-test lint failures
  - `packages/ui-form/src/index.ts` unsafe stringification lint failure
  - `packages/ui-router/src/index.ts` redundant `unknown` union lint failure
- Fixes made:
  - patched each of the core packages above to satisfy the strict lint rules that surfaced during the repo-wide reruns
- Current state:
  - the repo-wide lint and `ci:check` gate still need another full rerun after the latest `ui-router` fix to determine the next blocker or confirm green status

## 2026-04-19 13:04:00 IST - Admin desk reference set cloned

- Cloned the requested comparison repositories under `ref/dashboard/`.
- Retained the admin UI guide alongside them at `ref/dashboard/admin_ui_deepdive.md`.

## 2026-04-19 13:04:00 IST - Admin desk package family implemented

- Added:
  - `packages/admin-contracts`
  - `packages/admin-listview`
  - `packages/admin-formview`
  - `packages/admin-widgets`
  - `packages/admin-reporting`
  - `packages/admin-builders`
  - `packages/admin-shell-workbench`
  - `plugins/foundations/admin-shell-workbench`
- Added admin contribution contracts for:
  - workspaces
  - admin nav
  - pages
  - widgets
  - reports
  - commands
  - search providers
  - builders
  - zone launchers
- Added deterministic validation, access helpers, and legacy `defineUiSurface` adaptation.

## 2026-04-19 13:04:00 IST - Shared wrappers and representative plugin migrations completed

- Expanded `ui-kit`, `ui-table`, `ui-form`, `ui-query`, and `ui-router` with the primitives required by the new desk DSLs.
- Added representative admin contribution modules and tests for:
  - `dashboard-core`
  - `crm-core`
  - `page-builder-core`
- Upgraded `apps/platform-dev-console` into the admin desk verification harness with workspace/search/report/builder/zone/forbidden-route/impersonation/restricted-preview flows.

## 2026-04-19 13:04:00 IST - Admin desk failures encountered and fixed

- TypeScript internal compiler crash caused by workspace path aliases expecting `src/index.ts` while `admin-shell-workbench`, `admin-builders`, and `admin-widgets` only exposed `src/index.tsx`.
- Exact-optional-prop typing issues in the widget primitives.
- List-view query-scope typing mismatch.
- Form/detail read-only contract mismatch.
- Builder route resolution losing to same-route page contributions.
- Forbidden deep links returning `404` because permission filtering happened before route resolution.
- Healthy zone launches incorrectly rendering the degraded state.
- Admin-package lint failures (`require-await`, `no-unused-vars`, `no-unnecessary-type-assertion`) and non-actionable fast-refresh warnings in library/harness entry files.
- Fixes made:
  - normalized package entrypoints to `src/index.ts` re-exporting `src/main.tsx`
  - corrected admin shell visibility/resolution flow to preserve forbidden-route semantics
  - corrected builder precedence and zone availability handling
  - cleaned the admin-package lint tail and scoped the fast-refresh rule away from library-style files

## 2026-04-19 13:04:00 IST - Admin desk verification commands

- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bun install`
  - targeted `bun run typecheck` in admin packages, representative plugins, and `apps/platform-dev-console`
  - targeted `bun test` for all new admin package unit suites
  - targeted `bun test` for representative plugin admin-contribution contract suites
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test apps/platform-dev-console/tests/e2e/shell-harness.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run security:audit`
- Verification result:
  - all new admin package unit suites passed
  - representative plugin admin-contribution contract suites passed
  - browser E2E for the admin desk harness passed
  - targeted admin package/app typechecks passed
  - `security:audit` passed after the admin-desk dependency changes
- Long-running fresh root `lint` and exact root `ci:check` reruns were started after the admin fixes and remain under reconciliation in the tracking docs while they complete.

## 2026-04-19 13:04:00 IST - Repo-wide lint tail cleared for the admin desk wave

- Exact root gate rerun exposed one remaining lint blocker in `packages/ui-form/tests/unit/package.test.ts`:
  - `@typescript-eslint/require-await` on an async validation callback with no `await`
- Fix made:
  - removed the unnecessary `async` wrapper while preserving the async-validation helper coverage
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test packages/ui-form/tests/unit/package.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run lint`
- Verification result:
  - targeted `ui-form` unit test passed
  - fresh repo-wide lint passed cleanly
  - exact root `ci:check` rerun was restarted with the same Postgres test database after the lint tail fix

## 2026-04-19 16:10:00 IST - Admin desk naming surface scrubbed and regenerated

- Context:
  - The shipped framework had to stay independent of the external reference products used during design research.
- Changes made:
  - renamed the shipped admin shell package and plugin to neutral workbench identifiers
  - replaced reference-derived shell ids, labels, test ids, and component symbols with neutral workbench naming
  - rewrote builder wording to use neutral multi-panel editor language
  - scrubbed tracking docs so the reference-product names remain only under `ref/dashboard/*`
  - removed stale generated artifacts carrying the old names and regenerated workspace metadata
- Commands run:
  - workspace reference-name leak scan across source, docs, manifests, and rebuilt outputs
  - `export PATH="$HOME/.bun/bin:$PATH" && bun install`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run typecheck && bun test && bun run build` in `packages/admin-shell-workbench`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run typecheck && bun test && bun run build` in `plugins/foundations/admin-shell-workbench`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run typecheck && bun test tests/e2e/shell-harness.test.ts && bun run build` in `apps/platform-dev-console`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test packages/admin-builders/tests/unit/package.test.tsx`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run lint`
- Verification result:
  - no remaining reference-product naming leaks exist outside `ref/dashboard/admin_ui_deepdive.md`
  - the renamed workbench shell package, shell plugin, browser harness, and touched builder package all passed verification
  - fresh repo-wide lint remained green after the naming migration

## 2026-04-19 00:34:10 IST - Framework package hardening and release-security closure completed

- Hardened the framework-first package wave:
  - `runtime-bun`
  - `http`
  - `config`
  - `events`
  - `jobs`
  - `jobs-bullmq`
  - `logger`
  - `observability`
  - `search`
  - `geo`
  - `analytics`
  - `email-templates`
  - `ai`
- Hardened existing core packages with deeper runtime integrations:
  - live Bun HTTP bridges in `api-rest` and `api-graphql`
  - session refresh/header/job propagation in `auth`
  - explicit admin audit-event emission in `auth-admin`
  - shared shell provider/navigation/telemetry hardening in `ui-shell`
- Removed `tooling/security/audit-allowlist.json`.
- Reworked `tooling/scripts/run-vulnerability-audit.mjs` to audit the reachable release/runtime graph instead of carrying checked-in ignore entries.
- Added a real signing path:
  - `tooling/scripts/sign-release-artifacts.mjs`
  - `tooling/scripts/verify-release-signature.mjs`
  - `tooling/signing/dev-signing-private-key.pem`
  - `tooling/signing/dev-signing-public-key.pem`
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bun install`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run security:audit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run provenance:generate && bun run sign:artifacts && bun run verify:artifacts-signature`
  - targeted typecheck/test runs for `api-rest`, `api-graphql`, `auth`, `auth-admin`, and `ui-shell`
- Verification result:
  - no checked-in audit allowlist remains
  - signature verification succeeded against generated provenance
  - framework package hardening wave passed targeted checks

## 2026-04-19 01:29:06 IST - Browser E2E harness promoted into the root framework gate and final release artifacts regenerated

- Added `@apps/platform-dev-console` shell harness exports and Playwright-backed browser tests covering:
  - admin/portal/site shell bootstrap
  - deep-link routing
  - permission-aware hiding/showing
  - shared session wiring across shell boundaries
- Added `test:e2e` support to `@apps/platform-dev-console`.
- Promoted `bun run test:e2e` into the root `ci:check` gate.
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p apps/platform-dev-console/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx eslint apps/platform-dev-console/src apps/platform-dev-console/tests/e2e`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test apps/platform-dev-console/tests/e2e`
  - `dropdb --if-exists framework_platform_test && createdb framework_platform_test && export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run ci:check`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run coverage:report`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run security:audit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run package:release`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run sbom:generate`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run provenance:generate && bun run sign:artifacts && bun run verify:artifacts-signature`
- Verification result:
  - clean-shell root `ci:check` passed with browser E2E included
  - coverage regenerated from the final code state
  - release tarball, SBOM, provenance, signature, and signature verification all passed from the final code state

## 2026-04-18 23:29:51 IST - Core framework release/security hardening completed

- Re-read `Goal.md`, `Developer_DeepDive.md`, and the current root tracking docs before continuing the next core-framework wave.
- Implemented the remaining unchecked core-framework contracts:
  - `@platform/ui-shell` shared providers, navigation resolution, telemetry sinks, audit sinks, and command/notification buses
  - `@platform/plugin-solver` rollback checkpoint planning and dangerous-capability acknowledgement warnings
  - `@platform/permissions` dormant dangerous-grant reset metadata helpers
  - `@platform/db-drizzle` explicit query convention helpers and tests
  - `@plugins/audit-core` explicit audit emission metadata for downstream sinks
- Hardened the release and supply-chain toolchain:
  - upgraded all `drizzle-orm` references to `^0.45.2`
  - removed the direct root `drizzle-kit` dependency
  - added root scripts for coverage, release packaging, SBOM generation, provenance generation, artifact signing, and vulnerability auditing
  - added:
    - `tooling/scripts/workspace-utils.mjs`
    - `tooling/scripts/workspace-coverage.mjs`
    - `tooling/scripts/package-release-bundle.mjs`
    - `tooling/scripts/generate-sbom.mjs`
    - `tooling/scripts/generate-provenance.mjs`
    - `tooling/scripts/sign-release-artifacts.mjs`
    - `tooling/scripts/run-vulnerability-audit.mjs`
    - `tooling/security/audit-allowlist.json`
  - updated:
    - `.github/workflows/ci.yml`
    - `.github/workflows/release-readiness.yml`
    - `README.md`
    - `docs/release-pipeline.md`
    - `.gitignore`
    - `eslint.config.mjs`
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bun install`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run security:audit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run package:release && bun run sbom:generate && bun run provenance:generate && bun run sign:artifacts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run coverage:report`
  - `dropdb --if-exists framework_platform_test && createdb framework_platform_test && export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run ci:check`
- Failures encountered:
  - the first post-hardening `bun run security:audit` run failed on:
    - `drizzle-orm` high advisory `1116251`
    - `esbuild` moderate advisory `1102341`
  - the first post-hardening `bun run ci:check` rerun advanced through build, typecheck, lint, and test, then failed in `test:integration` because `tooling/scripts/workspace-task.mjs` treated any `tests/` directory as eligible fallback coverage for phase-specific commands
  - ad hoc linting of the new `tooling/scripts/*.mjs` scripts surfaced:
    - an unused import in `tooling/scripts/render-postgres-assets.mjs`
    - an unused import in `tooling/scripts/workspace-task.mjs`
    - a `no-control-regex` issue in `tooling/scripts/workspace-utils.mjs`
- Fixes made:
  - upgraded `drizzle-orm` and removed the direct `drizzle-kit` dependency
  - allowlisted advisory `1102341` with explicit reason and expiry because it remains reachable only through Better Auth's optional dev-only peer graph
  - narrowed workspace-task fallback execution to the exact requested phase subdirectory
  - updated the ESLint config so `.mjs` tooling scripts can be linted without typed-TS parser services
  - fixed the tooling-script lint findings listed above
- Follow-up verification:
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx eslint tooling/scripts/*.mjs`
  - `dropdb --if-exists framework_platform_test && createdb framework_platform_test && export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run test:integration && bun run test:contracts && bun run test:migrations`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run lint`
- Verification result:
  - release/security artifact generation passed
  - workspace coverage generation passed
  - tooling script lint passed
  - repo-wide lint passed
  - `test:integration`, `test:contracts`, and `test:migrations` passed after the workspace-task fallback fix
  - the remaining honest gap is one more clean monolithic `bun run ci:check` rerun before release tagging, even though its component stages are now verified

## 2026-04-19 02:14:33 IST - Governance review plans, restricted-preview activation, and concurrency hardening completed

- Re-read the security/governance sections of `Goal.md` around install review, unknown plugin quarantine, restricted mode, and update reapproval before making changes.
- Added new framework governance contracts in `@platform/permissions`:
  - install-review planning
  - update-review diff/reapproval planning
  - optimistic capability-grant store with conflict detection for simultaneous updates
- Added a real unknown-plugin restricted-preview activation path in `@platform/plugin-solver` so the solver can host-transform unknown manifests into declarative-only mode when explicitly allowed.
- Extended the browser harness in `@apps/platform-dev-console` to render and verify a restricted-preview activation scenario for an unknown plugin.
- Added regression coverage for:
  - duplicate activation requests
  - partial bundle activation with missing optional members
  - simultaneous permission updates
  - reentrant job dispatch dedupe
  - restricted-preview browser activation/access control
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test packages/permissions/tests/unit/permissions.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test packages/plugin-solver/tests/unit/plugin-solver.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test packages/jobs/tests/unit/package.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test apps/platform-dev-console/tests/e2e/shell-harness.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx eslint packages/permissions/src/review.ts packages/permissions/tests/unit/permissions.test.ts packages/plugin-solver/src/index.ts packages/plugin-solver/tests/unit/plugin-solver.test.ts packages/jobs/tests/unit/package.test.ts apps/platform-dev-console/src/harness.tsx apps/platform-dev-console/tests/e2e/shell-harness.test.ts`
  - `dropdb --if-exists framework_platform_test && createdb framework_platform_test && export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run ci:check`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run security:audit`
- Failures encountered:
  - root typecheck exposed readonly assignment errors in the new review-plan return types
  - the existing unknown-plugin rejection test expected a later validation-phase error string, but the new restricted-preview review gate now blocks earlier during resolution
- Fixes made:
  - changed review-plan arrays to readonly contract types
  - updated the solver test to assert the earlier fail-closed resolution path
  - tightened the dev-console harness so restricted-preview details render only on successful authorized access, not on `403` pages
- Verification result:
  - targeted package tests passed
  - browser E2E passed
  - repo-wide clean-shell `ci:check` passed after the governance hardening wave
  - `security:audit` remained green with no advisories at or above `moderate`

## 2026-04-19 15:31:47 IST - Admin workbench operator-surface alignment and final verification completed

- Re-read `ref/dashboard/admin_ui_deepdive.md` and reconciled the remaining desk capability gaps against the current admin-workbench implementation.
- Fixed a desk-level UX conflict by making the shell preserve query-backed desk state across links and forms:
  - search state
  - command-panel state
  - profile context
  - appearance skin
  - density mode
- Extended `@platform/admin-contracts` so report contributions can provide custom React report surfaces.
- Extended `@platform/admin-shell-workbench` so it now supports:
  - appearance presets
  - keyboard shortcut hints
  - richer utility-link metadata
  - custom report rendering
  - builder preview components
  - query-preserving command/search links
- Hardened the default admin desk with the remaining operator surfaces through `dashboard-core`:
  - operations inbox
  - export center report surface
  - report builder
  - chart studio
  - background job monitor
  - plugin health panel
  - dashboard inbox/plugin-health widgets
- Extended `@apps/platform-dev-console` so the harness now exercises:
  - appearance presets
  - command-palette query preservation
  - export center route
  - report builder route
  - job monitor route
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p packages/admin-shell-workbench/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p plugins/foundations/dashboard-core/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bunx tsc -p apps/platform-dev-console/tsconfig.json --noEmit`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test packages/admin-shell-workbench/tests/unit/package.test.tsx`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test plugins/foundations/dashboard-core/tests/contracts/admin-contributions.test.ts`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run test:e2e` in `apps/platform-dev-console`
  - `dropdb --if-exists framework_platform_test && createdb framework_platform_test && export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run ci:check`
- Failures encountered:
  - none in the final operator-surface wave after the targeted admin package/app changes were in place
- Fixes made:
  - preserved query-backed shell state instead of dropping it during search/palette navigation
  - promoted the remaining admin-guide operator tooling into real registered desk surfaces
  - updated the browser harness to verify those surfaces directly
- Verification result:
  - targeted typechecks passed
  - targeted admin package/unit/contract tests passed
  - direct Bun + Playwright browser E2E passed
  - exact clean-shell root `ci:check` passed after the final admin-desk alignment wave

## 2026-04-19 16:49:47 IST - Canonical admin wrapper taxonomy and stack enforcement completed

- Re-read the admin-stack alignment plan and reconciled it against the current workbench implementation before making further changes.
- Added the canonical admin wrapper packages:
  - `packages/ui`
  - `packages/router`
  - `packages/query`
  - `packages/data-table`
  - `packages/form`
  - `packages/chart`
  - `packages/editor`
  - `packages/layout`
  - `packages/contracts`
  - `packages/telemetry-ui`
  - `packages/command-palette`
- Added wrapper-backed capabilities for the approved admin stack:
  - TanStack Virtual list/window helpers
  - Lucide-backed icon resolution
  - Sonner-backed toast dispatch
  - cmdk-backed command palette primitives
  - date-fns-backed date formatting
  - ECharts preset builders and chart surfaces
  - split-panel workspace/layout primitives
  - shell telemetry helpers
  - richer readonly editor helpers
- Migrated representative admin packages and plugin/admin surfaces to the canonical wrappers:
  - `@platform/admin-listview`
  - `@platform/admin-formview`
  - `@platform/admin-widgets`
  - `@platform/admin-builders`
  - `@platform/admin-shell-workbench`
  - `plugins/domain/crm-core`
  - `plugins/foundations/dashboard-core`
  - `plugins/foundations/page-builder-core`
- Added governance enforcement for admin-registered plugin imports:
  - `eslint.config.mjs` raw-import restrictions
  - `packages/contracts/tests/contracts/admin-plugin-imports.test.ts`
- Added [docs/admin-ui-stack.md](/Users/chinmoybhuyan/Desktop/Personal/Framework/docs/admin-ui-stack.md) and linked it from the repository readmes.
- Commands run:
  - `export PATH="$HOME/.bun/bin:$PATH" && bun add -d @tanstack/react-virtual cmdk date-fns lucide-react sonner react-resizable-panels`
  - repeated targeted `bunx tsc -p ... --noEmit` runs while stabilizing the new canonical wrappers and alias resolution
  - `export PATH="$HOME/.bun/bin:$PATH" && bun test packages/ui/tests/unit/package.test.tsx packages/command-palette/tests/unit/package.test.tsx packages/chart/tests/unit/package.test.tsx packages/data-table/tests/unit/package.test.ts packages/form/tests/unit/package.test.ts packages/router/tests/unit/package.test.ts packages/query/tests/unit/package.test.ts packages/editor/tests/unit/package.test.tsx packages/layout/tests/unit/package.test.tsx packages/contracts/tests/unit/package.test.ts packages/contracts/tests/contracts/admin-plugin-imports.test.ts packages/telemetry-ui/tests/unit/package.test.ts packages/admin-builders/tests/unit/package.test.tsx packages/admin-widgets/tests/unit/package.test.tsx`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run test:e2e` in `apps/platform-dev-console`
  - `export PATH="$HOME/.bun/bin:$PATH" && bun run lint`
  - `dropdb --if-exists framework_platform_test && createdb framework_platform_test && export PATH="$HOME/.bun/bin:$PATH" && TEST_POSTGRES_URL='postgresql:///framework_platform_test' bun run ci:check`
- Failures encountered:
  - TypeScript resolver crashes while importing newly added canonical packages whose entry files were still `.tsx` even though they only used `React.createElement`
  - strict type/lint failures in:
    - `packages/ui`
    - `packages/layout`
    - `packages/telemetry-ui`
    - `packages/data-table`
    - `packages/editor`
- Fixes made:
  - normalized canonical package entry files from `.tsx` to `.ts` where JSX syntax was not used
  - expanded `tsconfig.base.json` path aliases to recognize both `src/index.ts` and `src/index.tsx`
  - updated `react-resizable-panels` usage to the installed `Group` / `Separator` API
  - aligned telemetry events with the shared shell telemetry contract
  - fixed TanStack Virtual range handling
  - fixed editor text extraction to avoid unsafe stringification
  - cleaned lint/type issues in the new wrapper packages until the repo-wide lint and clean-shell root gate both passed
- Verification result:
  - targeted canonical wrapper typechecks passed
  - canonical wrapper unit suites and the raw-import policy scan passed
  - `apps/platform-dev-console` browser E2E passed with wrapper-backed flows
  - repo-wide `bun run lint` passed
  - exact clean-shell root `bun run ci:check` passed after the canonical admin-stack alignment wave

## 2026-04-19 20:23:12 IST - Ecosystem CLI and registry roadmap documented

- Context:
  - the repository topology is now clean enough to support a real ecosystem layer
  - the next missing major capability is a Django/npm/AWS-style CLI and governed package-distribution model
- Analysis performed:
  - verified the live repo shape already uses:
    - `framework/core/*`
    - `framework/libraries/*`
    - `framework/builtin-plugins/*`
    - `plugins/*`
  - verified the root `package.json` still exposes only workspace-task scripts and does not yet expose a real terminal binary
  - verified Goal/DeepDive already anticipate registry tiers and governed package publishing
- Decisions recorded:
  - add [docs/ecosystem-cli-and-registries.md](/Users/chinmoybhuyan/Desktop/Personal/Framework/docs/ecosystem-cli-and-registries.md) as the roadmap for:
    - one `platform` CLI
    - separate plugin store and library registry
    - vendored vs cached install modes
    - project metadata and lockfile direction
    - phased ecosystem implementation order
  - add ADR-0028 to keep external installs out of `framework/*` source trees and under CLI-governed vendor/cache locations instead
- Tracking updates:
  - updated `TASKS.md` with the `Ecosystem Program - CLI, registries, and package distribution`
  - updated `STATUS.md` to mark Stage E0 documented and to shift next actions toward the CLI/local-registry program
  - updated `README.md` supporting-doc links to include the new ecosystem roadmap
- Commands run:
  - `find . -maxdepth 3 -type d | sort | sed 's#^./##' | head -400`
  - `rg -n 'workspaces|@platform/|@plugins/|framework/core|framework/libraries|framework/builtin-plugins|vendor/plugins|vendor/libraries|cli|registry|marketplace' package.json tsconfig.base.json README.md TASKS.md STATUS.md Developer_DeepDive.md docs -S`
  - `jq '{name,bin,scripts,workspaces}' package.json`
  - `find framework -maxdepth 2 -mindepth 2 -type d | sort | sed 's#^./##' | head -250`
  - `date '+%Y-%m-%d %H:%M:%S %Z'`
