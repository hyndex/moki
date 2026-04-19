import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { BUN_BIN, ensureDir, getWorkspacePackageDirs, readJson, rootDir, stripAnsi } from "./workspace-utils.mjs";

const sbomDir = ensureDir(path.join(rootDir, "artifacts", "sbom"));
const outputPath = path.join(sbomDir, "platform-sbom.cdx.json");
const rootPackage = readJson(path.join(rootDir, "package.json"));
const lockfilePath = path.join(rootDir, "bun.lock");
const workspacePackages = getWorkspacePackageDirs().map((packageDir) => {
  const packageJson = readJson(path.join(packageDir, "package.json"));
  return {
    dir: packageDir,
    path: path.relative(rootDir, packageDir),
    manifest: packageJson
  };
});

const bunVersionResult = spawnSync(BUN_BIN, ["--version"], {
  cwd: rootDir,
  encoding: "utf8",
  env: { ...process.env, BUN_BIN }
});
const listResult = spawnSync(BUN_BIN, ["list", "--all"], {
  cwd: rootDir,
  encoding: "utf8",
  env: { ...process.env, BUN_BIN }
});
const lockHash = existsSync(lockfilePath)
  ? createHash("sha256").update(readFileSync(lockfilePath)).digest("hex")
  : null;

if (listResult.status !== 0) {
  console.error(listResult.stderr);
  process.exit(listResult.status ?? 1);
}

const workspaceRefByName = new Map(
  workspacePackages.map(({ manifest }) => [
    manifest.name,
    `pkg:npm/${encodePurlName(manifest.name)}@${manifest.version ?? "0.1.0"}`
  ])
);
const externalComponents = new Map();

for (const rawLine of stripAnsi(listResult.stdout).split(/\r?\n/)) {
  const trimmed = rawLine.trim();
  if (!trimmed || !trimmed.includes("@") || trimmed.includes("*circular")) {
    continue;
  }

  const normalized = trimmed
    .replace(/^[├└│─\s]+/, "")
    .replace(/^(optional peer|peer|dev)\s+/, "")
    .replace(/\s+\(requires.*$/, "");
  const atIndex = normalized.lastIndexOf("@");

  if (atIndex <= 0) {
    continue;
  }

  const name = normalized.slice(0, atIndex);
  const version = normalized.slice(atIndex + 1);
  if (!version || version.startsWith("workspace:") || workspaceRefByName.has(name)) {
    continue;
  }

  const key = `${name}@${version}`;
  if (!externalComponents.has(key)) {
    externalComponents.set(key, {
      type: "library",
      name,
      version,
      "bom-ref": `pkg:npm/${encodePurlName(name)}@${version}`,
      purl: `pkg:npm/${encodePurlName(name)}@${version}`
    });
  }
}

const componentRefsByName = new Map();
for (const component of externalComponents.values()) {
  if (!componentRefsByName.has(component.name)) {
    componentRefsByName.set(component.name, component["bom-ref"]);
  }
}

const workspaceComponents = workspacePackages.map(({ manifest, path: packagePath }) => {
  const type = packagePath.startsWith("apps/") ? "application" : "library";
  const version = manifest.version ?? "0.1.0";
  return {
    type,
    name: manifest.name,
    version,
    "bom-ref": `pkg:npm/${encodePurlName(manifest.name)}@${version}`,
    purl: `pkg:npm/${encodePurlName(manifest.name)}@${version}`,
    properties: [
      { name: "platform:workspacePath", value: packagePath },
      { name: "platform:private", value: String(Boolean(manifest.private)) }
    ]
  };
});

const components = [...workspaceComponents, ...externalComponents.values()];
const dependencies = [];

dependencies.push({
  ref: `pkg:npm/${encodePurlName(rootPackage.name)}@workspace`,
  dependsOn: resolveDependencies(rootPackage, workspaceRefByName, componentRefsByName)
});

for (const { manifest } of workspacePackages) {
  dependencies.push({
    ref: `pkg:npm/${encodePurlName(manifest.name)}@${manifest.version ?? "0.1.0"}`,
    dependsOn: resolveDependencies(manifest, workspaceRefByName, componentRefsByName)
  });
}

const bom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [
      {
        vendor: "OpenAI Codex",
        name: "platform-sbom-generator",
        version: "1.0.0"
      }
    ],
    component: {
      type: "application",
      name: rootPackage.name,
      version: "workspace",
      "bom-ref": `pkg:npm/${encodePurlName(rootPackage.name)}@workspace`,
      properties: [
        { name: "platform:packageManager", value: rootPackage.packageManager ?? "bun" },
        { name: "platform:bunVersion", value: (bunVersionResult.stdout || "").trim() || "unknown" },
        { name: "platform:lockfileHashSha256", value: lockHash ?? "missing" }
      ]
    }
  },
  components,
  dependencies
};

writeFileSync(outputPath, JSON.stringify(bom, null, 2));

function resolveDependencies(packageJson, workspaceMap, externalMap) {
  const dependencies = new Set();
  for (const section of ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"]) {
    const values = packageJson[section];
    if (!values) {
      continue;
    }

    for (const dependencyName of Object.keys(values)) {
      const workspaceRef = workspaceMap.get(dependencyName);
      if (workspaceRef) {
        dependencies.add(workspaceRef);
        continue;
      }

      const externalRef = externalMap.get(dependencyName);
      if (externalRef) {
        dependencies.add(externalRef);
      }
    }
  }

  return [...dependencies].sort((left, right) => left.localeCompare(right));
}

function encodePurlName(packageName) {
  return packageName.replace(/^@/, "%40").replace("/", "%2F");
}
