import assert from "node:assert/strict";

import { chromium } from "playwright";

import { startShellHarnessServer } from "../../src/harness";

const chromiumExecutable =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function runScenario(name: string, fn: () => Promise<void>) {
  process.stdout.write(`e2e: ${name}\n`);
  await fn();
}

async function main() {
  const harness = startShellHarnessServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumExecutable
  });

  try {
    await runScenario("admin desk boot and workspace navigation", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${harness.url}/admin?profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("body").getAttribute("data-shell"), "admin");
      assert.equal(await page.locator("[data-testid='admin-workbench-shell']").count(), 1);
      assert.ok((await page.getByText("Operations Overview").count()) > 0);

      await page.locator("[data-testid='workspace-list']").getByRole("link", { name: /AI/ }).click();
      assert.match((await page.locator("[data-testid='current-path']").textContent()) ?? "", /\/admin\/workspace\/ai/);

      await page.locator(".awb-sidebar a[href='/admin/ai/runs']").first().click();
      assert.equal(await page.locator("[data-plugin-page='ai-core-runs']").count(), 1);
      assert.match((await page.locator("[data-testid='favorites-list']").textContent()) ?? "", /Desk Home/);
      assert.match((await page.locator("[data-testid='favorites-list']").textContent()) ?? "", /Agent Runs/);

      await context.close();
    });

    await runScenario("search, reports, builder, and zone recovery", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${harness.url}/admin?profile=admin&search=agent&skin=slate&density=comfortable`, {
        waitUntil: "networkidle"
      });
      assert.match((await page.locator("[data-testid='search-results']").textContent()) ?? "", /Agent Runs/);
      const commandHref = await page.locator("[data-testid='open-command-palette']").getAttribute("href");
      assert.match(commandHref ?? "", /panel=commands/);
      assert.match(commandHref ?? "", /search=agent/);
      assert.match(commandHref ?? "", /skin=slate/);

      await page.goto(commandHref ? `${harness.url}${commandHref}` : `${harness.url}/admin?panel=commands&profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("[data-testid='command-dialog']").count(), 1);
      assert.ok((await page.getByText("Open Report Builder").count()) > 0);

      await page.goto(`${harness.url}/admin/reports/export-center?profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.match((await page.locator("[data-testid='route-state']").textContent()) ?? "", /report:200/);
      assert.equal(await page.locator("[data-plugin-page='dashboard-export-center']").count(), 1);

      await page.goto(`${harness.url}/admin/ai/runs?profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("[data-plugin-page='ai-core-runs']").count(), 1);

      await page.goto(`${harness.url}/admin/ai/prompts?profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("[data-plugin-page='ai-core-prompts']").count(), 1);

      await page.goto(`${harness.url}/admin/ai/approvals?profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("[data-plugin-page='ai-core-approvals']").count(), 1);

      await page.goto(`${harness.url}/admin/ai/retrieval?profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("[data-plugin-page='ai-rag-retrieval']").count(), 1);

      await page.goto(`${harness.url}/admin/ai/evals?profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("[data-plugin-page='ai-evals']").count(), 1);

      await page.goto(`${harness.url}/admin/reports/ai-regressions?profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.match((await page.locator("[data-testid='route-state']").textContent()) ?? "", /report:200/);

      await page.goto(`${harness.url}/admin/tools/report-builder?profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("[data-testid='builder-host']").count(), 1);
      assert.equal(await page.locator("[data-plugin-page='dashboard-report-builder']").count(), 1);

      await page.goto(`${harness.url}/admin/tools/job-monitor?profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("[data-plugin-page='dashboard-job-monitor']").count(), 1);

      await page.goto(`${harness.url}/admin/tools/page-builder?profile=admin`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("[data-testid='builder-host']").count(), 1);

      await page.goto(`${harness.url}/apps/page-builder?profile=admin&zoneState=healthy`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("[data-testid='zone-launch']").count(), 1);

      await page.goto(`${harness.url}/apps/page-builder?profile=admin&zoneState=degraded`, {
        waitUntil: "networkidle"
      });
      assert.match((await page.locator("[data-testid='route-state']").textContent()) ?? "", /zone-degraded:200/);
      assert.ok((await page.getByText("temporarily unavailable").count()) > 0);

      await context.close();
    });

    await runScenario("wrapper-backed toasts render for admin flows", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(
        `${harness.url}/admin?profile=admin&toast=success&toastTitle=Saved%20View&toastDetail=Active%20Contacts%20was%20saved`,
        {
          waitUntil: "networkidle"
        }
      );
      assert.equal(await page.locator("[data-testid='toast-stack']").count(), 1);
      assert.match((await page.locator("[data-testid='toast-stack']").textContent()) ?? "", /Saved View/);
      assert.match((await page.locator("[data-testid='toast-stack']").textContent()) ?? "", /Active Contacts was saved/);

      await context.close();
    });

    await runScenario("permission-aware denials", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${harness.url}/admin?profile=viewer`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.getByRole("link", { name: "Agent Runs" }).count(), 0);
      assert.equal(await page.getByRole("link", { name: "Admin Settings" }).count(), 0);
      assert.equal(await page.getByRole("link", { name: "Page Builder" }).count(), 0);
      assert.equal(await page.getByRole("link", { name: "Report Builder" }).count(), 0);
      assert.equal(await page.getByRole("link", { name: "Job Monitor" }).count(), 0);
      assert.equal(await page.getByRole("link", { name: "Restricted Preview" }).count(), 0);

      const settingsResponse = await page.goto(`${harness.url}/admin/settings?profile=viewer`, {
        waitUntil: "networkidle"
      });
      assert.equal(settingsResponse?.status(), 403);
      assert.ok((await page.getByText("Access blocked").count()) > 0);
      assert.match((await page.locator("[data-testid='route-state']").textContent()) ?? "", /forbidden:403/);

      const builderResponse = await page.goto(`${harness.url}/admin/tools/page-builder?profile=viewer`, {
        waitUntil: "networkidle"
      });
      assert.equal(builderResponse?.status(), 403);
      assert.match((await page.locator("[data-testid='route-state']").textContent()) ?? "", /forbidden:403/);

      const aiResponse = await page.goto(`${harness.url}/admin/ai/runs?profile=viewer`, {
        waitUntil: "networkidle"
      });
      assert.equal(aiResponse?.status(), 403);
      assert.match((await page.locator("[data-testid='route-state']").textContent()) ?? "", /forbidden:403/);

      await context.close();
    });

    await runScenario("impersonation and restricted preview details", async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${harness.url}/admin?profile=support`, {
        waitUntil: "networkidle"
      });
      assert.equal(await page.locator("[data-testid='impersonation-banner']").count(), 1);

      await page.goto(`${harness.url}/admin/plugins/restricted-preview?profile=support`, {
        waitUntil: "networkidle"
      });
      assert.match((await page.locator("[data-testid='restricted-preview-mode']").textContent()) ?? "", /restricted-preview/);
      assert.match((await page.locator("[data-testid='restricted-preview-isolation']").textContent()) ?? "", /declarative-only/);
      assert.match((await page.locator("[data-testid='restricted-preview-capabilities']").textContent()) ?? "", /data.export.dashboard/);
      assert.match((await page.locator("[data-testid='restricted-preview-hosts']").textContent()) ?? "", /api.example.com/);
      assert.match((await page.locator("[data-testid='restricted-preview-activation']").textContent()) ?? "", /unknown-marketplace-widget/);

      await context.close();
    });
  } finally {
    await browser.close();
    harness.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
