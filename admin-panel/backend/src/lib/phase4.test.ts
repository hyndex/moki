/** Phase-4 tests: fulfillment, HRMS, FX, inter-company, regional packs, PDF. */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "gutu-phase4-test-"));
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

/* ============================== Fulfillment ============================== */

describe("fulfillment", () => {
  async function setupTenant(t: string) {
    const sl = await import("@gutu-plugin/inventory-core");
    const item = sl.createStockItem({ tenantId: t, code: "ITM-1", name: "Item" });
    const wh = sl.createWarehouse({ tenantId: t, number: "WH-1", name: "Main" });
    sl.recordStockMovement({
      tenantId: t,
      itemId: item.id,
      warehouseId: wh.id,
      kind: "receipt",
      quantity: 100,
      rateMinor: 100,
    });
    return { item, wh };
  }

  it("end-to-end: reserve → pick → pack → ship; FIFO consumed on ship", async () => {
    const ff = await import("@gutu-plugin/inventory-core");
    const sl = await import("@gutu-plugin/inventory-core");
    const t = "t-ff";
    const { item, wh } = await setupTenant(t);
    const r = ff.createReservation({
      tenantId: t,
      itemId: item.id,
      warehouseId: wh.id,
      quantity: 10,
      consumerResource: "accounting.invoice",
      consumerId: "inv-1",
    });
    let bin = sl.getBin(t, item.id, wh.id);
    expect(bin?.actualQty).toBe(100);
    expect(bin?.reservedQty).toBe(10);

    const pl = ff.createPickList({
      tenantId: t,
      warehouseId: wh.id,
      reservationIds: [r.id],
      createdBy: "x",
    });
    expect(pl.items.length).toBe(1);

    ff.recordPickQuantity({
      tenantId: t,
      pickListId: pl.id,
      itemId: item.id,
      warehouseId: wh.id,
      quantity: 10,
    });
    const sh = ff.packShipment({
      tenantId: t,
      pickListId: pl.id,
      consumerResource: "accounting.invoice",
      consumerId: "inv-1",
      createdBy: "x",
    });
    const shipped = ff.shipShipment({
      tenantId: t,
      id: sh.id,
      shippedBy: "x",
    });
    expect(shipped.status).toBe("shipped");

    bin = sl.getBin(t, item.id, wh.id);
    expect(bin?.actualQty).toBe(90);
    expect(bin?.reservedQty).toBe(0);

    // Reservation flipped to fulfilled.
    const r2 = ff.getReservation(t, r.id);
    expect(r2?.status).toBe("fulfilled");

    // Idempotent ship.
    const shAgain = ff.shipShipment({ tenantId: t, id: sh.id, shippedBy: "x" });
    expect(shAgain.id).toBe(shipped.id);

    // Mark delivered.
    const delivered = ff.markDelivered({ tenantId: t, id: sh.id, by: "x" });
    expect(delivered.status).toBe("delivered");
  });

  it("rejects reservation when not enough is available", async () => {
    const ff = await import("@gutu-plugin/inventory-core");
    const t = "t-ff-low";
    const { item, wh } = await setupTenant(t);
    expect(() =>
      ff.createReservation({
        tenantId: t,
        itemId: item.id,
        warehouseId: wh.id,
        quantity: 1000,
        consumerResource: "accounting.invoice",
        consumerId: "inv-x",
      }),
    ).toThrow(/available|insufficient/);
  });

  it("cancelling a reservation releases reserved_qty", async () => {
    const ff = await import("@gutu-plugin/inventory-core");
    const sl = await import("@gutu-plugin/inventory-core");
    const t = "t-ff-cancel";
    const { item, wh } = await setupTenant(t);
    const r = ff.createReservation({
      tenantId: t,
      itemId: item.id,
      warehouseId: wh.id,
      quantity: 5,
      consumerResource: "x",
      consumerId: "y",
    });
    expect(sl.getBin(t, item.id, wh.id)?.reservedQty).toBe(5);
    ff.cancelReservation(t, r.id);
    expect(sl.getBin(t, item.id, wh.id)?.reservedQty).toBe(0);
  });

  it("over-pick is rejected", async () => {
    const ff = await import("@gutu-plugin/inventory-core");
    const t = "t-ff-over";
    const { item, wh } = await setupTenant(t);
    const r = ff.createReservation({
      tenantId: t,
      itemId: item.id,
      warehouseId: wh.id,
      quantity: 5,
      consumerResource: "x",
      consumerId: "y",
    });
    const pl = ff.createPickList({
      tenantId: t,
      warehouseId: wh.id,
      reservationIds: [r.id],
      createdBy: "x",
    });
    expect(() =>
      ff.recordPickQuantity({
        tenantId: t,
        pickListId: pl.id,
        itemId: item.id,
        warehouseId: wh.id,
        quantity: 6,
      }),
    ).toThrow(/over-pick|cannot pick/i);
  });
});

/* ============================== HRMS ===================================== */

describe("hrms", () => {
  it("creates an employee, records attendance with computed hours", async () => {
    const h = await import("@gutu-plugin/hr-payroll-core");
    const e = h.createEmployee({
      tenantId: "t-hr",
      employeeNo: "EMP-001",
      firstName: "Alice",
      lastName: "Anderson",
      hireDate: "2024-01-01",
      baseSalaryMinor: 500000,
      createdBy: "x",
    });
    const a = h.recordAttendance({
      tenantId: "t-hr",
      employeeId: e.id,
      date: "2026-04-01",
      checkIn: "2026-04-01T09:00:00.000Z",
      checkOut: "2026-04-01T17:30:00.000Z",
    });
    expect(a.hours).toBeCloseTo(8.5, 2);
    expect(a.status).toBe("present");
  });

  it("upserts attendance on second call same day", async () => {
    const h = await import("@gutu-plugin/hr-payroll-core");
    const e = h.createEmployee({
      tenantId: "t-hr-upsert",
      employeeNo: "EMP-001",
      firstName: "B",
      lastName: "B",
      hireDate: "2024-01-01",
      createdBy: "x",
    });
    const a = h.recordAttendance({
      tenantId: "t-hr-upsert",
      employeeId: e.id,
      date: "2026-04-01",
      hours: 4,
    });
    const b = h.recordAttendance({
      tenantId: "t-hr-upsert",
      employeeId: e.id,
      date: "2026-04-01",
      hours: 8,
    });
    expect(b.id).toBe(a.id);
    expect(b.hours).toBe(8);
  });

  it("leave balance sums accrual + consumption + adjustment", async () => {
    const h = await import("@gutu-plugin/hr-payroll-core");
    const t = "t-hr-leave";
    const e = h.createEmployee({
      tenantId: t,
      employeeNo: "E1",
      firstName: "L",
      lastName: "L",
      hireDate: "2024-01-01",
      createdBy: "x",
    });
    const lt = h.createLeaveType({ tenantId: t, code: "PL", name: "Paid Leave", annualDays: 12 });
    h.recordLeave({
      tenantId: t,
      employeeId: e.id,
      leaveTypeId: lt.id,
      kind: "accrual",
      days: 12,
      effectiveDate: "2026-01-01",
    });
    h.recordLeave({
      tenantId: t,
      employeeId: e.id,
      leaveTypeId: lt.id,
      kind: "consumption",
      days: 3,
      effectiveDate: "2026-04-15",
    });
    h.recordLeave({
      tenantId: t,
      employeeId: e.id,
      leaveTypeId: lt.id,
      kind: "adjustment",
      days: 1,
      effectiveDate: "2026-04-20",
      memo: "carried forward",
    });
    const balances = h.leaveBalance({
      tenantId: t,
      employeeId: e.id,
      upToDate: "2026-04-30",
    });
    const pl = balances.find((b) => b.typeCode === "PL");
    expect(pl?.balance).toBe(12 - 3 + 1);
  });

  it("computes a payroll run, posts to GL with balanced journal", async () => {
    const h = await import("@gutu-plugin/hr-payroll-core");
    const gl = await import("@gutu-plugin/accounting-core");
    const t = "t-hr-pay";
    const e1 = h.createEmployee({
      tenantId: t,
      employeeNo: "P1",
      firstName: "P",
      lastName: "1",
      hireDate: "2024-01-01",
      baseSalaryMinor: 500000,
      createdBy: "x",
    });
    const e2 = h.createEmployee({
      tenantId: t,
      employeeNo: "P2",
      firstName: "P",
      lastName: "2",
      hireDate: "2024-01-01",
      baseSalaryMinor: 300000,
      createdBy: "x",
    });
    const run = h.computePayrollRun({
      tenantId: t,
      periodLabel: "2026-04",
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
      taxRate: 0.20,
      createdBy: "x",
    });
    expect(run.totalGrossMinor).toBe(800000);
    expect(run.totalTaxMinor).toBe(160000);
    expect(run.totalNetMinor).toBe(640000);
    expect(run.lines.length).toBe(2);
    expect(run.lines.find((l) => l.employeeId === e1.id)?.netMinor).toBe(400000);
    expect(run.lines.find((l) => l.employeeId === e2.id)?.netMinor).toBe(240000);

    const expense = gl.createAccount({
      tenantId: t,
      number: "5100",
      name: "Salary Expense",
      accountType: "expense",
      createdBy: "x",
    });
    const taxLiab = gl.createAccount({
      tenantId: t,
      number: "2400",
      name: "Tax Withholding",
      accountType: "liability",
      createdBy: "x",
    });
    const payable = gl.createAccount({
      tenantId: t,
      number: "2300",
      name: "Payroll Payable",
      accountType: "liability",
      createdBy: "x",
    });
    const posted = h.postPayrollRun({
      tenantId: t,
      id: run.id,
      salaryExpenseAccountId: expense.id,
      taxLiabilityAccountId: taxLiab.id,
      payrollPayableAccountId: payable.id,
      postedBy: "x",
    });
    expect(posted.status).toBe("posted");
    expect(posted.glJournalId).toBeTruthy();
    const tb = gl.trialBalance({ tenantId: t });
    expect(tb.inBalance).toBe(true);
    expect(tb.totalDebitMinor).toBe(800000);
    expect(tb.totalCreditMinor).toBe(800000);

    // Idempotent post.
    const again = h.postPayrollRun({
      tenantId: t,
      id: run.id,
      salaryExpenseAccountId: expense.id,
      taxLiabilityAccountId: taxLiab.id,
      payrollPayableAccountId: payable.id,
      postedBy: "x",
    });
    expect(again.glJournalId).toBe(posted.glJournalId);
  });
});

/* ============================== FX ======================================= */

describe("fx", () => {
  it("set and get rates with as-of fallback", async () => {
    const fx = await import("@gutu-plugin/e-invoicing-core");
    fx.setFxRate({
      tenantId: "t-fx",
      fromCurrency: "USD",
      toCurrency: "EUR",
      effectiveDate: "2026-04-01",
      rate: 0.92,
    });
    fx.setFxRate({
      tenantId: "t-fx",
      fromCurrency: "USD",
      toCurrency: "EUR",
      effectiveDate: "2026-04-15",
      rate: 0.93,
    });
    const onApr10 = fx.getFxRate({
      tenantId: "t-fx",
      fromCurrency: "USD",
      toCurrency: "EUR",
      asOf: "2026-04-10",
    });
    expect(onApr10?.rate).toBe(0.92);
    const onApr20 = fx.getFxRate({
      tenantId: "t-fx",
      fromCurrency: "USD",
      toCurrency: "EUR",
      asOf: "2026-04-20",
    });
    expect(onApr20?.rate).toBe(0.93);
    // Identity rate.
    const identity = fx.getFxRate({
      tenantId: "t-fx",
      fromCurrency: "USD",
      toCurrency: "USD",
    });
    expect(identity?.rate).toBe(1);
  });

  it("convert applies the resolved rate", async () => {
    const fx = await import("@gutu-plugin/e-invoicing-core");
    fx.setFxRate({
      tenantId: "t-fx-conv",
      fromCurrency: "USD",
      toCurrency: "INR",
      effectiveDate: "2026-04-01",
      rate: 83.45,
    });
    const c = fx.convert({
      tenantId: "t-fx-conv",
      amountMinor: 100_00,
      fromCurrency: "USD",
      toCurrency: "INR",
      asOf: "2026-04-15",
    });
    expect(c?.amountMinor).toBe(Math.round(100_00 * 83.45));
  });

  it("revaluates a foreign-currency monetary account", async () => {
    const fx = await import("@gutu-plugin/e-invoicing-core");
    const gl = await import("@gutu-plugin/accounting-core");
    const t = "t-fx-rev";
    // Base = USD. AR account is in EUR (foreign).
    const ar = gl.createAccount({
      tenantId: t,
      number: "1200",
      name: "AR EUR",
      accountType: "asset",
      currency: "EUR",
      createdBy: "x",
    });
    const sales = gl.createAccount({
      tenantId: t,
      number: "4000",
      name: "Sales",
      accountType: "income",
      currency: "EUR",
      createdBy: "x",
    });
    const fxGain = gl.createAccount({
      tenantId: t,
      number: "4500",
      name: "FX Gain",
      accountType: "income",
      createdBy: "x",
    });
    const fxLoss = gl.createAccount({
      tenantId: t,
      number: "5500",
      name: "FX Loss",
      accountType: "expense",
      createdBy: "x",
    });
    fx.setFxRate({ tenantId: t, fromCurrency: "EUR", toCurrency: "USD", effectiveDate: "2026-04-01", rate: 1.10 });
    fx.setFxRate({ tenantId: t, fromCurrency: "EUR", toCurrency: "USD", effectiveDate: "2026-04-30", rate: 1.20 });
    // Post a 100 EUR sale on Apr 1 (book base = $110).
    gl.postJournal({
      tenantId: t,
      number: "JV-EUR-1",
      postingDate: "2026-04-01",
      lines: [
        { accountId: ar.id, side: "debit", amountMinor: 10000 },
        { accountId: sales.id, side: "credit", amountMinor: 10000 },
      ],
      createdBy: "x",
    });
    // Revalue at end of month (rate 1.20).
    const out = fx.revaluate({
      tenantId: t,
      baseCurrency: "USD",
      asOf: "2026-04-30",
      glAccountIds: [ar.id],
      gainAccountId: fxGain.id,
      lossAccountId: fxLoss.id,
      postedBy: "x",
    });
    // bookBase: 100 EUR * 1.10 = 110_00 minor (USD).
    // nowBase:  100 EUR * 1.20 = 120_00 minor (USD).
    // delta = +10_00 → gain.
    expect(out.netGainMinor).toBe(1000);
    expect(out.journalId).toBeTruthy();
  });
});

/* ============================== Inter-company ============================ */

describe("intercompany", () => {
  it("mirrors a sales invoice as a purchase bill", async () => {
    const fx = await import("@gutu-plugin/e-invoicing-core");
    const si = await import("@gutu-plugin/sales-core");
    const gl = await import("@gutu-plugin/accounting-core");
    const t = "t-ic";
    const income = gl.createAccount({
      tenantId: t,
      number: "4000",
      name: "Sales",
      accountType: "income",
      createdBy: "x",
    });
    const sourceInvoice = si.createInvoice({
      tenantId: t,
      companyId: "co-A",
      kind: "sales",
      partyResource: "platform.party",
      partyId: "party-A",
      postingDate: "2026-04-01",
      lines: [{ description: "Item", quantity: 1, rateMinor: 10000, incomeAccountId: income.id }],
      createdBy: "x",
    });
    fx.createIntercompanyMapping({
      tenantId: t,
      sellerCompanyId: "co-A",
      buyerCompanyId: "co-B",
      sellerPartyId: "party-A",
      buyerPartyId: "party-B",
      createdBy: "x",
    });
    const out = fx.mirrorSalesAsPurchase({
      tenantId: t,
      sourceInvoiceId: sourceInvoice.id,
      createdBy: "x",
    });
    expect(out.mirrorId).toBeTruthy();
    const mirror = si.getInvoice(t, out.mirrorId);
    expect(mirror?.kind).toBe("purchase");
    expect(mirror?.companyId).toBe("co-B");
    expect(mirror?.totalMinor).toBe(sourceInvoice.totalMinor);
  });

  it("rejects mirror when no mapping is configured", async () => {
    const fx = await import("@gutu-plugin/e-invoicing-core");
    const si = await import("@gutu-plugin/sales-core");
    const gl = await import("@gutu-plugin/accounting-core");
    const t = "t-ic-nomap";
    const income = gl.createAccount({
      tenantId: t,
      number: "4000",
      name: "Sales",
      accountType: "income",
      createdBy: "x",
    });
    const inv = si.createInvoice({
      tenantId: t,
      companyId: "co-Z",
      kind: "sales",
      partyResource: "platform.party",
      partyId: "party-Z",
      postingDate: "2026-04-01",
      lines: [{ description: "x", quantity: 1, rateMinor: 100, incomeAccountId: income.id }],
      createdBy: "x",
    });
    expect(() =>
      fx.mirrorSalesAsPurchase({ tenantId: t, sourceInvoiceId: inv.id, createdBy: "x" }),
    ).toThrow(/mapping/);
  });
});

/* ============================== Regional packs ========================== */

describe("regional-packs", () => {
  it("installs India GST pack and produces tax templates", async () => {
    const fx = await import("@gutu-plugin/e-invoicing-core");
    const si = await import("@gutu-plugin/sales-core");
    fx.installRegionalPack({
      tenantId: "t-rp-in",
      code: "india-gst",
      installedBy: "x",
    });
    const templates = si.listTaxTemplates("t-rp-in");
    // 5 rates × 2 (intra + inter) = 10 templates.
    expect(templates.length).toBeGreaterThanOrEqual(10);
    const intra18 = templates.find((t) => t.name === "GST 18% Intra-state");
    expect(intra18).toBeDefined();
    expect(intra18?.components.length).toBe(2);
  });

  it("computes a GSTR summary across submitted invoices", async () => {
    const fx = await import("@gutu-plugin/e-invoicing-core");
    const si = await import("@gutu-plugin/sales-core");
    const gl = await import("@gutu-plugin/accounting-core");
    const t = "t-gst-rep";
    // Pre-create the tax-component liability accounts so the pack can
    // wire them — this is the production pattern: set up CGST/SGST/IGST
    // liability accounts first, then install the pack with the mapping.
    const cgstLiab = gl.createAccount({
      tenantId: t,
      number: "2410",
      name: "CGST Payable",
      accountType: "liability",
      createdBy: "x",
    });
    const sgstLiab = gl.createAccount({
      tenantId: t,
      number: "2420",
      name: "SGST Payable",
      accountType: "liability",
      createdBy: "x",
    });
    const igstLiab = gl.createAccount({
      tenantId: t,
      number: "2430",
      name: "IGST Payable",
      accountType: "liability",
      createdBy: "x",
    });
    fx.installRegionalPack({
      tenantId: t,
      code: "india-gst",
      taxAccountByLabel: {
        CGST: cgstLiab.id,
        SGST: sgstLiab.id,
        IGST: igstLiab.id,
      },
      installedBy: "x",
    });
    const tpl = si.listTaxTemplates(t).find((x) => x.name === "GST 18% Intra-state")!;
    const ar = gl.createAccount({
      tenantId: t,
      number: "1200",
      name: "AR",
      accountType: "asset",
      createdBy: "x",
    });
    const income = gl.createAccount({
      tenantId: t,
      number: "4000",
      name: "Sales",
      accountType: "income",
      createdBy: "x",
    });
    const inv = si.createInvoice({
      tenantId: t,
      kind: "sales",
      partyResource: "x",
      partyId: "y",
      postingDate: "2026-04-15",
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
    si.submitInvoice({
      tenantId: t,
      id: inv.id,
      receivableAccountId: ar.id,
      submittedBy: "x",
    });
    const summary = fx.gstrSummary({
      tenantId: t,
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
    });
    const row = summary.rows.find((r) => r.rateLabel === "GST 18% Intra-state");
    expect(row?.taxableMinor).toBe(10000);
    expect(row?.cgstMinor).toBe(900);
    expect(row?.sgstMinor).toBe(900);
    expect(summary.totals.taxableMinor).toBe(10000);
  });

  it("EU VAT pack installs four bands", async () => {
    const fx = await import("@gutu-plugin/e-invoicing-core");
    const si = await import("@gutu-plugin/sales-core");
    fx.installRegionalPack({
      tenantId: "t-rp-eu",
      code: "eu-vat",
      installedBy: "x",
    });
    const templates = si.listTaxTemplates("t-rp-eu");
    const standard = templates.find((t) => t.name === "VAT 21%");
    expect(standard).toBeDefined();
    expect(standard?.components[0]?.ratePct).toBe(21);
  });

  it("rejects duplicate install", async () => {
    const fx = await import("@gutu-plugin/e-invoicing-core");
    fx.installRegionalPack({
      tenantId: "t-rp-dup",
      code: "us-sales-tax",
      installedBy: "x",
    });
    expect(() =>
      fx.installRegionalPack({
        tenantId: "t-rp-dup",
        code: "us-sales-tax",
        installedBy: "x",
      }),
    ).toThrow(/already-installed|already/i);
  });
});

/* ============================== PDF helper =============================== */

describe("print-pdf", () => {
  it("buildPrintableHtml injects @page CSS and auto-print", async () => {
    const pdf = await import("@gutu-plugin/template-core");
    const out = pdf.buildPrintableHtml({
      html: "<!doctype html><html><head><title>X</title></head><body>hi</body></html>",
      paperSize: "A4",
      orientation: "portrait",
    });
    expect(out).toContain("@page");
    expect(out).toContain("210mm 297mm");
    expect(out).toContain("window.print()");
  });

  it("renderTemplateToPrintable resolves a template against context", async () => {
    const pdf = await import("@gutu-plugin/template-core");
    const out = await pdf.renderTemplateToPrintable({
      template: "<h1>Hello {{ name }}</h1>",
      context: { name: "Alice" },
      paperSize: "A5",
    });
    expect(out.kind).toBe("html");
    expect(typeof out.body).toBe("string");
    expect((out.body as string)).toContain("Hello Alice");
    expect((out.body as string)).toContain("148mm 210mm");
  });

  it("renderPdf delegates to a registered renderer when present", async () => {
    const pdf = await import("@gutu-plugin/template-core");
    pdf.registerPdfRenderer(async (html) => {
      return new TextEncoder().encode(`PDF:${html.slice(0, 5)}`);
    });
    const out = await pdf.renderPdf({ html: "<html/>" });
    expect(out.kind).toBe("pdf");
    expect(out.contentType).toBe("application/pdf");
    pdf.registerPdfRenderer(null as never);
  });
});
