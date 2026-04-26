/** Phase-2 tests: notification dispatcher, scheduler, GL ledger,
 *  bulk import. Each section is self-contained; we exercise the
 *  primitives directly (not via HTTP) to keep the surface tight.
 *
 *  Setup mirrors customization.test.ts — re-route DB_PATH, run tenancy
 *  and legacy migrations, then import the modules under test. */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "gutu-phase2-test-"));
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

/* ============================== GL Ledger =============================== */

describe("gl-ledger", () => {
  it("creates accounts, posts a balanced journal, computes trial balance", async () => {
    const gl = await import("@gutu-plugin/accounting-core");
    const cash = gl.createAccount({
      tenantId: "t-gl",
      number: "1100",
      name: "Cash",
      accountType: "asset",
      createdBy: "tester",
    });
    const revenue = gl.createAccount({
      tenantId: "t-gl",
      number: "4000",
      name: "Sales Revenue",
      accountType: "income",
      createdBy: "tester",
    });

    const journal = gl.postJournal({
      tenantId: "t-gl",
      number: "JV-0001",
      postingDate: "2026-04-01",
      memo: "Cash sale",
      lines: [
        { accountId: cash.id, side: "debit", amountMinor: 50000 },
        { accountId: revenue.id, side: "credit", amountMinor: 50000 },
      ],
      createdBy: "tester",
    });
    expect(journal.totalDebitMinor).toBe(50000);
    expect(journal.totalCreditMinor).toBe(50000);
    expect(journal.entries).toHaveLength(2);

    const tb = gl.trialBalance({ tenantId: "t-gl" });
    expect(tb.inBalance).toBe(true);
    expect(tb.totalDebitMinor).toBe(50000);
    expect(tb.totalCreditMinor).toBe(50000);

    const bs = gl.balanceSheet({ tenantId: "t-gl", asOf: "2026-12-31" });
    // Income shifts to retained earnings; equity = 500.
    expect(bs.totalAssetsMinor).toBe(50000);
    expect(bs.retainedEarningsMinor).toBe(50000);
    expect(bs.inBalance).toBe(true);

    const pnl = gl.profitAndLoss({ tenantId: "t-gl" });
    expect(pnl.netIncomeMinor).toBe(50000);
  });

  it("rejects imbalanced journals", async () => {
    const gl = await import("@gutu-plugin/accounting-core");
    const a = gl.createAccount({
      tenantId: "t-gl-bad",
      number: "1000",
      name: "A",
      accountType: "asset",
      createdBy: "x",
    });
    const b = gl.createAccount({
      tenantId: "t-gl-bad",
      number: "2000",
      name: "B",
      accountType: "liability",
      createdBy: "x",
    });
    expect(() =>
      gl.postJournal({
        tenantId: "t-gl-bad",
        number: "JV-IMB",
        postingDate: "2026-04-01",
        lines: [
          { accountId: a.id, side: "debit", amountMinor: 100 },
          { accountId: b.id, side: "credit", amountMinor: 90 },
        ],
        createdBy: "x",
      }),
    ).toThrow(/balance/);
  });

  it("is idempotent on repeated posting with same idempotencyKey", async () => {
    const gl = await import("@gutu-plugin/accounting-core");
    const a = gl.createAccount({
      tenantId: "t-gl-idem",
      number: "1000",
      name: "A",
      accountType: "asset",
      createdBy: "x",
    });
    const b = gl.createAccount({
      tenantId: "t-gl-idem",
      number: "4000",
      name: "B",
      accountType: "income",
      createdBy: "x",
    });
    const args = {
      tenantId: "t-gl-idem",
      number: "JV-IDEM-1",
      postingDate: "2026-04-01",
      idempotencyKey: "src:invoice:42:rev:1",
      lines: [
        { accountId: a.id, side: "debit" as const, amountMinor: 1234 },
        { accountId: b.id, side: "credit" as const, amountMinor: 1234 },
      ],
      createdBy: "x",
    };
    const first = gl.postJournal(args);
    const second = gl.postJournal({ ...args, number: "JV-IDEM-2" });
    expect(second.id).toBe(first.id);
    expect(second.number).toBe(first.number);
  });

  it("reverses a journal as a contra entry", async () => {
    const gl = await import("@gutu-plugin/accounting-core");
    const a = gl.createAccount({
      tenantId: "t-gl-rev",
      number: "1000",
      name: "A",
      accountType: "asset",
      createdBy: "x",
    });
    const b = gl.createAccount({
      tenantId: "t-gl-rev",
      number: "2000",
      name: "B",
      accountType: "liability",
      createdBy: "x",
    });
    const j = gl.postJournal({
      tenantId: "t-gl-rev",
      number: "JV-R-1",
      postingDate: "2026-04-01",
      lines: [
        { accountId: a.id, side: "debit", amountMinor: 1000 },
        { accountId: b.id, side: "credit", amountMinor: 1000 },
      ],
      createdBy: "x",
    });
    const r = gl.reverseJournal({
      tenantId: "t-gl-rev",
      journalId: j.id,
      reversalNumber: "JV-R-1-REV",
      createdBy: "x",
    });
    expect(r.reversesJournalId).toBe(j.id);
    // After reversal, trial balance is back to zero.
    const tb = gl.trialBalance({ tenantId: "t-gl-rev" });
    expect(tb.inBalance).toBe(true);
    // Balances net to zero.
    for (const row of tb.rows) {
      expect(row.balanceMinor).toBe(0);
    }
  });

  it("refuses to post to a group account or to a closed period", async () => {
    const gl = await import("@gutu-plugin/accounting-core");
    const group = gl.createAccount({
      tenantId: "t-gl-rules",
      number: "1000",
      name: "Assets",
      accountType: "asset",
      isGroup: true,
      createdBy: "x",
    });
    const child = gl.createAccount({
      tenantId: "t-gl-rules",
      number: "1100",
      name: "Cash",
      accountType: "asset",
      parentId: group.id,
      createdBy: "x",
    });
    const inc = gl.createAccount({
      tenantId: "t-gl-rules",
      number: "4000",
      name: "Inc",
      accountType: "income",
      createdBy: "x",
    });
    expect(() =>
      gl.postJournal({
        tenantId: "t-gl-rules",
        number: "JV-G",
        postingDate: "2026-04-01",
        lines: [
          { accountId: group.id, side: "debit", amountMinor: 100 },
          { accountId: inc.id, side: "credit", amountMinor: 100 },
        ],
        createdBy: "x",
      }),
    ).toThrow(/group account/);

    const period = gl.createPeriod({
      tenantId: "t-gl-rules",
      label: "FY2025-Q1",
      startDate: "2025-01-01",
      endDate: "2025-03-31",
    });
    gl.closePeriod({ tenantId: "t-gl-rules", id: period.id, closedBy: "x" });
    expect(() =>
      gl.postJournal({
        tenantId: "t-gl-rules",
        number: "JV-CP",
        postingDate: "2025-02-15",
        lines: [
          { accountId: child.id, side: "debit", amountMinor: 50 },
          { accountId: inc.id, side: "credit", amountMinor: 50 },
        ],
        createdBy: "x",
      }),
    ).toThrow(/closed period/i);
    // With override, posting succeeds.
    const ok = gl.postJournal({
      tenantId: "t-gl-rules",
      number: "JV-CP-OK",
      postingDate: "2025-02-15",
      lines: [
        { accountId: child.id, side: "debit", amountMinor: 50 },
        { accountId: inc.id, side: "credit", amountMinor: 50 },
      ],
      allowClosedPeriod: true,
      createdBy: "x",
    });
    expect(ok.totalDebitMinor).toBe(50);
  });
});

/* ============================== Connections ============================= */

describe("connections backend", () => {
  it("derives groups from record_links + GL journals", async () => {
    const gl = await import("@gutu-plugin/accounting-core");
    const { db, nowIso } = await import("../db");
    const { uuid } = await import("./id");

    // Seed: one record + a few links + a posted journal sourced from it.
    const tenant = "t-conn";
    const sourceResource = "accounting.invoice";
    const sourceId = uuid();
    db.prepare(
      `INSERT INTO records (resource, id, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      sourceResource,
      sourceId,
      JSON.stringify({ id: sourceId, tenantId: tenant, name: "INV-1" }),
      nowIso(),
      nowIso(),
    );
    // Outbound links to two contacts.
    const otherA = uuid();
    const otherB = uuid();
    for (const [resource, id, label] of [
      ["crm.contact", otherA, "Contact A"],
      ["crm.contact", otherB, "Contact B"],
    ] as const) {
      db.prepare(
        `INSERT INTO records (resource, id, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        resource,
        id,
        JSON.stringify({ id, tenantId: tenant, name: label }),
        nowIso(),
        nowIso(),
      );
      db.prepare(
        `INSERT INTO record_links
           (id, tenant_id, from_resource, from_id, to_resource, to_id, kind, payload, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'related', NULL, 'system', ?)`,
      ).run(uuid(), tenant, sourceResource, sourceId, resource, id, nowIso());
    }

    // Inbound link: a payment references the invoice.
    const paymentId = uuid();
    db.prepare(
      `INSERT INTO records (resource, id, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      "accounting.payment",
      paymentId,
      JSON.stringify({ id: paymentId, tenantId: tenant, name: "PAY-1" }),
      nowIso(),
      nowIso(),
    );
    db.prepare(
      `INSERT INTO record_links
         (id, tenant_id, from_resource, from_id, to_resource, to_id, kind, payload, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'related', NULL, 'system', ?)`,
    ).run(uuid(), tenant, "accounting.payment", paymentId, sourceResource, sourceId, nowIso());

    // GL journal sourced from this invoice.
    const cash = gl.createAccount({
      tenantId: tenant,
      number: "1100",
      name: "Cash",
      accountType: "asset",
      createdBy: "x",
    });
    const inc = gl.createAccount({
      tenantId: tenant,
      number: "4000",
      name: "Sales",
      accountType: "income",
      createdBy: "x",
    });
    gl.postJournal({
      tenantId: tenant,
      number: "JV-CONN-1",
      postingDate: "2026-04-01",
      sourceResource,
      sourceRecordId: sourceId,
      lines: [
        { accountId: cash.id, side: "debit", amountMinor: 1000 },
        { accountId: inc.id, side: "credit", amountMinor: 1000 },
      ],
      createdBy: "x",
    });

    // Pull groups directly using the same SQL the route uses.
    const outbound = db
      .prepare(
        `SELECT to_resource, kind, COUNT(*) as count FROM record_links
          WHERE tenant_id = ? AND from_resource = ? AND from_id = ?
          GROUP BY to_resource, kind`,
      )
      .all(tenant, sourceResource, sourceId) as Array<{ to_resource: string; kind: string; count: number }>;
    expect(outbound.find((g) => g.to_resource === "crm.contact")?.count).toBe(2);

    const inbound = db
      .prepare(
        `SELECT from_resource, kind, COUNT(*) as count FROM record_links
          WHERE tenant_id = ? AND to_resource = ? AND to_id = ?
          GROUP BY from_resource, kind`,
      )
      .all(tenant, sourceResource, sourceId) as Array<{ from_resource: string; kind: string; count: number }>;
    expect(inbound.find((g) => g.from_resource === "accounting.payment")?.count).toBe(1);

    const journals = db
      .prepare(
        `SELECT id, number FROM gl_journals
          WHERE tenant_id = ? AND source_resource = ? AND source_record_id = ?`,
      )
      .all(tenant, sourceResource, sourceId);
    expect(journals.length).toBe(1);
  });
});

/* ============================== Bulk Import ============================= */

describe("bulk-import", () => {
  it("parses CSV with quoted fields and embedded commas", async () => {
    const bi = await import("@gutu-plugin/integration-core");
    const csv = `name,email,note
"Acme, Inc.",billing@acme.com,"Has \\"special\\" chars"
Beta,beta@x.com,Plain row`;
    const r = bi.parseCsv(csv);
    expect(r.headers).toEqual(["name", "email", "note"]);
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.name).toBe("Acme, Inc.");
  });

  it("parses JSON arrays and JSONL", async () => {
    const bi = await import("@gutu-plugin/integration-core");
    const arr = bi.parseJsonOrJsonl(`[{"a":1,"b":"x"},{"a":2,"b":"y"}]`);
    expect(arr.format).toBe("json");
    expect(arr.rows.length).toBe(2);
    const lines = bi.parseJsonOrJsonl(`{"a":1}\n{"a":2}`);
    expect(lines.format).toBe("jsonl");
    expect(lines.rows.length).toBe(2);
  });

  it("commits an insert atomically and reports per-row results", async () => {
    const bi = await import("@gutu-plugin/integration-core");
    const parsed = bi.parseCsv(`id,name,email
abc-1,Acme,a@x.com
abc-2,Beta,b@x.com`);
    const result = bi.importBulk({
      tenantId: "t-bi",
      resource: "test.contact",
      parsed,
      mapping: { id: "id", name: "name", email: "email" },
      strategy: "insert",
      dryRun: false,
      createdBy: "tester",
    });
    expect(result.ok).toBe(2);
    expect(result.errors).toBe(0);
    // The records exist in the records table.
    const { db } = await import("../db");
    const rows = db
      .prepare(`SELECT id FROM records WHERE resource = ?`)
      .all("test.contact") as Array<{ id: string }>;
    expect(rows.map((r) => r.id).sort()).toEqual(["abc-1", "abc-2"]);
  });

  it("dry-run reports validation errors without writing", async () => {
    const bi = await import("@gutu-plugin/integration-core");
    const parsed = bi.parseCsv(`id,note\nx-1,hello`);
    const result = bi.importBulk({
      tenantId: "t-bi-dry",
      resource: "test.dry",
      parsed,
      mapping: { id: "id", note: "note" },
      strategy: "insert",
      dryRun: true,
      createdBy: "tester",
    });
    expect(result.ok).toBe(1);
    const { db } = await import("../db");
    const rows = db
      .prepare(`SELECT id FROM records WHERE resource = ?`)
      .all("test.dry") as Array<{ id: string }>;
    expect(rows.length).toBe(0);
  });

  it("upsert updates an existing record", async () => {
    const bi = await import("@gutu-plugin/integration-core");
    const ins = bi.parseCsv(`id,name\nu-1,Original`);
    bi.importBulk({
      tenantId: "t-bi-up",
      resource: "test.upsert",
      parsed: ins,
      mapping: { id: "id", name: "name" },
      strategy: "insert",
      dryRun: false,
      createdBy: "x",
    });
    const upd = bi.parseCsv(`id,name\nu-1,Updated`);
    const r = bi.importBulk({
      tenantId: "t-bi-up",
      resource: "test.upsert",
      parsed: upd,
      mapping: { id: "id", name: "name" },
      strategy: "upsert",
      dryRun: false,
      createdBy: "x",
    });
    expect(r.ok).toBe(1);
    const { db } = await import("../db");
    const row = db
      .prepare(`SELECT data FROM records WHERE resource = ? AND id = ?`)
      .get("test.upsert", "u-1") as { data: string };
    expect(JSON.parse(row.data).name).toBe("Updated");
  });
});

/* ============================== Notification dispatcher ================== */

describe("notification-dispatcher", () => {
  it("drains pending in-app deliveries to record_links, marks sent", async () => {
    const nr = await import("@gutu-plugin/notifications-core");
    const dispatcher = await import("@gutu-plugin/notifications-core");
    const rule = nr.createNotificationRule({
      tenantId: "t-disp",
      name: "ping",
      resource: "test.ping",
      event: "create",
      channels: [{ kind: "in-app", config: { recipients: ["user:abc"] } }],
      bodyTemplate: "hello {{ name }}",
      createdBy: "x",
    });
    const fired = nr.fireEvent({
      tenantId: "t-disp",
      resource: "test.ping",
      event: "create",
      recordId: "rec-1",
      record: { id: "rec-1", name: "world" },
    });
    expect(fired.deliveries).toBe(1);

    const result = await dispatcher.drainOnce(10);
    expect(result.attempted).toBeGreaterThanOrEqual(1);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    // Verify a record_link was created.
    const { db } = await import("../db");
    const links = db
      .prepare(
        `SELECT * FROM record_links
           WHERE tenant_id = ? AND from_resource = ? AND from_id = ? AND kind = 'notification'`,
      )
      .all("t-disp", "test.ping", "rec-1");
    expect(links.length).toBeGreaterThan(0);
    // touched: rule was used
    expect(rule.id.length).toBeGreaterThan(0);
  });

  it("retries failed webhook deliveries up to max attempts", async () => {
    const nr = await import("@gutu-plugin/notifications-core");
    const dispatcher = await import("@gutu-plugin/notifications-core");
    nr.createNotificationRule({
      tenantId: "t-disp-fail",
      name: "wh-fail",
      resource: "test.fail",
      event: "create",
      // Webhook with no URL → handler throws → dispatcher records failure.
      channels: [{ kind: "webhook", config: {} }],
      bodyTemplate: "noop",
      createdBy: "x",
    });
    nr.fireEvent({
      tenantId: "t-disp-fail",
      resource: "test.fail",
      event: "create",
      recordId: "rec-fail",
      record: {},
    });
    // First attempt — should record an error and bump attempts.
    await dispatcher.drainOnce(5);
    const { db } = await import("../db");
    const row = db
      .prepare(
        `SELECT attempts, status, last_error FROM notification_deliveries
          WHERE tenant_id = ? AND resource = ?`,
      )
      .get("t-disp-fail", "test.fail") as { attempts: number; status: string; last_error: string };
    expect(row.attempts).toBeGreaterThanOrEqual(1);
    expect(row.last_error).toContain("url");
  });

  it("replay flips failed deliveries back to pending", async () => {
    const dispatcher = await import("@gutu-plugin/notifications-core");
    const { db } = await import("../db");
    const row = db
      .prepare(
        `SELECT id FROM notification_deliveries
           WHERE tenant_id = 't-disp-fail' LIMIT 1`,
      )
      .get() as { id: string } | undefined;
    if (!row) throw new Error("expected a delivery from previous test");
    // Force into failed state.
    db.prepare(
      `UPDATE notification_deliveries SET status = 'failed' WHERE id = ?`,
    ).run(row.id);
    expect(dispatcher.replayDelivery("t-disp-fail", row.id)).toBe(true);
    const after = db
      .prepare(`SELECT status FROM notification_deliveries WHERE id = ?`)
      .get(row.id) as { status: string };
    expect(after.status).toBe("pending");
  });
});

/* ============================== Notification scheduler =================== */

describe("notification-scheduler", () => {
  it("fires days-after when the trigger field falls in the day window", async () => {
    const nr = await import("@gutu-plugin/notifications-core");
    const sched = await import("@gutu-plugin/notifications-core");
    const { db, nowIso } = await import("../db");
    const { uuid } = await import("./id");

    // Yesterday → 1 day after = today.
    const yesterday = new Date(Date.now() - 86_400_000);
    yesterday.setUTCHours(8, 30, 0, 0);

    const rule = nr.createNotificationRule({
      tenantId: "t-sched",
      name: "follow up",
      resource: "test.due",
      event: "days-after",
      triggerField: "due_date",
      offsetDays: 1,
      channels: [{ kind: "in-app", config: { recipients: ["owner"] } }],
      bodyTemplate: "follow up on {{ name }}",
      createdBy: "x",
    });
    // Insert a record matching the window.
    const recId = uuid();
    db.prepare(
      `INSERT INTO records (resource, id, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      "test.due",
      recId,
      JSON.stringify({
        id: recId,
        tenantId: "t-sched",
        name: "Test",
        due_date: yesterday.toISOString(),
      }),
      nowIso(),
      nowIso(),
    );

    sched.runSchedulerTickForTest();
    const runs = sched.getScheduleRunsForTest(rule.id);
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs[0]?.recordId).toBe(recId);

    // Run again — same day bucket; should NOT double-fire.
    sched.runSchedulerTickForTest();
    const runs2 = sched.getScheduleRunsForTest(rule.id);
    expect(runs2.length).toBe(runs.length);
  });

  it("evaluates cron expressions correctly", async () => {
    // Indirectly test cronMatches via a minute-precise rule.
    const nr = await import("@gutu-plugin/notifications-core");
    const sched = await import("@gutu-plugin/notifications-core");
    const now = new Date();
    const cron = `${now.getUTCMinutes()} ${now.getUTCHours()} * * *`;
    nr.createNotificationRule({
      tenantId: "t-cron",
      name: "every-day",
      resource: "test.cron",
      event: "cron",
      cronExpr: cron,
      channels: [{ kind: "in-app", config: { recipients: ["ops"] } }],
      bodyTemplate: "ping",
      createdBy: "x",
    });
    sched.runSchedulerTickForTest();
    const { db } = await import("../db");
    const runs = db
      .prepare(`SELECT * FROM notification_schedule_runs WHERE rule_id IN (
                  SELECT id FROM notification_rules WHERE tenant_id = ?)`)
      .all("t-cron");
    expect(runs.length).toBe(1);
  });
});
