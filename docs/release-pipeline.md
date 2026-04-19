# Release Pipeline

## Goals

- keep Bun as the single workspace runtime and package manager
- verify type safety, build outputs, linting, unit tests, contracts, migrations, and integration behavior from the same root command surface
- validate Postgres role, RLS, and curated `api` view behavior against a live database before release-ready artifacts are published
- emit coverage, SBOM, provenance, and verified signature artifacts from the same verified workspace state
- fail the framework release path on reachable vulnerabilities at or above the configured threshold without checked-in advisory ignore entries

## Primary Workflows

### Continuous Integration

The primary workflow is defined in `.github/workflows/ci.yml`.

It performs these steps:

1. Check out the repository.
2. Install Bun with `oven-sh/setup-bun`.
3. Run `bun install --frozen-lockfile`.
4. Render the Postgres bootstrap assets with `bun run db:render:postgres`.
5. Run `bun run ci:check`.
6. Run `bun run coverage:report`.
7. Package the release bundle with `bun run package:release`.
8. Generate the CycloneDX SBOM with `bun run sbom:generate`.
9. Generate the local provenance manifest with `bun run provenance:generate`.
10. Run `bun run security:audit`.
11. Generate the local signature manifest with `bun run sign:artifacts`.
12. Verify the detached signature manifest with `bun run verify:artifacts-signature`.
13. Generate GitHub-hosted provenance and SBOM attestations for the release tarball.
14. Upload `ops/postgres/`, `coverage/`, and `artifacts/` for traceability.

The job provisions PostgreSQL 16 as a service container and exports:

- `DATABASE_URL`
- `DATABASE_TEST_URL`
- `TEST_POSTGRES_URL`

All of them point at the same CI database because the integration suite creates and cleans its own isolated fixtures.

### Release Readiness

The release workflow is defined in `.github/workflows/release-readiness.yml`.

It is intended for manual execution before publishing or handing off artifacts. It:

1. installs Bun
2. installs dependencies
3. renders Postgres assets
4. runs the full `bun run ci:check` gate
5. runs coverage, audit, SBOM, provenance, and release packaging
6. requires environment-backed signing material through `PLATFORM_SIGNING_PRIVATE_KEY_PEM_B64`
7. signs the provenance manifest and verifies the detached signature
8. generates GitHub-hosted provenance and SBOM attestations for the release tarball
9. uploads the release-readiness bundle:
   - `artifacts/`
   - `coverage/`
   - `ops/postgres/`
   - `README.md`
   - `STATUS.md`
   - `TASKS.md`
   - `RISK_REGISTER.md`
   - this document

## Local Reproduction

### Standard verification

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun install
bun run ci:check
bun run security:audit
bun run coverage:report
bun run package:release
bun run sbom:generate
bun run provenance:generate
bun run sign:artifacts
bun run verify:artifacts-signature
```

### Postgres verification with Docker

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run db:render:postgres
docker compose -f ops/postgres/compose.yaml up -d
TEST_POSTGRES_URL=postgres://platform_admin:platform_admin@localhost:5432/platform bun test framework/core/db-drizzle/tests/integration/postgres.test.ts
```

### Postgres verification with a local server

```bash
export PATH="$HOME/.bun/bin:$PATH"
dropdb --if-exists framework_platform_test
createdb framework_platform_test
TEST_POSTGRES_URL=postgresql:///framework_platform_test bun test framework/core/db-drizzle/tests/integration/postgres.test.ts
```

## Artifact Expectations

- `artifacts/release/platform-core-framework.tgz` is the release subject used for provenance and SBOM attestation.
- `artifacts/sbom/platform-sbom.cdx.json` is the generated CycloneDX SBOM for the release bundle and workspace dependency graph.
- `artifacts/provenance/build-provenance.json` is the local provenance manifest built from the same verified workspace.
- `artifacts/provenance/release-signature.json` is a verified detached signature record for the provenance manifest.
- `artifacts/security/audit-report.json` records the Bun advisory scan for the reachable runtime and release dependency closure, excluding peer-only expansion paths that are not part of the framework artifact graph.
- `ops/postgres/platform-bootstrap.sql` is the generated source of truth for platform roles, schemas, RLS, and curated `api` views.
- `ops/postgres/transaction-context.sql` provides a portable example of request-context initialization statements.
- `STATUS.md`, `TASKS.md`, and `RISK_REGISTER.md` travel with release artifacts so deferred work and residual risk remain explicit.

## Signing Modes

- Local development uses the checked-in dev test key under `tooling/signing/` when no environment-backed signing material is provided.
- CI can use the same local dev test key to verify the full signing pipeline on every change.
- Release readiness requires `PLATFORM_REQUIRE_ENV_SIGNING=true` and fails if environment-provided signing material is missing or if the generated signature does not verify.
