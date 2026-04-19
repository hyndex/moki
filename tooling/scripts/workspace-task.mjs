import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { BUN_BIN, getWorkspacePackageDirs, readJson } from "./workspace-utils.mjs";

const requestedScript = process.argv[2];

if (!requestedScript) {
  console.error("usage: bun run tooling/scripts/workspace-task.mjs <script>");
  process.exit(1);
}

const fallbackTestDirs = {
  "test:unit": path.join("tests", "unit"),
  "test:integration": path.join("tests", "integration"),
  "test:contracts": path.join("tests", "contracts"),
  "test:migrations": path.join("tests", "migrations"),
  "test:e2e": path.join("tests", "e2e")
};

const workspacePackages = getWorkspacePackageDirs();
let executedCount = 0;

for (const packageDir of workspacePackages) {
  const packageJsonPath = path.join(packageDir, "package.json");
  const packageJson = readJson(packageJsonPath);
  const fallbackTestDir = fallbackTestDirs[requestedScript];
  const fallbackTestPath = fallbackTestDir ? path.join(packageDir, fallbackTestDir) : null;

  if (!packageJson.scripts || !packageJson.scripts[requestedScript]) {
    if (!fallbackTestPath || !existsSync(fallbackTestPath)) {
      continue;
    }

    console.log(`\n==> ${packageJson.name} :: ${requestedScript} (fallback)`);
    const fallbackResult = spawnSync(BUN_BIN, ["test", fallbackTestDir], {
      cwd: packageDir,
      stdio: "inherit",
      env: { ...process.env, BUN_BIN }
    });

    executedCount += 1;

    if (fallbackResult.status !== 0) {
      process.exit(fallbackResult.status ?? 1);
    }

    continue;
  }

  console.log(`\n==> ${packageJson.name} :: ${requestedScript}`);
  const result = spawnSync(BUN_BIN, ["run", requestedScript], {
    cwd: packageDir,
    stdio: "inherit",
    env: { ...process.env, BUN_BIN }
  });

  executedCount += 1;

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (executedCount === 0) {
  console.warn(`No workspace package exposed script '${requestedScript}'.`);
}
