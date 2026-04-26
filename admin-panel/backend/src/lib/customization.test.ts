/** Customization layer smoke tests.
 *
 *  Covers, in one file:
 *    - template-engine.ts                — render scalar / for / if / filters / errors
 *    - naming-series.ts                  — pattern parse, atomic next(), bucket reset
 *    - property-setters.ts               — upsert, listing, scope priority
 *    - notification-rules.ts             — create, evaluate condition, fire→deliveries
 *    - print-format.ts                   — create, render with letterhead
 *
 *  Pattern matches workflow/engine.test.ts: re-route DB_PATH before
 *  importing db.ts, run tenancy + legacy migrations, then exercise. */

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "gutu-cust-test-"));
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

describe("template-engine", () => {
  it("interpolates scalars + paths", async () => {
    const { renderTemplate } = await import("@gutu-plugin/template-core");
    const r = renderTemplate("Hello {{ user.name }}!", { user: { name: "Sam" } });
    expect(r.output).toBe("Hello Sam!");
    expect(r.errors).toHaveLength(0);
  });

  it("escapes by default; safe filter opts out", async () => {
    const { renderTemplate } = await import("@gutu-plugin/template-core");
    expect(renderTemplate("{{ x }}", { x: "<b>hi</b>" }).output).toBe("&lt;b&gt;hi&lt;/b&gt;");
    expect(renderTemplate("{{ x | safe }}", { x: "<b>hi</b>" }).output).toBe("<b>hi</b>");
  });

  it("supports for + if + currency filter", async () => {
    const { renderTemplate } = await import("@gutu-plugin/template-core");
    const tpl = `{% for line in items %}{{ line.qty }}x {{ line.name }}={{ line.amount | currency("EUR") }}{% if loop.last %}.{% else %}, {% endif %}{% endfor %}`;
    const out = renderTemplate(tpl, {
      items: [
        { name: "A", qty: 2, amount: 100 },
        { name: "B", qty: 1, amount: 50 },
      ],
    });
    expect(out.output).toContain("2x A=");
    expect(out.output).toContain("€100.00");
    expect(out.output).toContain(".");
    expect(out.errors).toHaveLength(0);
  });

  it("falls back gracefully on bad expressions", async () => {
    const { renderTemplate } = await import("@gutu-plugin/template-core");
    const out = renderTemplate("{{ deep.nested.missing }}", {});
    expect(out.output).toBe("");
    expect(out.errors).toHaveLength(0); // missing fields are not errors
  });
});

describe("naming-series", () => {
  it("creates a series, formats next() with year+counter", async () => {
    const ns = await import("@gutu-plugin/template-core");
    const created = ns.createNamingSeries({
      tenantId: "t1",
      resource: "test.invoice",
      pattern: "INV-.YYYY.-#####",
      isDefault: true,
      createdBy: "tester@example.com",
    });
    expect(created.pattern).toBe("INV-.YYYY.-#####");
    const a = ns.nextDocumentName("t1", created.id, new Date(Date.UTC(2026, 3, 1)));
    expect(a.counter).toBe(1);
    expect(a.name).toBe("INV-2026-00001");
    const b = ns.nextDocumentName("t1", created.id, new Date(Date.UTC(2026, 3, 1)));
    expect(b.counter).toBe(2);
    expect(b.name).toBe("INV-2026-00002");
  });

  it("buckets reset per year", async () => {
    const ns = await import("@gutu-plugin/template-core");
    const created = ns.createNamingSeries({
      tenantId: "t1",
      resource: "test.invoice2",
      pattern: "INV-.YYYY.-#####",
      createdBy: "tester@example.com",
    });
    const a = ns.nextDocumentName("t1", created.id, new Date(Date.UTC(2026, 0, 1)));
    expect(a.counter).toBe(1);
    expect(a.name).toBe("INV-2026-00001");
    const b = ns.nextDocumentName("t1", created.id, new Date(Date.UTC(2027, 0, 1)));
    expect(b.counter).toBe(1);
    expect(b.name).toBe("INV-2027-00001");
  });

  it("rejects patterns without a counter", async () => {
    const ns = await import("@gutu-plugin/template-core");
    expect(() =>
      ns.createNamingSeries({
        tenantId: "t1",
        resource: "test.invoice3",
        pattern: "INV-.YYYY.-",
        createdBy: "tester@example.com",
      }),
    ).toThrow(/counter/);
  });

  it("nextNameForResource picks the default", async () => {
    const ns = await import("@gutu-plugin/template-core");
    const name = ns.nextNameForResource("t1", "test.invoice", new Date(Date.UTC(2026, 3, 1)));
    expect(name).toMatch(/^INV-2026-\d{5}$/);
  });
});

describe("property-setters", () => {
  it("upserts and lists", async () => {
    const ps = await import("@gutu-plugin/forms-core");
    const a = ps.upsertPropertySetter({
      tenantId: "t1",
      resource: "crm.contact",
      field: "phone",
      property: "required",
      value: true,
      createdBy: "tester@example.com",
    });
    expect(a.scope).toBe("tenant");
    expect(a.value).toBe(true);
    // Same key → update, not duplicate
    const b = ps.upsertPropertySetter({
      tenantId: "t1",
      resource: "crm.contact",
      field: "phone",
      property: "required",
      value: false,
      createdBy: "tester@example.com",
    });
    expect(b.id).toBe(a.id);
    expect(b.value).toBe(false);
    const list = ps.listPropertySetters("t1", "crm.contact");
    expect(list).toHaveLength(1);
  });

  it("resolves with role > company > tenant priority", async () => {
    const ps = await import("@gutu-plugin/forms-core");
    ps.upsertPropertySetter({
      tenantId: "t-prio",
      resource: "crm.lead",
      field: "score",
      property: "label",
      value: "Tenant Score",
      createdBy: "x",
    });
    ps.upsertPropertySetter({
      tenantId: "t-prio",
      resource: "crm.lead",
      field: "score",
      property: "label",
      value: "EU Score",
      scope: "company:eu",
      createdBy: "x",
    });
    ps.upsertPropertySetter({
      tenantId: "t-prio",
      resource: "crm.lead",
      field: "score",
      property: "label",
      value: "Sales Score",
      scope: "role:sales",
      createdBy: "x",
    });
    const noCtx = ps.resolvePropertyOverrides({ tenantId: "t-prio", resource: "crm.lead" });
    expect(noCtx.score?.label).toBe("Tenant Score");
    const eu = ps.resolvePropertyOverrides({
      tenantId: "t-prio",
      resource: "crm.lead",
      companyId: "eu",
    });
    expect(eu.score?.label).toBe("EU Score");
    const sales = ps.resolvePropertyOverrides({
      tenantId: "t-prio",
      resource: "crm.lead",
      companyId: "eu",
      roleIds: ["sales"],
    });
    expect(sales.score?.label).toBe("Sales Score");
  });

  it("rejects bad property names + bad value kinds", async () => {
    const ps = await import("@gutu-plugin/forms-core");
    expect(() =>
      ps.upsertPropertySetter({
        tenantId: "t1",
        resource: "crm.contact",
        field: "x",
        property: "invalid_one",
        value: 1,
        createdBy: "x",
      }),
    ).toThrow(/Unknown property/);
    expect(() =>
      ps.upsertPropertySetter({
        tenantId: "t1",
        resource: "crm.contact",
        field: "x",
        property: "required",
        value: "yes",
        createdBy: "x",
      }),
    ).toThrow(/expects a boolean/);
  });
});

describe("notification-rules", () => {
  it("creates a rule, evaluates condition, fires → deliveries", async () => {
    const nr = await import("@gutu-plugin/notifications-core");
    const rule = nr.createNotificationRule({
      tenantId: "t-nr",
      name: "Big invoice notify",
      resource: "accounting.invoice",
      event: "create",
      condition: { op: "gt", field: "total", value: 1000 },
      channels: [{ kind: "in-app", config: { recipients: ["owner"] } }],
      bodyTemplate: "Heads up — invoice {{ name }} for {{ total | currency }}",
      createdBy: "x",
    });
    expect(rule.enabled).toBe(true);

    const result = nr.fireEvent({
      tenantId: "t-nr",
      resource: "accounting.invoice",
      event: "create",
      recordId: "rec-1",
      record: { name: "INV-1", total: 1500, currency: "USD" },
    });
    expect(result.fired).toBeGreaterThan(0);
    expect(result.deliveries).toBeGreaterThan(0);

    // Below-threshold record should NOT fire.
    const skipped = nr.fireEvent({
      tenantId: "t-nr",
      resource: "accounting.invoice",
      event: "create",
      recordId: "rec-2",
      record: { name: "INV-2", total: 500 },
    });
    expect(skipped.fired).toBe(0);
  });

  it("evaluates AND/OR groups", async () => {
    const nr = await import("@gutu-plugin/notifications-core");
    const ctx = { status: "open", priority: 1, tags: ["urgent"] };
    expect(
      nr.evaluateCondition(
        { op: "and", args: [{ op: "eq", field: "status", value: "open" }, { op: "lt", field: "priority", value: 5 }] },
        ctx,
      ),
    ).toBe(true);
    expect(
      nr.evaluateCondition(
        { op: "or", args: [{ op: "eq", field: "status", value: "closed" }, { op: "in", field: "status", value: ["open", "active"] }] },
        ctx,
      ),
    ).toBe(true);
  });
});

describe("print-format", () => {
  it("creates and renders with sample record", async () => {
    const pf = await import("@gutu-plugin/template-core");
    const fmt = pf.createPrintFormat({
      tenantId: "t-pf",
      resource: "accounting.invoice",
      name: "Standard",
      template: `<h1>Invoice {{ name }}</h1><p>{{ customer_name }} — {{ grand_total | currency }}</p>`,
      isDefault: true,
      createdBy: "x",
    });
    const out = pf.renderPrintFormat({
      tenantId: "t-pf",
      formatId: fmt.id,
      record: { name: "INV-9", customer_name: "Acme", grand_total: 250 },
      context: { currency: "USD" },
    });
    expect(out.html).toContain("Invoice INV-9");
    expect(out.html).toContain("Acme");
    expect(out.html).toContain("$250.00");
  });

  it("composes with letterhead", async () => {
    const pf = await import("@gutu-plugin/template-core");
    const lh = pf.createLetterHead({
      tenantId: "t-pf",
      name: "Acme Letterhead",
      headerHtml: "<div>Acme HQ • {{ now | date }}</div>",
      footerHtml: "<div>Page footer</div>",
      isDefault: true,
      createdBy: "x",
    });
    const fmt = pf.createPrintFormat({
      tenantId: "t-pf",
      resource: "accounting.invoice2",
      name: "With LH",
      template: "<p>Body</p>",
      letterheadId: lh.id,
      createdBy: "x",
    });
    const out = pf.renderPrintFormat({
      tenantId: "t-pf",
      formatId: fmt.id,
      record: {},
    });
    expect(out.html).toContain("Acme HQ");
    expect(out.html).toContain("Page footer");
    expect(out.html).toContain("Body");
  });
});
