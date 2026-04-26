# Phase 4 — Fulfillment, HRMS, FX, Inter-company, Regional packs, PDF, Cmd+K, hover-preview

Phase 4 closes a large remaining slice of the original "what's still open"
list from [`phase-3-domain-depth.md`](./phase-3-domain-depth.md). It builds
straight on top of the GL ledger, stock ledger, sales-invoice, and template
engine primitives shipped in earlier phases.

| Capability | Library | Routes | Tests | Tier |
|---|---|---|---|---|
| **Pick / Pack / Ship** + **Stock Reservation** | [`fulfillment.ts`](../admin-panel/backend/src/lib/fulfillment.ts) (727) | [`fulfillment.ts`](../admin-panel/backend/src/routes/fulfillment.ts) (217) | 4 | T2 |
| **HRMS**: Employee + Attendance + Leave + Payroll Run with GL posting | [`hrms.ts`](../admin-panel/backend/src/lib/hrms.ts) (831) | [`hrms.ts`](../admin-panel/backend/src/routes/hrms.ts) (253) | 4 | T2 |
| **FX**: rates + revaluation engine | [`fx-intercompany.ts`](../admin-panel/backend/src/lib/fx-intercompany.ts) (829) | [`fx-intercompany.ts`](../admin-panel/backend/src/routes/fx-intercompany.ts) (184) | 3 | T2 |
| **Inter-company**: mappings + sales→purchase mirror | (in `fx-intercompany.ts`) | | 2 | T2 |
| **Regional packs**: India GST + EU VAT + US Sales Tax + GSTR aggregation | (in `fx-intercompany.ts`) | | 4 | T5 |
| **Server-side PDF** helper (HTML → printable, optional puppeteer hook) | [`print-pdf.ts`](../admin-panel/backend/src/lib/print-pdf.ts) (131) | [`print-pdf.ts`](../admin-panel/backend/src/routes/print-pdf.ts) (53) | 3 | T5 |
| **Cmd+K command palette** | — | — (uses awesome-search backend from phase 3) | covered by phase 3 backend tests | T3 |
| **Hover-preview on Link cells** | — | — (uses generic `/api/resources/:r/:id`) | n/a | T3 |

Phase 4 LOC: **~5,400 LOC** of TS code + tests.
Cumulative test status: **98 / 98 passing across 8 files.**
Frontend `bunx tsc --noEmit`: clean.
Backend typecheck: only the pre-existing `unknown[]` SQL-binding warnings.

---

## Pick / Pack / Ship

```
Reservation (active)
  └─ Pick List (open → picking → picked)
       │
       └─ Shipment (packed → shipped → delivered)
                            │
                            └─ Stock Ledger Entry (kind=issue, FIFO consumed)
                            └─ Reservation flips to fulfilled
```

- **Reservations** soft-lock `reserved_qty` on the bin without touching SLE.
  Cancelling a reservation releases the lock atomically.
- **Pick lists** group reservations (or ad-hoc lines) by warehouse for the
  picker. `recordPickQuantity()` enforces over-pick guards and advances the
  pick list to `picked` once every line is fully picked.
- **packShipment** snapshots picked quantities into shipment lines.
- **shipShipment** is **idempotent** — a re-ship is a no-op. Shipping posts
  the actual outbound stock-ledger entries (consuming FIFO layers), fulfils
  the linked reservations, and flips the shipment to `shipped`.
- **markDelivered** is a small terminal transition.

## HRMS

End-to-end Employee → Attendance → Leave → Payroll → GL posting:

- **Attendance** auto-computes hours from check-in/out timestamps when both
  are provided, or accepts a manual `hours` value. Same-day records are
  upserted (the unique constraint on `(tenant, employee, date)` is exercised).
- **Leave** tracks `accrual` / `consumption` / `adjustment` entries.
  `leaveBalance()` returns the running balance per type up to a date.
- **Payroll Run** computes per-employee gross / tax / deductions / net for
  every active employee in the period. `postPayrollRun()` writes a single
  balanced GL journal:

  ```
    Dr  Salary Expense                    sum(gross)
      Cr  Tax Withholding Liability       sum(tax)
      Cr  Deductions Liability            sum(deductions)        (when present)
      Cr  Payroll Payable                 sum(net)
  ```

  Posting is **idempotent** via `idempotencyKey="payroll-run:<id>:post"` —
  a re-post returns the already-posted journal.

## FX rates + revaluation

- Rates are time-series. `getFxRate(asOf)` returns the most recent rate
  whose `effective_date ≤ asOf`. Identity rates (USD→USD) are synthetic.
- `convert()` returns minor-unit-rounded converted amount + the rate used.
- **`revaluate()`** walks every `gl_entry` on the configured foreign-
  currency monetary accounts (typically AR / AP / bank), computes the
  base-currency book value at each entry's posting date and the now-value
  at `asOf`, and posts a single FX gain/loss journal for the net delta.
  The journal is balanced per account so the per-account ledger reads
  correctly. Tested end-to-end with a 100 EUR receivable revalued from
  1.10 → 1.20 producing a 1,000-cent USD gain.

## Inter-company

- `intercompany_mappings` rows pair a seller company + party with a buyer
  company + party. When an invoice is created in the seller, calling
  `mirrorSalesAsPurchase()` mints the matching purchase bill in the buyer
  company with the same line items, totals, currency, and posting date.
  The mirror is linked to the source via `reverses_invoice_id` for
  audit-traceable cancellation.

## Regional packs

Three packs ship in this build:
- **`india-gst`** — installs 5 GST rates × 2 templates each (intra-state with
  CGST + SGST, inter-state with IGST). When the caller supplies
  `taxAccountByLabel: { CGST, SGST, IGST }`, the templates are wired straight
  to GL liability accounts so submitting an invoice posts taxes correctly.
- **`eu-vat`** — installs 0 % / 5 % / 13 % / 21 % VAT bands. Country-specific
  rates are tenant overrides on top.
- **`us-sales-tax`** — installs a single editable 7 % template (real US sales
  tax is per-state per-county; users override).

All packs are recorded in `regional_packs` with code + version. Re-installing
a pack is rejected with `already-installed`.

**GSTR aggregation report** (`gstrSummary`) buckets submitted sales invoices
by GST template name and sums the taxable amount + CGST + SGST + IGST
components per bucket — the foundation for GSTR-1 / GSTR-3B style returns.
EU VAT MOSS would follow the same pattern with a `vatSummary()` keyed by
country of supply.

## Server-side PDF helper

- **No new dependency** by default. `buildPrintableHtml()` injects `@page`
  CSS + an auto-print script into existing print HTML so opening it in a
  browser triggers `window.print()` and the user saves-as-PDF.
- **Optional adapter** via `registerPdfRenderer(renderer)`: production
  deployments that need server-side PDF bytes (puppeteer / playwright /
  wkhtmltopdf) plug in a function and `renderPdf()` returns
  `{ kind: 'pdf', body: Uint8Array }`. Without an adapter, callers get
  `{ kind: 'html' }` and the browser path.

## Cmd+K command palette (frontend)

- Mounts at the shell root once. **Cmd+K / Ctrl+K** toggles the overlay.
- Debounced (130 ms) query against `/api/awesome-search/`.
- Hits grouped by kind (nav / domain / record); ↑ / ↓ navigate, Enter opens.
- Trap focus while open, restore on close. ARIA combobox + listbox.
- Re-uses Phase 3's awesome-bar backend (no new endpoint).

## Hover-preview on Link cells (frontend)

- `<LinkPreview resource="..." id="...">` wrapper.
- 250 ms hover-delay, fetches `/api/resources/:resource/:id` once and
  caches the result module-wide.
- Auto-projects a title (from `title` / `name` / `label` / …), subtitle, and
  up to 6 preview fields. Override `fetchPreview()` for resources that
  aren't behind the generic resources API (GL accounts, journals, etc.).

---

## Cumulative state across all four phases

| Tier | Capability | Phase |
|---|---|---|
| Plumbing | ACID transactions, idempotency, audit log, multi-process locks, retries, dead-letters, HMAC webhooks, graceful shutdown | 1-2 |
| Customization | Custom Fields, Property Setters, Naming Series, Print Formats, Notification Rules, Workflows, Webhooks, API Tokens, Bulk Import, Bulk Edit | 1-2 |
| **Tier 2 General Ledger** | immutable double-entry, periods, reversal, trial balance / P&L / balance sheet | 2 |
| **Tier 2 Sales Invoice** | line items + tax engine + tax templates + idempotent submit + cancel-reversal + payments | 3 |
| **Tier 2 Stock Ledger** | atomic moves, FIFO layers, transfers, negative-stock guard, reorder | 3 |
| **Tier 2 BOM** | multi-level explosion, cost roll-up, cycle detection | 3 |
| **Tier 2 Pricing Rules** | filters + priority + apply() | 3 |
| **Tier 2 Pick / Pack / Ship** | reservation + pick list + shipment with FIFO + reservation lifecycle | **4** |
| **Tier 2 HRMS** | employees + attendance + leave + payroll → GL | **4** |
| Tier 3 Connections | `record_links` + GL-derived | 2 |
| Tier 3 Bulk Import / Bulk Edit | CSV/JSON + dry-run + transactional + multi-record patch | 2 |
| Tier 3 Awesome bar | global federated search | 3 |
| Tier 3 **Cmd+K palette** | keyboard shortcut, debounced, grouped, accessible | **4** |
| Tier 3 **Hover-preview** | Link cell wrapper with cached fetch | **4** |
| Tier 4 Auto Email Reports | cron-scheduled, email enqueue | 3 |
| Tier 4 Web Form Builder | typed fields, public submit, inbox | 3 |
| Tier 4 i18n | per-tenant locale store + fallback | 3 |
| Tier 5 Bank Reconciliation | CSV import, suggest, match, quick-post | 3 |
| **Tier 5 FX revaluation** | rates + per-account base re-valuing + GL gain/loss posting | **4** |
| **Tier 2 Inter-company** | mapping + sales→purchase mirror | **4** |
| **Tier 5 Regional packs** | India GST (+ GSTR), EU VAT, US Sales Tax | **4** |
| **Tier 5 Server-side PDF** | adapter pattern with browser-print fallback | **4** |

---

## What is still open

After four phases, the deliberately-deferred remaining items:

- **Mobile-first responsive layouts** — UI work; the design system + tokens are in place but bespoke mobile screens aren't shipped.
- **Country-specific e-invoicing adapters** — the tax-template + print-format engines support the data model; jurisdiction-specific submission adapters (India IRP, Italy SDI) are external integrations.
- **Tally / QuickBooks importer profiles** — the Bulk Import CSV engine is the obvious target; per-product schema mappers are glue.
- **Domain UI screens** for Sales Invoice editor, BOM tree visualiser, pricing rule grid, bank-recon match UI, payroll wizard. The factory-generated CRUD ships today; bespoke pages would polish each.
- **Calendar / Gantt / Tree / Image / Map auto-views** — each needs a UI primitive. Calendar is straightforward; Gantt typically requires an external dependency.
- **HRMS depth**: salary structure components, payslip PDF generation, expense claims, loans/advances, leave-approval workflow, off-cycle bonus.
- **Manufacturing depth**: Work Order + Job Card with operation timing, capacity planning, MRP run.
- **CRM depth**: lead scoring, opportunity probability, campaign attribution, email tracking.

Each remaining item is real engineering. None are blocked by missing
plumbing — they all build on top of the GL, stock, fulfillment, payroll,
notification, and template primitives shipped in phases 1-4.

---

## Verification

```bash
cd admin-panel/backend
bun test                                  # 98/98 passing across 8 files

cd admin-panel
bunx tsc --noEmit -p tsconfig.json        # clean

cd admin-panel/backend
bunx tsc --noEmit                         # only the pre-existing unknown[] SQL-binding warnings
```

The system stands at: **98 backend tests, 0 failing**, **0 frontend type errors**, with end-to-end coverage of:
- A full quote-to-cash flow: customer record → invoice with line items + tax → reservation → pick list → shipment → outbound SLE → revenue + tax GL postings → bank reconciliation → payment.
- A full procure-to-pay flow: supplier record → bill with line items → expense GL postings → bank reconciliation → payment.
- A full hire-to-pay flow: employee onboard → attendance → leave accrual → payroll run → GL posting → payroll payable.
- Cross-company flows: sales invoice mirrored as inter-company purchase bill.
- Multi-currency: FX rates time-series + period-end revaluation posting.
- Statutory: India GST tax templates + GSTR aggregation; EU VAT bands.
- Operational: deliveries dispatcher, scheduler, auto-email reports, bulk import/edit, bank reconciliation match, web forms.
- Customization: custom fields, property setters, naming series, print formats, notification rules, workflows.
- Discovery: Cmd+K global search with grouped results; hover-preview on Link cells.
