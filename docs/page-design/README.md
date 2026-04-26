# Page Design Briefs

Per-plugin page design plans. Read [`PAGE-DESIGN-SYSTEM.md`](../PAGE-DESIGN-SYSTEM.md) first — every brief here speaks the language defined there (12 archetypes, slot grid, widget catalog, tokens, a11y, performance contract).

## How to read a brief

Every brief follows the same structure:

1. **Positioning** — one paragraph: what problem this plugin solves vs alternatives like ERPNext, Twenty, Salesforce, etc.
2. **Page map** — table mapping every plugin path to one of the 12 archetypes.
3. **Per-page specs** — for flagship briefs: KPIs, widgets, filters, saved views, bulk actions, keyboard map, URL state, performance budget, empty/loading/error states. For short-form briefs: highlights only.
4. **Cross-plugin integrations** — what this plugin both provides to and consumes from sibling plugins.
5. **Open questions** — explicit unresolved design choices for review.

## Tiers

- **flagship** — written at full depth (~600–1000 words). The 8 most-used plugins. Use these as reference exemplars.
- **standard** — short-form (~250–400 words). Sufficient for plugin authors to build.
- **support** — internal/admin-only or library-style plugins; concise.

## Flagship briefs (8)

| Plugin | Brief |
|---|---|
| CRM | [crm-core.md](./crm-core.md) |
| Accounting | [accounting-core.md](./accounting-core.md) |
| Inventory | [inventory-core.md](./inventory-core.md) |
| HR & Payroll | [hr-payroll-core.md](./hr-payroll-core.md) |
| Sales | [sales-core.md](./sales-core.md) |
| Notifications & Mail | [notifications-core.md](./notifications-core.md) |
| AI Assist | [ai-assist-core.md](./ai-assist-core.md) |
| Dashboard | [dashboard-core.md](./dashboard-core.md) |

## All plugins

### Domain plugins (operational)

| Plugin | Tier | Brief |
|---|---|---|
| Accounting | flagship | [accounting-core.md](./accounting-core.md) |
| AI Assist | flagship | [ai-assist-core.md](./ai-assist-core.md) |
| AI Core | standard | [ai-core.md](./ai-core.md) |
| AI Evals | standard | [ai-evals.md](./ai-evals.md) |
| AI RAG | standard | [ai-rag.md](./ai-rag.md) |
| AI Skills | standard | [ai-skills-core.md](./ai-skills-core.md) |
| Analytics & BI | standard | [analytics-bi-core.md](./analytics-bi-core.md) |
| Assets | standard | [assets-core.md](./assets-core.md) |
| Booking | standard | [booking-core.md](./booking-core.md) |
| Business Portals | standard | [business-portals-core.md](./business-portals-core.md) |
| Collab Pages | standard | [collab-pages-core.md](./collab-pages-core.md) |
| Community | standard | [community-core.md](./community-core.md) |
| Company Builder | standard | [company-builder-core.md](./company-builder-core.md) |
| Connections | standard | [connections-core.md](./connections-core.md) |
| Content | standard | [content-core.md](./content-core.md) |
| Contracts | standard | [contracts-core.md](./contracts-core.md) |
| CRM | flagship | [crm-core.md](./crm-core.md) |
| Dashboard | flagship | [dashboard-core.md](./dashboard-core.md) |
| Document | standard | [document-core.md](./document-core.md) |
| E-Invoicing | standard | [e-invoicing-core.md](./e-invoicing-core.md) |
| Execution Workspaces | standard | [execution-workspaces-core.md](./execution-workspaces-core.md) |
| Field Service | standard | [field-service-core.md](./field-service-core.md) |
| Files | standard | [files-core.md](./files-core.md) |
| Forms | standard | [forms-core.md](./forms-core.md) |
| HR & Payroll | flagship | [hr-payroll-core.md](./hr-payroll-core.md) |
| Inventory | flagship | [inventory-core.md](./inventory-core.md) |
| Issues | standard | [issues-core.md](./issues-core.md) |
| Knowledge | standard | [knowledge-core.md](./knowledge-core.md) |
| Maintenance (CMMS) | standard | [maintenance-cmms-core.md](./maintenance-cmms-core.md) |
| Manufacturing | standard | [manufacturing-core.md](./manufacturing-core.md) |
| Notifications & Mail | flagship | [notifications-core.md](./notifications-core.md) |
| Page Builder | standard | [page-builder-core.md](./page-builder-core.md) |
| Party Relationships | standard | [party-relationships-core.md](./party-relationships-core.md) |
| Payments | standard | [payments-core.md](./payments-core.md) |
| POS | standard | [pos-core.md](./pos-core.md) |
| Pricing & Tax | standard | [pricing-tax-core.md](./pricing-tax-core.md) |
| Procurement | standard | [procurement-core.md](./procurement-core.md) |
| Product Catalog | standard | [product-catalog-core.md](./product-catalog-core.md) |
| Projects | standard | [projects-core.md](./projects-core.md) |
| Quality | standard | [quality-core.md](./quality-core.md) |
| Sales | flagship | [sales-core.md](./sales-core.md) |
| Slides | standard | [slides-core.md](./slides-core.md) |
| Spreadsheet | standard | [spreadsheet-core.md](./spreadsheet-core.md) |
| Subscriptions | standard | [subscriptions-core.md](./subscriptions-core.md) |
| Support & Service | standard | [support-service-core.md](./support-service-core.md) |
| Traceability | standard | [traceability-core.md](./traceability-core.md) |
| Treasury | standard | [treasury-core.md](./treasury-core.md) |
| User Directory | standard | [user-directory.md](./user-directory.md) |
| Whiteboard | standard | [whiteboard-core.md](./whiteboard-core.md) |
| Workflow | standard | [workflow-core.md](./workflow-core.md) |

### Cross-plugin services

| Plugin | Tier | Brief |
|---|---|---|
| Audit | standard | [audit-core.md](./audit-core.md) |
| Auth | standard | [auth-core.md](./auth-core.md) |
| Automation | standard | [automation-core.md](./automation-core.md) |
| Awesome Search | standard | [awesome-search-core.md](./awesome-search-core.md) |
| Document Editor | standard | [document-editor-core.md](./document-editor-core.md) |
| Editor Core | standard | [editor-core.md](./editor-core.md) |
| ERP Actions | standard | [erp-actions-core.md](./erp-actions-core.md) |
| Favorites | standard | [favorites-core.md](./favorites-core.md) |
| Field Metadata | standard | [field-metadata-core.md](./field-metadata-core.md) |
| Integration | standard | [integration-core.md](./integration-core.md) |
| Jobs | standard | [jobs-core.md](./jobs-core.md) |
| Org & Tenant | standard | [org-tenant-core.md](./org-tenant-core.md) |
| Portal | standard | [portal-core.md](./portal-core.md) |
| Record Links | standard | [record-links-core.md](./record-links-core.md) |
| Role & Policy | standard | [role-policy-core.md](./role-policy-core.md) |
| Runtime Bridge | support | [runtime-bridge-core.md](./runtime-bridge-core.md) |
| Saved Views | standard | [saved-views-core.md](./saved-views-core.md) |
| Search | standard | [search-core.md](./search-core.md) |
| Storage Core | support | [storage-core.md](./storage-core.md) |
| Storage Local | support | [storage-local.md](./storage-local.md) |
| Storage S3 | support | [storage-s3.md](./storage-s3.md) |
| Template | support | [template-core.md](./template-core.md) |
| Timeline | standard | [timeline-core.md](./timeline-core.md) |
| Webhooks | standard | [webhooks-core.md](./webhooks-core.md) |

### Shell & infrastructure

| Plugin | Tier | Brief |
|---|---|---|
| Admin Shell Workbench | support | [admin-shell-workbench.md](./admin-shell-workbench.md) |

## Coverage summary

- **75 plugins** — all have a brief
- **8 flagship** — full depth
- **62 standard** — short-form
- **5 support** — admin/library-style

## Adding a new plugin brief

1. Decide tier — flagship requires sustained UX investment.
2. Use [`crm-core.md`](./crm-core.md) (flagship) or [`payments-core.md`](./payments-core.md) (standard) as a template.
3. Map every page to one of the 12 archetypes from `PAGE-DESIGN-SYSTEM.md`.
4. Reference shared widgets and tokens; never invent new chrome without first proposing additions to the design system.
5. Add the row to the index above.
6. Submit a PR — the docs reviewer checks archetype coverage and tier consistency.

## Open design-system additions

The plugin contract additions in [`PAGE-DESIGN-SYSTEM.md` §11](../PAGE-DESIGN-SYSTEM.md#11-plugin-contract-additions) (`archetype`, `fullBleed`, `density`, `searchable`, `savedViews`, `quickActions`) need to land in [`@gutu-host/plugin-ui-contract`](../HOST-SDK-REFERENCE.md). Until they do, plugins implement archetypes but the shell does not yet read the metadata.

## Versioning

Briefs reference `design-system: 1.0` in their frontmatter. When the system bumps to 2.0, briefs must be reviewed (CI warns but does not block).
