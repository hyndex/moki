import { beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let app: Awaited<ReturnType<typeof setup>>;

async function setup() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "gutu-erp-actions-test-"));
  process.env.DB_PATH ??= path.join(dataDir, "test.db");
  process.env.STORAGE_SIGNING_KEY ??= "k".repeat(64);
  process.env.NODE_ENV = "test";

  const { resetConfig } = await import("../../src/config");
  resetConfig();
  const { migrate } = await import("../../src/migrations");
  migrate();
  const tenancyMig = await import("../../src/tenancy/migrations");
  await tenancyMig.migrateGlobal();

  const { db } = await import("../../src/db");
  const tenantId = `tenant-erp-actions-${Date.now()}`;
  const token = `erp-actions-token-${Date.now()}`;
  db.exec(`PRAGMA foreign_keys = OFF`);
  db.prepare(
    `INSERT OR REPLACE INTO tenants (id, slug, name, schema_name, status, plan, settings, created_at, updated_at)
     VALUES (?, ?, 'ERP Actions', 'tenant_erp_actions', 'active', 'builtin', '{}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
  ).run(tenantId, `erp-actions-${Date.now()}`);
  db.prepare(
    `INSERT OR REPLACE INTO users (id, email, name, role, password_hash, mfa_enabled, created_at, updated_at)
     VALUES ('erp-user-1', 'erp-actions@gutu.dev', 'ERP Actions', 'admin', 'x', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
  ).run();
  db.prepare(
    `INSERT INTO tenant_memberships (tenant_id, user_id, role, joined_at)
     VALUES (?, 'erp-user-1', 'owner', '2026-01-01T00:00:00.000Z')
     ON CONFLICT(tenant_id, user_id) DO UPDATE SET role = 'owner'`,
  ).run(tenantId);
  db.prepare(
    `INSERT OR REPLACE INTO sessions (token, user_id, tenant_id, created_at, expires_at, ua, ip)
     VALUES (?, 'erp-user-1', ?, '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z', 'test', '127.0.0.1')`,
  ).run(token, tenantId);

  const { createApp } = await import("../../src/server");
  return { app: createApp(), tenantId, token, db };
}

beforeAll(async () => {
  app = await setup();
});

function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${app.token}`);
  headers.set("x-tenant", app.tenantId);
  return app.app.fetch(new Request(`http://localhost${input}`, { ...init, headers }));
}

async function createRecord(resource: string, body: Record<string, unknown>) {
  const res = await authedFetch(`/api/resources/${encodeURIComponent(resource)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(201);
  return await res.json() as Record<string, unknown>;
}

describe("ERP actions API", () => {
  it("maps a source document into a downstream document with idempotency, links, and timeline", async () => {
    const quote = await createRecord("sales.quote", {
      id: "quote-erp-1",
      number: "QTN-0001",
      account: "Initech",
      customer: "Initech",
      amount: 12500,
      currency: "USD",
      status: "accepted",
      items: [
        { item: "SKU-001", description: "Implementation", quantity: 2, rate: 5000, amount: 10000 },
        { item: "SKU-002", description: "Support", quantity: 1, rate: 2500, amount: 2500 },
      ],
    });

    const action = {
      id: "quotation-to-sales-order",
      label: "Create Sales Order",
      relation: "creates-sales-order",
      targetResourceId: "sales.order",
      targetDocumentType: "selling.Sales Order",
      visibleInStatuses: ["accepted"],
      fieldMap: { customer: "customer", amount: "amount", currency: "currency" },
      childTableMap: { items: "items" },
      defaults: { status: "draft" },
    };

    const first = await authedFetch("/api/erp/actions/map-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceResource: "sales.quote",
        sourceId: quote.id,
        action,
        idempotencyKey: "quote-erp-1:to-order",
      }),
    });
    expect(first.status).toBe(201);
    const created = await first.json() as {
      mapping: { targetResource: string; targetId: string; relation: string };
      target: Record<string, unknown>;
      reused: boolean;
    };
    expect(created.reused).toBe(false);
    expect(created.mapping.targetResource).toBe("sales.order");
    expect(created.mapping.relation).toBe("creates-sales-order");
    expect(created.target.customer).toBe("Initech");
    expect(created.target.status).toBe("draft");
    expect((created.target.items as unknown[]).length).toBe(2);

    const replay = await authedFetch("/api/erp/actions/map-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceResource: "sales.quote",
        sourceId: quote.id,
        action,
        idempotencyKey: "quote-erp-1:to-order",
      }),
    });
    expect(replay.status).toBe(200);
    const replayed = await replay.json() as { mapping: { targetId: string }; reused: boolean };
    expect(replayed.reused).toBe(true);
    expect(replayed.mapping.targetId).toBe(created.mapping.targetId);

    const target = await authedFetch(`/api/resources/sales.order/${created.mapping.targetId}`);
    expect(target.status).toBe(200);
    const related = await authedFetch("/api/erp/related/sales.quote/quote-erp-1");
    expect(related.status).toBe(200);
    const relatedBody = await related.json() as { rows: { targetId: string }[] };
    expect(relatedBody.rows.some((row) => row.targetId === created.mapping.targetId)).toBe(true);

    const links = await authedFetch("/api/record-links/around/sales.quote/quote-erp-1");
    expect(links.status).toBe(200);
    const linkBody = await links.json() as { rows: { toId: string; kind: string }[] };
    expect(linkBody.rows.some((row) => row.toId === created.mapping.targetId && row.kind === "creates-sales-order")).toBe(true);

    const timeline = await authedFetch("/api/timeline/sales.quote/quote-erp-1");
    expect(timeline.status).toBe(200);
    const timelineBody = await timeline.json() as { rows: { kind: string; message: string }[] };
    expect(timelineBody.rows.some((row) => row.kind === "erp-mapping" && row.message.includes("sales.order"))).toBe(true);
  });

  it("rejects ineligible document states and unbalanced accounting postings", async () => {
    await createRecord("sales.quote", {
      id: "quote-erp-draft",
      number: "QTN-DRAFT",
      account: "Globex",
      amount: 5000,
      currency: "USD",
      status: "draft",
    });
    const ineligible = await authedFetch("/api/erp/actions/map-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceResource: "sales.quote",
        sourceId: "quote-erp-draft",
        action: {
          id: "quotation-to-sales-order",
          label: "Create Sales Order",
          relation: "creates-sales-order",
          targetResourceId: "sales.order",
          visibleInStatuses: ["accepted"],
        },
      }),
    });
    expect(ineligible.status).toBe(409);

    await createRecord("accounting.invoice", {
      id: "invoice-erp-1",
      number: "INV-0001",
      customer: "Initech",
      amount: 12500,
      currency: "USD",
      status: "submitted",
    });
    const unbalanced = await authedFetch("/api/erp/actions/postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: "accounting",
        voucherResource: "accounting.invoice",
        voucherId: "invoice-erp-1",
        idempotencyKey: "invoice-erp-1:bad-post",
        entries: [
          { account: "Accounts Receivable", debit: 12500, currency: "USD" },
          { account: "Sales", credit: 12000, currency: "USD" },
        ],
      }),
    });
    expect(unbalanced.status).toBe(422);

    const balanced = await authedFetch("/api/erp/actions/postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: "accounting",
        voucherResource: "accounting.invoice",
        voucherId: "invoice-erp-1",
        idempotencyKey: "invoice-erp-1:post",
        entries: [
          { account: "Accounts Receivable", debit: 12500, currency: "USD" },
          { account: "Sales", credit: 12500, currency: "USD" },
        ],
      }),
    });
    expect(balanced.status).toBe(201);
    const posted = await balanced.json() as { batch: { id: string }; reused: boolean };
    expect(posted.reused).toBe(false);
    const entryCount = app.db
      .prepare("SELECT COUNT(*) AS c FROM erp_posting_entries WHERE batch_id = ?")
      .get(posted.batch.id) as { c: number };
    expect(entryCount.c).toBe(2);

    const replay = await authedFetch("/api/erp/actions/postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: "accounting",
        voucherResource: "accounting.invoice",
        voucherId: "invoice-erp-1",
        idempotencyKey: "invoice-erp-1:post",
        entries: [
          { account: "Accounts Receivable", debit: 12500, currency: "USD" },
          { account: "Sales", credit: 12500, currency: "USD" },
        ],
      }),
    });
    expect(replay.status).toBe(200);
    const replayed = await replay.json() as { batch: { id: string }; reused: boolean };
    expect(replayed.reused).toBe(true);
    expect(replayed.batch.id).toBe(posted.batch.id);

    const preview = await authedFetch("/api/erp/actions/postings/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: "accounting",
        voucherResource: "accounting.invoice",
        voucherId: "invoice-erp-1",
        entries: [
          { account: "Accounts Receivable", debit: 12500, currency: "USD" },
          { account: "Sales", credit: 12000, currency: "USD" },
        ],
      }),
    });
    expect(preview.status).toBe(200);
    const previewed = await preview.json() as { batch: { status: string }; imbalance: { delta: number }[] };
    expect(previewed.batch.status).toBe("invalid");
    expect(previewed.imbalance[0]?.delta).toBe(500);

    const ledger = await authedFetch("/api/erp/ledger/accounting.invoice/invoice-erp-1");
    expect(ledger.status).toBe(200);
    const ledgerBody = await ledger.json() as { rows: { account: string; debit: number; credit: number }[] };
    expect(ledgerBody.rows.some((row) => row.account === "Accounts Receivable" && row.debit === 12500)).toBe(true);

    const gl = await authedFetch("/api/erp/reports/general-ledger?resource=accounting.invoice&recordId=invoice-erp-1");
    expect(gl.status).toBe(200);
    const glBody = await gl.json() as { totals: { debit: number; credit: number } };
    expect(glBody.totals.debit).toBe(12500);
    expect(glBody.totals.credit).toBe(12500);

    const reverse = await authedFetch("/api/erp/actions/reverse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "accounting.invoice",
        recordId: "invoice-erp-1",
        idempotencyKey: "invoice-erp-1:reverse",
        reason: "Test reversal",
      }),
    });
    expect(reverse.status).toBe(201);
    const reversed = await reverse.json() as { batch: { id: string; status: string }; reused: boolean };
    expect(reversed.reused).toBe(false);
    expect(reversed.batch.status).toBe("reversed");
    const reverseReplay = await authedFetch("/api/erp/actions/reverse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "accounting.invoice",
        recordId: "invoice-erp-1",
        idempotencyKey: "invoice-erp-1:reverse",
      }),
    });
    expect(reverseReplay.status).toBe(200);
    const reverseReplayed = await reverseReplay.json() as { batch: { id: string }; reused: boolean };
    expect(reverseReplayed.reused).toBe(true);
    expect(reverseReplayed.batch.id).toBe(reversed.batch.id);
  });

  it("applies workflow transitions, cancellation, reconciliation, and stock postings", async () => {
    await createRecord("inventory.stock-entry", {
      id: "stock-entry-erp-1",
      status: "draft",
      item: "SKU-STOCK",
      warehouse: "Stores",
      quantity: 4,
      valuationRate: 50,
      amount: 200,
    });

    const transition = await authedFetch("/api/erp/actions/transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "inventory.stock-entry",
        recordId: "stock-entry-erp-1",
        stateField: "status",
        from: "draft",
        to: "submitted",
      }),
    });
    expect(transition.status).toBe(200);
    const transitioned = await transition.json() as { record: { status: string } };
    expect(transitioned.record.status).toBe("submitted");

    const stockPost = await authedFetch("/api/erp/actions/postings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: "stock",
        voucherResource: "inventory.stock-entry",
        voucherId: "stock-entry-erp-1",
        idempotencyKey: "stock-entry-erp-1:post",
        entries: [
          { item: "SKU-STOCK", warehouse: "Stores", quantity: 4, valuationRate: 50, amount: 200 },
        ],
      }),
    });
    expect(stockPost.status).toBe(201);

    const stock = await authedFetch("/api/erp/stock/inventory.stock-entry/stock-entry-erp-1");
    expect(stock.status).toBe(200);
    const stockBody = await stock.json() as { rows: { item: string; quantity: number; amount: number }[] };
    expect(stockBody.rows.some((row) => row.item === "SKU-STOCK" && row.quantity === 4 && row.amount === 200)).toBe(true);

    const reconcile = await authedFetch("/api/erp/actions/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "inventory.stock-entry",
        recordId: "stock-entry-erp-1",
        idempotencyKey: "stock-entry-erp-1:reconcile",
        reconciliationKey: "count-2026-04",
        matchedRecordIds: ["bin-1"],
      }),
    });
    expect(reconcile.status).toBe(200);
    const reconciled = await reconcile.json() as { record: { reconciliationStatus: string; reconciliationKey: string } };
    expect(reconciled.record.reconciliationStatus).toBe("reconciled");
    expect(reconciled.record.reconciliationKey).toBe("count-2026-04");

    const cancel = await authedFetch("/api/erp/actions/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "inventory.stock-entry",
        recordId: "stock-entry-erp-1",
        idempotencyKey: "stock-entry-erp-1:cancel",
        reason: "Operator correction",
      }),
    });
    expect(cancel.status).toBe(200);
    const cancelled = await cancel.json() as { record: { status: string; cancellationReason: string } };
    expect(cancelled.record.status).toBe("cancelled");
    expect(cancelled.record.cancellationReason).toBe("Operator correction");

    const cancelReplay = await authedFetch("/api/erp/actions/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "inventory.stock-entry",
        recordId: "stock-entry-erp-1",
        idempotencyKey: "stock-entry-erp-1:cancel",
      }),
    });
    expect(cancelReplay.status).toBe(200);
    const replayed = await cancelReplay.json() as { reused: boolean };
    expect(replayed.reused).toBe(true);
  });

  it("renders redacted print documents and serves revocable hashed portal links", async () => {
    await createRecord("accounting.invoice", {
      id: "invoice-print-1",
      number: "INV-PRINT-0001",
      customer: "Initech",
      amount: 321,
      currency: "USD",
      status: "submitted",
      secretToken: "do-not-render",
      items: [
        { item: "SKU-PRINT", description: "Printable service", quantity: 3, rate: 107, amount: 321 },
      ],
    });

    const print = await authedFetch("/api/erp/print/accounting.invoice/invoice-print-1?format=standard-tax-invoice");
    expect(print.status).toBe(200);
    const printBody = await print.json() as { html: string; title: string; childTables: { key: string }[] };
    expect(printBody.title).toBe("INV-PRINT-0001");
    expect(printBody.html).toContain("INV-PRINT-0001");
    expect(printBody.html).toContain("Printable service");
    expect(printBody.html).not.toContain("do-not-render");
    expect(printBody.childTables.some((table) => table.key === "items")).toBe(true);

    const created = await authedFetch("/api/erp/portal-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "accounting.invoice",
        recordId: "invoice-print-1",
        audience: "customer",
        formatId: "standard-tax-invoice",
        title: "Customer invoice",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    });
    expect(created.status).toBe(201);
    const link = await created.json() as { id: string; token: string; url: string };
    expect(link.token.length).toBeGreaterThan(32);
    const persisted = app.db
      .prepare("SELECT token_hash, access_count FROM erp_portal_links WHERE id = ?")
      .get(link.id) as { token_hash: string; access_count: number };
    expect(persisted.token_hash).not.toBe(link.token);
    expect(persisted.access_count).toBe(0);

    const publicRes = await app.app.fetch(new Request(`http://localhost${link.url}`));
    expect(publicRes.status).toBe(200);
    const publicBody = await publicRes.json() as { html: string; portal: { accessCount: number } };
    expect(publicBody.html).toContain("Customer invoice");
    expect(publicBody.html).toContain("Printable service");
    expect(publicBody.html).not.toContain("do-not-render");
    expect(publicBody.portal.accessCount).toBe(1);

    app.db
      .prepare("UPDATE erp_portal_links SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?")
      .run(link.id);
    const expired = await app.app.fetch(new Request(`http://localhost${link.url}`));
    expect(expired.status).toBe(410);

    const second = await authedFetch("/api/erp/portal-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: "accounting.invoice",
        recordId: "invoice-print-1",
        audience: "customer",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    });
    expect(second.status).toBe(201);
    const secondLink = await second.json() as { id: string; token: string; url: string };
    const revoke = await authedFetch(`/api/erp/portal-links/${secondLink.id}/revoke`, { method: "POST" });
    expect(revoke.status).toBe(200);
    const revoked = await app.app.fetch(new Request(`http://localhost${secondLink.url}`));
    expect(revoked.status).toBe(404);
  });
});
