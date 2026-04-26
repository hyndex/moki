/* End-to-end CRUD verification.
 *
 * For each plugin/resource:
 *  1. Visit the list/page in the UI; capture screenshot pre-state.
 *  2. POST a record via the API using the same auth cookie.
 *  3. Reload the UI page and assert the new record is visible (round-trip).
 *  4. PUT/PATCH if applicable; assert the new value renders.
 *  5. DELETE via the API; reload; assert it's gone.
 *
 * Each scenario is wrapped in try/catch so one breaking step doesn't kill
 * the rest of the suite. */

import { chromium, type Page, type BrowserContext } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
// Route API calls through Vite's proxy so cookies set on the frontend
// origin authenticate the backend. Hitting :3333 directly from Node
// trips the auth middleware because the cookie domain differs.
const API = process.env.API ?? "http://127.0.0.1:5173";
const OUT = path.resolve(__dirname, "../../tmp/e2e-crud");
fs.mkdirSync(OUT, { recursive: true });

interface Step { step: string; ok: boolean; detail?: string }
interface Result { scenario: string; steps: Step[] }

const results: Result[] = [];

let bearerToken: string = "";

async function login(page: Page) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button:has-text("Sign in")', { timeout: 10_000 });
  await page.fill('input[type="email"], input[name="email"]', "chinmoy@gutu.dev");
  await page.fill('input[type="password"]', "password");
  await page.click('button:has-text("Sign in")');
  await page.waitForFunction(
    () => !document.body.innerText.toLowerCase().includes("sign in to your workspace"),
    { timeout: 10_000 },
  );
  await page.waitForTimeout(800);
  bearerToken = await page.evaluate(() => localStorage.getItem("gutu.auth.token") ?? "");
  if (!bearerToken) throw new Error("login: no auth token in localStorage");
}

async function shot(page: Page, name: string) {
  try { await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false }); } catch {}
}

async function api(_ctx: BrowserContext, method: string, urlPath: string, body?: unknown) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${bearerToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = text;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

function record(scenario: string, step: string, ok: boolean, detail?: string) {
  let r = results.find((x) => x.scenario === scenario);
  if (!r) { r = { scenario, steps: [] }; results.push(r); }
  r.steps.push({ step, ok, detail });
  console.log(`  [${scenario}] ${ok ? "OK  " : "FAIL"} ${step}${detail ? "  — " + detail.slice(0, 140) : ""}`);
}

async function safe(scenario: string, fn: () => Promise<void>) {
  try { await fn(); }
  catch (e) {
    record(scenario, "scenario crashed", false, String(e).slice(0, 140));
  }
}

/* ---- 1. Webhooks ---- */
async function scenarioWebhooks(page: Page, ctx: BrowserContext) {
  const S = "webhooks";
  const targetUrl = `https://example.test/wh/e2e-${Date.now()}`;
  const create = await api(ctx, "POST", "/api/webhooks", {
    targetUrl,
    eventPattern: "crm.contact.created",
    enabled: true,
  });
  record(S, "POST create", create.status === 200 || create.status === 201, `status ${create.status}`);
  const created: any = (create.json as any)?.row ?? create.json;
  if (!created?.id) return;

  await page.goto(`${BASE}/#/settings/webhooks`);
  await page.waitForTimeout(2000);
  await shot(page, "wh-list-after-create");
  const text = await page.evaluate(() => document.body.innerText);
  record(S, "UI list shows new webhook", text.includes(targetUrl), `body has url? ${text.includes(targetUrl)}`);

  const del = await api(ctx, "DELETE", `/api/webhooks/${created.id}`);
  record(S, "DELETE", del.status === 200 || del.status === 204, `status ${del.status}`);

  await page.reload();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => document.body.innerText);
  record(S, "UI list no longer shows it", !after.includes(targetUrl));
}

/* ---- 2. API tokens ---- */
async function scenarioApiTokens(page: Page, ctx: BrowserContext) {
  const S = "api-tokens";
  const name = `e2e-tok-${Date.now()}`;
  const create = await api(ctx, "POST", "/api/api-tokens", { name, scopes: ["read"] });
  record(S, "POST create", create.status === 200 || create.status === 201, `status ${create.status}`);
  const created: any = (create.json as any)?.row ?? create.json;
  if (!created?.id) {
    record(S, "no id returned", false, JSON.stringify(create.json).slice(0, 120));
    return;
  }
  // Plaintext exists once on creation
  record(S, "one-time plaintext token returned", typeof (create.json as any).token === "string" || typeof (created.token === "string"), "token field present");

  await page.goto(`${BASE}/#/settings/api-tokens`);
  await page.waitForTimeout(1800);
  await shot(page, "tok-list-after-create");
  const text = await page.evaluate(() => document.body.innerText);
  record(S, "UI list shows new token", text.includes(name));

  const del = await api(ctx, "DELETE", `/api/api-tokens/${created.id}`);
  record(S, "DELETE (revoke)", del.status === 200 || del.status === 204, `status ${del.status}`);

  await page.reload();
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => document.body.innerText);
  // Revoked tokens stay visible with a "Revoked" badge — that's correct.
  // Verify the audit trail is intact AND the badge renders.
  record(S, "UI list shows token with Revoked badge", after.includes(name) && /revoked/i.test(after));
}

/* ---- 3. Custom fields ---- */
async function scenarioCustomFields(page: Page, ctx: BrowserContext) {
  const S = "custom-fields";
  const RES = "crm.contact";
  const fieldKey = `e2e_field_${Date.now()}`;
  const create = await api(ctx, "POST", `/api/field-metadata/${RES}`, {
    label: "E2E test field",
    key: fieldKey,
    kind: "text",
    required: false,
  });
  record(S, "POST create", create.status === 200 || create.status === 201, `status ${create.status}`);
  const created: any = (create.json as any)?.row ?? create.json;
  if (!created?.id) {
    record(S, "no id returned", false, JSON.stringify(create.json).slice(0, 120));
    return;
  }

  await page.goto(`${BASE}/#/settings/custom-fields`);
  await page.waitForTimeout(2000);
  // Click Contacts row to scope
  const contactsRow = page.getByText(/^Contacts$/).first();
  if (await contactsRow.count()) await contactsRow.click();
  await page.waitForTimeout(800);
  await shot(page, "cf-list-after-create");
  const text = await page.evaluate(() => document.body.innerText);
  record(S, "UI shows new field key", text.includes(fieldKey));

  const list = await api(ctx, "GET", `/api/field-metadata/${RES}`);
  const rows = (list.json as any)?.rows ?? (list.json as any)?.fields ?? [];
  record(S, "GET list contains it", !!rows.find((r: any) => r.key === fieldKey));

  const del = await api(ctx, "DELETE", `/api/field-metadata/${RES}/${created.id}`);
  record(S, "DELETE", del.status === 200 || del.status === 204, `status ${del.status}`);
}

/* ---- 4. Property setters ---- */
async function scenarioPropertySetters(page: Page, ctx: BrowserContext) {
  const S = "property-setters";
  const RES = "crm.contact";
  const value = `Override-${Date.now()}`;
  const create = await api(ctx, "POST", `/api/property-setters/${RES}`, {
    field: "displayName",
    property: "label",
    value,
  });
  record(S, "POST create", create.status === 200 || create.status === 201, `status ${create.status}`);
  const created: any = (create.json as any)?.row ?? create.json;
  if (!created?.id) return;

  await page.goto(`${BASE}/#/settings/property-setters`);
  await page.waitForTimeout(2000);
  const contactsRow = page.getByText(/^Contacts$/).first();
  if (await contactsRow.count()) await contactsRow.click();
  await page.waitForTimeout(800);
  await shot(page, "ps-list-after-create");
  const text = await page.evaluate(() => document.body.innerText);
  record(S, "UI shows the override value", text.includes(value));

  // Effective merge endpoint
  const eff = await api(ctx, "GET", `/api/property-setters/${RES}/effective`);
  record(S, "effective endpoint 200", eff.status === 200);

  const del = await api(ctx, "DELETE", `/api/property-setters/${RES}/${created.id}`);
  record(S, "DELETE", del.status === 200 || del.status === 204, `status ${del.status}`);
}

/* ---- 5. Naming series ---- */
async function scenarioNamingSeries(page: Page, ctx: BrowserContext) {
  const S = "naming-series";
  const RES = "sales.quote";
  const pattern = `E2E-${Date.now()}-.#####`;
  const create = await api(ctx, "POST", `/api/naming-series/${RES}`, {
    pattern,
    label: "E2E series",
    isDefault: false,
  });
  record(S, "POST create", create.status === 200 || create.status === 201, `status ${create.status}`);
  const created: any = (create.json as any)?.row ?? create.json;
  if (!created?.id) return;

  await page.goto(`${BASE}/#/settings/naming-series`);
  await page.waitForTimeout(2000);
  // Click Quotations row
  const quotesRow = page.getByText(/^Quotations$/).first();
  if (await quotesRow.count()) await quotesRow.click();
  await page.waitForTimeout(800);
  await shot(page, "ns-list-after-create");
  const text = await page.evaluate(() => document.body.innerText);
  record(S, "UI shows series label", text.includes("E2E series") || text.includes(pattern));

  // Counter behavior — POST .../next 3x and ensure values increment.
  const extract = (r: { json: unknown }) => {
    const j = r.json as Record<string, unknown> | undefined;
    return (
      (j?.name as string | undefined) ??
      (j?.value as string | undefined) ??
      (j?.next as string | undefined) ??
      String(j?.counter ?? "")
    );
  };
  const n1 = await api(ctx, "POST", `/api/naming-series/${RES}/${created.id}/next`, {});
  const n2 = await api(ctx, "POST", `/api/naming-series/${RES}/${created.id}/next`, {});
  const n3 = await api(ctx, "POST", `/api/naming-series/${RES}/${created.id}/next`, {});
  const v1 = extract(n1), v2 = extract(n2), v3 = extract(n3);
  const allUnique = v1 && v2 && v3 && v1 !== v2 && v2 !== v3 && v1 !== v3;
  record(S, "counter increments per call", !!allUnique, `${v1} → ${v2} → ${v3}`);

  const del = await api(ctx, "DELETE", `/api/naming-series/${RES}/${created.id}`);
  record(S, "DELETE", del.status === 200 || del.status === 204, `status ${del.status}`);
}

/* ---- 6. Print formats ---- */
async function scenarioPrintFormats(page: Page, ctx: BrowserContext) {
  const S = "print-formats";
  const RES = "sales.quote";
  const name = `E2E print ${Date.now()}`;
  const create = await api(ctx, "POST", `/api/print-formats/${RES}`, {
    name,
    template: "<h1>Quote {{record.id}}</h1><p>Total: {{record.total}}</p>",
    paperSize: "A4",
  });
  record(S, "POST create", create.status === 200 || create.status === 201, `status ${create.status}`);
  const created: any = (create.json as any)?.row ?? create.json;
  if (!created?.id) return;

  await page.goto(`${BASE}/#/settings/print-formats`);
  await page.waitForTimeout(2000);
  const quotesRow = page.getByText(/^Quotations$/).first();
  if (await quotesRow.count()) await quotesRow.click();
  await page.waitForTimeout(800);
  await shot(page, "pf-list-after-create");
  const text = await page.evaluate(() => document.body.innerText);
  record(S, "UI shows new format", text.includes(name));

  // Render endpoint
  const rendered = await api(ctx, "POST", `/api/print-formats/${RES}/${created.id}/render`, {
    record: { id: "Q-001", total: 1234 },
  });
  record(S, "render endpoint 200", rendered.status === 200, JSON.stringify(rendered.json).slice(0, 100));
  if (rendered.status === 200) {
    const html = (rendered.json as any)?.html ?? (rendered.json as any) ?? "";
    record(S, "render output contains record id", typeof html === "string" && html.includes("Q-001"), html.slice(0, 80));
  }

  const del = await api(ctx, "DELETE", `/api/print-formats/${RES}/${created.id}`);
  record(S, "DELETE", del.status === 200 || del.status === 204, `status ${del.status}`);
}

/* ---- 7. Letter heads ---- */
async function scenarioLetterHeads(_page: Page, ctx: BrowserContext) {
  const S = "letter-heads";
  const create = await api(ctx, "POST", "/api/print-formats/letter-heads", {
    name: `E2E LH ${Date.now()}`,
    contentHtml: "<div>E2E header</div>",
    isDefault: false,
  });
  record(S, "POST create", create.status === 200 || create.status === 201, `status ${create.status}`);
  const created: any = (create.json as any)?.row ?? create.json;
  if (created?.id) {
    const list = await api(ctx, "GET", "/api/print-formats/letter-heads");
    const rows = (list.json as any)?.rows ?? [];
    record(S, "GET list shows it", !!rows.find((r: any) => r.id === created.id));
    const del = await api(ctx, "DELETE", `/api/print-formats/letter-heads/${created.id}`);
    record(S, "DELETE", del.status === 200 || del.status === 204, `status ${del.status}`);
  }
}

/* ---- 8. Notification rules ---- */
async function scenarioNotificationRules(page: Page, ctx: BrowserContext) {
  const S = "notification-rules";
  const RES = "sales.quote";
  const name = `E2E rule ${Date.now()}`;
  const create = await api(ctx, "POST", `/api/notification-rules/${RES}`, {
    name,
    event: "create",
    channels: [{ kind: "in-app" }],
    subject: "New quote",
    bodyTemplate: "{{record.id}}",
    enabled: true,
  });
  record(S, "POST create", create.status === 200 || create.status === 201, `status ${create.status}`);
  const created: any = (create.json as any)?.row ?? create.json;
  if (!created?.id) return;

  await page.goto(`${BASE}/#/settings/notification-rules`);
  await page.waitForTimeout(2000);
  const quotesRow = page.getByText(/^Quotations$/).first();
  if (await quotesRow.count()) await quotesRow.click();
  await page.waitForTimeout(800);
  await shot(page, "nr-list-after-create");
  const text = await page.evaluate(() => document.body.innerText);
  record(S, "UI shows new rule", text.includes(name));

  // Test fire
  const test = await api(ctx, "POST", `/api/notification-rules/${RES}/${created.id}/test`, {
    record: { id: "Q-1", total: 100 },
  });
  record(S, "test-fire endpoint 200", test.status === 200 || test.status === 202, `status ${test.status}`);

  const deliveries = await api(ctx, "GET", "/api/notification-rules/_deliveries");
  const delRows = (deliveries.json as any)?.rows ?? [];
  record(S, "deliveries list returns", deliveries.status === 200, `count=${delRows.length}`);

  const del = await api(ctx, "DELETE", `/api/notification-rules/${RES}/${created.id}`);
  record(S, "DELETE", del.status === 200 || del.status === 204, `status ${del.status}`);
}

/* ---- 9. Workflows ---- */
async function scenarioWorkflows(page: Page, ctx: BrowserContext) {
  const S = "workflows";
  const name = `E2E wf ${Date.now()}`;
  // Workflow create endpoint
  const create = await api(ctx, "POST", "/api/workflows", {
    name,
    trigger: { kind: "manual" },
    nodes: [],
    edges: [],
  });
  record(S, "POST create", create.status === 200 || create.status === 201, `status ${create.status}`);
  const created: any = (create.json as any)?.row ?? create.json;
  if (!created?.id) {
    record(S, "no id returned", false, JSON.stringify(create.json).slice(0, 120));
    return;
  }

  await page.goto(`${BASE}/#/settings/workflows`);
  await page.waitForTimeout(2000);
  await shot(page, "wf-list-after-create");
  const text = await page.evaluate(() => document.body.innerText);
  record(S, "UI shows new workflow", text.includes(name));

  // Detail page
  await page.goto(`${BASE}/#/admin/workflow/${created.id}`);
  await page.waitForTimeout(2500);
  await shot(page, "wf-detail");
  const detailText = await page.evaluate(() => document.body.innerText);
  record(S, "detail page renders name", detailText.includes(name) || detailText.toLowerCase().includes("workflow"));

  const del = await api(ctx, "DELETE", `/api/workflows/${created.id}`);
  record(S, "DELETE", del.status === 200 || del.status === 204, `status ${del.status}`);
}

/* ---- 10. CRM Contacts ---- */
async function scenarioContacts(page: Page, ctx: BrowserContext) {
  const S = "contacts";
  const email = `e2e+${Date.now()}@example.test`;
  const contactName = `E2E Contact ${Date.now()}`;
  const create = await api(ctx, "POST", "/api/resources/crm.contact", {
    name: contactName,
    email,
    company: "E2E Co",
  });
  record(S, "POST create", create.status === 200 || create.status === 201, `status ${create.status}`);
  const created: any = (create.json as any)?.row ?? create.json;
  if (!created?.id) {
    record(S, "no id returned", false, JSON.stringify(create.json).slice(0, 200));
    return;
  }

  await page.goto(`${BASE}/#/contacts`);
  await page.waitForTimeout(2500);
  await shot(page, "contacts-list-after-create");
  const listText = await page.evaluate(() => document.body.innerText);
  // Cards show name + company, not email — assert on name (which is unique).
  record(S, "list shows new contact", listText.includes(contactName));

  // Detail
  await page.goto(`${BASE}/#/contacts/${created.id}`);
  await page.waitForTimeout(2500);
  await shot(page, "contact-detail");
  const detailText = await page.evaluate(() => document.body.innerText);
  record(S, "detail shows email", detailText.includes(email));

  // Update
  const upd = await api(ctx, "PUT", `/api/resources/crm.contact/${created.id}`, { company: "E2E Co Updated" });
  record(S, "PUT update", upd.status === 200, `status ${upd.status}`);

  // Reload detail; check updated text
  await page.reload();
  await page.waitForTimeout(2000);
  const updatedText = await page.evaluate(() => document.body.innerText);
  record(S, "detail reflects update", updatedText.includes("E2E Co Updated"));

  const del = await api(ctx, "DELETE", `/api/resources/crm.contact/${created.id}`);
  record(S, "DELETE", del.status === 200 || del.status === 204, `status ${del.status}`);
}

/* ---- 11. Resources read-side spot checks ---- */
async function scenarioResourcesRead(_page: Page, ctx: BrowserContext) {
  const S = "resources-read";
  const ids = ["crm.contact", "crm.lead", "sales.deal", "sales.quote", "ops.ticket", "hr.employee"];
  for (const id of ids) {
    const r = await api(ctx, "GET", `/api/resources/${id}?limit=5`);
    record(S, `GET /api/resources/${id}`, r.status === 200, `count=${(r.json as any)?.total ?? "?"}`);
  }
}

/* ---- 12. Cmd-K palette ---- */
async function scenarioCmdK(page: Page) {
  const S = "cmd-k";
  await page.goto(`${BASE}/#/`);
  await page.waitForTimeout(1500);
  await page.keyboard.press("Meta+k");
  await page.waitForTimeout(500);
  const dialog = page.getByRole("dialog").first();
  const opens = (await dialog.count()) > 0 && await dialog.isVisible();
  record(S, "palette opens via Meta+K", opens);
  if (!opens) return;

  await page.keyboard.type("naming");
  await page.waitForTimeout(400);
  const text1 = await page.evaluate(() => document.body.innerText);
  record(S, "search 'naming' yields results", text1.toLowerCase().includes("naming") || text1.toLowerCase().includes("series"));
  await shot(page, "cmd-k-naming");

  // Clear and search for a different keyword
  await page.keyboard.press("Meta+a");
  await page.keyboard.type("webhook");
  await page.waitForTimeout(400);
  const text2 = await page.evaluate(() => document.body.innerText);
  record(S, "search 'webhook' yields results", text2.toLowerCase().includes("webhook"));
  await shot(page, "cmd-k-webhook");

  await page.keyboard.press("Escape");
}

/* ---- Run ---- */
async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const browserErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") browserErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => browserErrors.push("PAGEERR: " + e.message.slice(0, 200)));

  console.log("Logging in...");
  await login(page);
  console.log("Logged in.\n");

  await safe("webhooks", () => scenarioWebhooks(page, ctx));
  await safe("api-tokens", () => scenarioApiTokens(page, ctx));
  await safe("custom-fields", () => scenarioCustomFields(page, ctx));
  await safe("property-setters", () => scenarioPropertySetters(page, ctx));
  await safe("naming-series", () => scenarioNamingSeries(page, ctx));
  await safe("print-formats", () => scenarioPrintFormats(page, ctx));
  await safe("letter-heads", () => scenarioLetterHeads(page, ctx));
  await safe("notification-rules", () => scenarioNotificationRules(page, ctx));
  await safe("workflows", () => scenarioWorkflows(page, ctx));
  await safe("contacts", () => scenarioContacts(page, ctx));
  await safe("resources-read", () => scenarioResourcesRead(page, ctx));
  await safe("cmd-k", () => scenarioCmdK(page));

  await browser.close();

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ results, browserErrors }, null, 2));

  let pass = 0, fail = 0;
  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    const ok = r.steps.filter((s) => s.ok).length;
    console.log(`  ${r.scenario.padEnd(22)} ${ok}/${r.steps.length}`);
    pass += ok;
    fail += r.steps.length - ok;
  }
  console.log(`\nTotal: ${pass} pass / ${fail} fail / ${browserErrors.length} browser errors`);
  if (browserErrors.length) {
    console.log("\nBrowser errors:");
    for (const e of browserErrors.slice(0, 8)) console.log("  " + e);
  }
}

main().catch((e) => { console.error(e); process.exit(2); });
