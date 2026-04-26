/* Adversarial end-to-end audit.
 *
 * Probes every new mechanism with edge cases and bad inputs. Each
 * probe records a result; the harness reports failures + crashes.
 * Run after the green E2E to catch issues only triggered by edge cases. */

import { chromium, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const API = process.env.API ?? "http://127.0.0.1:5173";
const OUT = path.resolve(__dirname, "../../tmp/bug-hunt");
fs.mkdirSync(OUT, { recursive: true });

interface Step { step: string; ok: boolean; detail?: string }
interface Result { scenario: string; steps: Step[] }
const results: Result[] = [];

let bearerToken = "";

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
}

async function api(method: string, urlPath: string, body?: unknown, opts: { auth?: boolean } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.auth !== false && bearerToken) headers.authorization = `Bearer ${bearerToken}`;
  const res = await fetch(`${API}${urlPath}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
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
  catch (e) { record(scenario, "scenario crashed", false, String(e).slice(0, 200)); }
}

/* ===== 1. /api/_plugins endpoint contract ===== */
async function scenarioPluginAdmin() {
  const S = "plugin-admin";

  // List
  const list = await api("GET", "/api/_plugins");
  record(S, "GET /_plugins returns 200", list.status === 200);
  const rows = (list.json as any).rows ?? [];
  record(S, "lists ≥20 plugins", rows.length >= 20, `count=${rows.length}`);
  record(S, "every row has id+version+manifest|null", rows.every((r: any) =>
    typeof r.id === "string" && typeof r.version === "string" &&
    (r.manifest === null || typeof r.manifest === "object")));
  record(S, "every row has status field", rows.every((r: any) =>
    ["loaded", "quarantined", "disabled", "unknown"].includes(r.status)));

  // Single
  const single = await api("GET", "/api/_plugins/timeline-core");
  record(S, "GET /_plugins/timeline-core 200", single.status === 200,
    `id=${(single.json as any).id}`);

  const missing = await api("GET", "/api/_plugins/does-not-exist");
  record(S, "GET /_plugins/<missing> 404", missing.status === 404);

  // Reserved sub-paths must NOT collapse to :id
  const leases = await api("GET", "/api/_plugins/_leases");
  record(S, "GET /_plugins/_leases lists leases", leases.status === 200 && Array.isArray((leases.json as any).rows));

  const ws = await api("GET", "/api/_plugins/_ws-routes");
  record(S, "GET /_plugins/_ws-routes 200", ws.status === 200);

  const en = await api("GET", "/api/_plugins/_enablement");
  record(S, "GET /_plugins/_enablement 200", en.status === 200);
}

/* ===== 2. Leader election: leases visible + valid shape ===== */
async function scenarioLeases() {
  const S = "leases";
  const r = await api("GET", "/api/_plugins/_leases");
  const rows: any[] = (r.json as any).rows ?? [];
  record(S, "≥6 cluster-singleton leases held", rows.length >= 6, `count=${rows.length}`);
  const expectedNames = ["notifications:dispatcher", "notifications:scheduler",
    "analytics:auto-email", "webhooks:dispatcher", "workflow:engine", "timeline:writer"];
  for (const n of expectedNames) {
    record(S, `lease "${n}" present`, rows.some((x) => x.name === n));
  }
  record(S, "every lease has expiresAt in the future", rows.every((x) =>
    new Date(x.expiresAt).getTime() > Date.now()));
  record(S, "every lease holderId is non-empty", rows.every((x) => typeof x.holderId === "string" && x.holderId.length > 0));
}

/* ===== 3. Per-tenant enablement: gate + admin API ===== */
async function scenarioEnablement() {
  const S = "enablement";
  // Verify before-state: webhooks-core enabled by default
  const before = await api("GET", "/api/webhooks");
  record(S, "webhooks-core reachable when enabled (default)", before.status === 200, `status=${before.status}`);

  // Validation: missing pluginId
  const bad1 = await api("POST", "/api/_plugins/_enablement", { enabled: true });
  record(S, "POST without pluginId → 400", bad1.status === 400);

  // Validation: wrong type
  const bad2 = await api("POST", "/api/_plugins/_enablement", { pluginId: "webhooks-core", enabled: "yes" });
  record(S, "POST with non-bool enabled → 400", bad2.status === 400);

  // Disable webhooks-core for current tenant
  const off = await api("POST", "/api/_plugins/_enablement", { pluginId: "webhooks-core", enabled: false });
  record(S, "POST disable returns 200", off.status === 200);

  // Re-enable (so other tests don't break)
  const on = await api("POST", "/api/_plugins/_enablement", { pluginId: "webhooks-core", enabled: true });
  record(S, "POST re-enable returns 200", on.status === 200);

  // Note: pluginGate is wired via the admin endpoint. The webhook plugin
  // routes themselves don't currently use pluginGate, so we can't yet
  // verify gating short-circuits — the API to set the flag is verified.
  // After plugins opt into pluginGate(...) middleware, this scenario
  // should be extended to check actual 404 behavior.
  const list = await api("GET", "/api/_plugins/_enablement");
  const rows: any[] = (list.json as any).rows ?? [];
  const wh = rows.find((x: any) => x.pluginId === "webhooks-core");
  record(S, "enablement persists in list", !!wh, JSON.stringify(wh ?? null).slice(0, 100));
}

/* ===== 4. Plugin admin auth: revoking auth requirement ===== */
async function scenarioAuthGuards() {
  const S = "auth-guards";
  const before = bearerToken;
  bearerToken = "";
  const r = await api("GET", "/api/_plugins");
  bearerToken = before;
  record(S, "/_plugins requires auth (401)", r.status === 401, `status=${r.status}`);

  // Bad token
  bearerToken = "definitely-not-valid";
  const r2 = await api("GET", "/api/_plugins");
  bearerToken = before;
  record(S, "bad bearer → 401", r2.status === 401, `status=${r2.status}`);
}

/* ===== 5. Uninstall endpoint: shape + admin role gate ===== */
async function scenarioUninstall() {
  const S = "uninstall";
  // Missing plugin
  const bad = await api("POST", "/api/_plugins/no-such-plugin/uninstall");
  record(S, "POST uninstall on missing plugin → 404", bad.status === 404, `status=${bad.status}`);
}

/* ===== 6. Plugin manifests: vendor + permissions surface ===== */
async function scenarioManifests() {
  const S = "manifests";
  const list = await api("GET", "/api/_plugins");
  const rows: any[] = (list.json as any).rows ?? [];
  const withMan = rows.filter((r: any) => r.manifest);
  record(S, "≥4 plugins now ship a manifest", withMan.length >= 4, `count=${withMan.length}`);
  for (const r of withMan) {
    if (r.manifest.permissions) {
      const valid = r.manifest.permissions.every((p: string) =>
        ["db.read","db.write","audit.write","events.publish","events.subscribe","fs.read","fs.write","net.outbound","ws.upgrade"].includes(p));
      record(S, `${r.id} permissions valid`, valid, `perms=${JSON.stringify(r.manifest.permissions)}`);
    }
  }

  // Notifications-core declares provides
  const notifs = rows.find((r: any) => r.id === "notifications-core");
  record(S, "notifications-core advertises provides", Array.isArray(notifs?.provides) && notifs.provides.includes("notifications.dispatch"));
}

/* ===== 7. Discovery: every package.json gutuPlugins entry loaded ===== */
async function scenarioDiscovery() {
  const S = "discovery";
  const list = await api("GET", "/api/_plugins");
  const ids = new Set(((list.json as any).rows ?? []).map((r: any) => r.id));
  const expected = [
    "template-core","notifications-core","pricing-tax-core","accounting-core",
    "inventory-core","manufacturing-core","sales-core","treasury-core",
    "hr-payroll-core","e-invoicing-core","forms-core","integration-core",
    "analytics-bi-core","field-metadata-core","auth-core","webhooks-core",
    "workflow-core","saved-views-core","timeline-core","favorites-core",
    "record-links-core","erp-actions-core","awesome-search-core","editor-core",
    "connections-core",
  ];
  for (const id of expected) {
    record(S, `discovered "${id}"`, ids.has(id));
  }
}

/* ===== 8. CRUD edge cases ===== */
async function scenarioCrudEdges() {
  const S = "crud-edges";

  // Webhook with malformed URL
  const bad1 = await api("POST", "/api/webhooks", { targetUrl: "not-a-url", eventPattern: "*", enabled: true });
  record(S, "webhooks: invalid URL accepted/rejected gracefully", bad1.status === 400 || bad1.status === 201,
    `status=${bad1.status}`);

  // Naming series with bad pattern
  const bad2 = await api("POST", "/api/naming-series/sales.quote", { pattern: "BAD{}{}", label: "x" });
  record(S, "naming-series: bad pattern → 400", bad2.status === 400, `status=${bad2.status}`);

  // Notification rule with no channels
  const bad3 = await api("POST", "/api/notification-rules/sales.quote", {
    name: "no-channels", event: "create", channels: [], bodyTemplate: "x", enabled: true,
  });
  record(S, "notification-rules: empty channels → 400", bad3.status === 400, `status=${bad3.status}`);

  // Field metadata: duplicate key
  const k = `e2e_dup_${Date.now()}`;
  const c1 = await api("POST", "/api/field-metadata/crm.contact", { label: "x", key: k, kind: "text" });
  const c2 = await api("POST", "/api/field-metadata/crm.contact", { label: "y", key: k, kind: "text" });
  record(S, "field-metadata: duplicate key → 4xx (409 or 400)", c2.status === 409 || c2.status === 400, `status=${c2.status}`);
  if ((c1.json as any)?.id) {
    await api("DELETE", `/api/field-metadata/crm.contact/${(c1.json as any).id}`);
  }

  // Print format: render with missing template variables (graceful)
  const pf = await api("POST", "/api/print-formats/sales.quote", {
    name: `e2e-edge-${Date.now()}`,
    template: "<h1>{{record.id}}</h1>",
    paperSize: "A4",
  });
  if ((pf.json as any)?.id) {
    const r = await api("POST", `/api/print-formats/sales.quote/${(pf.json as any).id}/render`, { record: {} });
    record(S, "print-formats: render with missing vars 200", r.status === 200, `status=${r.status}`);
    await api("DELETE", `/api/print-formats/sales.quote/${(pf.json as any).id}`);
  }

  // API token scopes validation
  const tok = await api("POST", "/api/api-tokens", { name: `e2e-${Date.now()}`, scopes: [{ resource: "crm.contact", verbs: ["read"] }] });
  record(S, "api-tokens: well-formed scopes → 201", tok.status === 201, `status=${tok.status}`);
  if ((tok.json as any)?.id) {
    await api("DELETE", `/api/api-tokens/${(tok.json as any).id}`);
  }

  // Resource update: partial PATCH
  const create = await api("POST", "/api/resources/crm.contact", { name: `Edge ${Date.now()}`, email: `e+${Date.now()}@test.com` });
  if ((create.json as any)?.id) {
    const id = (create.json as any).id;
    const patch = await api("PATCH", `/api/resources/crm.contact/${id}`, { company: "Patched" });
    record(S, "PATCH partial update", patch.status === 200, `status=${patch.status}`);
    const get = await api("GET", `/api/resources/crm.contact/${id}`);
    record(S, "PATCH preserves non-patched fields", typeof (get.json as any)?.email === "string");
    await api("DELETE", `/api/resources/crm.contact/${id}`);
  }

  // Delete a resource that doesn't exist
  const delMissing = await api("DELETE", "/api/resources/crm.contact/does-not-exist");
  record(S, "DELETE missing → 404 or 200 (idempotent)", delMissing.status === 404 || delMissing.status === 200,
    `status=${delMissing.status}`);
}

/* ===== 9. Tenant context: cross-tenant data leak ===== */
async function scenarioTenancy() {
  const S = "tenancy";
  // Read crm.contact list
  const r = await api("GET", "/api/resources/crm.contact?limit=2");
  const rows: any[] = (r.json as any)?.rows ?? [];
  const tenantIds = new Set(rows.map((x: any) => x.tenantId).filter(Boolean));
  record(S, "all rows belong to a single tenant", tenantIds.size <= 1, `tenantIds=${[...tenantIds].join(",")}`);

  // Try to read a record under wrong tenant by ID-guess (should 404)
  const fakeId = "00000000-fake-fake-fake-000000000000";
  const r2 = await api("GET", `/api/resources/crm.contact/${fakeId}`);
  record(S, "GET /:id with foreign id → 404", r2.status === 404, `status=${r2.status}`);
}

/* ===== 10. Health endpoint shape ===== */
async function scenarioHealth() {
  const S = "health";
  const h = await api("GET", "/api/health", undefined, { auth: false });
  record(S, "/api/health open + 200", h.status === 200);
  record(S, "/api/health includes time", typeof (h.json as any)?.time === "string");
}

/* ===== 11. Pagination + sort + filter on resources ===== */
async function scenarioListing() {
  const S = "listing";
  const r1 = await api("GET", "/api/resources/crm.contact?limit=1");
  const total1 = (r1.json as any)?.total;
  record(S, "limit=1 returns 1 row", ((r1.json as any)?.rows ?? []).length === 1);
  record(S, "list returns total count", typeof total1 === "number");

  const r2 = await api("GET", "/api/resources/crm.contact?limit=1&offset=1");
  record(S, "offset=1 returns different row", ((r1.json as any)?.rows ?? [])[0]?.id !== ((r2.json as any)?.rows ?? [])[0]?.id);

  // Bad limit
  const r3 = await api("GET", "/api/resources/crm.contact?limit=-5");
  record(S, "negative limit handled gracefully", r3.status === 200 || r3.status === 400, `status=${r3.status}`);
}

/* ===== Run ===== */
async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  console.log("Logging in...");
  await login(page);
  console.log("Logged in.\n");

  await safe("plugin-admin", scenarioPluginAdmin);
  await safe("leases", scenarioLeases);
  await safe("enablement", scenarioEnablement);
  await safe("auth-guards", scenarioAuthGuards);
  await safe("uninstall", scenarioUninstall);
  await safe("manifests", scenarioManifests);
  await safe("discovery", scenarioDiscovery);
  await safe("crud-edges", scenarioCrudEdges);
  await safe("tenancy", scenarioTenancy);
  await safe("health", scenarioHealth);
  await safe("listing", scenarioListing);

  await browser.close();

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 2));
  let pass = 0, fail = 0;
  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    const ok = r.steps.filter((s) => s.ok).length;
    console.log(`  ${r.scenario.padEnd(18)} ${ok}/${r.steps.length}`);
    pass += ok; fail += r.steps.length - ok;
  }
  console.log(`\nTotal: ${pass} pass / ${fail} fail`);
  if (fail > 0) {
    console.log("\nFAILED steps:");
    for (const r of results) for (const s of r.steps) if (!s.ok) console.log(`  [${r.scenario}] ${s.step} — ${s.detail ?? ""}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(2); });
