import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = resolve(import.meta.dir, "../..");
const distDir = join(rootDir, "dist");
const outputPath = join(distDir, "gutu.js");
const bunBin = process.env.BUN_BIN || process.execPath || "bun";

mkdirSync(dirname(outputPath), { recursive: true });

const result = spawnSync(
  bunBin,
  [
    "build",
    join(rootDir, "framework/core/cli/src/bin.ts"),
    "--outfile",
    outputPath,
    "--target",
    "bun",
    "--format",
    "esm"
  ],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const current = readFileSync(outputPath, "utf8");
const shebang = "#!/usr/bin/env bun\n";
const withoutExistingShebang = current.replace(/^#![^\n]*\n/, "");
if (!current.startsWith(shebang)) {
  writeFileSync(outputPath, `${shebang}${withoutExistingShebang}`, "utf8");
}

chmodSync(outputPath, 0o755);
