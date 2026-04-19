import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dir, "../../../");
const pluginsRoot = path.join(workspaceRoot, "plugins");
const bannedImports = [
  "@tanstack/react-router",
  "@tanstack/react-query",
  "@tanstack/react-table",
  "@tanstack/react-virtual",
  "react-hook-form",
  "@hookform/resolvers",
  "lucide-react",
  "sonner",
  "cmdk",
  "date-fns",
  "echarts"
];
const bannedPatterns = [/^@radix-ui\//, /^@tiptap\//, /^@react-email\//];

describe("admin plugin stack policy", () => {
  it("keeps admin-registered plugins on platform wrappers instead of raw UI stack imports", () => {
    const adminPluginRoots = findAdminPluginRoots(pluginsRoot);
    const violations: string[] = [];

    for (const pluginRoot of adminPluginRoots) {
      for (const filePath of walk(path.join(pluginRoot, "src", "ui"))) {
        if (!/\.(ts|tsx)$/.test(filePath)) {
          continue;
        }
        if (isZoneException(filePath)) {
          continue;
        }

        const source = readFileSync(filePath, "utf8");
        for (const specifier of readImportSpecifiers(source)) {
          if (bannedImports.includes(specifier) || bannedPatterns.some((pattern) => pattern.test(specifier))) {
            violations.push(`${path.relative(workspaceRoot, filePath)} -> ${specifier}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

function findAdminPluginRoots(root: string): string[] {
  const roots: string[] = [];
  for (const filePath of walk(root)) {
    if (filePath.endsWith(path.join("src", "ui", "admin.contributions.ts"))) {
      roots.push(path.dirname(path.dirname(path.dirname(filePath))));
    }
  }
  return roots.sort((left, right) => left.localeCompare(right));
}

function walk(root: string): string[] {
  if (!exists(root)) {
    return [];
  }

  const results: string[] = [];
  for (const entry of readdirSync(root)) {
    const absolutePath = path.join(root, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      results.push(...walk(absolutePath));
      continue;
    }
    results.push(absolutePath);
  }
  return results;
}

function readImportSpecifiers(source: string): string[] {
  const matches = source.matchAll(/from\s+["']([^"']+)["']/g);
  return [...matches].map((match) => match[1] ?? "").filter(Boolean);
}

function isZoneException(filePath: string): boolean {
  return filePath.includes(`${path.sep}zone${path.sep}`)
    || filePath.includes(`${path.sep}zones${path.sep}`)
    || /\.zone\.(ts|tsx)$/.test(filePath);
}

function exists(filePath: string): boolean {
  try {
    statSync(filePath);
    return true;
  } catch {
    return false;
  }
}
