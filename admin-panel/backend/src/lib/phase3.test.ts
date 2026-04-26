/** Phase-3 tests covering Tier 2-5 primitives.
 *
 *  - Sales Invoice — line item totals, tax engine, GL posting, idempotent submit, cancel-reversal.
 *  - Stock Ledger — receipts add FIFO layers; issues consume oldest first;
 *    transfers preserve valuation; negative-stock guard; reorder report.
 *  - BOM — multi-level explosion, cost roll-up, cycle detection, aggregation.
 *  - Pricing Rules — match priority, qty bands, validity windows, apply().
 *  - Bank Reconciliation — CSV parse, candidate suggestion, match/unmatch, quick-post.
 *  - Auto Email Reports — cron tick fires once per minute bucket, enqueues email delivery.
 *  - Web Forms — validate fields, accept/reject, create record on submit.
 *  - i18n — upsert + bulk + locale fallback.
 *  - Awesome bar — record + domain + nav results, scoring + dedupe.
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "gutu-phase3-test-"));
  process.env.DB_PATH = path.join(dataDir, "test.db");
  process.env.NODE_ENV = "test";
  await import("../db");
  const tenancyMig = await import("../tenancy/migrations");
  await tenancyMig.migrateGlobal();
  const migrations = await import("../migrations");
  migrations.migrate();
  // Run every host-plugin's migrations, in topological order.
  const { runPluginMigrations } = await import("../host/plugin-contract");
  const plugins = await Promise.all([
    import("@gutu-plugin/template-core"),
    import("@gutu-plugin/notifications-core"),
    import("@gutu-plugin/pricing-tax-core"),
    import("@gutu-plugin/accounting-core"),
    import("@gutu-plugin/inventory-core"),
    import("@gutu-plugin/manufacturing-core"),
    import("@gutu-plugin/sales-core"),
    import("@gutu-plugin/treasury-core"),
    import("@gutu-plugin/hr-payroll-core"),
    import("@gutu-plugin/e-invoicing-core"),
    import("@gutu-plugin/forms-core"),
    import("@gutu-plugin/integration-core"),
    import("@gutu-plugin/analytics-bi-core"),
  ]);
  await runPluginMigrations(plugins.map((p) => p.hostPlugin));
});

afterAll(async () => {
  // NOTE: don't rm the dataDir — bun's module-cached `db` keeps the
  // SQLite file open across test files (Bun runs them in one process,
  // and `await import("../db")` is cached after the first file). We
  // leak the tmp dir to avoid disk-I/O errors in subsequent files. The
  // OS reclaims it after the process exits.
});

/* ============================== Sales Invoice =========================== */

describe("sales-invoice", () => {
  it("computes net + tax + total from line items", async () => {
    const si = await import("@gutu-plugin/sales-core");
    const inv = si.createInvoice({
      tenantId: "t-si",
      kind: "sales",
      partyResource: "crm.contact",
      partyId: "cust-1",
      postingDate: "2026-04-01",
      currency: "USD",
      lines: [
        { description: "Widget", quantity: 2, rateMinor: 5000, taxPct: 10 },
        { description: "Gadget", quantity: 1, rateMinor: 1000, discountPct: 10, taxPct: 10 },
      ],
      createdBy: "x",
    });
    // line 1: net=10000, tax=1000, total=11000
    // line 2: discount 10% on 1000 → net=900, tax=90, total=990
    expect(inv.subtotalMinor).toBe(10900);
    expect(inv.taxMinor).toBe(1090);
    expect(inv.totalMinor).toBe(11990);
    expect(inv.lines).toHaveLength(2);
    expect(inv.lines[1]?.netMinor).toBe(900);
    expect(inv.status).toBe("draft");
  });

  it("submits to GL and is idempotent on resubmit", async () => {
    const si = await import("@gutu-plugin/sales-core");
    const gl = await import("@gutu-plugin/accounting-core");
    const ar = gl.createAccount({
      tenantId: "t-si-sub",
      number: "1200",
      name: "AR",
      accountType: "asset",
      createdBy: "x",
    });
    const income = gl.createAccount({
      tenantId: "t-si-sub",
      number: "4000",
      name: "Sales Income",
      accountType: "income",
      createdBy: "x",
    });
    const inv = si.createInvoice({
      tenantId: "t-si-sub",
      kind: "sales",
      partyResource: "crm.contact",
      partyId: "cust-1",
      postingDate: "2026-04-01",
      lines: [
        { description: "Widget", quantity: 1, rateMinor: 10000, incomeAccountId: income.id, taxPct: 0 },
      ],
      createdBy: "x",
    });
    const a = si.submitInvoice({
      tenantId: "t-si-sub",
      id: inv.id,
      receivableAccountId: ar.id,
      submittedBy: "x",
    });
    expect(a.status).toBe("submitted");
    expect(a.glJournalId).toBeTruthy();
    // Resubmitting returns the same invoice (no double posting).
    const b = si.submitInvoice({
      tenantId: "t-si-sub",
      id: inv.id,
      receivableAccountId: ar.id,
      submittedBy: "x",
    });
    expect(b.glJournalId).toBe(a.glJournalId);
    // GL should be in balance with the invoice total.
    const tb = gl.trialBalance({ tenantId: "t-si-sub" });
    expect(tb.totalDebitMinor).toBe(10000);
    expect(tb.totalCreditMinor).toBe(10000);
  });

  it("cancel-reversal puts GL back to zero", async () => {
    const si = await import("@gutu-plugin/sales-core");
    const gl = await import("@gutu-plugin/accounting-core");
    const ar = gl.createAccount({
      tenantId: "t-si-cancel",
      number: "1200",
      name: "AR",
      accountType: "asset",
      createdBy: "x",
    });
    const income = gl.createAccount({
      tenantId: "t-si-cancel",
      number: "4000",
      name: "Sales",
      accountType: "income",
      createdBy: "x",
    });
    const inv = si.createInvoice({
      tenantId: "t-si-cancel",
      kind: "sales",
      partyResource: "crm.contact",
      partyId: "c1",
      postingDate: "2026-04-01",
      lines: [
        { description: "Widget", quantity: 1, rateMinor: 5000, incomeAccountId: income.id },
      ],
      createdBy: "x",
    });
    si.submitInvoice({ tenantId: "t-si-cancel", id: inv.id, receivableAccountId: ar.id, submittedBy: "x" });
    si.cancelInvoice({ tenantId: "t-si-cancel", id: inv.id, cancelledBy: "x" });
    const tb = gl.trialBalance({ tenantId: "t-si-cancel" });
    expect(tb.inBalance).toBe(true);
    for (const row of tb.rows) expect(row.balanceMinor).toBe(0);
  });

  it("supports tax templates with per-component GL posting", async () => {
    const si = await import("@gutu-plugin/sales-core");
    const gl = await import("@gutu-plugin/accounting-core");
    const tenant = "t-si-tax";
    const ar = gl.createAccount({ tenantId: tenant, number: "1200", name: "AR", accountType: "asset", createdBy: "x" });
    const income = gl.createAccount({ tenantId: tenant, number: "4000", name: "Sales", accountType: "income", createdBy: "x" });
    const taxFed = gl.createAccount({ tenantId: tenant, number: "2400", name: "Tax Fed", accountType: "liability", createdBy: "x" });
    const taxState = gl.createAccount({ tenantId: tenant, number: "2410", name: "Tax State", accountType: "liability", createdBy: "x" });
    const tpl = si.createTaxTemplate({
      tenantId: tenant,
      name: "Std",
      components: [
        { label: "Federal", ratePct: 5, glAccountId: taxFed.id, compound: false },
        { label: "State",   ratePct: 3, glAccountId: taxState.id, compound: false },
      ],
      createdBy: "x",
    });
    const inv = si.createInvoice({
      tenantId: tenant,
      kind: "sales",
      partyResource: "crm.contact",
      partyId: "c1",
      postingDate: "2026-04-01",
      lines: [
        {
          description: "Widget",
          quantity: 1,
          rateMinor: 10000,
          taxTemplateId: tpl.id,
          incomeAccountId: income.id,
        },
      ],
      createdBy: "x",
    });
    expect(inv.taxMinor).toBe(800); // 5%+3% of 10000
    si.submitInvoice({
      tenantId: tenant,
      id: inv.id,
      receivableAccountId: ar.id,
      submittedBy: "x",
    });
    const balances = gl.accountBalances({ tenantId: tenant });
    const fed = balances.find((b) => b.accountId === taxFed.id);
    const state = balances.find((b) => b.accountId === taxState.id);
    expect(fed?.balanceMinor).toBe(500);
    expect(state?.balanceMinor).toBe(300);
  });
});

/* ============================== Stock Ledger ============================ */

describe("stock-ledger", () => {
  it("FIFO receipts + issues consume oldest first", async () => {
    const sl = await import("@gutu-plugin/inventory-core");
    const item = sl.createStockItem({
      tenantId: "t-stk",
      code: "WID-001",
      name: "Widget",
      valuationMethod: "fifo",
    });
    const wh = sl.createWarehouse({
      tenantId: "t-stk",
      number: "WH-01",
      name: "Main",
    });
    sl.recordStockMovement({
      tenantId: "t-stk",
      itemId: item.id,
      warehouseId: wh.id,
      kind: "receipt",
      quantity: 10,
      rateMinor: 100,
    });
    sl.recordStockMovement({
      tenantId: "t-stk",
      itemId: item.id,
      warehouseId: wh.id,
      kind: "receipt",
      quantity: 10,
      rateMinor: 200,
    });
    const issue = sl.recordStockMovement({
      tenantId: "t-stk",
      itemId: item.id,
      warehouseId: wh.id,
      kind: "issue",
      quantity: -15,
    });
    // Consumed: 10 @ 100 + 5 @ 200 → value = -2000
    expect(issue.sle.valueMinor).toBe(-2000);
    expect(issue.consumedFromLayers?.length).toBe(2);
    const bin = sl.getBin("t-stk", item.id, wh.id);
    expect(bin?.actualQty).toBe(5);
    expect(bin?.valuationMinor).toBe(1000); // 5 left @ 200
  });

  it("rejects negative stock unless allowNegative=true", async () => {
    const sl = await import("@gutu-plugin/inventory-core");
    const item = sl.createStockItem({ tenantId: "t-stk-n", code: "X", name: "X" });
    const wh = sl.createWarehouse({ tenantId: "t-stk-n", number: "W", name: "W" });
    expect(() =>
      sl.recordStockMovement({
        tenantId: "t-stk-n",
        itemId: item.id,
        warehouseId: wh.id,
        kind: "issue",
        quantity: -5,
      }),
    ).toThrow(/leave bin|insufficient/);
    // With override.
    const out = sl.recordStockMovement({
      tenantId: "t-stk-n",
      itemId: item.id,
      warehouseId: wh.id,
      kind: "adjustment",
      quantity: -5,
    });
    expect(out.bin?.actualQty).toBe(-5);
  });

  it("transfer preserves valuation between warehouses", async () => {
    const sl = await import("@gutu-plugin/inventory-core");
    const item = sl.createStockItem({ tenantId: "t-stk-tx", code: "W", name: "W" });
    const a = sl.createWarehouse({ tenantId: "t-stk-tx", number: "A", name: "A" });
    const b = sl.createWarehouse({ tenantId: "t-stk-tx", number: "B", name: "B" });
    sl.recordStockMovement({
      tenantId: "t-stk-tx",
      itemId: item.id,
      warehouseId: a.id,
      kind: "receipt",
      quantity: 10,
      rateMinor: 150,
    });
    const xfer = sl.recordStockTransfer({
      tenantId: "t-stk-tx",
      itemId: item.id,
      fromWarehouseId: a.id,
      toWarehouseId: b.id,
      quantity: 4,
    });
    expect(xfer.out.bin?.actualQty).toBe(6);
    expect(xfer.out.bin?.valuationMinor).toBe(900); // 6 @ 150
    expect(xfer.in.bin?.actualQty).toBe(4);
    expect(xfer.in.bin?.valuationMinor).toBe(600);
  });

  it("reorder suggestions surface items below threshold", async () => {
    const sl = await import("@gutu-plugin/inventory-core");
    const item = sl.createStockItem({
      tenantId: "t-stk-ro",
      code: "RO-1",
      name: "Reorder",
      reorderLevel: 100,
    });
    const wh = sl.createWarehouse({ tenantId: "t-stk-ro", number: "W", name: "W" });
    sl.recordStockMovement({
      tenantId: "t-stk-ro",
      itemId: item.id,
      warehouseId: wh.id,
      kind: "receipt",
      quantity: 50,
      rateMinor: 1000,
    });
    const list = sl.reorderSuggestions({ tenantId: "t-stk-ro" });
    expect(list.length).toBe(1);
    expect(list[0]?.shortfall).toBe(50);
  });
});

/* ============================== BOM ===================================== */

describe("bom", () => {
  it("multi-level explosion + cost roll-up", async () => {
    const bom = await import("@gutu-plugin/manufacturing-core");
    const sub = bom.createBom({
      tenantId: "t-bom",
      itemCode: "SUB-1",
      lines: [{ itemCode: "RAW-1", quantity: 2, rateMinor: 100 }],
      labourMinor: 50,
      createdBy: "x",
    });
    const top = bom.createBom({
      tenantId: "t-bom",
      itemCode: "TOP-1",
      lines: [
        { itemCode: "SUB-1", quantity: 3, subBomId: sub.id, scrapPct: 0 },
        { itemCode: "RAW-2", quantity: 1, rateMinor: 500 },
      ],
      labourMinor: 100,
      overheadMinor: 25,
      createdBy: "x",
    });
    const ex = bom.explodeBom({ tenantId: "t-bom", bomId: top.id, quantity: 4 });
    // 4 of TOP-1 → 12 of SUB-1 → 24 of RAW-1 (24 * 100 = 2400)
    // 4 of TOP-1 → 4 of RAW-2 (4 * 500 = 2000)
    // Sub labour: 12 of SUB-1 → 12 * (50 / 1) = 600
    // Top labour: 4 * 100 = 400; overhead: 4 * 25 = 100
    expect(ex.totalMaterialMinor).toBe(2400 + 2000);
    expect(ex.totalLabourMinor).toBe(600 + 400);
    expect(ex.totalOverheadMinor).toBe(100);
    expect(ex.totalCostMinor).toBe(2400 + 2000 + 600 + 400 + 100);
    expect(ex.unitCostMinor).toBe(Math.round(ex.totalCostMinor / 4));
    // Aggregation collapses identical items.
    const agg = bom.aggregateExplosion(ex.rows);
    expect(agg.find((r) => r.itemCode === "RAW-1")?.quantity).toBe(24);
    expect(agg.find((r) => r.itemCode === "RAW-2")?.quantity).toBe(4);
  });

  it("detects cycles", async () => {
    const bom = await import("@gutu-plugin/manufacturing-core");
    const a = bom.createBom({
      tenantId: "t-bom-c",
      itemCode: "A",
      lines: [{ itemCode: "B", quantity: 1, rateMinor: 0 }],
      createdBy: "x",
    });
    const b = bom.createBom({
      tenantId: "t-bom-c",
      itemCode: "B",
      lines: [{ itemCode: "A", quantity: 1, subBomId: a.id }],
      createdBy: "x",
    });
    // Now point A's B-line at B's BOM, creating a cycle.
    const { db: rawDb } = await import("../db");
    rawDb.prepare(`UPDATE bom_lines SET sub_bom_id = ? WHERE bom_id = ?`).run(b.id, a.id);
    expect(() =>
      bom.explodeBom({ tenantId: "t-bom-c", bomId: a.id, quantity: 1 }),
    ).toThrow(/cycle/i);
  });
});

/* ============================== Pricing Rules =========================== */

describe("pricing-rules", () => {
  it("applies the highest-priority matching rule", async () => {
    const pr = await import("@gutu-plugin/pricing-tax-core");
    pr.createPricingRule({
      tenantId: "t-pr",
      name: "Generic 5%",
      priority: 0,
      filters: {},
      action: "discount-pct",
      valuePct: 5,
      createdBy: "x",
    });
    pr.createPricingRule({
      tenantId: "t-pr",
      name: "Enterprise 20%",
      priority: 10,
      filters: { customerGroup: "enterprise", minQty: 10 },
      action: "discount-pct",
      valuePct: 20,
      createdBy: "x",
    });
    const generic = pr.applyPricing({
      tenantId: "t-pr",
      ctx: { customerGroup: "smb" },
      rateMinor: 1000,
      qty: 1,
    });
    expect(generic.discountPct).toBe(5);
    expect(generic.effectiveRateMinor).toBe(950);

    const enterprise = pr.applyPricing({
      tenantId: "t-pr",
      ctx: { customerGroup: "enterprise" },
      rateMinor: 1000,
      qty: 25,
    });
    expect(enterprise.discountPct).toBe(20);
    expect(enterprise.effectiveRateMinor).toBe(800);

    // Below qty band: no enterprise rule; falls back to generic 5%.
    const below = pr.applyPricing({
      tenantId: "t-pr",
      ctx: { customerGroup: "enterprise" },
      rateMinor: 1000,
      qty: 5,
    });
    expect(below.discountPct).toBe(5);
  });

  it("respects validity windows", async () => {
    const pr = await import("@gutu-plugin/pricing-tax-core");
    pr.createPricingRule({
      tenantId: "t-pr-v",
      name: "April Promo",
      priority: 100,
      filters: { validFrom: "2026-04-01", validTo: "2026-04-30" },
      action: "discount-pct",
      valuePct: 50,
      createdBy: "x",
    });
    const inApril = pr.applyPricing({
      tenantId: "t-pr-v",
      ctx: { postingDate: "2026-04-15" },
      rateMinor: 100,
      qty: 1,
    });
    expect(inApril.discountPct).toBe(50);
    const outsideApril = pr.applyPricing({
      tenantId: "t-pr-v",
      ctx: { postingDate: "2026-05-01" },
      rateMinor: 100,
      qty: 1,
    });
    expect(outsideApril.discountPct).toBe(0);
  });
});

/* ============================== Bank Reconciliation ===================== */

describe("bank-reconciliation", () => {
  it("parses CSV with header aliases and signed amounts", async () => {
    const br = await import("@gutu-plugin/treasury-core");
    const csv = `Date,Description,Debit,Credit,Reference
2026-04-01,Acme deposit,,500.00,REF-1
2026-04-02,Vendor payment,200.00,,REF-2
04/03/2026,Cash deposit,,150.50,REF-3`;
    const lines = br.parseStatementCsv(csv);
    expect(lines.length).toBe(3);
    expect(lines[0]?.amountMinor).toBe(50000);
    expect(lines[1]?.amountMinor).toBe(-20000);
    expect(lines[2]?.amountMinor).toBe(15050);
    expect(lines[2]?.postingDate).toBe("2026-04-03");
  });

  it("matches a candidate GL entry when amounts + dates align", async () => {
    const br = await import("@gutu-plugin/treasury-core");
    const gl = await import("@gutu-plugin/accounting-core");
    const tenant = "t-br";
    const cash = gl.createAccount({
      tenantId: tenant,
      number: "1100",
      name: "Cash",
      accountType: "asset",
      createdBy: "x",
    });
    const sales = gl.createAccount({
      tenantId: tenant,
      number: "4000",
      name: "Sales",
      accountType: "income",
      createdBy: "x",
    });
    // Post a deposit through GL.
    gl.postJournal({
      tenantId: tenant,
      number: "JV-DEP",
      postingDate: "2026-04-05",
      lines: [
        { accountId: cash.id, side: "debit", amountMinor: 25000 },
        { accountId: sales.id, side: "credit", amountMinor: 25000 },
      ],
      createdBy: "x",
    });
    const stmt = br.createStatement({
      tenantId: tenant,
      bankAccountId: cash.id,
      label: "April",
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
      currency: "USD",
      lines: [{ postingDate: "2026-04-05", description: "Deposit", reference: null, amountMinor: 25000 }],
      createdBy: "x",
    });
    const line = stmt.lines[0]!;
    const cands = br.suggestMatches({ tenantId: tenant, lineId: line.id });
    expect(cands.length).toBeGreaterThan(0);
    const match = br.matchLine({
      tenantId: tenant,
      lineId: line.id,
      glEntryId: cands[0]!.glEntryId,
      matchedBy: "x",
    });
    expect(match.status).toBe("matched");
  });

  it("quick-posts a journal from an unmatched line + matches it", async () => {
    const br = await import("@gutu-plugin/treasury-core");
    const gl = await import("@gutu-plugin/accounting-core");
    const tenant = "t-br-qp";
    const cash = gl.createAccount({
      tenantId: tenant,
      number: "1100",
      name: "Cash",
      accountType: "asset",
      createdBy: "x",
    });
    const fees = gl.createAccount({
      tenantId: tenant,
      number: "5100",
      name: "Bank Fees",
      accountType: "expense",
      createdBy: "x",
    });
    const stmt = br.createStatement({
      tenantId: tenant,
      bankAccountId: cash.id,
      label: "Fees stmt",
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
      currency: "USD",
      lines: [{ postingDate: "2026-04-15", description: "Wire fee", reference: null, amountMinor: -1000 }],
      createdBy: "x",
    });
    const line = stmt.lines[0]!;
    const out = br.quickPostFromLine({
      tenantId: tenant,
      lineId: line.id,
      contraAccountId: fees.id,
      postedBy: "x",
    });
    expect(out.journalId).toBeTruthy();
    const after = br.getStatementLine(tenant, line.id);
    expect(after?.status).toBe("matched");
  });
});

/* ============================== Auto Email Reports ====================== */

describe("auto-email-reports", () => {
  it("fires a matching cron rule once per minute bucket and queues an email delivery", async () => {
    const aer = await import("@gutu-plugin/analytics-bi-core");
    const now = new Date();
    const cron = `${now.getUTCMinutes()} ${now.getUTCHours()} * * *`;
    const r = aer.createReport({
      tenantId: "t-aer",
      name: "Daily TB",
      reportKind: "gl-trial-balance",
      reportArgs: {},
      cronExpr: cron,
      subjectTpl: "TB {{ now | date }}",
      bodyTpl: "{{ report.summary }}",
      recipients: ["cfo@example.com"],
      createdBy: "x",
    });
    const a = aer.autoEmailTick(now);
    expect(a.fired).toBe(1);
    // Re-tick same minute: idempotent.
    const b = aer.autoEmailTick(now);
    expect(b.fired).toBe(0);
    // A delivery row exists.
    const { db } = await import("../db");
    const rows = db
      .prepare(
        `SELECT id, status FROM notification_deliveries WHERE tenant_id = ? AND record_id = ?`,
      )
      .all("t-aer", r.id) as Array<{ id: string; status: string }>;
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe("pending");
  });
});

/* ============================== Web Forms =============================== */

describe("web-forms", () => {
  it("creates a form, accepts a valid submission, creates a record", async () => {
    const wf = await import("@gutu-plugin/forms-core");
    const form = wf.createWebForm({
      tenantId: "t-wf",
      slug: "lead-capture",
      title: "Get in touch",
      targetResource: "crm.lead",
      fields: [
        { name: "name", label: "Your name", kind: "text", required: true },
        { name: "email", label: "Email", kind: "email", required: true },
        { name: "topic", label: "Topic", kind: "select", required: true,
          options: [{ value: "sales", label: "Sales" }, { value: "support", label: "Support" }] },
      ],
      published: true,
      createdBy: "x",
    });
    const ok = wf.submitWebForm({
      tenantId: "t-wf",
      slug: form.slug,
      payload: { name: "Alice", email: "alice@example.com", topic: "sales" },
    });
    expect(ok.errors).toBeUndefined();
    expect(ok.recordId).toBeTruthy();
    expect(ok.submission.status).toBe("accepted");
    // Bad payload → rejected, but logged.
    const bad = wf.submitWebForm({
      tenantId: "t-wf",
      slug: form.slug,
      payload: { name: "Bob", email: "not-an-email", topic: "sales" },
    });
    expect(bad.errors?.email).toBeTruthy();
    expect(bad.submission.status).toBe("rejected");
  });

  it("refuses to serve unpublished forms", async () => {
    const wf = await import("@gutu-plugin/forms-core");
    const form = wf.createWebForm({
      tenantId: "t-wf-up",
      slug: "draft",
      title: "Draft",
      targetResource: "crm.lead",
      fields: [{ name: "name", label: "Name", kind: "text", required: true }],
      published: false,
      createdBy: "x",
    });
    expect(() =>
      wf.submitWebForm({
        tenantId: "t-wf-up",
        slug: form.slug,
        payload: { name: "X" },
      }),
    ).toThrow(/unpublished|published/);
  });
});

/* ============================== i18n ==================================== */

describe("i18n", () => {
  it("upserts and resolves with locale fallback", async () => {
    const i18n = await import("./i18n");
    i18n.bulkUpsert({
      tenantId: "t-i18n",
      locale: "en",
      entries: { "crm.lead.label": "Lead", "crm.lead.tagline": "A potential customer" },
    });
    i18n.bulkUpsert({
      tenantId: "t-i18n",
      locale: "hi",
      entries: { "crm.lead.label": "लीड" },
    });
    const hi = i18n.resolveStrings({ tenantId: "t-i18n", locale: "hi" });
    expect(hi.strings["crm.lead.label"]).toBe("लीड");
    // tagline missing in hi → fallback to en.
    expect(hi.strings["crm.lead.tagline"]).toBe("A potential customer");
  });

  it("format() substitutes placeholders", async () => {
    const i18n = await import("./i18n");
    expect(i18n.format("Hello {name}, you have {count} messages", { name: "Alice", count: 3 })).toBe(
      "Hello Alice, you have 3 messages",
    );
  });

  it("rejects bad locales", async () => {
    const i18n = await import("./i18n");
    expect(() =>
      i18n.upsertString({ tenantId: "t-i18n", locale: "BAD", key: "x", value: "y" }),
    ).toThrow(/locale/i);
  });
});

/* ============================== Awesome bar ============================= */

describe("awesome-bar", () => {
  it("returns nav + record + domain hits ranked by score", async () => {
    const aw = await import("./awesome-bar");
    const gl = await import("@gutu-plugin/accounting-core");
    const tenant = "t-aw";
    gl.createAccount({
      tenantId: tenant,
      number: "1100",
      name: "Cash and Equivalents",
      accountType: "asset",
      createdBy: "x",
    });
    const { db, nowIso } = await import("../db");
    const { uuid } = await import("./id");
    const recordId = uuid();
    db.prepare(
      `INSERT INTO records (resource, id, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      "crm.contact",
      recordId,
      JSON.stringify({ id: recordId, tenantId: tenant, name: "Cash Customer" }),
      nowIso(),
      nowIso(),
    );
    const hits = aw.searchAwesome({ tenantId: tenant, query: "cash" });
    expect(hits.length).toBeGreaterThan(0);
    const kinds = new Set(hits.map((h) => h.kind));
    expect(kinds.has("domain")).toBe(true);
    expect(kinds.has("record")).toBe(true);
    // Trial balance nav target is in the static list.
    const trialHits = aw.searchAwesome({ tenantId: tenant, query: "trial" });
    expect(trialHits.find((h) => h.kind === "nav" && h.title.includes("Trial"))).toBeTruthy();
  });

  it("returns empty for empty query", async () => {
    const aw = await import("./awesome-bar");
    expect(aw.searchAwesome({ tenantId: "t-aw", query: "" }).length).toBe(0);
  });
});
