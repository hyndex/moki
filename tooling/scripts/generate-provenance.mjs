import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { BUN_BIN, ensureDir, rootDir } from "./workspace-utils.mjs";

const requiredArtifacts = [
  {
    path: path.join(rootDir, "artifacts", "release", "platform-core-framework.tgz"),
    script: "package:release"
  },
  {
    path: path.join(rootDir, "artifacts", "sbom", "platform-sbom.cdx.json"),
    script: "sbom:generate"
  }
];

for (const artifact of requiredArtifacts) {
  if (existsSync(artifact.path)) {
    continue;
  }

  const result = spawnSync(BUN_BIN, ["run", artifact.script], {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, BUN_BIN }
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const provenanceDir = ensureDir(path.join(rootDir, "artifacts", "provenance"));
const outputPath = path.join(provenanceDir, "build-provenance.json");
const trackedPaths = [
  "artifacts/release/platform-core-framework.tgz",
  "artifacts/release/manifest.json",
  "artifacts/sbom/platform-sbom.cdx.json",
  "ops/postgres/platform-bootstrap.sql",
  "ops/postgres/transaction-context.sql",
  "package.json",
  "bun.lock",
  ".github/workflows/ci.yml",
  ".github/workflows/release-readiness.yml"
];

const subjects = trackedPaths
  .map((relativePath) => {
    const absolutePath = path.join(rootDir, relativePath);
    if (!existsSync(absolutePath)) {
      return null;
    }

    return {
      path: relativePath,
      sha256: createHash("sha256").update(readFileSync(absolutePath)).digest("hex")
    };
  })
  .filter(Boolean);

const bunVersion = spawnSync(BUN_BIN, ["--version"], {
  cwd: rootDir,
  encoding: "utf8",
  env: { ...process.env, BUN_BIN }
});

const provenance = {
  schemaVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  buildType: "bun-workspace-platform-core-framework",
  source: {
    repositoryPresent: existsSync(path.join(rootDir, ".git")),
    workspaceRoot: rootDir
  },
  invocation: {
    commands: [
      "bun run build",
      "bun run typecheck",
      "bun run lint",
      "bun run test",
      "bun run test:integration",
      "bun run test:contracts",
      "bun run test:migrations",
      "bun run coverage:report",
      "bun run security:audit",
      "bun run package:release",
      "bun run sbom:generate"
    ]
  },
  environment: {
    bunVersion: (bunVersion.stdout || "").trim() || "unknown",
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version
  },
  subjects
};

writeFileSync(outputPath, JSON.stringify(provenance, null, 2));
writeFileSync(
  path.join(provenanceDir, "subjects.checksums.txt"),
  subjects.map((subject) => `${subject.sha256}  ${subject.path}`).join("\n") + "\n"
);
