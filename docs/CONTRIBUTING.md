# Contributing

Code style, conventions, PR process, commit message format.

---

## 1. Workflow

### 1.1 Branches

- `main` — always green; deployable
- `claude/*` — Claude Code worktree branches
- `codex/*` — Codex feature branches
- `feat/<short-slug>` — long-lived feature branches
- `fix/<short-slug>` — bug fixes

### 1.2 PR process

1. Open a PR against `main`
2. CI must pass (test + typecheck + docker-build jobs)
3. At least one approval from a maintainer
4. Merge as squash (single commit per PR on main)

### 1.3 Commit messages

Format:
```
<type>(<scope>): <subject>

<body — what changed and why, hard-wrapped at 72 cols>

Co-Authored-By: ...
```

Types:
- `feat` — new feature
- `fix` — bug fix
- `chore` — tooling, dependencies, no behaviour change
- `refactor` — code reshape, no behaviour change
- `docs` — docs only
- `test` — tests only
- `perf` — performance improvement
- `ci` — CI workflow change

Scopes:
- `plugin-host` — host SDK / contract / loader
- `<plugin-id>` — a specific plugin (e.g. `webhooks-core`)
- `shell` — shell-only (auth, tenants, audit, resources, …)
- `frontend` — admin-panel UI
- `backend` — admin-panel server
- `docs` — documentation
- `ci` — CI / build

Examples:
- `feat(plugin-host): add provides/consumes registry pattern`
- `fix(workflow-core): close worker on lease loss`
- `chore(deps): bump hono to 4.6.20`
- `docs(plugin-development): clarify ws auth flow`

### 1.4 PR description template

```markdown
## What

One-paragraph summary of what changed.

## Why

What problem this solves / what value this adds.

## How

Implementation notes — only the non-obvious decisions.

## Tests

- [ ] e2e-crud passes (53/53)
- [ ] visual-smoke passes (10/10)
- [ ] visual-interactions passes (10/10)
- [ ] bug-hunt passes (76/76)
- [ ] new tests added for the change (if applicable)
- [ ] typecheck passes
- [ ] docker build passes

## Risks

Anything that could go wrong + how to roll back.

## Screenshots

(if UI change)
```

---

## 2. Code style

### 2.1 Files

- TypeScript everywhere. JS only in transpiled output (committed for
  some plugins to avoid build steps in the monorepo).
- One concept per file. Don't dump unrelated helpers in `utils.ts`.
- File names: kebab-case for files (`webhook-dispatcher.ts`),
  PascalCase for components (`VehiclesPage.tsx`).

### 2.2 Imports

Order:
1. Third-party (`react`, `hono`, `zod`)
2. Host SDK (`@gutu-host`, `@gutu-host/*`)
3. Other plugins (`@gutu-plugin/*`)
4. App imports (`@/*`)
5. Relative (`./..`)

Within each group, alphabetical.

```ts
import * as React from "react";
import { z } from "zod";

import { db, requireAuth } from "@gutu-host";
import { withLeadership } from "@gutu-host/leader";

import { Card } from "@/admin-primitives/Card";

import { fleetRoutes } from "./routes/fleet-core";
import { migrate } from "./db/migrate";
```

### 2.3 Comments

- Default to writing **no comments**. Names + types should self-document.
- Add a comment ONLY when the WHY is non-obvious: a hidden constraint,
  a subtle invariant, a workaround for an upstream bug.
- Don't comment WHAT — the code already says what.
- Don't reference issue numbers, PR numbers, or callers in code
  comments — those rot.
- Top-of-file docstring explaining the module's purpose is encouraged
  for non-trivial files (route handlers, contracts, migrations).

### 2.4 Naming

- `camelCase` for functions, variables
- `PascalCase` for types, classes, React components
- `SCREAMING_SNAKE_CASE` for constants and env vars
- Boolean prefix: `is*`, `has*`, `should*`
- Promise return: name the verb (`fetchUser`, not `getUser`)

### 2.5 Errors

- Use `Error` subclasses for expected failures (`PermissionDeniedError`,
  `NamingSeriesError`)
- Throw, don't return error tuples
- Catch at boundaries (route handlers, worker tops); never silently
  catch in the middle

### 2.6 Async

- `async/await` everywhere, no raw `.then()` chains
- Top-level await is fine in `main.ts` (Bun supports it)
- Don't fire-and-forget `void asyncFn()` without justification —
  uncaught errors swallow

### 2.7 Types

- Strict TS (`strict: true` in tsconfig)
- Avoid `any` — use `unknown` for boundary types and narrow
- Avoid `as` casts — use type guards or zod
- Function signatures fully typed (no inferred return types on
  exported functions)

```ts
// Good
export function getUser(id: string): User | null { ... }

// Bad
export function getUser(id: string) { ... }   // return type inferred
```

### 2.8 SQL

- Always parameterised — never string-interpolate user input
- Always `IF NOT EXISTS` in migrations
- Always index `tenant_id` and any frequently-filtered column
- Use uppercase for SQL keywords, lowercase for identifiers
- Wrap multi-statement migrations in `db.exec(\`...\`)`

```ts
// Good
db.prepare("SELECT * FROM users WHERE id = ?").get(id);

// Bad
db.exec(`SELECT * FROM users WHERE id = '${id}'`);   // SQL injection
```

### 2.9 React

- Function components only — no class components
- Hooks at the top of the component, before any conditional
- `React.memo` for expensive children
- `useCallback` for handlers passed as props
- `useMemo` for expensive computed values
- Never mutate state — always create new objects

### 2.10 Tailwind

- Semantic tokens only — never raw colors (`text-text-muted`, not
  `text-gray-500`)
- Class order: layout → spacing → typography → color → effects
- Long class strings: extract to a variable or use clsx
- Don't use `@apply` outside of CSS files (rare; prefer composing
  classes in JSX)

---

## 3. The plugin contract is sacred

If you add a field to `HostPlugin` or `AdminUiContribution`:
- Document it in `HOST-SDK-REFERENCE.md`
- Add a probe in `bug-hunt.ts`
- Update `PLUGIN-DEVELOPMENT.md` with usage
- Update the scaffolder template if it changes the default plugin shape

If you change a field's behaviour:
- Bump the host SDK major version (we don't have one yet — start at
  v1 when first breaking change ships)
- Document the migration path
- Provide a deprecation period — never remove without warning

---

## 4. Defensive coding

### 4.1 Boundary validation

Every external input (HTTP body, query params, WS frames, file
uploads) goes through Zod:

```ts
const Schema = z.object({...});
const parsed = Schema.safeParse(body);
if (!parsed.success) return c.json({ error: ..., issues: parsed.error.issues }, 400);
```

### 4.2 Tenant scoping

Every query that touches per-tenant data must filter by `tenant_id`.
The shell's resource router does this for you; plugins must do it
themselves.

```ts
// Good
db.prepare("... WHERE tenant_id = ? AND id = ?").get(tenantId, id);

// Bad
db.prepare("... WHERE id = ?").get(id);   // cross-tenant leak
```

### 4.3 Worker errors

Workers don't throw. Catch at the top of the tick:

```ts
async function tick() {
  try {
    await doWork();
  } catch (err) {
    console.error("[my-worker] tick failed:", err);
    // optionally: recordAudit({ level: "error", action: "my-worker.failed", ... })
  }
}
```

### 4.4 Resource cleanup

Always call cleanup paths (clearInterval, unsubscribe, close stream)
in the plugin's `stop()`. The shell wraps `stop()` in try/catch, but
leaked resources accumulate during HMR.

```ts
let stop: (() => void) | null = null;

start: (ctx) => {
  const interval = setInterval(tick, 30_000);
  const unsub = subscribeRecordEvents(handler);
  stop = () => { clearInterval(interval); unsub(); };
},
stop: () => { stop?.(); stop = null; },
```

---

## 5. Documentation

### 5.1 What to document

- Public exports — JSDoc on every exported function, class, type
- Non-obvious decisions — top-of-file or inline comments
- Plugin authoring conventions — extend PLUGIN-DEVELOPMENT.md
- Operational quirks — extend RUNBOOK.md
- Deployment knobs — extend DEPLOYMENT.md
- Type signatures — extend HOST-SDK-REFERENCE.md

### 5.2 What NOT to document

- WHAT the code does — the code says it
- Internal implementation details that may change
- TODOs (use the issue tracker)
- Personal commentary, attribution, history

---

## 6. Testing requirements

Every PR must:
- Add tests for new behaviour
- Pass all 4 shell suites (149/149)
- Pass typecheck (`bun run typecheck`)
- Pass docker build

If a PR can't be tested by the existing suites (e.g. it's a docs-only
change), say so in the PR description.

---

## 7. Reviewing

When you review a PR:

- Run the suites locally to confirm CI's verdict
- Check that the commit message follows the format
- Check the diff for: SQL injection risk, cross-tenant leak risk,
  missing audit calls, missing tenant scoping
- Check that the PR description explains the WHY, not just the WHAT
- Suggest improvements as comments; **block** only on:
  - Security issues
  - Plugin contract violations
  - Test coverage gaps for new behaviour
  - Performance regressions

---

## 8. Releasing

### 8.1 Plugins (separate repos)

```bash
cd plugins/gutu-plugin-fleet-core
npm version patch              # or minor / major
git push origin main --tags
bun publish
```

### 8.2 Shell (Framework repo)

The shell doesn't publish to npm; it deploys as a Docker image.
Tag releases on the GitHub repo:

```bash
git tag -a v1.2.0 -m "Plugin host v1.2: new permissions semantics"
git push origin v1.2.0
```

CI builds + pushes a tagged Docker image to your registry on every
tag push (configure `.github/workflows/release.yml`).

---

## 9. Code of conduct

- Assume good intent
- Be specific in feedback (cite line numbers, link to docs)
- Default to "yes" — let the author iterate, don't block on
  preference-level disagreements
- When in doubt, write a test together rather than arguing about
  hypothetical behaviour
- No drive-by comments. If you're going to ask for changes, plan to
  re-review.

---

## 10. Getting help

- Doc-related: file an issue on the Framework repo with `[docs]` prefix
- Bug: file an issue with reproduction steps + expected vs actual
- Security: email `security@gutula.dev` (not a public issue)
- General questions: open a discussion in the Framework repo
