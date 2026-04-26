export const maturityOrder = [
  "Scaffolded",
  "Baseline",
  "Hardened",
  "Production Candidate"
];

export const pluginGroupOrder = [
  "Platform Backbone",
  "Operational Data",
  "AI Systems",
  "Governed AI Operating Models",
  "Content and Experience"
];

export const groupDefaults = {
  "Platform Backbone": {
    nonGoals: [
      "Not a generic WordPress-style hook bus or plugin macro system.",
      "Not a product-specific UX suite beyond the exported admin or portal surfaces that ship today."
    ],
    recommendedNext: [
      "Add stronger operator-facing reconciliation and observability surfaces where runtime state matters.",
      "Promote any currently implicit cross-plugin lifecycles into explicit command, event, or job contracts when those integrations stabilize."
    ],
    laterOptional: [
      "Dedicated federation or external identity/provider adapters once the core contracts are stable."
    ]
  },
  "Operational Data": {
    nonGoals: [
      "Not a full vertical application suite; this plugin only owns the domain slice exported in this repo.",
      "Not a replacement for explicit orchestration in jobs/workflows when multi-step automation is required."
    ],
    recommendedNext: [
      "Broaden lifecycle coverage with deeper orchestration, reconciliation, and operator tooling where the business flow requires it.",
      "Add more explicit domain events or follow-up job surfaces when downstream systems need tighter coupling."
    ],
    laterOptional: [
      "Outbound connectors, richer analytics, or portal-facing experiences once the core domain contracts harden."
    ]
  },
  "AI Systems": {
    nonGoals: [
      "Not an everything-and-the-kitchen-sink provider abstraction layer.",
      "Not a substitute for explicit approval, budgeting, and audit governance in the surrounding platform."
    ],
    recommendedNext: [
      "Add deeper provider, persistence, or evaluation integrations only where the shipped control-plane contracts already prove stable.",
      "Expand operator diagnostics and release gating where the current lifecycle already exposes strong evidence paths."
    ],
    laterOptional: [
      "More connector breadth, richer evaluation libraries, and domain-specific copilots after the baseline contracts settle."
    ]
  },
  "Governed AI Operating Models": {
    nonGoals: [
      "Not a generic no-code company simulator or unrestricted agent swarm shell.",
      "Not a replacement for the lower-level AI, workflow, integration, and audit primitives it composes."
    ],
    recommendedNext: [
      "Broaden operating-model depth only where the current governed execution, queue, and department contracts have already stabilized.",
      "Add richer cross-domain observability once operator teams depend on the composed company builder surfaces daily."
    ],
    laterOptional: [
      "Vertical operating-model packs, richer staffing simulations, and external business system orchestration after the baseline pack stabilizes."
    ]
  },
  "Content and Experience": {
    nonGoals: [
      "Not a monolithic website builder or headless-CMS replacement beyond the specific content surfaces exported here.",
      "Not a generic front-end framework; UI behavior remains bounded to the plugin’s declared resources and surfaces."
    ],
    recommendedNext: [
      "Deepen publishing, review, search, or portal flows where current resources and actions already suggest the next stable step.",
      "Add richer admin and operator guidance once the domain lifecycle hardens."
    ],
    laterOptional: [
      "Advanced authoring, public delivery, and analytics extensions after the core content contracts prove stable."
    ]
  }
};

export const pluginProfiles = {
  "admin-shell-workbench": {
    group: "Platform Backbone",
    architectureRole:
      "Hosts the universal admin desk and turns resource, route, widget, and workspace contributions into one navigable operator surface.",
    focusAreas: ["admin workspaces", "route resolution", "operator preferences"],
    recommendedNext: [
      "Deepen saved-workspace, search, and operator personalization flows once more first-party plugins depend on the desk.",
      "Add stronger runtime diagnostics around missing or conflicting admin contributions."
    ],
    laterOptional: [
      "Workspace theming and tenant-aware desk presets once the contribution contracts stop moving."
    ]
  },
  "ai-core": {
    group: "AI Systems",
    architectureRole:
      "Acts as the durable control plane for agent execution, prompt governance, approval checkpoints, and replay-safe run state.",
    focusAreas: ["agent runtime", "approval queues", "replay-safe execution"],
    recommendedNext: [
      "Broaden provider adapters and richer operator diagnostics without weakening the current governance boundary.",
      "Add stronger persisted orchestration once long-running agent workflows leave the reference-runtime stage."
    ],
    laterOptional: [
      "Provider-specific optimization surfaces once the cross-provider contract has been battle-tested."
    ]
  },
  "ai-evals": {
    group: "AI Systems",
    architectureRole:
      "Owns evaluation datasets, judges, regression baselines, and the release-review evidence used to keep AI changes honest.",
    focusAreas: ["eval datasets", "release gating", "baseline regression review"],
    recommendedNext: [
      "Wire the current evaluation evidence into more release and rollout control points.",
      "Add richer judge provenance and dataset lineage as the eval corpus grows."
    ],
    laterOptional: [
      "Domain-specific judge packs and cross-environment benchmark promotion."
    ]
  },
  "ai-rag": {
    group: "AI Systems",
    architectureRole:
      "Provides tenant-safe retrieval, memory collection management, and the evidence path for grounded AI responses.",
    focusAreas: ["retrieval", "memory collections", "grounding diagnostics"],
    recommendedNext: [
      "Add more ingestion and connector breadth only after the current retrieval contracts remain stable under production load.",
      "Deepen operator visibility into collection freshness, ingestion failures, and retrieval quality."
    ],
    laterOptional: [
      "Hybrid search, reranking, and external-connector packs once the baseline retrieval pipeline stabilizes."
    ]
  },
  "ai-skills-core": {
    group: "AI Systems",
    architectureRole:
      "Defines the governed skill registry, packaging model, and skill-to-runtime contracts that higher-level AI systems consume.",
    focusAreas: ["skills registry", "skill contracts", "governed runtime composition"],
    recommendedNext: [
      "Deepen skill provenance and release evidence once more production runtimes depend on packaged skills.",
      "Add stronger diagnostics around skill compatibility and dependency drift as the skill catalog grows."
    ]
  },
  "audit-core": {
    group: "Platform Backbone",
    architectureRole:
      "Provides the immutable evidence spine for sensitive actions, reconciliation trails, and downstream accountability workflows.",
    focusAreas: ["audit evidence", "sensitive actions", "accountability"],
    recommendedNext: [
      "Add richer replay and export paths where external compliance workflows need them.",
      "Expose stronger operator search and correlation tooling when more packages depend on audit history."
    ]
  },
  "auth-core": {
    group: "Platform Backbone",
    architectureRole:
      "Owns canonical identity provisioning and status state so the rest of the ecosystem can treat identity as a stable domain contract.",
    focusAreas: ["identity provisioning", "provider state", "tenant-safe identities"],
    nonGoals: [
      "Not a full end-user authentication UI or recovery experience.",
      "Does not currently export a wide session-management or MFA API surface beyond the identity contract."
    ],
    recommendedNext: [
      "Expand session, revocation, and provider-lifecycle surfaces if the surrounding platform needs them.",
      "Add explicit identity lifecycle events when downstream provisioning flows depend on them."
    ]
  },
  "automation-core": {
    group: "Platform Backbone",
    architectureRole:
      "Coordinates automation definitions, recurring execution, and governed follow-up behavior without hiding work inside undocumented cron glue.",
    focusAreas: ["automation definitions", "scheduled execution", "governed follow-up"],
    recommendedNext: [
      "Add stronger operator diagnostics and replay controls where automations start owning more business-critical follow-up work.",
      "Clarify execution handoff patterns with jobs, workflows, and notifications as automation coverage broadens."
    ]
  },
  "booking-core": {
    group: "Operational Data",
    architectureRole:
      "Implements the reservation engine for staging, confirming, and cancelling allocation windows with conflict-safe database constraints.",
    focusAreas: ["reservation staging", "hold confirmation", "slot conflict safety"],
    nonGoals: [
      "Does not currently export recurring booking, waitlist, or availability-search APIs.",
      "Does not replace downstream orchestration for approvals or billing around a reservation lifecycle."
    ],
    recommendedNext: [
      "Add richer availability search, recurrence, or waitlist flows only after the current reservation invariants stay stable.",
      "Introduce explicit downstream lifecycle events if other business systems must react automatically to booking transitions."
    ],
    laterOptional: [
      "Customer-facing booking journeys or pricing rules once the resource-allocation spine is fully settled."
    ]
  },
  "community-core": {
    group: "Content and Experience",
    architectureRole:
      "Provides the base group and membership domain used by community-facing experiences and moderation workflows.",
    focusAreas: ["groups", "memberships", "community governance"],
    recommendedNext: [
      "Add moderation, invitation, and community lifecycle depth where the current membership contract already supports it.",
      "Expose clearer integration points for notifications and portal experiences if community flows become more user-facing."
    ]
  },
  "collab-pages-core": {
    group: "Content and Experience",
    architectureRole:
      "Owns collaborative block-page records and realtime authoring surfaces so teams can use rich pages without coupling editors directly to storage, files, or auth internals.",
    focusAreas: ["collaborative pages", "block editor records", "realtime authoring"],
    recommendedNext: [
      "Deepen page versioning, permission diagnostics, and recovery flows as collaborative pages become durable business records.",
      "Clarify storage and file-attachment lifecycle guidance once embedded databases and rich media leave the baseline editor surface."
    ],
    laterOptional: [
      "Public publishing and template galleries after the collaborative record contract stabilizes."
    ]
  },
  "company-builder-core": {
    group: "Governed AI Operating Models",
    architectureRole:
      "Composes governed AI, issue, automation, workflow, and runtime primitives into operating-model packs, queues, and department-level execution surfaces.",
    focusAreas: ["operating models", "department builders", "governed AI execution"],
    recommendedNext: [
      "Deepen operating-model diagnostics and release evidence as more teams rely on company-level builders to coordinate work.",
      "Clarify pack-versioning and migration paths before broader third-party operating-model composition is introduced."
    ]
  },
  "content-core": {
    group: "Content and Experience",
    architectureRole:
      "Owns pages, posts, and content-type records so publishing and delivery workflows can share a stable content model.",
    focusAreas: ["pages", "posts", "content types"],
    recommendedNext: [
      "Deepen review and publication orchestration once content lifecycle requirements stop shifting.",
      "Add clearer search and template integration guidance where those plugin boundaries become routine."
    ]
  },
  "dashboard-core": {
    group: "Operational Data",
    architectureRole:
      "Provides the dashboard and widget backbone for operator-facing metrics, saved views, and admin summary surfaces.",
    focusAreas: ["dashboards", "widgets", "saved views"],
    recommendedNext: [
      "Expand drill-down and dashboard runtime diagnostics as more operational plugins register widgets.",
      "Add stronger cross-plugin metric contracts when dashboard composition becomes a platform-wide dependency."
    ]
  },
  "document-core": {
    group: "Content and Experience",
    architectureRole:
      "Tracks generated documents and their lifecycle so other plugins can treat document artifacts as a governed domain object.",
    focusAreas: ["document lifecycle", "generated artifacts", "governed records"],
    recommendedNext: [
      "Clarify generation pipelines and downstream archival rules as more document-producing plugins appear.",
      "Add stronger file and template integration guidance when document outputs become a common platform contract."
    ]
  },
  "document-editor-core": {
    group: "Content and Experience",
    architectureRole:
      "Provides the rich document editing surface for governed text documents while keeping editor state, files, auth, and storage integrations behind explicit plugin contracts.",
    focusAreas: ["rich documents", "editor state", "document collaboration"],
    recommendedNext: [
      "Deepen DOCX import or export diagnostics, comment workflows, and autosave recovery once document editing moves beyond baseline authoring.",
      "Clarify file, storage, and realtime collaboration boundaries as more document-producing flows adopt the editor."
    ],
    laterOptional: [
      "Template galleries, mail-merge style generation, and public review links after the editor record model stabilizes."
    ]
  },
  "execution-workspaces-core": {
    group: "AI Systems",
    architectureRole:
      "Owns realized execution workspaces, runtime service inventory, and the durable state used to operate sandboxed AI execution environments.",
    focusAreas: ["execution workspaces", "runtime services", "workspace realization"],
    recommendedNext: [
      "Deepen runtime diagnostics and lifecycle reconciliation as more AI and automation flows depend on long-lived execution environments.",
      "Add clearer infrastructure handoff guidance where external runtimes or clusters start backing these workspaces."
    ]
  },
  "files-core": {
    group: "Content and Experience",
    architectureRole:
      "Abstracts file references and storage state so upstream plugins do not need to couple directly to storage implementation details.",
    focusAreas: ["file references", "storage state", "asset metadata"],
    recommendedNext: [
      "Add richer scanning, lifecycle, and retention orchestration where file handling becomes more sensitive.",
      "Expose clearer connector guidance for external storage backends once the contract is stable."
    ]
  },
  "spreadsheet-core": {
    group: "Content and Experience",
    architectureRole:
      "Provides governed workbook records and spreadsheet editing surfaces so teams can use formulas, tables, and analysis artifacts without bypassing platform storage and access controls.",
    focusAreas: ["workbooks", "spreadsheet editor", "formula artifacts"],
    recommendedNext: [
      "Deepen workbook versioning, import or export diagnostics, and calculation recovery as spreadsheet usage becomes operational.",
      "Clarify embedded chart, pivot, and file lifecycle boundaries where workbooks become source data for dashboards or reports."
    ],
    laterOptional: [
      "Connected sheets, reusable workbook templates, and external data refresh after the core editor contract stabilizes."
    ]
  },
  "slides-core": {
    group: "Content and Experience",
    architectureRole:
      "Owns presentation deck records and slide editing surfaces so teams can create governed visual communication artifacts inside the platform shell.",
    focusAreas: ["slide decks", "presentation editor", "visual artifacts"],
    recommendedNext: [
      "Deepen deck versioning, export diagnostics, and collaborative review flows once presentations become durable customer-facing artifacts.",
      "Clarify media, template, and storage integration guidance as slide decks consume more shared platform assets."
    ],
    laterOptional: [
      "Brand-kit templates, speaker notes workflows, and publishable deck links after the baseline deck lifecycle hardens."
    ]
  },
  "forms-core": {
    group: "Content and Experience",
    architectureRole:
      "Defines the dynamic form and submission layer used by internal tools, operator flows, and self-service data collection.",
    focusAreas: ["form definitions", "submission capture", "governed input contracts"],
    recommendedNext: [
      "Expand validation and workflow coupling where form submissions drive more downstream automation.",
      "Add stronger portal and dashboard integration guidance if form-driven products become more user-facing."
    ]
  },
  "storage-core": {
    group: "Platform Backbone",
    architectureRole:
      "Owns storage backend declarations, presigned access, and backend registry orchestration so file-using plugins do not couple directly to local or cloud storage implementations.",
    focusAreas: ["storage registry", "presigned access", "backend health"],
    recommendedNext: [
      "Deepen backend health checks, lifecycle policies, and migration diagnostics as more plugins rely on durable file storage.",
      "Expose clearer adapter capability reporting and failure recovery where storage providers differ in behavior."
    ],
    laterOptional: [
      "Storage tiering, object retention policies, and cross-region replication controls after the backend contract stabilizes."
    ]
  },
  "storage-local": {
    group: "Platform Backbone",
    architectureRole:
      "Provides the local filesystem storage adapter for development, small deployments, and controlled self-hosted environments.",
    focusAreas: ["local storage adapter", "tenant directory isolation", "signed local URLs"],
    recommendedNext: [
      "Harden path, quota, and cleanup diagnostics as local storage is used outside development environments.",
      "Clarify backup and restore guidance for operators who rely on filesystem-backed storage."
    ],
    laterOptional: [
      "Filesystem quota enforcement and local object lifecycle policies after the adapter contract stabilizes."
    ]
  },
  "storage-s3": {
    group: "Platform Backbone",
    architectureRole:
      "Provides the S3-compatible storage adapter for cloud object storage without forcing higher-level plugins to learn provider-specific behavior.",
    focusAreas: ["S3 adapter", "object storage", "cloud-compatible presign"],
    recommendedNext: [
      "Deepen provider-specific diagnostics, retry policy guidance, and bucket policy validation as S3-compatible deployments broaden.",
      "Expose clearer capability flags for endpoints that differ from AWS S3 semantics."
    ],
    laterOptional: [
      "Multipart tuning, lifecycle policy templates, and cross-provider migration helpers after the adapter baseline hardens."
    ]
  },
  "whiteboard-core": {
    group: "Content and Experience",
    architectureRole:
      "Owns infinite-canvas whiteboard records and collaborative visual workspace surfaces while keeping realtime, file, and storage behavior governed by platform contracts.",
    focusAreas: ["whiteboards", "infinite canvas", "visual collaboration"],
    recommendedNext: [
      "Deepen canvas versioning, export recovery, and permission diagnostics as whiteboards become durable project artifacts.",
      "Clarify rich-media and embedded-object lifecycle guidance where canvas objects reference shared files or records."
    ],
    laterOptional: [
      "Template libraries, presentation mode, and public review links after the core canvas contract stabilizes."
    ]
  },
  "integration-core": {
    group: "AI Systems",
    architectureRole:
      "Provides the governed connector and webhook foundation used by higher-level runtimes to interact with external systems safely.",
    focusAreas: ["connectors", "webhooks", "external-system governance"],
    recommendedNext: [
      "Broaden connector depth only where the current webhook, secret, and governance contracts have already stabilized.",
      "Add stronger operator diagnostics for connector health, credential drift, and replay scenarios as usage expands."
    ]
  },
  "issues-core": {
    group: "AI Systems",
    architectureRole:
      "Defines the governed issue and work-item domain used by AI runtimes, operators, and automations to coordinate tracked execution.",
    focusAreas: ["issues", "work items", "governed execution tracking"],
    recommendedNext: [
      "Deepen workflow, notification, and AI handoff coverage as issues become a broader cross-plugin execution spine.",
      "Add stronger SLA, queue, and reconciliation surfaces once issue state becomes operationally critical."
    ]
  },
  "jobs-core": {
    group: "Platform Backbone",
    architectureRole:
      "Registers the background job definitions, queues, retry policy, and execution metadata that other plugins can target safely.",
    focusAreas: ["job definitions", "retry policy", "execution metadata"],
    nonGoals: [
      "This repo does not yet claim to be a full distributed worker runtime or broker adapter layer.",
      "It defines and governs job contracts; external execution infrastructure still sits outside the repo boundary."
    ],
    recommendedNext: [
      "Add stronger worker-runtime integration guidance and operational troubleshooting as more plugins dispatch background jobs.",
      "Expose more lifecycle telemetry once execution state becomes a first-class operator concern."
    ]
  },
  "knowledge-core": {
    group: "Content and Experience",
    architectureRole:
      "Owns the knowledge base and article tree domain that can feed retrieval, documentation, and governed knowledge experiences.",
    focusAreas: ["knowledge base", "article trees", "managed docs"],
    recommendedNext: [
      "Deepen RAG and search integration guidance where knowledge content becomes a primary retrieval source.",
      "Add richer authoring and review notes if more governed documentation flows land here."
    ]
  },
  "payments-core": {
    group: "Operational Data",
    architectureRole:
      "Provides the governed payments control plane for provider accounts, payment records, refunds, webhook ingress, and readiness reporting.",
    focusAreas: ["provider accounts", "payment records", "webhook governance"],
    recommendedNext: [
      "Deepen live provider coverage and operator reconciliation where the current framework-level payments surface proves stable.",
      "Add richer downstream analytics and notification coupling once payment lifecycle contracts settle."
    ]
  },
  "notifications-core": {
    group: "Operational Data",
    architectureRole:
      "Operates as the outbound communication control plane for deterministic local delivery, endpoint governance, preference management, and auditable attempt history.",
    focusAreas: ["message queueing", "delivery attempts", "endpoint and preference governance"],
    nonGoals: [
      "Does not currently ship live third-party connector packages in this repo.",
      "Does not export inbound email/SMS handling, campaigns, or marketing-automation workflows."
    ],
    recommendedNext: [
      "Add live provider connectors and stronger long-running delivery reconciliation once the current local-provider contract is stable.",
      "Promote the current lifecycle events and dispatch flow into richer platform orchestration surfaces where downstream plugins need them."
    ],
    laterOptional: [
      "Campaign tooling, inbound processing, and broader provider governance after the transactional substrate has matured."
    ]
  },
  "party-relationships-core": {
    group: "Operational Data",
    architectureRole:
      "Provides the canonical external-party, contact, address, and relationship write model so every business plugin can compose around one governed business identity spine.",
    focusAreas: ["party masters", "contact facets", "relationship graphs"],
    recommendedNext: [
      "Deepen dedupe, survivorship, and merge safety before more downstream commercial and financial plugins depend on party truth.",
      "Add stronger hierarchy, KYC, and localization-aware contact governance as onboarding depth increases."
    ]
  },
  "product-catalog-core": {
    group: "Operational Data",
    architectureRole:
      "Owns the shared catalog, variant, and operational default records that downstream selling, buying, inventory, and production plugins can reuse safely.",
    focusAreas: ["products", "variants", "shared defaults"],
    recommendedNext: [
      "Deepen variant, substitution, and lifecycle controls before more downstream domains treat the catalog as fixed truth.",
      "Add stronger packaging for product templates, quality defaults, and manufacturing-facing policy overlays."
    ]
  },
  "pricing-tax-core": {
    group: "Operational Data",
    architectureRole:
      "Maintains shared pricing, discount, tax, and commercial-policy rules so order, billing, and procurement flows evaluate policy from one governed source.",
    focusAreas: ["price policies", "tax rules", "commercial evaluation"],
    recommendedNext: [
      "Add richer precedence, localization, and approval evidence where pricing and tax changes start driving live operations.",
      "Clarify override, promotion, and withholding flows before sector packs build on the pricing layer."
    ]
  },
  "traceability-core": {
    group: "Operational Data",
    architectureRole:
      "Defines document lineage, common dimensions, and reconciliation surfaces so cross-plugin business effects stay visible and repairable.",
    focusAreas: ["lineage graph", "common dimensions", "reconciliation queues"],
    recommendedNext: [
      "Deepen drift detection and exception routing as more business plugins emit downstream linked work.",
      "Expose stronger operator tooling for process lineage and partial-failure recovery."
    ]
  },
  "accounting-core": {
    group: "Operational Data",
    architectureRole:
      "Owns ledger-oriented financial truth, billing posture, and reconciliation state so every upstream plugin must request finance outcomes explicitly.",
    focusAreas: ["ledger truth", "billing posture", "financial reconciliation"],
    recommendedNext: [
      "Deepen posting templates, close controls, and reversal handling before upstream domains rely on accounting intents in production.",
      "Add stronger downstream bank, tax, and subledger reconciliation coverage as the finance surface hardens."
    ]
  },
  "crm-core": {
    group: "Operational Data",
    architectureRole:
      "Owns lead, opportunity, and pre-sales readiness state so commercial handoff stays explicit before Sales becomes the demand source of truth.",
    focusAreas: ["lead intake", "opportunity state", "handoff readiness"],
    recommendedNext: [
      "Deepen scoring, routing, and handoff validation before more quote creation depends on CRM quality.",
      "Add stronger campaign and activity evidence where pre-sales governance becomes operationally significant."
    ]
  },
  "sales-core": {
    group: "Operational Data",
    architectureRole:
      "Owns quote-to-order demand truth, downstream billing requests, and fulfillment orchestration requests without leaking into stock or ledger writes.",
    focusAreas: ["quotes", "orders", "billing requests"],
    recommendedNext: [
      "Deepen amendment, return, and partial-fulfillment coverage as more downstream inventory and accounting flows depend on sales demand truth.",
      "Clarify credit, hold, and promise-date orchestration before higher-volume order flows go live."
    ]
  },
  "procurement-core": {
    group: "Operational Data",
    architectureRole:
      "Owns requisitions, sourcing outcomes, purchase commitments, and receipt expectations while leaving stock and finance truth to their owning plugins.",
    focusAreas: ["requisitions", "purchase commitments", "receipt expectations"],
    recommendedNext: [
      "Deepen sourcing, tolerance, and exception handling before more warehouse and financial flows depend on procurement commitments.",
      "Add stronger scorecard and substitution support where supplier governance becomes critical."
    ]
  },
  "inventory-core": {
    group: "Operational Data",
    architectureRole:
      "Owns physical stock, reservations, transfers, and reconciliation state so warehouse truth remains explicit and durable.",
    focusAreas: ["stock truth", "reservations", "movement reconciliation"],
    recommendedNext: [
      "Deepen warehouse execution, counting, and discrepancy handling before more downstream operational flows depend on inventory truth.",
      "Add stronger negative-stock, transfer, and quality-state enforcement where physical operations become denser."
    ]
  },
  "projects-core": {
    group: "Operational Data",
    architectureRole:
      "Owns project execution, milestone progress, and delivery-driven billing readiness without collapsing into sales or accounting truth.",
    focusAreas: ["project execution", "milestones", "billing readiness"],
    recommendedNext: [
      "Deepen budget, change, and timesheet-aware delivery flows before project-backed billing becomes production critical.",
      "Add stronger portfolio and commitment views where multi-project delivery coordination matters."
    ]
  },
  "support-service-core": {
    group: "Operational Data",
    architectureRole:
      "Owns ticket, service-order, and SLA state so service operations remain explicit and auditable across intake, execution, and billing readiness.",
    focusAreas: ["tickets", "service orders", "sla state"],
    recommendedNext: [
      "Deepen entitlement, escalation, and spare-consumption coverage before service operations depend on the boundary in production.",
      "Add stronger omnichannel intake and operator recovery paths where support becomes a primary customer workflow."
    ]
  },
  "pos-core": {
    group: "Operational Data",
    architectureRole:
      "Owns POS sessions, receipt journals, and sync or closeout exception state while handing settled stock and finance effects downstream explicitly.",
    focusAreas: ["sessions", "receipt journals", "sync reconciliation"],
    recommendedNext: [
      "Deepen offline replay, cashier variance, and settlement controls before broader retail deployment.",
      "Add stronger loyalty, payment, and omnichannel bridge guidance once the session boundary stabilizes."
    ]
  },
  "manufacturing-core": {
    group: "Operational Data",
    architectureRole:
      "Owns BOM, routing, work-order, and WIP state so production truth remains explicit and separate from inventory or accounting outcomes.",
    focusAreas: ["boms", "work orders", "wip"],
    recommendedNext: [
      "Deepen production variance, subcontracting, and rework handling before the manufacturing boundary is treated as production-grade.",
      "Add stronger planning and quality integration contracts where plant execution depends on them daily."
    ]
  },
  "quality-core": {
    group: "Operational Data",
    architectureRole:
      "Owns inspections, nonconformance, release holds, and CAPA state so conformity and remediation decisions remain first-class business truth.",
    focusAreas: ["inspections", "quality holds", "capa"],
    recommendedNext: [
      "Deepen hold or release, deviation approval, and CAPA closure handling before more stock and production flows rely on the quality boundary.",
      "Add stronger sampling and evidence packaging for regulated operational contexts."
    ]
  },
  "assets-core": {
    group: "Operational Data",
    architectureRole:
      "Owns fixed-asset register and lifecycle posture so capitalization, custody, transfer, and disposal work stay explicit and governed.",
    focusAreas: ["asset register", "depreciation posture", "custody transfers"],
    recommendedNext: [
      "Deepen book, depreciation, and custody controls before the asset boundary feeds finance and operations in production.",
      "Add stronger audit and verification tooling where physical asset campaigns depend on the register."
    ]
  },
  "hr-payroll-core": {
    group: "Operational Data",
    architectureRole:
      "Owns workforce, leave, and payroll state so people and compensation truth remain governed before downstream finance or delivery consumption.",
    focusAreas: ["employees", "payroll runs", "leave state"],
    recommendedNext: [
      "Deepen retro, rerun, and payout-failure handling before payroll moves beyond scaffold coverage.",
      "Add stronger attendance, benefits, and sensitive-data governance as the HR surface hardens."
    ]
  },
  "org-tenant-core": {
    group: "Platform Backbone",
    architectureRole:
      "Maintains the tenant and organization graph so the rest of the ecosystem can reason about ownership and isolation consistently.",
    focusAreas: ["tenant graph", "organization graph", "isolation boundaries"],
    recommendedNext: [
      "Add richer tenant lifecycle and reconciliation guidance where provisioning and billing start depending on the graph.",
      "Expose clearer cross-plugin event guidance if tenant changes must trigger downstream automation."
    ]
  },
  "page-builder-core": {
    group: "Operational Data",
    architectureRole:
      "Provides the builder-canvas and layout/block domain used to compose editable page structures with governed admin entrypoints.",
    focusAreas: ["builder canvas", "layout blocks", "admin editing surface"],
    recommendedNext: [
      "Deepen publication, preview, and template workflows once the builder contract is stable across more page types.",
      "Add clearer content, asset, and portal integration patterns where page assembly becomes more operationally critical."
    ]
  },
  "contracts-core": {
    group: "Operational Data",
    architectureRole:
      "Owns long-running agreement, entitlement, and billing-schedule truth so recurring or governed commercial commitments stay explicit.",
    focusAreas: ["contracts", "entitlements", "billing schedules"],
    recommendedNext: [
      "Deepen amendment, renewal, and entitlement exception handling as more commercial flows rely on contracts as a primary boundary.",
      "Clarify downstream accounting and service entitlement handoff rules before higher-volume recurring operations go live."
    ]
  },
  "subscriptions-core": {
    group: "Operational Data",
    architectureRole:
      "Owns recurring plan, cycle, and renewal truth for subscription businesses instead of burying recurrence inside orders or invoices.",
    focusAreas: ["subscription plans", "billing cycles", "renewals"],
    recommendedNext: [
      "Deepen pause, resume, arrears, and dunning-oriented lifecycle coverage as recurring revenue use cases expand.",
      "Clarify renewal and proration handoff rules before financial automation depends on the subscription cycle contract."
    ]
  },
  "business-portals-core": {
    group: "Content and Experience",
    architectureRole:
      "Projects governed business records into customer, vendor, and employee self-service workspaces without taking ownership away from source plugins.",
    focusAreas: ["self-service portals", "business projections", "portal actions"],
    recommendedNext: [
      "Deepen portal-specific workflow and approval guidance as more business plugins expose self-service actions.",
      "Add stronger projection freshness and reconciliation diagnostics where portals become operationally critical."
    ]
  },
  "field-service-core": {
    group: "Operational Data",
    architectureRole:
      "Owns dispatch, visit execution, and parts-request coordination for on-site service work while keeping inventory and accounting boundaries explicit.",
    focusAreas: ["dispatch", "field visits", "spare-parts requests"],
    recommendedNext: [
      "Deepen technician mobility, offline follow-up, and completion-proof flows as field execution becomes more demanding.",
      "Clarify downstream inventory, billing, and entitlement orchestration before higher-volume service dispatch goes live."
    ]
  },
  "maintenance-cmms-core": {
    group: "Operational Data",
    architectureRole:
      "Owns preventive maintenance plans, work orders, and asset-health posture for maintenance-led operations.",
    focusAreas: ["maintenance plans", "asset work orders", "asset health"],
    recommendedNext: [
      "Deepen downtime, inspection, and preventive scheduling coverage as more asset-intensive flows rely on the maintenance contract.",
      "Clarify support, inventory, and asset-reconciliation handoffs before broader CMMS usage expands."
    ]
  },
  "treasury-core": {
    group: "Operational Data",
    architectureRole:
      "Owns treasury-side cash posture, banking operations, and liquidity forecasting as a finance boundary distinct from ledger truth.",
    focusAreas: ["cash position", "banking", "liquidity forecasting"],
    recommendedNext: [
      "Deepen bank-statement, payout, and forecast-variance coverage where treasury work becomes daily operator activity.",
      "Clarify accounting and payments handoffs before live treasury automation depends on this contract."
    ]
  },
  "e-invoicing-core": {
    group: "Operational Data",
    architectureRole:
      "Owns electronic invoice preparation, submission posture, and statutory reconciliation without taking financial ownership away from accounting.",
    focusAreas: ["e-invoice preparation", "submission status", "statutory reconciliation"],
    recommendedNext: [
      "Deepen jurisdiction-specific rejection, replay, and archive flows as more country packs depend on this plugin.",
      "Clarify accounting and tax handoff boundaries before statutory automation becomes production-critical."
    ]
  },
  "analytics-bi-core": {
    group: "Operational Data",
    architectureRole:
      "Owns governed datasets, KPI models, and warehouse-sync posture so heavy analytics does not sprawl into transactional plugins.",
    focusAreas: ["datasets", "KPIs", "warehouse sync"],
    recommendedNext: [
      "Deepen dataset versioning, refresh controls, and warehouse-failure diagnostics as analytics usage broadens.",
      "Clarify dashboard and BI integration contracts before more consumers depend on the shared dataset layer."
    ]
  },
  "ai-assist-core": {
    group: "AI Systems",
    architectureRole:
      "Provides bounded AI summaries, triage suggestions, and anomaly-review state for business teams without making AI the source of truth.",
    focusAreas: ["assist summaries", "triage suggestions", "anomaly review"],
    recommendedNext: [
      "Deepen review, feedback, and rollback flows as more operators use AI assistance in production workflows.",
      "Clarify domain-specific guardrails and downstream action policies before automated assist paths broaden."
    ]
  },
  "portal-core": {
    group: "Operational Data",
    architectureRole:
      "Defines the self-service portal entry surface and the contract for portal-aware resources and actions.",
    focusAreas: ["portal shell", "self-service entrypoints", "portal-aware resources"],
    recommendedNext: [
      "Broaden portal workflow depth as more operational plugins expose self-service actions.",
      "Add stronger role-aware navigation and lifecycle guidance once the portal surface matures beyond the baseline shell."
    ]
  },
  "role-policy-core": {
    group: "Platform Backbone",
    architectureRole:
      "Owns RBAC and ABAC policy records so access decisions stay governed and inspectable across the ecosystem.",
    focusAreas: ["roles", "policies", "access governance"],
    recommendedNext: [
      "Add clearer downstream enforcement patterns and policy-drift diagnostics when more plugins consume these rules directly.",
      "Expose explicit policy lifecycle events if cross-plugin automation depends on role or grant changes."
    ]
  },
  "runtime-bridge-core": {
    group: "AI Systems",
    architectureRole:
      "Bridges governed platform workflows into external runtimes and service boundaries without leaking orchestration assumptions into every plugin.",
    focusAreas: ["runtime bridges", "service handoff", "governed orchestration"],
    recommendedNext: [
      "Deepen runtime observability and failure recovery patterns as more production workflows depend on bridge handoffs.",
      "Clarify adapter stability and compatibility boundaries before expanding bridge coverage further."
    ]
  },
  "search-core": {
    group: "Operational Data",
    architectureRole:
      "Defines the search index and query contract that other plugins can target without hard-coding a single search backend.",
    focusAreas: ["search indexes", "query contracts", "typed retrieval"],
    recommendedNext: [
      "Broaden indexing and result-ranking guidance once more plugins depend on the search contract.",
      "Add clearer ingestion and refresh orchestration patterns where stale search state becomes operationally significant."
    ]
  },
  "template-core": {
    group: "Content and Experience",
    architectureRole:
      "Maintains reusable templates for content, messaging, and workflow-centric generation across the ecosystem.",
    focusAreas: ["content templates", "message templates", "workflow templates"],
    recommendedNext: [
      "Clarify template versioning and publication patterns once more plugins depend on shared templates.",
      "Add deeper coupling guidance for content, notifications, and workflow consumers."
    ]
  },
  "user-directory": {
    group: "Operational Data",
    architectureRole:
      "Projects people and directory data into a stable domain contract that other plugins can search, reference, and render.",
    focusAreas: ["directory records", "people projection", "searchable identities"],
    recommendedNext: [
      "Add stronger sync, reconciliation, and lifecycle guidance if the directory becomes the source for external systems.",
      "Clarify auth and org-tenant integration patterns where directory state drives access or communications."
    ]
  },
  "workflow-core": {
    group: "Platform Backbone",
    architectureRole:
      "Defines explicit workflow state machines and approval models so business processes stay inspectable instead of hiding in ad hoc hooks.",
    focusAreas: ["workflow definitions", "approval states", "transition rules"],
    recommendedNext: [
      "Add richer execution-state and replay guidance if more plugins adopt workflow-driven orchestration.",
      "Expose tighter integration patterns with jobs and notifications when human approvals start driving more automation."
    ],
    laterOptional: [
      "Visual editors or migration helpers for workflow definitions once the current state-machine contract hardens."
    ]
  }
};

export function getProfile(pluginId) {
  const profile = pluginProfiles[pluginId];
  if (!profile) {
    throw new Error(`Missing plugin profile for '${pluginId}'.`);
  }

  return {
    ...groupDefaults[profile.group],
    ...profile,
    nonGoals: [...(groupDefaults[profile.group]?.nonGoals ?? []), ...(profile.nonGoals ?? [])],
    recommendedNext: [...(profile.recommendedNext ?? []), ...(groupDefaults[profile.group]?.recommendedNext ?? [])],
    laterOptional: [...(profile.laterOptional ?? []), ...(groupDefaults[profile.group]?.laterOptional ?? [])]
  };
}
