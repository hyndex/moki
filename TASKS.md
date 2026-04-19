# TASKS

## Phase 0 - Repository analysis and planning

- [x] Read `Goal.md` completely.
- [x] Read `Developer_DeepDive.md` completely.
- [x] Extract required platform/library/package/test/workflow constraints.
- [x] Create root tracking documents:
  - [x] `TASKS.md`
  - [x] `STATUS.md`
  - [x] `TEST_MATRIX.md`
  - [x] `ARCHITECTURE_DECISIONS.md`
  - [x] `RISK_REGISTER.md`
  - [x] `IMPLEMENTATION_LEDGER.md`
- [x] Record initial repository state and environment limitations.
- [ ] Reconcile the implementation continuously against the docs before each major phase.

## Phase 1 - Workspace / monorepo foundation

- [x] Create Bun-based monorepo structure:
  - [x] `apps/`
  - [x] `framework/core/`
  - [x] `framework/libraries/`
  - [x] `framework/builtin-plugins/`
  - [x] `plugins/`
  - [x] `tooling/`
  - [x] `docs/`
- [x] Add root `package.json` with workspaces.
- [x] Add `bunfig.toml`.
- [x] Add strict root `tsconfig.json` and shared package configs.
- [x] Add shared lint config.
- [x] Add shared formatting config.
- [x] Add root scripts:
  - [x] `build`
  - [x] `typecheck`
  - [x] `lint`
  - [x] `test`
  - [x] `test:unit`
  - [x] `test:integration`
  - [x] `test:e2e`
  - [x] `test:contracts`
  - [x] `test:migrations`
  - [x] `ci:check`
- [x] Add env templates:
  - [x] `.env.example`
  - [x] `.env.test.example`
- [x] Add shared package build/test helpers.
- [x] Add workspace README / run instructions.
- [x] Install and validate Bun in the local environment.
- [x] Restructure the repository taxonomy for distribution:
  - [x] move framework engine packages under `framework/core/`
  - [x] move shared libraries and admin/UI wrappers under `framework/libraries/`
  - [x] move shipped default plugins under `framework/builtin-plugins/`
  - [x] reserve `plugins/` for future vendored or store-installed optional extensions
  - [x] keep package ids stable (`@platform/*`, `@plugins/*`) while changing only filesystem layout
  - [x] update workspace discovery, TypeScript path aliases, and scaffolding for the new topology
  - [x] initialize a clean root Git repository for the framework workspace
  - [x] remove the checked-in optional plugin catalog from the shipped framework repository

## Phase 2 - Core platform contracts

- [x] Implement `packages/kernel`
  - [x] package kinds / manifest taxonomy
  - [x] `definePackage`
  - [x] `definePlugin`
  - [x] `defineConnector`
  - [x] `defineMigrationPack`
  - [x] `defineBundle`
  - [x] governance metadata types
  - [x] manifest validation entrypoints
- [x] Implement `packages/schema`
  - [x] `defineResource`
  - [x] `defineAction`
  - [x] resource/action registries
  - [x] contract JSON schema helpers
  - [x] validation error types
  - [ ] move `definePolicy` into `@platform/schema` only if the platform contract changes from the current `@platform/permissions` placement
- [x] Implement `packages/plugin-solver`
  - [x] dependency graph loader
  - [x] compatibility resolution
  - [x] deterministic ordering
  - [x] conflict detection
  - [x] route ownership model
  - [x] slot claim model
  - [x] data ownership model
  - [x] partial activation rules
  - [x] rollback checkpoint planning
- [x] Implement capability registry.
- [x] Implement extension-point registry.
- [x] Implement package validation and conflict reporting.
- [x] Add unit and contract tests for all DSLs and solver behaviors.

## Phase 3 - Security / trust / permissions

- [x] Implement `packages/permissions`
  - [x] trust tiers
  - [x] review tiers
  - [x] isolation profiles
  - [x] capability categories
  - [x] permission classes
  - [x] install-time requests
  - [x] optional permissions
  - [x] runtime-sensitive grants
  - [x] host allowlists
  - [x] secret reference model
  - [x] permission diffing on update
  - [x] dormant permission reset metadata
  - [x] restricted mode
  - [x] quarantine flow
  - [x] unknown plugin policy
  - [x] policy engine integration points
- [x] Add backend-level admin approval contracts.
- [x] Add signing/provenance metadata contracts.
- [x] Add security regression tests:
  - [x] permission escalation prevention
  - [x] unknown plugin restrictions
  - [x] dangerous scope blocking
  - [x] update diff reapproval
  - [x] route / slot privilege conflicts

## Phase 4 - Database layer and DB security

- [x] Implement `packages/db-drizzle`
  - [x] Postgres driver integration
  - [x] SQLite driver integration
  - [x] shared DB client factory
  - [x] role-aware context
  - [x] transaction helpers
  - [x] schema helpers
  - [x] query conventions
- [x] Implement `packages/migrate`
  - [x] migration runner
  - [x] migration metadata
  - [x] dry-run support
  - [x] ordered cross-package execution
- [x] Implement DB security conventions:
  - [x] role model abstraction
  - [x] RLS conventions
  - [x] `api` schema conventions
  - [x] reporting role model
  - [x] backup/restore role model
  - [x] unknown plugin DB denial model
- [x] Add sample SQL/bootstrap assets for Postgres role hardening.
- [x] Add DB tests:
  - [x] schema helper unit tests
  - [x] Postgres integration tests
  - [x] SQLite integration tests
  - [x] migration tests
  - [x] role/permission regression tests

## Phase 5 - Auth / tenancy / policy foundations

- [x] Implement `packages/auth`
- [x] Implement `packages/auth-admin`
- [x] Implement auth context / tenant propagation wrappers.
- [x] Implement foundation plugins:
  - [x] `auth-core`
  - [x] `user-directory`
  - [x] `org-tenant-core`
  - [x] `role-policy-core`
  - [x] `audit-core`
- [x] Implement session handling.
- [x] Implement actor context.
- [x] Implement impersonation controls.
- [x] Implement audit event emission.
- [x] Add tests:
  - [x] tenant isolation
  - [x] role checks
  - [x] impersonation guardrails
  - [x] session context correctness

## Phase 6 - API foundation

- [x] Implement `packages/api-rest`
  - [x] resource/action routing
  - [x] versioned REST path generation
  - [x] request/response validation
  - [x] webhook receive/send primitives
  - [x] AI tool contract generation
- [x] Implement `packages/openapi` behavior inside `packages/api-rest` or as scoped module.
- [x] Implement `packages/api-graphql`
  - [x] GraphQL Yoga adapter
  - [x] resource/action graph adapters
  - [x] optional mounting
- [x] Add API tests:
  - [x] route generation
  - [x] action permission enforcement
  - [x] OpenAPI snapshots
  - [x] GraphQL adapter behavior
  - [x] webhook signature verification

## Phase 7 - Shells and frontend surface system

- [x] Implement `packages/ui-shell`
  - [x] admin shell
  - [x] portal shell
  - [x] site shell
  - [x] shared providers
  - [x] navigation
  - [x] deep-link contracts
  - [x] telemetry hooks
- [x] Implement wrappers:
  - [x] `packages/ui-router`
  - [x] `packages/ui-query`
  - [x] `packages/ui-table`
  - [x] `packages/ui-form`
  - [x] `packages/ui-kit`
  - [x] `packages/ui-editor`
- [x] Implement zone adapters:
  - [x] `packages/ui-zone-next`
  - [x] `packages/ui-zone-static`
- [x] Implement UI surface registration model.
- [x] Add tests:
  - [x] shell registration
  - [x] route collisions
  - [x] zone mount validation
  - [x] permission-aware rendering
  - [x] deep-link contracts

## Admin Desk Program - Universal admin workbench

- [x] Stage A0 - Gap audit and references
  - [x] Read the admin UI deep dive and reconcile it against `Goal.md` and `Developer_DeepDive.md`.
  - [x] Compare the required admin desk capabilities against the existing `@platform/ui-shell` substrate.
  - [x] Clone external admin reference repositories under `ref/dashboard/`.
- [x] Stage A1 - Admin contracts and compatibility adapters
  - [x] Create `@platform/admin-contracts`.
  - [x] Add contract helpers:
    - [x] `defineWorkspace`
    - [x] `defineAdminNav`
    - [x] `definePage`
    - [x] `defineWidget`
    - [x] `defineReport`
    - [x] `defineCommand`
    - [x] `defineSearchProvider`
    - [x] `defineBuilder`
    - [x] `defineZoneLaunch`
  - [x] Add access helpers and deterministic conflict validation.
  - [x] Add legacy `defineUiSurface` adaptation for admin pages/widgets/zones.
- [x] Stage A2 - Default admin shell implementation
  - [x] Create `@platform/admin-shell-workbench`.
  - [x] Implement workspaces, grouped nav, favorites, recents, search, command palette, utilities rail, and governed route resolution.
  - [x] Preserve 403/404/degraded-zone semantics while filtering visible desk contributions.
  - [x] Add shell-owned visual tokens, dense desk chrome, breadcrumbs, inbox, utility rail, and workspace-home composition so the desk renders as a complete workbench without an external CSS pipeline.
  - [x] Add theme/customization hooks for brand copy, tenant chips, utility links, help links, notification cards, density, and shell color tokens.
- [x] Stage A3 - Admin surface packages
  - [x] Create `@platform/admin-listview`.
  - [x] Create `@platform/admin-formview`.
  - [x] Create `@platform/admin-widgets`.
  - [x] Create `@platform/admin-reporting`.
  - [x] Add resource-derived list/form/detail helpers and saved-view support.
  - [x] Add ECharts-backed chart option generation behind platform-owned widget wrappers.
- [x] Stage A4 - Builders and product zones
  - [x] Create `@platform/admin-builders`.
  - [x] Add multi-panel builder host primitives.
  - [x] Add governed zone launcher contracts and degraded-zone recovery rendering.
- [x] Stage A5 - Plugin migration and operational hardening
  - [x] Create `@plugins/admin-shell-workbench`.
  - [x] Upgrade representative plugins to contribute through the desk contracts:
    - [x] `dashboard-core`
    - [x] `ai-core`
    - [x] `page-builder-core`
  - [x] Upgrade `@apps/platform-dev-console` into the admin desk verification harness.
  - [x] Add restricted-preview, forbidden-route, impersonation-banner, and zone-recovery desk flows.
  - [x] Remove the outer demo navigation from the harness so the workbench itself owns navigation, utilities, and context switching.
  - [x] Upgrade representative proving pages/widgets to denser operator-grade layouts aligned with the workbench surface system.
- [x] Stage A6 - Repo-wide verification and reconciliation
  - [x] Add unit coverage for all new admin packages.
  - [x] Add contract coverage for representative plugin admin contributions.
  - [x] Add browser E2E coverage for workspace nav, search, reports, builders, healthy/degraded zones, forbidden routes, and restricted preview.
  - [x] Re-run targeted admin package/app typechecks.
  - [x] Re-run targeted admin package/app builds after the workbench UX wave.
  - [x] Re-run targeted admin package/app unit tests after the workbench UX wave.
  - [x] Replace the unstable `bun test` browser path with a direct Bun + Playwright E2E runner for `@apps/platform-dev-console`.
  - [x] Re-run workspace `test:e2e` through the root workspace task runner.
  - [x] Re-run fresh repo-wide `lint` after the workbench UX wave.
  - [x] Re-run `security:audit` after the admin-desk dependency changes.
  - [x] Scrub external reference-product names from shipped identifiers, labels, tests, comments, and generated outputs while keeping the external references isolated under `ref/dashboard/`.
  - [x] Add the remaining operator-desk surfaces that were still thin in the guide comparison:
    - [x] operations inbox
    - [x] export center report surface
    - [x] report builder
    - [x] chart studio
    - [x] background job monitor
    - [x] plugin health panel
  - [x] Add query-preserving shell deep links and appearance presets so search, command palette, and theme state do not conflict.
  - [x] Reconcile the exact fresh root `ci:check` rerun in the tracking docs after the final admin-desk wave.

## Admin UI Stack Alignment - Canonical wrapper contract

- [x] Stage S0 - Lock the approved admin stack and plugin policy.
  - [x] Keep ECharts as the shared chart engine behind `@platform/chart`.
  - [x] Keep raw third-party UI imports forbidden by default in admin-registered plugins.
  - [x] Limit advanced exceptions to declared builder/studio/zone packages.
- [x] Stage S1 - Publish the canonical public wrapper taxonomy.
  - [x] `@platform/ui`
  - [x] `@platform/router`
  - [x] `@platform/query`
  - [x] `@platform/data-table`
  - [x] `@platform/form`
  - [x] `@platform/chart`
  - [x] `@platform/editor`
  - [x] `@platform/layout`
  - [x] `@platform/contracts`
  - [x] `@platform/telemetry-ui`
  - [x] `@platform/command-palette`
- [x] Stage S2 - Deepen the wrappers to match the approved stack.
  - [x] virtualization helpers
  - [x] icon registry
  - [x] toast controller
  - [x] command palette primitives
  - [x] date formatting helpers
  - [x] ECharts preset builders
  - [x] split-panel layout helpers
  - [x] query invalidation helpers
  - [x] editor preset/read-only helpers
  - [x] shell telemetry helpers
- [x] Stage S3 - Migrate the admin workbench and representative admin plugins to the canonical wrappers.
  - [x] `@platform/admin-listview`
  - [x] `@platform/admin-formview`
  - [x] `@platform/admin-widgets`
  - [x] `@platform/admin-reporting`
  - [x] `@platform/admin-builders`
  - [x] `@platform/admin-shell-workbench`
  - [x] `ai-core`
  - [x] `dashboard-core`
  - [x] `page-builder-core`
- [x] Stage S4 - Add enforcement and docs.
  - [x] lint-time raw-import restrictions for admin-registered plugins
  - [x] contract scan for raw-import policy violations
  - [x] `docs/admin-ui-stack.md`
  - [x] README/docs links to the canonical admin stack doc
- [x] Stage S5 - Re-run full verification on the aligned stack.
  - [x] targeted wrapper/unit/contract suites
  - [x] browser harness verification for wrapper-backed flows
  - [x] repo-wide `bun run lint`
  - [x] exact clean-shell root `bun run ci:check`

## Ecosystem Program - CLI, registries, and package distribution

- [ ] Stage E0 - Lock the ecosystem architecture and clean package-install model.
  - [x] confirm the repository taxonomy is already split into framework core, framework libraries, built-in plugins, and optional plugins
  - [x] document the clean structure, CLI model, registry tiers, vendoring/cache model, and lockfile direction in `docs/ecosystem-cli-and-registries.md`
  - [ ] ratify the exact project metadata files:
    - [ ] `platform.project.json`
    - [ ] `platform.lock`
    - [ ] `.platform/state/*`
  - [ ] ratify the exact install destinations:
    - [ ] `vendor/plugins/*`
    - [ ] `vendor/libraries/*`
    - [ ] `.platform/cache/*`
- [ ] Stage E1 - Create the root CLI package.
  - [x] create `@platform/cli`
  - [x] expose the `platform` terminal binary
  - [ ] move existing build/test/doctor/graph/status entrypoints behind the CLI
- [ ] Stage E2 - Implement project/bootstrap/scaffolding commands.
  - [ ] `platform new`
  - [ ] `gutu init`
  - [ ] `platform make plugin`
  - [ ] `platform make library`
  - [ ] `platform make app`
  - [ ] `platform make connector`
  - [ ] `platform make migration-pack`
  - [ ] `platform make bundle`
  - [x] `gutu make ai-pack`
- [ ] Stage E3 - Implement local registry and lockfile workflows.
  - [ ] local file-backed registry index
  - [ ] `platform plugin install ./path`
  - [ ] `platform library add ./path`
  - [ ] deterministic lockfile writes and integrity snapshots
- [ ] Stage E4 - Implement vendoring and cache resolution.
  - [ ] vendored plugin installs
  - [ ] vendored library installs
  - [ ] cached installs under `.platform/cache/*`
  - [ ] deterministic unpacking and digest verification
- [ ] Stage E5 - Implement private/org registry workflows.
  - [ ] `platform registry login`
  - [ ] `platform registry publish`
  - [ ] `platform registry promote`
  - [ ] `platform registry yank`
  - [ ] signature/provenance verification on publish and install
- [ ] Stage E6 - Implement governed plugin-store flows.
  - [ ] capability review plans
  - [ ] trust-tier aware installs
  - [ ] restricted-preview activation
  - [ ] update diffs and rollback plans
  - [ ] install/uninstall/enable/disable CLI flows
- [ ] Stage E7 - Implement the separate library-registry flows.
  - [ ] compatibility metadata
  - [ ] library add/update/remove
  - [ ] cache vs vendor policy controls
  - [ ] API compatibility validation
- [ ] Stage E8 - Mature partner/public ecosystem surfaces.
  - [ ] partner registry support
  - [ ] listing/review workflow
  - [ ] publisher metadata and support data
  - [ ] marketplace/search/info surfaces
  - [ ] keep public registry blocked until supply-chain maturity remains green

## Native AI-Agent Platform Program

- [x] Stage AI0 - Extend the framework AI package family.
  - [x] `@platform/ai` tool policy helpers
  - [x] `@platform/ai-runtime`
  - [x] `@platform/ai-memory`
  - [x] `@platform/ai-guardrails`
  - [x] `@platform/ai-evals`
  - [x] `@platform/ai-mcp`
- [x] Stage AI1 - Ship built-in AI packs as framework batteries.
  - [x] `ai-core`
  - [x] `ai-rag`
  - [x] `ai-evals`
  - [x] explicit manifests, resources, actions, policies, and admin contributions
  - [x] tenancy, approval, denial, and replay-oriented tests
- [x] Stage AI2 - Make actions and resources agent-operable.
  - [x] AI-facing action metadata
  - [x] AI-facing resource metadata
  - [x] tool allow/deny/approval/redaction hooks
  - [x] curated grounding input references
  - [x] replay metadata contracts
- [x] Stage AI3 - Add operator-facing runtime, memory, eval, and CLI workflows.
  - [x] durable run, step, budget, and approval lifecycle helpers
  - [x] AI admin pages, widgets, reports, commands, and search providers
  - [x] `platform agent run`
  - [x] `platform agent replay`
  - [x] `platform agent approve`
  - [x] `platform prompt validate`
  - [x] `platform prompt diff`
  - [x] `platform memory ingest`
  - [x] `platform memory reindex`
  - [x] `platform eval run`
  - [x] `platform eval compare`
  - [x] `platform mcp inspect`
  - [x] `platform mcp serve`
- [ ] Stage AI4 - Close the remaining transport and release-gate gaps.
  - [ ] move AI run state from deterministic built-in fixtures into full persistent control-plane storage
  - [ ] add full long-running MCP transport serving instead of descriptor emission only
  - [ ] add governed external MCP connector lifecycle with trust-tiered hosts and secrets
  - [ ] wire eval regression thresholds into the root CI/release gates

## Agent Understanding Program - Semantic understanding and doc-pack layer

- [x] Stage U0 - Extend framework contracts with understanding metadata.
  - [x] create `@platform/agent-understanding`
  - [x] add required understanding-doc pack definitions
  - [x] extend `defineResource` with model and field understanding metadata
  - [x] extend `defineAction` with purpose, preconditions, side effects, and mandatory-step semantics
  - [x] extend workflow definitions with actors, invariants, state meaning, and transition semantics
- [x] Stage U1 - Add repo-native CLI tooling for understanding.
  - [x] `platform docs scaffold`
  - [x] `platform docs index`
  - [x] `platform docs validate`
  - [x] root shortcuts:
    - [x] `bun run docs:scaffold`
    - [x] `bun run docs:index`
    - [x] `bun run docs:validate`
- [x] Stage U2 - Generate the required doc-pack baseline across the repo.
  - [x] scaffold local `docs/` packs for apps
  - [x] scaffold local `docs/` packs for framework core and libraries
  - [x] scaffold local `docs/` packs for built-in plugins and any active local workspaces
  - [x] generate `docs/agent-understanding.index.json`
  - [x] add `docs:validate` to the root `ci:check` gate
- [x] Stage U3 - Document and exemplify the understanding layer.
  - [x] update `README.md`
  - [x] add `docs/agent-understanding.md`
  - [x] update `docs/README.md`
  - [x] enrich representative packages:
    - [x] `dashboard-core`
    - [x] `workflow-core`
    - [x] `ai-core`
  - [x] upgrade the workspace scaffolder so future generated packages start with descriptions and doc-pack files
- [ ] Stage U4 - Deep semantic backfill across remaining legacy packages.
  - [ ] reduce warning-only gaps for older resources missing rich field descriptions
  - [ ] reduce warning-only gaps for older actions missing side-effect and failure-mode semantics
  - [ ] reduce warning-only gaps for older workflows that still lack state or transition explanations

## Phase 8 - Foundational domain plugins

This phase originally included a much larger optional plugin catalog. The shipped framework repository is now intentionally narrowed to framework code plus built-in plugins, so non-builtin plugin work is tracked as external follow-on work rather than checked-in framework source.

- [x] Generate explicit package shells for all required foundations/domain bases with manifests, resources, actions, services, UI surfaces, and baseline tests.
- [x] Normalize plugin self-dependency and foundation dependency cycles so solver-based installs can execute against real workspace manifests.
- [ ] Implement all mandatory foundations/domain bases as explicit packages with manifests, contracts, services, tests:
  - [x] `workflow-core`
  - [x] `jobs-core`
  - [x] `files-core`
  - [x] `notifications-core`
  - [ ] `search-core`
  - [ ] `dashboard-core`
  - [x] `portal-core`
  - [ ] `content-core`
  - [ ] `page-builder-core`
  - [ ] `knowledge-core`
  - [ ] `forms-core`
  - [x] `ai-core`
  - [x] `sales-core`
  - [x] `marketing-core`
  - [x] `commerce-core`
  - [x] `catalog-core`
  - [x] `pricing-core`
  - [x] `payments-core`
  - [ ] `finance-core`
  - [ ] `hr-core`
  - [ ] `payroll-core`
  - [ ] `procurement-core`
  - [ ] `inventory-core`
  - [ ] `manufacturing-core`
  - [ ] `quality-core`
  - [ ] `maintenance-core`
  - [ ] `logistics-core`
  - [ ] `warehouse-core`
  - [ ] `project-core`
  - [ ] `service-desk-core`
  - [ ] `field-service-core`
  - [ ] `analytics-core`
  - [ ] `bi-core`
  - [x] `ai-core`
  - [x] `ai-rag`
  - [x] `ai-evals`
  - [ ] `vector-core`
  - [x] `booking-core`
  - [ ] `calendar-core`
  - [x] `scheduling-core`
  - [ ] `learning-core`
  - [ ] `streaming-core`
  - [ ] `workspace-core`
  - [ ] `security-core`
  - [ ] `compliance-core`
  - [ ] `performance-core`
  - [ ] `backup-dr-core`
  - [ ] `server-ops-core`
  - [ ] `observability-core`
  - [ ] `localization-core`
  - [ ] `geo-core`
  - [ ] `real-estate-core`
  - [ ] `hospitality-core`
  - [ ] `public-sector-core`
  - [ ] `nonprofit-core`
  - [ ] `erp-core`

## Phase 9 - Cross-cutting feature packs

- [ ] Implement representative packs as separate plugins:
  - [ ] `seo-core`
  - [ ] localization pack(s)
  - [ ] performance pack(s)
  - [ ] backup/DR pack(s)
  - [ ] security pack(s)
  - [ ] forms/document pack(s)
  - [ ] reporting/export pack(s)
  - [ ] analytics pack(s)
  - [ ] AI pack(s)
  - [ ] workplace pack(s)

## Phase 10 - Connectors

- [ ] Implement adapter architecture and representative connectors:
  - [ ] email provider adapter
  - [ ] messaging/chat adapter
  - [ ] payment adapter
  - [ ] storage adapter
  - [ ] analytics/export adapter
  - [ ] AI provider adapter
  - [ ] identity/SSO adapter
  - [ ] gateway/ops adapter
- [ ] Ensure wrappers isolate provider SDKs from business code.
- [ ] Add mock/provider integration tests.

## Phase 11 - Migration packs

- [ ] Implement migration framework end-to-end.
- [ ] Implement representative migration packs:
  - [ ] commerce source
  - [ ] CRM source
  - [ ] content source
  - [ ] productivity/workspace source
- [ ] Support:
  - [ ] discover
  - [ ] map
  - [ ] dry-run
  - [ ] import
  - [ ] reconcile
  - [ ] cutover
  - [ ] reporting

## Phase 12 - External plugin store bundles / tested distributions

- [ ] Implement plugin-store bundle definitions outside the shipped framework repo.
- [x] Keep bundle resolution support in the kernel and solver.
- [x] Keep representative bundle-resolution tests using inline bundle manifests instead of checked-in optional packages.

## Phase 13 - Verticals / subapps

- [ ] Implement representative vertical bases and atomic subapps:
  - [ ] school management
  - [ ] clinic/hospital
  - [ ] hospitality/hotel
  - [ ] manufacturing
  - [ ] 3PL/logistics
  - [ ] D2C/headless commerce
  - [ ] OTT/media
  - [ ] LMS
  - [ ] bookings/services

## Phase 14 - Test hardening

- [ ] Expand unit coverage across core packages.
- [ ] Expand integration coverage across DB/auth/API/plugin activation.
- [ ] Expand contract coverage across manifests/OpenAPI/AI tools/bundles.
- [x] Expand security coverage across permissions/egress/secrets/DB denial.
- [ ] Add migration regression suites.
- [ ] Add concurrency/edge suites:
  - [x] booking double allocation
  - [x] duplicate activation
  - [x] simultaneous permission updates
  - [x] partial bundle activation
  - [x] event/job reentrancy
- [x] Add framework UI route/render suites:
  - [x] admin/portal/site shell bootstrap
  - [x] deep-link routing
  - [x] permission-aware hiding/showing
  - [x] session sharing across shell boundaries
- [ ] Add end-to-end browser flows for critical verticals.

## Phase 15 - CI/CD / quality gates

- [x] Implement CI workflow(s).
- [x] Implement coverage reporting.
- [x] Implement quality gates.
- [x] Implement build artifacts.
- [x] Implement signing/provenance hooks.
- [x] Implement SBOM/vulnerability automation.
- [x] Remove the framework audit allowlist and make `security:audit` green without checked-in ignores.
- [x] Provide a real local signing path with the dev test key and an env-backed CI signing path.
- [x] Extend the root `ci:check` gate to include browser E2E.
- [x] Document release pipeline.

## Phase 16 - Final hardening and reconciliation

 - [x] Re-read `Goal.md` and `Developer_DeepDive.md`.
 - [x] Reconcile every checked item against real code + tests + commands run.
 - [x] Update root docs to match the actual implementation.
 - [x] Finalize package map.
 - [x] Finalize run/test instructions.
 - [x] Finalize deferred items with justifications.
 - [x] Finalize residual risk summary.
