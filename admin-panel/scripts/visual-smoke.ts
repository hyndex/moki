/* Headless visual smoke test of every plugin admin page.
 * Walks each route, captures the rendered DOM + a screenshot,
 * and reports load errors / missing elements. */

import { chromium, type Page } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const OUT = path.resolve(__dirname, "../../tmp/visual-smoke");
fs.mkdirSync(OUT, { recursive: true });

interface Probe {
  name: string;
  hash: string;
  expectedText: string[];
  optional?: boolean;
}

const PROBES: Probe[] = [
  { name: "landing", hash: "/", expectedText: ["Gutu", "Settings"] },

  // 6 plugin admin pages I migrated this session
  { name: "custom-fields", hash: "/settings/custom-fields", expectedText: ["Custom fields"] },
  { name: "property-setters", hash: "/settings/property-setters", expectedText: ["Property setters"] },
  { name: "naming-series", hash: "/settings/naming-series", expectedText: ["Naming series"] },
  { name: "print-formats", hash: "/settings/print-formats", expectedText: ["Print formats"] },
  { name: "notification-rules", hash: "/settings/notification-rules", expectedText: ["Notification rules"] },
  { name: "bulk-import", hash: "/settings/bulk-import", expectedText: ["Bulk import"] },

  // Legacy admin-tools surfaces (still in shell)
  { name: "workflows", hash: "/settings/workflows", expectedText: ["Workflow"] },
  { name: "webhooks", hash: "/settings/webhooks", expectedText: ["Webhook"] },
  { name: "api-tokens", hash: "/settings/api-tokens", expectedText: ["API token"] },
];

interface ProbeResult {
  name: string;
  url: string;
  ok: boolean;
  missing: string[];
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: { url: string; status: number; method: string }[];
  bodyTextLen: number;
  screenshotPath: string;
}

async function runProbe(page: Page, p: Probe): Promise<ProbeResult> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: { url: string; status: number; method: string }[] = [];

  const onConsole = (m: import("playwright").ConsoleMessage) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  };
  const onPageErr = (e: Error) => pageErrors.push(e.message);
  const onResp = (r: import("playwright").Response) => {
    if (r.status() >= 400) failedRequests.push({ url: r.url(), status: r.status(), method: r.request().method() });
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageErr);
  page.on("response", onResp);

  const url = `${BASE}/#${p.hash}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  // Hash router needs a tick to render after hash change.
  await page.waitForTimeout(2500);

  const bodyText = await page.evaluate(() => document.body.innerText ?? "");
  const missing = p.expectedText.filter((t) => !bodyText.toLowerCase().includes(t.toLowerCase()));

  const screenshotPath = path.join(OUT, `${p.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  page.off("console", onConsole);
  page.off("pageerror", onPageErr);
  page.off("response", onResp);

  return {
    name: p.name,
    url,
    ok: missing.length === 0 && pageErrors.length === 0,
    missing,
    consoleErrors,
    pageErrors,
    failedRequests,
    bodyTextLen: bodyText.length,
    screenshotPath,
  };
}

async function login(page: Page) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('button:has-text("Sign in")', { timeout: 10_000 });
  // Inputs may be pre-filled; force the values to be safe.
  await page.fill('input[type="email"], input[name="email"]', "chinmoy@gutu.dev");
  await page.fill('input[type="password"]', "password");
  await page.click('button:has-text("Sign in")');
  // Wait for shell to render — look for nav landmark or settings link.
  await page.waitForFunction(
    () => !document.body.innerText.toLowerCase().includes("sign in to your workspace"),
    { timeout: 10_000 },
  );
  await page.waitForTimeout(800);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log("Logging in...");
  await login(page);
  console.log("Logged in.\n");

  const results: ProbeResult[] = [];
  for (const probe of PROBES) {
    process.stdout.write(`  → ${probe.name}…`);
    try {
      const r = await runProbe(page, probe);
      results.push(r);
      process.stdout.write(r.ok ? " ok\n" : ` MISS ${r.missing.join(",")} | err ${r.pageErrors.length}\n`);
    } catch (e) {
      results.push({
        name: probe.name,
        url: `${BASE}/#${probe.hash}`,
        ok: false,
        missing: probe.expectedText,
        consoleErrors: [],
        pageErrors: [String(e)],
        failedRequests: [],
        bodyTextLen: 0,
        screenshotPath: "",
      });
      process.stdout.write(` FAIL ${String(e).slice(0, 80)}\n`);
    }
  }

  await browser.close();

  const reportPath = path.join(OUT, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  console.log("\n=== SUMMARY ===");
  let okCount = 0;
  for (const r of results) {
    const status = r.ok ? "OK  " : "FAIL";
    console.log(
      `${status} ${r.name.padEnd(20)} body=${String(r.bodyTextLen).padStart(5)}  missing=[${r.missing.join(",")}]  pageErr=${r.pageErrors.length}  reqErr=${r.failedRequests.length}`,
    );
    if (r.ok) okCount++;
  }
  console.log(`\n${okCount}/${results.length} probes OK`);
  console.log(`Report: ${reportPath}`);
  console.log(`Screenshots: ${OUT}/`);

  if (okCount !== results.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
