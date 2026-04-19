# ARCHITECTURE_DECISIONS

## ADR-0001 - Tracking documents are first-class repository artifacts

- Status: accepted
- Date: 2026-04-18
- Context: The spec requires root-level execution tracking, risk logging, architecture decisions, and test mapping that stay current throughout implementation.
- Decision: Keep `TASKS.md`, `STATUS.md`, `TEST_MATRIX.md`, `ARCHITECTURE_DECISIONS.md`, `RISK_REGISTER.md`, and `IMPLEMENTATION_LEDGER.md` in the repository root and update them after each major milestone.
- Consequences:
  - Progress and remaining scope stay explicit.
  - Deferred work cannot be hidden.
  - The repository remains auditable for a follow-on engineer or agent.

## ADR-0002 - Bun must remain the target workspace/runtime even though it is currently unavailable on PATH

- Status: accepted
- Date: 2026-04-18
- Context: The docs require Bun as the workspace manager, runtime, test runner, and primary developer entrypoint, but the environment currently reports `bun: command not found`.
- Decision: Bootstrap the repository to Bun conventions and then provision Bun locally for execution instead of substituting a different package manager/runtime as the primary contract.
- Consequences:
  - The implementation remains aligned with the platform specification.
  - Early setup work must include environment/toolchain installation or a documented local binary strategy.
  - Validation commands may remain temporarily blocked until Bun is provisioned.

## ADR-0003 - Use a repository scaffolder to generate the documented package taxonomy consistently

- Status: accepted
- Date: 2026-04-18
- Context: The specification requires a very large but consistent package topology across platform packages, foundations, domain bases, feature packs, connectors, migration packs, verticals, and bundles.
- Decision: Add `tooling/scripts/scaffold-workspace.mjs` to generate the standardized package tree and repetitive manifest/package boilerplate so manual implementation effort can stay focused on kernel, security, DB, API, and UI logic.
- Consequences:
  - Package naming and structure stay aligned with `Developer_DeepDive.md`.
  - Generated packages still require follow-on implementation and validation; the scaffolder is not treated as completion.
  - Re-running the scaffolder must be done carefully after manual edits because it overwrites generated files.

## ADR-0004 - The foundation dependency graph must be acyclic before bundle and solver smoke tests

- Status: accepted
- Date: 2026-04-18
- Context: The first scaffold pass gave the foundational plugins a symmetric dependency pattern, which created cycles such as `auth-core -> org-tenant-core -> auth-core` and blocked real bundle-resolution tests.
- Decision: Normalize the foundational dependency graph to an explicit spine:
  - `auth-core` has no foundation dependency
  - `org-tenant-core` depends on `auth-core`
  - `role-policy-core` depends on `auth-core` and `org-tenant-core`
  - `audit-core` depends on `auth-core` and `org-tenant-core`
  - `user-directory` depends on the full foundation set
- Consequences:
  - Real bundle smoke tests can execute against workspace manifests without synthetic fixtures.
  - Foundation packages now form a predictable install order for later hardening work.
  - The scaffolder and generated package manifests must stay aligned to avoid reintroducing cycles.

## ADR-0005 - The baseline GraphQL adapter exposes generated resource/action entrypoints through JSON scalar boundaries

- Status: accepted
- Date: 2026-04-18
- Context: The docs require optional GraphQL support generated from the same resource/action registry as REST, but full schema synthesis for every Zod contract would have significantly expanded the initial platform surface.
- Decision: Implement the first GraphQL adapter with:
  - generated query/mutation fields per resource/action
  - permission checks at the adapter boundary
  - Yoga-backed execution
  - JSON scalar payload boundaries so the adapter stays contract-driven without inventing a parallel handwritten schema system
- Consequences:
  - GraphQL support is functional and shares the same source contracts as REST.
  - The adapter remains thin and easy to evolve.
  - A later milestone should replace or augment the JSON-scalar boundaries with richer typed field synthesis for public GraphQL surfaces.

## ADR-0006 - Foundation plugins should graduate from symmetric scaffolds into domain-specific contracts in bounded waves

- Status: accepted
- Date: 2026-04-18
- Context: The initial workspace scaffold intentionally created uniform manifests/resources/actions/services/tests for every plugin, but that shape was too generic to satisfy the spec for critical foundations like workflows, jobs, files, notifications, and portal behavior.
- Decision: Harden foundation plugins in bounded waves by replacing generic `label/status` resources and no-op services with domain-specific contracts and behavior:
  - explicit state-machine catalogs in `workflow-core`
  - explicit job envelopes in `jobs-core`
  - quarantine-aware file registration in `files-core`
  - provider-routed dispatch rules in `notifications-core`
  - canonical portal shell surfaces in `portal-core`
- Consequences:
  - The repository keeps a reproducible package taxonomy while still converging on meaningful domain behavior.
  - Follow-on waves can apply the same pattern to domain bases and vertical packs without inventing a new architecture.
  - Remaining unhardened plugins must stay visibly unchecked in `TASKS.md` until their generic scaffold logic is replaced.

## ADR-0007 - Booking ownership depends on scheduling-ledger contracts rather than duplicating allocation logic

- Status: accepted
- Date: 2026-04-18
- Context: The spec separates `booking-core` ownership (reservations, holds, confirmation state, waitlists) from `scheduling-core` ownership (availability and allocations) and explicitly calls out double-allocation risks.
- Decision: Implement `booking-core` on top of `scheduling-core` overlap and ledger helpers instead of duplicating allocation math in both packages:
  - `scheduling-core` owns allocation windows and ledger-key creation
  - `booking-core` depends on `scheduling-core`
  - booking concurrency is enforced first through a canonical writer abstraction and tested before a persistent DB layer exists
- Consequences:
  - Allocation math stays centralized.
  - The package graph more closely matches the product architecture.
  - A later persistence milestone must preserve this contract with DB-backed uniqueness or ledgers instead of reintroducing duplicate booking logic.

## ADR-0008 - Curated Postgres `api` views default to definer semantics and are validated against live role/RLS behavior

- Status: accepted
- Date: 2026-04-18
- Context: Isolated plugin runtimes are supposed to read only curated `api` projections without direct access to base tables. A live Postgres probe exposed that `security_invoker=true` undermined that model because the runtime role then needed underlying table privileges.
- Decision: Default generated `api` projections to `security_invoker=false`, keep explicit grants on the view itself, and validate the resulting privilege/RLS behavior with a live Postgres integration suite.
- Consequences:
  - Curated `api` views now match the intended least-privilege model for isolated runtimes.
  - The generated SQL/bootstrap assets better reflect production posture.
  - Postgres verification now depends on explicit live DB tests, not only string-based SQL snapshots.

## ADR-0009 - Root test phases auto-discover conventional test directories when package scripts are absent

- Status: accepted
- Date: 2026-04-18
- Context: The workspace included real `tests/integration` suites in some packages, but the root `test:integration` runner only executed packages that had manually declared a matching script, which silently skipped valid suites.
- Decision: Extend `tooling/scripts/workspace-task.mjs` so root phase-specific test commands fall back to conventional test directories:
  - `tests/unit`
  - `tests/integration`
  - `tests/contracts`
  - `tests/migrations`
  - `tests/e2e`
- Consequences:
  - Root test phases now execute more of the real test matrix without requiring repetitive package-level boilerplate.
  - The CI gate is stricter and closer to the documented testing model.
  - Remaining gaps are more likely to reflect missing tests rather than missing script declarations.

## ADR-0010 - Shared shell cross-cutting behavior belongs in `@platform/ui-shell`, not plugin-local helpers

- Status: accepted
- Date: 2026-04-18
- Context: The specs require consistent shell navigation, deep-link handling, audit context, and telemetry hooks across admin, portal, and site shells. Leaving those concerns inside individual plugins would have made shell boundaries inconsistent and hard to govern.
- Decision: Implement shared shell providers, navigation resolution, telemetry sinks, audit sinks, and command/notification buses inside `@platform/ui-shell`, then let plugin surfaces register into those contracts rather than duplicating shell glue per plugin.
- Consequences:
  - Cross-shell behavior stays explicit and testable at the framework layer.
  - Plugins consume shared contracts instead of inventing their own shell wiring.
  - Browser E2E still needs to validate the same contracts at runtime, but the source of truth is centralized.

## ADR-0011 - Dormant dangerous grants and rollback checkpoints are host-governed runtime metadata

- Status: accepted
- Date: 2026-04-18
- Context: The platform needs Android-style dormant grant reset behavior and deterministic rollback planning, but those concepts are runtime state, not plugin-authored manifest truth.
- Decision: Model dormant dangerous-grant metadata inside `@platform/permissions` and rollback checkpoint planning inside `@platform/plugin-solver` as host-computed records derived from manifests, grant state, and activation order rather than as mutable manifest fields.
- Consequences:
  - Plugin manifests remain declarative and auditable.
  - Sensitive runtime state stays under host control.
  - Upgrade/install flows can compare manifest intent with host-side grant/checkpoint state without blurring responsibilities.

## ADR-0012 - Release readiness centers on a generated source bundle plus SBOM, provenance, and optional detached signatures

- Status: accepted
- Date: 2026-04-18
- Context: The specs require coverage, SBOM, provenance, and signing hooks, but the local environment does not always have signing keys or a registry publish target available.
- Decision: Generate a deterministic release tarball from the verified workspace and hang the release-security artifacts off that subject:
  - `artifacts/release/platform-core-framework.tgz`
  - `artifacts/sbom/platform-sbom.cdx.json`
  - `artifacts/provenance/build-provenance.json`
  - `artifacts/provenance/release-signature.json`
  - GitHub build-provenance and SBOM attestations in CI
- Consequences:
  - Local and CI release checks talk about the same artifact subject.
  - Provenance and SBOM automation are real even without local signing secrets.
  - Missing signing keys become an explicit `skipped-no-key` state instead of hidden absence.

## ADR-0013 - Remove the direct `drizzle-kit` dependency and govern the remaining Better Auth advisory explicitly

- Status: accepted
- Date: 2026-04-18
- Context: A supply-chain audit surfaced a high-severity `drizzle-orm` issue and a moderate `esbuild` advisory inherited through Better Auth's optional `drizzle-kit` peer graph. The runtime ORM issue could be fixed directly, but the inherited Better Auth path could not be removed cleanly without upstream changes.
- Decision:
  - upgrade `drizzle-orm` to `^0.45.2`
  - remove the direct root `drizzle-kit` dependency
  - keep `bun run security:audit` failing by default at `moderate`, but allow advisory `1102341` only through the checked-in allowlist with justification and expiry
- Consequences:
  - The runtime ORM path is patched.
  - The remaining advisory stays visible and governed instead of being silently ignored.
  - The allowlist entry must be removed when Better Auth or its optional peer graph no longer resolves the vulnerable dev-only `esbuild` path.

## ADR-0014 - Vulnerability auditing should traverse the reachable release graph instead of allowlisting optional peer noise

- Status: accepted
- Date: 2026-04-19
- Context: The framework completion bar required `bun run security:audit` to pass without a checked-in allowlist, but Better Auth's optional peer graph could still surface advisories that were not part of the actual release/runtime dependency surface.
- Decision: Replace the checked-in allowlist path with a reachable-release-graph audit that evaluates the dependencies actually pulled into the verified framework artifact and fails on reachable advisories at or above the configured threshold.
- Consequences:
  - `security:audit` is strict again without relying on ignore files.
  - Optional peer noise does not force false positives when it is outside the shipped graph.
  - The audit report remains explicit in `artifacts/security/audit-report.json`.

## ADR-0015 - Local signing uses a deterministic dev test key while CI release signing uses environment-provided key material

- Status: accepted
- Date: 2026-04-19
- Context: The framework completion bar required a real signing path locally and in CI, but local environments do not always have release-secret infrastructure available.
- Decision: Provide two explicit signing modes:
  - a checked-in dev test key for local end-to-end signing verification
  - a required environment-backed signing contract for CI release readiness
- Consequences:
  - Local signing and signature verification are always testable.
  - CI still proves the real secret-backed release path.
  - The local dev key is verification-only and must never be treated as production release material.

## ADR-0016 - Framework browser E2E belongs in a lightweight shell harness app and is part of the root quality gate

- Status: accepted
- Date: 2026-04-19
- Context: The framework package layer needed browser E2E for shell bootstrap, deep links, permission-aware hiding, and shared-session wiring before plugin business work could safely build on top of it.
- Decision: Use `@apps/platform-dev-console` as the framework browser harness, add Playwright-backed shell E2E there, and promote `test:e2e` into the root `ci:check` gate.
- Consequences:
  - Framework shell contracts now have browser-level proof, not only unit tests.
  - Future plugin browser flows can extend the same harness instead of inventing separate shell bootstrap code.
  - The root quality gate now exercises the framework browser path automatically.

## ADR-0017 - Unknown plugin activation and capability updates are host-governed review plans with fail-closed concurrency

- Status: accepted
- Date: 2026-04-19
- Context: The docs require quarantine -> restricted preview -> manual review for unknown plugins, plus explicit approval/reapproval decisions for install and update flows. The earlier framework state had the low-level restricted-mode helper, but not a full activation path or concurrency-safe grant update contract.
- Decision:
  - implement install-review and update-review planning in `@platform/permissions`
  - let `@platform/plugin-solver` opt into a host-side restricted-preview transform for unknown plugins
  - model concurrent capability-grant updates as optimistic versioned commits that fail closed on stale writes
- Consequences:
  - Unknown plugins can be previewed only after their manifest is downgraded into restricted declarative-only form.
  - Approval/reapproval decisions are explicit framework contracts instead of implicit warnings.
  - Simultaneous permission updates cannot silently clobber one another.

## ADR-0018 - The universal admin desk is layered above `@platform/ui-shell`

- Status: accepted
- Date: 2026-04-19
- Context: The admin UI guide required a universal admin workbench with workspaces, admin nav, reports, builders, search, and command-palette behavior. The repository already had a lower-level shell substrate in `@platform/ui-shell` for session, zones, telemetry, and embedded surfaces.
- Decision: Keep `@platform/ui-shell` as the low-level substrate and add a dedicated admin family above it:
  - `@platform/admin-contracts`
  - `@platform/admin-listview`
  - `@platform/admin-formview`
  - `@platform/admin-widgets`
  - `@platform/admin-reporting`
  - `@platform/admin-builders`
  - `@platform/admin-shell-workbench`
- Consequences:
  - The platform keeps future shell swappability without destabilizing the lower-level shell substrate.
  - Admin-desk ergonomics stay explicit and contract-driven.
  - Portal/site shells continue to share the same substrate without inheriting admin-specific assumptions.

## ADR-0019 - The default admin desk borrows external reference patterns selectively through explicit contracts

- Status: accepted
- Date: 2026-04-19
- Context: The admin guide asked for a workspace-centric desk model, multi-panel builder ergonomics, and dashboard/report drilldown semantics, while explicitly forbidding a literal architectural copy of any reference product.
- Decision:
  - adopt a workspace-centric desk model for the primary admin shell
  - use multi-panel builder separation for dense builder surfaces
  - use dashboard/report/filter/drilldown semantics for reports and widgets
  - keep all of it behind explicit contracts and plugin contributions instead of server-driven framework magic
- Consequences:
  - The desk feels like a governed universal workbench rather than a pile of unrelated pages.
  - Builders and analytics stay powerful without taking over ordinary CRUD surfaces.
  - The shell remains aligned with the broader platform permission and route-ownership model.

## ADR-0020 - Legacy `defineUiSurface` contributions remain supported through an admin adapter during the desk rollout

- Status: accepted
- Date: 2026-04-19
- Context: Existing plugins already exposed admin pages/widgets/zones through `defineUiSurface`, but the new desk introduces a richer contribution system that would have broken current plugin UI flows if adopted as a flag day migration.
- Decision: Add a compatibility adapter in `@platform/admin-contracts` that lifts legacy embedded admin pages/widgets/zones into admin-desk contributions while making the new admin contracts the preferred path.
- Consequences:
  - Existing plugin surfaces can mount inside the new desk immediately.
  - Plugin migration can happen incrementally.
  - Route and permission governance still stays explicit at the admin layer.

## ADR-0021 - ECharts is the platform-owned chart wrapper for admin widgets and reports

- Status: accepted
- Date: 2026-04-19
- Context: The admin guide required a chart wrapper in the platform UI layer and discouraged raw chart-library imports in plugin code.
- Decision: Add `echarts` at the workspace root and keep chart semantics inside `@platform/admin-widgets`, where chart cards expose prepared option payloads and plugin authors rely on platform wrappers instead of raw vendor code.
- Consequences:
  - Chart behavior is standardized for the admin desk.
  - Plugins remain decoupled from raw charting vendor details.
  - Full client hydration can evolve later without breaking the plugin contract surface.

## ADR-0022 - External reference products must not leak into shipped identifiers or source naming

- Status: accepted
- Date: 2026-04-19
- Context: The admin desk was informed by external reference products, but the framework itself must remain independent and should not ship reference-product names in package ids, plugin ids, shell ids, symbols, comments, labels, or generated outputs.
- Decision:
  - keep all external reference material isolated under `ref/dashboard/*`
  - use neutral internal naming for shipped framework surfaces such as `admin-shell-workbench`
  - scrub generated artifacts and workspace metadata when naming migrations happen so stale compiled output does not preserve old reference names
- Consequences:
  - the framework presents an original product surface instead of a borrowed brand vocabulary
  - package/plugin identifiers stay stable, generic, and easier to evolve
  - external references remain available for analysis without contaminating runtime or source contracts

## ADR-0023 - The default admin workbench ships its own visual system so server-rendered desk surfaces remain coherent without a CSS build dependency

- Status: accepted
- Date: 2026-04-19
- Context: The admin workbench is rendered inside a lightweight Bun/React harness and must still feel like a dense, operator-grade desk even when a Tailwind or app-bundler pipeline is not present. The earlier shell markup used utility-class-oriented strings that rendered as mostly unstyled HTML in the verification harness.
- Decision:
  - keep the admin desk visually self-owned inside `@platform/admin-shell-workbench`
  - drive the shell through neutral `awb-*` classes plus shell-scoped CSS variables and embedded style rules
  - let `@platform/ui-kit`, `@platform/admin-widgets`, `@platform/admin-builders`, and proving pages share that same class vocabulary instead of relying on an external CSS framework at runtime
- Consequences:
  - the default workbench now renders as a coherent operator UI in server-rendered and harness contexts
  - theming and density become explicit shell inputs instead of accidental app-level concerns
  - plugin pages can stay visually consistent by using platform wrappers and the shared `awb-*` surface language

## ADR-0024 - Browser E2E for the admin harness runs as a direct Bun + Playwright script instead of `bun test`

- Status: accepted
- Date: 2026-04-19
- Context: In this environment, Playwright browser processes launched reliably from plain Bun/Node scripts but were being killed during `bun test` startup, which made the admin-browser verification flaky for reasons unrelated to the desk itself.
- Decision:
  - keep Playwright as the browser verification engine
  - move `@apps/platform-dev-console` browser verification to a direct Bun script runner (`bun run tests/e2e/run-shell-harness.ts`)
  - keep package `test` focused on unit tests while routing browser verification through package/root `test:e2e`
- Consequences:
  - browser verification remains real and automated without inheriting the Bun test runner instability
  - the root workspace `test:e2e` gate still exercises the full admin workbench flow
  - unit and browser concerns stay separated, which also makes future shell E2E expansion easier

## ADR-0025 - Admin desk appearance and custom report surfaces stay explicit, query-preserving shell contracts

- Status: accepted
- Date: 2026-04-19
- Context: The admin workbench needed richer operator surfaces and real customization without slipping into hidden client magic. The desk also needed to preserve search, command-panel, profile, density, and skin state across deep links so appearance controls would not fight ordinary navigation.
- Decision:
  - keep appearance customization explicit through shell inputs and query-preserving links/forms
  - let report contributions provide optional custom React components for richer export/audit/operator report surfaces
  - keep builder previews explicit by honoring builder-provided preview components before falling back to page-linked previews
- Consequences:
  - the desk can ship multiple coherent visual presets without a separate runtime settings framework
  - richer report/operator surfaces fit inside the same governed route and permission model instead of bypassing the shell
  - command palette, search, and appearance state now compose predictably across admin routes, which removes a real desk-level UX conflict

## ADR-0026 - Admin-registered plugins target canonical alias wrappers, not raw UI-stack libraries

- Status: accepted
- Date: 2026-04-19
- Context: The framework already had working `ui-*` packages, but the admin-plugin surface needed a clearer public taxonomy and stricter governance so future plugin work could stay low-code, consistent, and AI-friendly without a risky repo-wide rename. The stack also needed to stay explicit about ECharts as the shared chart engine even though other charting libraries were considered.
- Decision:
  - publish canonical alias packages for admin-plugin implementation:
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
  - keep the legacy `ui-*` packages as compatibility layers under the framework
  - keep ECharts as the shared chart engine behind `@platform/chart`
  - enforce that admin-registered plugins use platform wrappers instead of importing the raw admin stack directly, except in declared isolated zones/builders
- Consequences:
  - future admin-plugin work now has a stable public package taxonomy without forcing a risky rewrite of the existing framework internals
  - admin-plugin imports are more predictable for both humans and AI agents
  - raw-stack sprawl is now governed through lint and contract tests instead of code review alone
  - the framework keeps backward compatibility while making the canonical path explicit

## ADR-0027 - The repository is distributed as framework core plus built-in plugins plus optional plugins

- Status: accepted
- Date: 2026-04-19
- Context: The implementation had grown into a complete platform baseline, but the top-level filesystem still mixed engine packages, shared libraries, and shipped default plugins under generic `packages/` and `plugins/foundations/` roots. That made the framework harder to present as a distributable “platform plus built-ins” offering and harder to explain to future contributors.
- Decision:
  - move engine/runtime/infrastructure packages under `framework/core/`
  - move shared developer-facing libraries and UI/admin wrappers under `framework/libraries/`
  - move shipped default plugins under `framework/builtin-plugins/`
  - keep optional/business extensions under `plugins/`
  - keep package identities stable (`@platform/*`, `@plugins/*`) and change only filesystem layout, workspace discovery, and path aliases
- Consequences:
  - the repository now reads more clearly as a distributable framework with batteries included
  - built-in capabilities such as auth, audit, dashboard, and portal remain plugins logically, which preserves solver/governance behavior instead of hardcoding them into the kernel
  - future contributors and AI agents can distinguish framework engine, framework libraries, built-in plugins, and optional plugins more quickly
  - workspace configuration, scaffolding, and root docs must remain aligned with the new taxonomy

## ADR-0028 - External ecosystem installs must be CLI-governed dependencies, not mutations of framework source

- Status: accepted
- Date: 2026-04-19
- Context: After splitting the repository into framework core, framework libraries, built-in plugins, and optional plugins, the next ecosystem requirement is a real terminal/package experience similar to Django/npm/AWS CLI. The major design risk is letting downloaded code land directly inside `framework/core/*` or `framework/libraries/*`, which would blur the line between shipped framework code and externally installed dependencies.
- Decision:
  - introduce one framework-owned terminal surface via `@platform/cli` with a `platform` binary
  - keep `framework/core/*`, `framework/libraries/*`, and `framework/builtin-plugins/*` as distribution-owned source trees
  - treat registry-installed packages as managed dependencies that land in:
    - `vendor/plugins/*`
    - `vendor/libraries/*`
    - and/or `.platform/cache/*`
  - separate the plugin store from the library registry
  - require CLI-owned lockfile, signature, provenance, compatibility, and policy checks for external installs
- Consequences:
  - the framework keeps a clean source/distribution boundary even after adding an ecosystem store
  - built-in packages continue to feel batteries-included without turning third-party installs into source-tree mutations
  - future registry work now has an explicit architectural target for install destinations, lockfiles, and CLI responsibilities
  - the CLI and registry program becomes a first-class implementation phase instead of ad hoc script growth

## ADR-0029 - AI is a first-class governed runtime built on actions, workflows, memory, and evals

- Status: accepted
- Date: 2026-04-19
- Context: The framework already had explicit actions/resources, permissions, jobs, workflows, audit, multi-tenant context, and a provider-neutral `@platform/ai` package. To become truly agent-native, AI needed to be modeled as a governed runtime surface rather than as ad hoc SDK calls inside plugin code.
- Decision:
  - add a dedicated AI platform family:
    - `@platform/ai-runtime`
    - `@platform/ai-memory`
    - `@platform/ai-guardrails`
    - `@platform/ai-evals`
    - `@platform/ai-mcp`
  - extend action and resource contracts with AI-facing metadata for:
    - tool exposure
    - risk classification
    - approval mode
    - grounding inputs
    - output redaction
    - replay metadata
  - ship the first built-in AI batteries as plugins:
    - `ai-core`
    - `ai-rag`
    - `ai-evals`
  - require agents to use declared actions and curated read models only; no raw repositories, broad DB helpers, or undeclared connector clients
  - keep AI opt-in by default at the tenant, plugin, and policy level
  - keep provider access behind framework wrappers and connectors rather than allowing raw provider SDK imports in business code
  - expose governed MCP-safe descriptors from framework contracts and CLI tooling
- Consequences:
  - AI behavior now fits the same permission, audit, tenancy, and package-governance model as the rest of the framework
  - agent tooling is derivable from the action/resource registry instead of being maintained as a parallel bespoke surface
  - prompt, approval, retrieval, replay, and eval workflows are now framework concerns rather than scattered application logic
  - built-in AI capabilities remain swappable and governable because they are shipped as plugins instead of kernel magic
  - the current baseline includes descriptor-based MCP exposure and AI-native CLI workflows, while full long-running transport serving and CI release-gate enforcement remain explicit follow-on phases

## ADR-0030 - System understanding is a first-class framework contract distinct from orchestration

- Status: accepted
- Date: 2026-04-19
- Context: The framework is explicitly AI-first, but code shape alone is not enough for reliable AI-assisted implementation or review. Agents and follow-on engineers need access to business meaning, mandatory steps, invariants, workflow intent, and operational edge cases in a form that is close to the code and also consumable at repository scale. At the same time, this requirement is separate from agent orchestration: the framework should explain the system without deciding what work an agent must perform.
- Decision:
  - add a dedicated `@platform/agent-understanding` package
  - extend resource, action, and workflow contracts with semantic understanding metadata
  - standardize a required local doc pack for apps, framework packages, libraries, and plugins:
    - `AGENT_CONTEXT.md`
    - `BUSINESS_RULES.md`
    - `FLOWS.md`
    - `GLOSSARY.md`
    - `EDGE_CASES.md`
    - `MANDATORY_STEPS.md`
  - add CLI workflows to scaffold, index, and validate that understanding surface
  - generate a machine-readable repository understanding index for tooling and AI preflight context loading
  - enforce the required doc-pack baseline in the root CI gate while surfacing deeper semantic gaps as warnings during the backfill period
- Consequences:
  - the framework now treats system comprehension as a delivery concern rather than optional prose
  - AI agents and human engineers can load a stronger business model before acting on the codebase
  - understanding remains distinct from orchestration, which preserves the boundary between “explain the system” and “decide the next action”
  - future work can deepen semantic coverage incrementally without losing the now-mandatory repo-wide baseline
