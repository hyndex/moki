import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { BUN_BIN, cleanDir, ensureDir, getWorkspacePackageDirs, hasTests, readJson, rootDir, slugifyPackageName } from "./workspace-utils.mjs";

const coverageRoot = cleanDir(path.join(rootDir, "coverage"));
const manifest = {
  generatedAt: new Date().toISOString(),
  packages: []
};

let executedCount = 0;

for (const packageDir of getWorkspacePackageDirs()) {
  if (!hasTests(packageDir)) {
    continue;
  }

  const packageJson = readJson(path.join(packageDir, "package.json"));
  const coverageDir = cleanDir(path.join(coverageRoot, slugifyPackageName(packageJson.name)));

  console.log(`\n==> ${packageJson.name} :: coverage`);
  const result = spawnSync(
    BUN_BIN,
    [
      "test",
      "--coverage",
      "--coverage-reporter=text",
      "--coverage-reporter=lcov",
      "--coverage-dir",
      coverageDir
    ],
    {
      cwd: packageDir,
      stdio: "inherit",
      env: { ...process.env, BUN_BIN }
    }
  );

  executedCount += 1;

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  manifest.packages.push({
    packageName: packageJson.name,
    packageDir: path.relative(rootDir, packageDir),
    coverageDir: path.relative(rootDir, coverageDir),
    lcovPath: existsSync(path.join(coverageDir, "lcov.info")) ? path.relative(rootDir, path.join(coverageDir, "lcov.info")) : null
  });
}

if (executedCount === 0) {
  console.warn("No workspace package with tests was found for coverage reporting.");
}

ensureDir(coverageRoot);
writeFileSync(path.join(coverageRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
