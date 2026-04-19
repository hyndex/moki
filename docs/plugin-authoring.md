# Plugin Authoring Guide

This guide is for people building **Gutu plugins**:

- built-in plugins that ship with the framework,
- project-local business plugins inside a Gutu workspace,
- future store-distributed plugins,
- and optional installable modules that register routes, data, actions, admin surfaces, or zones.

If you are building a reusable framework package instead, use [library-authoring.md](./library-authoring.md).

---

## What counts as a plugin

Use a plugin when the unit:

- owns business or platform behavior,
- owns or extends installable capabilities,
- owns data or extends someone else’s declared data surface,
- participates in activation, trust, and compatibility rules,
- may contribute admin pages, widgets, reports, commands, builders, or zones,
- or should eventually be installable, enabled, disabled, reviewed, or versioned independently.

Typical plugin kinds:

- `app`
- `feature-pack`
- `connector`
- `migration-pack`
- `bundle`
- `ui-surface`
- `ai-pack`

---

## Where plugin code lives

### In the framework source repo

- built-in shipped plugins live in `framework/builtin-plugins/*`

### In a clean consumer workspace

- project-specific plugins live in `plugins/*`
- future vendored registry plugins live in `vendor/plugins/*`

### Strong rule

Plugins are installable units. Do not put plugin business logic into `framework/core/*` or `framework/libraries/*` just because it feels convenient.

---

## Decide before you start

Use this quick rule:

| If you are building... | Use a plugin? | Why |
| --- | --- | --- |
| a business module with entities, actions, and UI | yes | it is product logic |
| a provider adapter with secrets, egress, or webhooks | yes | it needs install-time governance |
| a migration/import pipeline | yes | it is an operational installable unit |
| a reusable table wrapper or router helper | no | that belongs in a framework library |
| a shared contract or DSL | no | that belongs in a framework library |

---

## Preferred authoring order

1. Create the manifest.
2. Scaffold the understanding doc pack.
3. Define resources.
4. Define actions.
5. Define workflows if the plugin owns process state.
6. Add services or handlers.
7. Register admin surfaces if relevant.
8. Add tests.
9. Validate docs and run the narrow test set.
10. Run the root quality gate before calling it ready.

---

## Step 1: create the manifest

Plugins use the manifest DSL from `@platform/kernel`.

Example:

```ts
import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "dashboard-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Dashboard Core",
  description: "Dashboard, widget, and saved view backbone.",
  dependsOn: ["auth-core", "org-tenant-core", "role-policy-core", "audit-core"],
  providesCapabilities: ["dashboard.views"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.dashboard"],
  ownsData: ["dashboard.views"],
  trustTier: "first-party",
  reviewTier: "R1",
  isolationProfile: "same-process-trusted",
  compatibility: {
    framework: "^0.1.0",
    runtime: "bun>=1.3.12",
    db: ["postgres", "sqlite"]
  }
});
```

Manifest rules:

- `id` must be stable
- `description` must be useful to humans and agents
- `dependsOn` must reflect real runtime dependencies
- `requestedCapabilities` must be explicit
- `ownsData` and `extendsData` must tell the truth
- trust/review/isolation must match the real risk level

---

## Step 2: scaffold the understanding docs

```bash
bun run gutu -- docs scaffold --target framework/builtin-plugins/dashboard-core
```

At minimum, fill in:

- `docs/AGENT_CONTEXT.md`
- `docs/BUSINESS_RULES.md`
- `docs/FLOWS.md`
- `docs/GLOSSARY.md`
- `docs/EDGE_CASES.md`
- `docs/MANDATORY_STEPS.md`

These docs are not decorative. They are part of the plugin contract for humans, reviewers, and AI agents.

---

## Step 3: define resources

Resources describe typed data, field metadata, admin defaults, and business meaning.

```ts
import { defineResource } from "@platform/schema";
import { z } from "zod";

export const ContactResource = defineResource({
  id: "crm.contacts",
  description: "A tenant-scoped person record used for lead, customer, and relationship workflows.",
  businessPurpose: "Acts as the canonical person-level CRM record that sales, marketing, support, and account teams reference.",
  invariants: [
    "A contact always belongs to exactly one tenant.",
    "A contact can be archived without losing audit history."
  ],
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    fullName: z.string().min(2),
    email: z.string().email().optional(),
    lifecycleStatus: z.enum(["lead", "active", "customer", "inactive"]),
    createdAt: z.string()
  }),
  fields: {
    fullName: {
      searchable: true,
      sortable: true,
      label: "Name",
      description: "Operator-facing display name for the person.",
      businessMeaning: "The canonical display value used in CRM, activity, and approval surfaces.",
      sourceOfTruth: true
    },
    email: {
      searchable: true,
      sortable: true,
      label: "Email",
      description: "Primary email used for contact, deduplication, and communication routing."
    },
    lifecycleStatus: {
      filter: "select",
      label: "Lifecycle",
      description: "Commercial relationship stage used by segmentation and pipeline flows.",
      requiredForFlows: ["lead-conversion", "campaign-targeting"]
    }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["fullName", "email", "lifecycleStatus"]
  },
  portal: {
    enabled: false
  }
});
```

Resource rules:

- every field should explain what it means, not only what it is called
- `autoCrud` is a helpful default, not an excuse to skip real business rules
- fields that drive workflows should say so
- sensitive or masked data should be explicit

---

## Step 4: define actions

Actions are typed business commands with permission and audit semantics.

```ts
import { defineAction } from "@platform/schema";
import { z } from "zod";

export const archiveContactAction = defineAction({
  id: "crm.contacts.archive",
  description: "Archives a contact for active operations while keeping historical references intact.",
  businessPurpose: "Removes stale contacts from active pipelines without destroying audit or reporting history.",
  input: z.object({
    contactId: z.string().uuid(),
    tenantId: z.string().uuid(),
    currentStatus: z.enum(["lead", "active", "customer", "inactive"]),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.literal("inactive")
  }),
  permission: "crm.contacts.archive",
  idempotent: true,
  audit: true,
  preconditions: [
    "The caller must have archive permission for the current tenant.",
    "The contact must already exist."
  ],
  mandatorySteps: [
    "Record why the contact is being archived.",
    "Emit an audit event for the status change."
  ],
  sideEffects: [
    "The contact leaves active operational default views.",
    "Downstream workflows may stop offering this contact for new outreach."
  ],
  postconditions: [
    "Historical references to the contact remain valid."
  ],
  failureModes: [
    "Permission denied.",
    "Unknown contact."
  ],
  forbiddenShortcuts: [
    "Do not delete the record instead of archiving it."
  ],
  handler: async ({ input }) => {
    return {
      ok: true,
      nextStatus: "inactive"
    };
  }
});
```

Action rules:

- use actions for important business mutations
- describe preconditions, side effects, and forbidden shortcuts
- if AI tools may call the action, define AI metadata and replay expectations explicitly

---

## Step 5: register admin surfaces when relevant

If the plugin belongs in the admin workbench, register contributions through contracts rather than injecting arbitrary UI.

```ts
import {
  defineAdminNav,
  defineCommand,
  definePage,
  defineReport,
  defineSearchProvider,
  defineWidget,
  defineWorkspace
} from "@platform/admin-contracts";

export const adminContributions = {
  workspaces: [
    defineWorkspace({
      id: "crm",
      label: "CRM",
      permission: "crm.contacts.read",
      homePath: "/admin/workspace/crm"
    })
  ],
  nav: [
    defineAdminNav({
      workspace: "crm",
      group: "customers",
      items: [
        {
          id: "crm.contacts",
          label: "Contacts",
          to: "/admin/crm/contacts",
          permission: "crm.contacts.read"
        }
      ]
    })
  ],
  pages: [
    definePage({
      id: "crm.contacts.list",
      kind: "list",
      route: "/admin/crm/contacts",
      label: "Contacts",
      workspace: "crm",
      permission: "crm.contacts.read"
    })
  ],
  widgets: [
    defineWidget({
      id: "crm.pipeline-summary",
      kind: "kpi",
      shell: "admin",
      slot: "dashboard.crm",
      permission: "crm.contacts.read"
    })
  ],
  reports: [
    defineReport({
      id: "crm.pipeline.report",
      kind: "tabular",
      route: "/admin/reports/crm-pipeline",
      label: "CRM Pipeline",
      permission: "crm.contacts.read",
      query: "crm.pipeline.summary",
      filters: [{ key: "ownerUserId", type: "user-select" }],
      export: ["csv", "xlsx"]
    })
  ],
  commands: [
    defineCommand({
      id: "crm.contacts.open",
      label: "Open CRM Contacts",
      permission: "crm.contacts.read",
      href: "/admin/crm/contacts"
    })
  ],
  searchProviders: [
    defineSearchProvider({
      id: "crm.contacts.search",
      scopes: ["contacts"],
      permission: "crm.contacts.read",
      search(query) {
        return [
          {
            id: `crm.contacts:${query}`,
            label: `Contact ${query}`,
            href: "/admin/crm/contacts",
            kind: "resource"
          }
        ];
      }
    })
  ]
};
```

Admin rules:

- every contribution must be permission-bound
- use platform wrappers instead of raw UI dependencies
- do not let plugin UI invent its own stack inside embedded admin surfaces

---

## Step 6: test the plugin properly

A real plugin normally needs:

- unit tests for services and helpers
- contract tests for manifests/resources/actions/admin contributions
- integration tests where DB/API/workflows matter
- UI/browser tests when the plugin contributes critical shell surfaces

Good minimum checklist:

- manifest is stable
- dependencies are valid
- resource schemas parse
- action inputs/outputs validate
- permissions are enforced
- important admin contributions resolve correctly
- business invariants are covered

---

## Connectors, migration packs, and bundles

These are still plugins, but with special roles.

### Connectors

Use connectors for external provider integrations. They should declare:

- requested capabilities
- allowed hosts
- secrets
- webhook routes
- isolation profile

### Migration packs

Use migration packs for import/export/reconciliation logic. They should be explicit about:

- source system assumptions
- transform rules
- retry and idempotency behavior
- rollback or reconciliation strategy

### Bundles

Use bundles for tested install distributions. They should describe:

- what is included
- optional includes
- target use case
- compatibility assumptions

---

## Strong plugin authoring rules

- Do not bypass manifests.
- Do not leave model, field, action, or workflow meaning implicit when the contract can describe it.
- Do not bypass wrapper packages.
- Do not let plugin UI choose arbitrary libraries.
- Do not give unknown plugins privileged access.
- Do not skip tests for resources, actions, or admin contributions.
- Do not put provider SDKs directly into business or domain plugins.

---

## Quick checklist before you finish

- [ ] Manifest is complete and truthful
- [ ] Understanding docs exist and are filled in
- [ ] Resources have field-level meaning, not only labels
- [ ] Actions describe preconditions, side effects, and forbidden shortcuts
- [ ] Admin contributions are permission-aware
- [ ] Tests cover core behavior
- [ ] `bun run docs:validate` passes
- [ ] `bun run ci:check` passes

---

## Related docs

- [README.md](../README.md)
- [library-authoring.md](./library-authoring.md)
- [admin-ui-stack.md](./admin-ui-stack.md)
- [agent-understanding.md](./agent-understanding.md)
- [Developer_DeepDive.md](./Developer_DeepDive.md)
