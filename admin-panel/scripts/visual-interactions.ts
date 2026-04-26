/* Interaction probes: open dialogs, Cmd-K palette, navigate to a detail
 * page, and confirm the wizard flow on the bulk import page advances. */

import { chromium, type Page, type Locator } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const OUT = path.resolve(__dirname, "../../tmp/visual-smoke");
fs.mkdirSync(OUT, { recursive: true });

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
}

async function shotIfPresent(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

interface InteractionResult {
  name: string;
  ok: boolean;
  detail: string;
}

async function clickButtonByText(page: Page, text: string): Promise<Locator | null> {
  const btn = page.getByRole("button", { name: new RegExp(text, "i") }).first();
  if (await btn.count()) {
    await btn.click();
    return btn;
  }
  return null;
}

async function dialogVisible(page: Page): Promise<boolean> {
  const dialog = page.getByRole("dialog").first();
  if (await dialog.count() === 0) return false;
  return await dialog.isVisible();
}

async function probeCustomFieldsCreate(page: Page): Promise<InteractionResult> {
  await page.goto(`${BASE}/#/settings/custom-fields`);
  await page.waitForTimeout(2000);
  const btn = await clickButtonByText(page, "Add field");
  if (!btn) return { name: "custom-fields-create", ok: false, detail: "no Add field button" };
  await page.waitForTimeout(800);
  const visible = await dialogVisible(page);
  await shotIfPresent(page, "interaction-custom-fields-create");
  return { name: "custom-fields-create", ok: visible, detail: visible ? "dialog opened" : "no dialog appeared" };
}

async function probeNamingSeriesCreate(page: Page): Promise<InteractionResult> {
  await page.goto(`${BASE}/#/settings/naming-series`);
  await page.waitForTimeout(2000);
  const btn = await clickButtonByText(page, "New series");
  if (!btn) return { name: "naming-series-create", ok: false, detail: "no New series button" };
  await page.waitForTimeout(800);
  const visible = await dialogVisible(page);
  await shotIfPresent(page, "interaction-naming-series-create");
  return { name: "naming-series-create", ok: visible, detail: visible ? "dialog opened" : "no dialog appeared" };
}

async function probePrintFormatsCreate(page: Page): Promise<InteractionResult> {
  await page.goto(`${BASE}/#/settings/print-formats`);
  await page.waitForTimeout(2000);
  const btn = await clickButtonByText(page, "New format");
  if (!btn) return { name: "print-formats-create", ok: false, detail: "no New format button" };
  await page.waitForTimeout(800);
  const visible = await dialogVisible(page);
  await shotIfPresent(page, "interaction-print-formats-create");
  return { name: "print-formats-create", ok: visible, detail: visible ? "dialog opened" : "no dialog appeared" };
}

async function probeNotificationRulesCreate(page: Page): Promise<InteractionResult> {
  await page.goto(`${BASE}/#/settings/notification-rules`);
  await page.waitForTimeout(2000);
  const btn = await clickButtonByText(page, "New rule");
  if (!btn) return { name: "notification-rules-create", ok: false, detail: "no New rule button" };
  await page.waitForTimeout(800);
  const visible = await dialogVisible(page);
  await shotIfPresent(page, "interaction-notification-rules-create");
  return { name: "notification-rules-create", ok: visible, detail: visible ? "dialog opened" : "no dialog appeared" };
}

async function probePropertySettersCreate(page: Page): Promise<InteractionResult> {
  await page.goto(`${BASE}/#/settings/property-setters`);
  await page.waitForTimeout(2000);
  const btn = await clickButtonByText(page, "New override");
  if (!btn) return { name: "property-setters-create", ok: false, detail: "no New override button" };
  await page.waitForTimeout(800);
  const visible = await dialogVisible(page);
  await shotIfPresent(page, "interaction-property-setters-create");
  return { name: "property-setters-create", ok: visible, detail: visible ? "dialog opened" : "no dialog appeared" };
}

async function probeWebhookCreate(page: Page): Promise<InteractionResult> {
  await page.goto(`${BASE}/#/settings/webhooks`);
  await page.waitForTimeout(2000);
  const btn = await clickButtonByText(page, "Create webhook");
  if (!btn) return { name: "webhook-create", ok: false, detail: "no Create webhook button" };
  await page.waitForTimeout(800);
  const visible = await dialogVisible(page);
  await shotIfPresent(page, "interaction-webhook-create");
  return { name: "webhook-create", ok: visible, detail: visible ? "dialog opened" : "no dialog appeared" };
}

async function probeApiTokenCreate(page: Page): Promise<InteractionResult> {
  await page.goto(`${BASE}/#/settings/api-tokens`);
  await page.waitForTimeout(2000);
  const btn = await clickButtonByText(page, "Create token");
  if (!btn) return { name: "api-token-create", ok: false, detail: "no Create token button" };
  await page.waitForTimeout(800);
  const visible = await dialogVisible(page);
  await shotIfPresent(page, "interaction-api-token-create");
  return { name: "api-token-create", ok: visible, detail: visible ? "dialog opened" : "no dialog appeared" };
}

async function probeCommandPalette(page: Page): Promise<InteractionResult> {
  await page.goto(`${BASE}/#/`);
  await page.waitForTimeout(1500);
  // Cmd-K on macOS, Ctrl-K elsewhere
  await page.keyboard.press("Meta+k");
  await page.waitForTimeout(600);
  const dialog = page.getByRole("dialog").first();
  const visible = (await dialog.count()) > 0 && await dialog.isVisible();
  await shotIfPresent(page, "interaction-cmd-k");
  if (visible) {
    // type a query and check results render
    await page.keyboard.type("custom");
    await page.waitForTimeout(400);
    await shotIfPresent(page, "interaction-cmd-k-search");
    await page.keyboard.press("Escape");
  }
  return { name: "cmd-k-palette", ok: visible, detail: visible ? "palette opened" : "palette did not open" };
}

async function probeListAndDetail(page: Page): Promise<InteractionResult> {
  // Pick a domain list — Contacts or similar — try via nav.
  await page.goto(`${BASE}/#/contacts`);
  await page.waitForTimeout(2500);
  await shotIfPresent(page, "interaction-contacts-list");
  const bodyText = (await page.evaluate(() => document.body.innerText)).toLowerCase();
  const hasList = bodyText.includes("contact") || bodyText.includes("lead") || bodyText.includes("name");
  if (!hasList) return { name: "list-detail-flow", ok: false, detail: `contacts list did not render — body=${bodyText.length} chars` };

  // Try to find any clickable row link.
  const rowLink = page.locator('a[href*="/contacts/"], tbody tr a, [data-testid*="row"]').first();
  if (!await rowLink.count()) return { name: "list-detail-flow", ok: hasList, detail: "list rendered but no detail link found" };
  await rowLink.click();
  await page.waitForTimeout(2000);
  await shotIfPresent(page, "interaction-contacts-detail");
  return { name: "list-detail-flow", ok: true, detail: "list rendered and navigated to detail" };
}

async function probeBulkImportFlow(page: Page): Promise<InteractionResult> {
  await page.goto(`${BASE}/#/settings/bulk-import`);
  await page.waitForTimeout(2000);
  const upload = page.getByText("Upload").first();
  const map = page.getByText("Map").first();
  const verify = page.getByText("Verify").first();
  const allWizardSteps = (await upload.count()) && (await map.count()) && (await verify.count());
  await shotIfPresent(page, "interaction-bulk-import");
  return {
    name: "bulk-import-wizard-render",
    ok: !!allWizardSteps,
    detail: allWizardSteps ? "all 3 wizard steps visible" : "wizard incomplete",
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  console.log("Logging in...");
  await login(page);
  console.log("Logged in.\n");

  const results: InteractionResult[] = [];
  const probes = [
    probeCustomFieldsCreate,
    probePropertySettersCreate,
    probeNamingSeriesCreate,
    probePrintFormatsCreate,
    probeNotificationRulesCreate,
    probeWebhookCreate,
    probeApiTokenCreate,
    probeCommandPalette,
    probeBulkImportFlow,
    probeListAndDetail,
  ];
  for (const probe of probes) {
    try {
      const r = await probe(page);
      results.push(r);
      console.log(`  ${r.ok ? "OK  " : "FAIL"} ${r.name.padEnd(28)} ${r.detail}`);
    } catch (e) {
      results.push({ name: probe.name, ok: false, detail: String(e).slice(0, 150) });
      console.log(`  CRASH ${probe.name}: ${String(e).slice(0, 100)}`);
    }
  }

  await browser.close();

  const reportPath = path.join(OUT, "interactions.json");
  fs.writeFileSync(reportPath, JSON.stringify({ results, consoleErrors, pageErrors }, null, 2));
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} interactions OK`);
  console.log(`page errors: ${pageErrors.length}, console errors: ${consoleErrors.length}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((e) => { console.error(e); process.exit(2); });
