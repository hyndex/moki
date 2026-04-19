import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { cleanDir, ensureDir, rootDir } from "./workspace-utils.mjs";

const releaseDir = cleanDir(path.join(rootDir, "artifacts", "release"));
const archivePath = path.join(releaseDir, "platform-core-framework.tgz");
const includedPaths = [
  ".github",
  ".env.example",
  ".env.test.example",
  "ARCHITECTURE_DECISIONS.md",
  "Developer_DeepDive.md",
  "Goal.md",
  "IMPLEMENTATION_LEDGER.md",
  "README.md",
  "RISK_REGISTER.md",
  "STATUS.md",
  "TASKS.md",
  "TEST_MATRIX.md",
  "apps",
  "bun.lock",
  "bunfig.toml",
  "docs",
  "eslint.config.mjs",
  "ops",
  "package.json",
  "packages",
  "plugins",
  "prettier.config.mjs",
  "tooling",
  "tsconfig.base.json",
  "tsconfig.json"
].filter((entry) => existsSync(path.join(rootDir, entry)));

const tarResult = spawnSync(
  "tar",
  [
    "-czf",
    archivePath,
    "--exclude=artifacts",
    "--exclude=coverage",
    "--exclude=node_modules",
    "--exclude=playwright-report",
    "--exclude=test-results",
    "--exclude=.bun-install-cache",
    "--exclude=*.tsbuildinfo",
    ...includedPaths
  ],
  {
    cwd: rootDir,
    stdio: "inherit"
  }
);

if (tarResult.status !== 0) {
  process.exit(tarResult.status ?? 1);
}

const checksum = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
const manifest = {
  generatedAt: new Date().toISOString(),
  archivePath: path.relative(rootDir, archivePath),
  sha256: checksum,
  includedPaths
};

ensureDir(releaseDir);
writeFileSync(path.join(releaseDir, "manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync(path.join(releaseDir, "checksums.txt"), `${checksum}  platform-core-framework.tgz\n`);
