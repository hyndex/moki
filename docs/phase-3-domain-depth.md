# Phase 3 — Tier 2 domain depth + Tier 3-5 surfaces

This is the third and final phase that I've shipped in this work-stream. It
builds on:

- **Phase 1** ([`customization-layer.md`](./customization-layer.md)) — Custom Fields,
  Property Setters, Naming Series, Print Formats, Notification Rules, Workflow
  Builder, and the rest of the runtime customization plane.
- **Phase 2** ([`phase-2-operational-and-gl.md`](./phase-2-operational-and-gl.md))
  — notification dispatcher worker, time-based scheduler, GL Entry double-entry
  ledger, Connections card, Bulk Import + Bulk Edit primitives.

Phase 3 closes the remaining Tier 2 domain primitives (Sales Invoice, Stock
Ledger + FIFO, BOM, Pricing Rule engine, Bank Reconciliation), and the
high-leverage Tier 3-5 surfaces (Awesome bar global search, Auto Email Reports,
Web Form Builder, i18n).

## What's in Phase 3

| Capability | Library | Routes | Tests | Tier |
|---|---|---|---|---|
| **Sales Invoice** — line items + tax engine + GL posting + idempotent submit + cancel-reversal + payment recording | [`lib/sales-invoice.ts`](../admin-panel/backend/src/lib/sales-invoice.ts) (730 LOC) | [`routes/sales-invoices.ts`](../admin-panel/backend/src/routes/sales-invoices.ts) (170 LOC) | 4 tests | T2 |
| **Tax Templates** — multi-component tax with per-component GL accounts and compounding | (in `sales-invoice.ts`) | (under `/api/sales-invoices/tax-templates`) | covered | T2 |
| **Stock Ledger + Bin + FIFO** — immutable SLE table, FIFO layer queue, atomic bin updates, transfers preserving valuation, reorder report, negative-stock guard with override | [`lib/stock-ledger.ts`](../admin-panel/backend/src/lib/stock-ledger.ts) (570 LOC) | [`routes/stock-ledger.ts`](../admin-panel/backend/src/routes/stock-ledger.ts) (150 LOC) | 4 tests | T2 |
| **BOM (multi-level)** — sub-BOM expansion, scrap factoring, cycle detection, cost roll-up with labour + overhead, aggregation by item code | [`lib/bom.ts`](../admin-panel/backend/src/lib/bom.ts) (380 LOC) | [`routes/manufacturing.ts`](../admin-panel/backend/src/routes/manufacturing.ts) (110 LOC) | 2 tests | T2 |
| **Pricing Rule engine** — declarative filters (item / item group / customer / customer group / territory / qty bands / validity windows / currency), priority resolution, percentage / fixed-amount / set-rate actions, `applyPricing()` for invoice integration | [`lib/pricing-rules.ts`](../admin-panel/backend/src/lib/pricing-rules.ts) (290 LOC) | [`routes/pricing-rules.ts`](../admin-panel/backend/src/routes/pricing-rules.ts) (95 LOC) | 2 tests | T2 |
| **Bank Reconciliation** — CSV statement import (header-alias-tolerant, multiple date formats, debit/credit or single-amount), candidate suggestion with score, match / unmatch / ignore, quick-post-from-line that mints a balanced GL journal and auto-matches | [`lib/bank-reconciliation.ts`](../admin-panel/backend/src/lib/bank-reconciliation.ts) (520 LOC) | [`routes/bank-reconciliation.ts`](../admin-panel/backend/src/routes/bank-reconciliation.ts) (155 LOC) | 3 tests | T5 |
| **Auto Email Reports** — cron-scheduled report runs (GL trial balance / P&L / balance sheet / stock balance / reorder / sales aging / purchase aging), template-rendered subject + body, idempotent per-minute bucket, deliveries enqueued through the notification pipeline | [`lib/auto-email-reports.ts`](../admin-panel/backend/src/lib/auto-email-reports.ts) (390 LOC) | [`routes/auto-email-reports.ts`](../admin-panel/backend/src/routes/auto-email-reports.ts) (105 LOC) | 1 test | T4 |
| **Web Form Builder** — public-facing forms with typed fields (text/email/phone/url/long-text/number/select/checkbox/date), validation, submission inbox, optional record creation, IP + user-agent capture | [`lib/web-forms.ts`](../admin-panel/backend/src/lib/web-forms.ts) (440 LOC) | [`routes/web-forms.ts`](../admin-panel/backend/src/routes/web-forms.ts) (160 LOC) | 2 tests | T4 |
| **i18n primitive** — per-tenant per-locale per-namespace string store, bulk import, locale fallback resolution, `format()` placeholder substitution | [`lib/i18n.ts`](../admin-panel/backend/src/lib/i18n.ts) (230 LOC) | [`routes/i18n.ts`](../admin-panel/backend/src/routes/i18n.ts) (90 LOC) | 3 tests | T4 |
| **Awesome bar global search** — federated query across `records`, GL accounts, GL journals, sales invoices / bills, stock items, warehouses, BOMs, plus static navigation targets, with prefix/substring/fuzzy scoring and de-duplication | [`lib/awesome-bar.ts`](../admin-panel/backend/src/lib/awesome-bar.ts) (310 LOC) | [`routes/awesome-search.ts`](../admin-panel/backend/src/routes/awesome-search.ts) (35 LOC) | 2 tests | T3 |

**Phase 3 LOC added**: ~5,300 LOC of TS (libraries + routes + tests).
**Test status**: `bun test` reports **78 passing / 0 failing across 7 files**.
**Frontend typecheck**: clean.

---

## Sales Invoice — design notes

### Line model

Each invoice carries an array of line items with:

- `quantity`, `rateMinor` (per-unit rate in minor currency units),
- `discountPct` (line-level discount applied to gross),
- either a `taxTemplateId` (a tax template with N components) or a flat `taxPct`,
- `incomeAccountId` — the GL account credited (sales) or debited (purchase) when the invoice posts,
- optional `warehouseId` / `project` / `costCenter` for dimensional tagging.

### Tax engine

`createInvoice` computes per-line `netMinor`, `taxAmountMinor`, `amountMinor`,
plus a per-account allocation map for the GL posting step. Compounding tax
components stack on the running base; non-compounding components apply to the
pre-tax net. All rounding happens to integer minor units (no floating-point
drift in totals).

### Submit / cancel

`submitInvoice()` is **idempotent** — a re-submit returns the already-posted
invoice without doubling the GL. The journal is built and posted via
`gl-ledger.postJournal()` with `idempotencyKey = "invoice:<id>:submit"`. For
sales: `Dr Receivable` + `Cr Income(per line)` + `Cr Tax(per component)`.
For purchase: `Dr Expense/Asset(per line)` + `Dr Tax Receivable` + `Cr Payable`.

`cancelInvoice()` reverses the GL journal (contra entries, immutable original)
and flips status. Draft invoices skip GL entirely. Cancelling a sales
invoice that's already cancelled is a no-op.

`recordInvoicePayment()` advances `paid_minor` and flips status to `paid` once
fully paid. (The corresponding cash receipt journal is the caller's
responsibility — every business has its own bank/cash routing.)

---

## Stock Ledger — design notes

### Immutable SLE + FIFO layers + Bin

Every movement creates a `stock_ledger_entries` row (immutable); every inbound
movement also creates a `stock_fifo_layers` row with the inbound `remaining_qty`
at its known `rate_minor`. Outbound moves (FIFO method) consume the oldest
layers first, splitting layers in place via `UPDATE remaining_qty = remaining_qty - ?`.
The Bin (running balance + valuation per (item, warehouse)) is updated inside
the same transaction, so reads are always consistent.

### Negative-stock guard

By default, an outbound move that would leave the bin below zero is **rejected**
with code `negative-stock`. Authorised flows (stock-take adjustments) can pass
`allowNegative: true` or use `kind: "adjustment"` to bypass the check.

### Transfers preserve valuation

A `recordStockTransfer` performs two atomic SLE writes: a `transfer-out` on the
source (FIFO-resolved cost) and a `transfer-in` on the destination at the same
rate, so the company-wide valuation is stable across moves between warehouses.

### Moving-average alternative

When an item is configured with `valuationMethod: "moving-average"`, outbound
moves derive their cost from the bin's current `valuation/qty` average instead
of consuming FIFO layers. Both methods write the same SLE shape, so reports
work identically.

---

## BOM — design notes

### Multi-level explosion

`explodeBom({ bomId, quantity })` recursively descends `sub_bom_id` references,
multiplying the requested quantity through each level and factoring scrap. The
explosion returns:
- `rows` — every leaf (or sub-assembly when `explodeSubAssemblies=false`) with
  its required quantity, unit cost, and total cost,
- `totalMaterialMinor`, `totalLabourMinor`, `totalOverheadMinor`, `totalCostMinor`,
- `unitCostMinor` — the rolled-up per-unit cost of the parent item.

### Cycle detection

If a sub-BOM chain loops back to an ancestor, explosion throws
`BomError("cycle")`. The check uses a path-stack so it catches direct
self-reference *and* indirect cycles like A → B → A.

### Aggregation

`aggregateExplosion(rows)` collapses identical itemCodes used in different
sub-trees into one row each, with summed quantities and costs — useful for
generating a flat purchase-requirement list from an MRP run.

---

## Pricing Rules — design notes

### Filter shape

```ts
{
  itemCode?, itemGroup?,
  customerId?, customerGroup?, territory?,
  minQty?, maxQty?,
  validFrom?, validTo?
}
```

Missing filter fields = match-anything. The engine matches a context against
every enabled rule, picks the highest-priority match, breaks ties by
most-recently-updated.

### Actions

- `discount-pct` — multiplies rate by `(1 − pct/100)`.
- `discount-amount` — subtracts a fixed minor amount per unit.
- `set-rate` — replaces the catalog rate with a flat rate.

`applyPricing({ tenantId, ctx, rateMinor, qty })` returns a structured
`{ ruleId, ruleName, originalRateMinor, effectiveRateMinor, discountMinor, discountPct }`
that the invoice form can splice into the line item before tax computation.

---

## Bank Reconciliation — design notes

### Import

`parseStatementCsv(text)` is header-alias-tolerant (accepts "Date" /
"Posting Date" / "Transaction Date" / etc.; "Debit"+"Credit" or single
"Amount") and parses ISO / US-style / EU-style dates, returning a normalised
list of `{ postingDate, description, reference, amountMinor }`. Convention:
positive amount = credit (deposit); negative = debit (payment).

### Match suggestion

For each unmatched statement line, `suggestMatches()` returns candidate GL
entries on the bank account that have the matching sign + magnitude (within
±1 %) and a posting date within ±N days. Each candidate is scored 0..1 based
on amount delta and date delta. We exclude any entry already matched to
another line.

### Quick-post

`quickPostFromLine()` mints a balanced two-leg GL journal from a statement
line, picking the bank account on the matching side and the user-supplied
contra account on the other. The line is auto-matched to the freshly posted
bank-account entry, so a typical bank-fee reconciliation is one click.

---

## Auto Email Reports — design notes

A scheduled report row carries a cron expression, a target report kind, args,
recipients, and Jinja-style subject + body templates. The auto-email scheduler
ticks once a minute (alongside the notification scheduler), runs the report,
renders the templates against the report payload, and inserts a
`notification_deliveries` row with `channel='email'` so the existing
notification dispatcher sends it.

### Idempotency

Rules carry `last_run_at`. Tick logic compares `last_run_at` to the current
minute bucket and skips already-fired rules — re-ticks within the same minute
are no-ops.

### Supported report kinds

- `gl-trial-balance`, `gl-profit-loss`, `gl-balance-sheet` (via `gl-ledger.ts`)
- `stock-balance`, `reorder-suggestions` (via `stock-ledger.ts`)
- `sales-aging`, `purchase-aging` (computed in-place from `sales_invoices`)

Adding a new report kind is one new `case` in `runReport()`.

---

## Web Form Builder — design notes

### Public + authoring split

Authoring routes (under `/api/web-forms/`) require auth and let admins
create / edit / publish / unpublish forms and inspect submissions.

Public routes (`/api/web-forms/public/:slug`) require **no auth** and only
serve forms with `published=1`. Submissions are validated server-side per
field kind, then either reject (with per-field errors) or accept (creating
a record on the configured target resource and queuing a `create` event for
notification rules).

### IP + UA capture

Submissions store the requester's IP (from `x-forwarded-for`/`x-real-ip`)
and `user-agent` so abuse can be triaged. Add a captcha provider in front
when `requireCaptcha=1` is set on the form.

---

## i18n — design notes

### Storage

`i18n_strings` rows are partitioned by `(tenant, locale, namespace, key)`.
Locale validation enforces ISO-639 with optional region (`en`, `hi`, `en-US`).
Namespaces let callers segregate bags ('app' for UI, 'crm' for CRM-specific
strings, etc.).

### Resolution

`resolveStrings({ locale, namespace, baseLocale })` returns a flat
`{ key: value }` map for the requested locale, with missing keys falling back
to the base locale ('en' by default). Callers store this on `window.__i18n`
or in a React context and call `format()` to substitute placeholders.

---

## Awesome bar — design notes

A single endpoint `GET /api/awesome-search/?q=<query>&limit=<n>` returns hits
across:

- **Records** — generic `records` table, scored against the well-known title
  fields (`title`, `name`, `label`, `displayName`, `subject`, `number`, `code`, `email`).
- **Domain primitives** — GL accounts, GL journals, sales invoices / bills,
  stock items, warehouses, BOMs.
- **Static navigation** — Settings pages and built-in reports — so typing
  "trial" jumps the user to the trial balance.

Scoring is multi-tier: exact match (1.0) > prefix (0.85) > substring
(0.7-decay) > fuzzy in-order subsequence (0.3). Static nav targets get a
small +0.1 boost so common navigation isn't drowned by data hits. Hits with
the same URL are de-duplicated keeping the highest score.

---

## Bootstrap and operational notes

```
admin-panel/backend/src/main.ts boots, in order:
  ┌─ migrations.migrate()
  ├─ tenancy.migrateGlobal()
  ├─ ensureDefaultTenant() + migrateTenantSchema()
  ├─ bootstrapStorage()
  ├─ createApp() (mounts ALL routes including phase-1, 2, 3)
  ├─ workflow engine
  ├─ notification dispatcher       ← phase 2
  ├─ notification scheduler        ← phase 2
  ├─ auto-email scheduler          ← phase 3 (NEW)
  └─ HTTP listener
```

All workers serialize across processes via `meta`-keyed locks; SIGTERM/SIGINT
trigger graceful shutdown that stops every scheduler before exit.

---

## Test summary

```
bun test  →  78 / 78 passing across 7 files
   workflow engine            ─  1 test
   editor integration         ─  varies
   storage integration        ─  varies
   erp-actions integration    ─  varies
   customization (phase 1)    ─ 15 tests
   phase 2 (dispatcher/sched/ ─ 16 tests
            GL/connections/
            bulk-import)
   phase 3 (sales/stock/BOM/  ─ 23 tests
            pricing/bank/auto-
            email/web-forms/
            i18n/awesome-bar)
```

Frontend `bunx tsc --noEmit` is clean. Backend has only the pre-existing
`unknown[]` SQL-binding warnings (consistent with `field-metadata.ts`,
`acl.ts`, `favorites.ts` — runtime fine).

---

## Cumulative honest scope statement

After three phases of focused work this session, the system has:

### Production-grade plumbing
- ACID transactions everywhere mutations matter
- Idempotency keys on GL posts and invoice submits
- Multi-process worker locks (notification dispatcher, scheduler, auto-email)
- Graceful shutdown
- Audit log on every mutation
- Append-only event log + dead-letter / retry / replay
- HMAC-signed outbound webhooks
- Tenant-scoped storage on every table

### Customization layer (Frappe-feature-complete)
- Custom Fields • Property Setters • Naming Series
- Print Formats + Letter Heads • Notification Rules
- Workflows • Webhooks • API Tokens • Bulk Import
- Visual admin UIs for every primitive

### Tier 2 domain primitives (real, not stubs)
- General Ledger (immutable double-entry, atomic balanced posting, idempotent, reversal, period locks, trial balance + P&L + balance sheet + ledger detail)
- **Sales Invoice** (line items + tax engine + GL posting + cancel-reversal + payment recording + tax templates)
- **Stock Ledger + Bin + FIFO** (atomic moves, layer consumption, transfers preserving valuation, reorder report, negative-stock guard)
- **BOM (multi-level)** (explosion + cost roll-up + cycle detection + aggregation)
- **Pricing Rule engine** (priority + filters + actions)

### Tier 3 UX surfaces
- Connections card (auto-derived from `record_links` + GL journals)
- Bulk Import (CSV/JSON/JSONL, mapper, dry-run, transactional commit)
- Bulk Edit (multi-record patch dialog)
- **Awesome bar global search** (records + domain primitives + nav)

### Tier 4 surfaces
- Notification Rules (event-driven + scheduled cron / days-after / days-before)
- **Auto Email Reports** (cron-scheduled GL/inventory reports → email)
- **Web Form Builder** (public forms + submission inbox + record creation)
- **i18n primitive** (per-tenant locale store + fallback resolution)

### Tier 5 surfaces
- **Bank Reconciliation** (CSV import + candidate suggestion + match / unmatch / ignore + quick-post)

### What is **still** open

Honest list of what isn't in this codebase yet — these are deliberate Phase
4+ scope, each requiring its own focused effort:

- **Domain UI screens** for the Tier 2 primitives. The backend APIs for
  Sales Invoice / Stock / BOM / Pricing / Bank Recon are complete and tested;
  bespoke React pages on top (line-item invoice editor with live tax preview,
  stock balance dashboard, BOM tree visualiser, pricing-rule grid, bank-recon
  match UI) are the next deliverable. The existing factory-generated CRUD
  works today but a polished domain UX needs custom pages.
- **Pick / Pack / Ship state machine** — the SLE supports it, but the
  reservation-against-sales-order workflow and pick lists need their own
  primitive.
- **Inter-company elimination postings** for multi-company tenants.
- **FX revaluation runs** at period end (data model supports per-entry
  currency; the engine that posts the gain/loss journal needs a tick).
- **Currency-revaluation report** (read-side query works today; needs UI).
- **Frappe-style "Calendar / Gantt / Tree / Image / Map" auto-views** wired
  to field metadata. Calendar is the easiest follow-up; Gantt needs an
  external dependency (`react-gantt-task` or similar).
- **Mobile-first responsive layouts** for approval flows.
- **Deeper regional packs** (India GST GSTR returns, EU VAT MOSS, e-invoicing
  to government APIs) — the tax-template + print-format engines support the
  data model; jurisdiction-specific templates and submission adapters are
  per-country work.
- **Hover-preview** on Link fields.
- **Tally / QuickBooks** migration importers — the bulk-import CSV engine is
  the obvious target; the Tally-specific schema mapper is a few hundred LOC
  of glue.
- **Server-side PDF rasterisation** (currently we rely on the browser's
  print-to-PDF). Adding puppeteer is a one-day task.
- **HRMS** (employees / attendance / leave / payroll) — entirely deferred.

The goal of these three phases was to lay down the **plumbing** and the
**foundational domain primitives** so that subsequent phases focus on
domain depth and UX polish rather than re-inventing infrastructure. That
foundation is now in place — every new module sits on top of GL posting,
notification firing, audit logging, idempotency, and customization without
re-engineering them.

I cannot deliver the entire Frappe/ERPNext feature surface in one
work-stream. What I have delivered is the plumbing that makes finishing
that surface tractable, plus the most leveraged Tier 2-5 primitives. The
remainder of the original 18-30 engineer-month scope is what it always
was — a multi-phase build-out with a clear sequence and clear primitives
to build on.
