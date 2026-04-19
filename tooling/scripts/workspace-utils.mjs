import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";

export const rootDir = process.cwd();
export const BUN_BIN = process.env.BUN_BIN || process.execPath || "bun";
export const workspaceRoots = [
  "apps",
  path.join("framework", "core"),
  path.join("framework", "libraries"),
  path.join("framework", "builtin-plugins"),
  path.join("plugins", "domain"),
  path.join("plugins", "feature-packs"),
  path.join("plugins", "connectors"),
  path.join("plugins", "migrations"),
  path.join("plugins", "verticals"),
  path.join("plugins", "bundles"),
  "tooling"
];

export function getWorkspacePackageDirs(root = rootDir) {
  const packageDirs = [];

  for (const workspaceRoot of workspaceRoots) {
    const absoluteRoot = path.join(root, workspaceRoot);
    if (!existsSync(absoluteRoot)) {
      continue;
    }

    for (const entry of readdirSync(absoluteRoot)) {
      const absoluteEntry = path.join(absoluteRoot, entry);
      if (!statSync(absoluteEntry).isDirectory()) {
        continue;
      }

      if (existsSync(path.join(absoluteEntry, "package.json"))) {
        packageDirs.push(absoluteEntry);
      }
    }
  }

  return packageDirs.sort((left, right) => left.localeCompare(right));
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function ensureDir(directoryPath) {
  mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
}

export function cleanDir(directoryPath) {
  rmSync(directoryPath, { force: true, recursive: true });
  mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
}

export function slugifyPackageName(packageName) {
  return packageName.replace(/^@/, "").replace(/[\\/]/g, "__");
}

export function stripAnsi(value) {
  return value.replace(new RegExp(String.raw`\u001B\[[0-9;]*m`, "g"), "");
}

export function hasTests(packageDir) {
  return existsSync(path.join(packageDir, "tests"));
}
