import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

type PackageKind = "app" | "library" | "plugin";
type SourceMode = "live" | "local";
type RepositoryKind = "core" | "catalog" | "library" | "plugin";

type PackageRecord = {
  id: string;
  kind: PackageKind;
  private: boolean;
  repoRootRelative: string;
  packageRelative: string;
  packageAbsolute: string;
  scripts: Record<string, string>;
  workspaceDependencies: string[];
};

type CommandResult = {
  ok: boolean;
  command: string;
  code: number;
  stdout: string;
  stderr: string;
};

type PackageMatrixResult = {
  id: string;
  kind: PackageKind;
  packageRelative: string;
  commands: CommandResult[];
};

type AuditReport = {
  generatedAt: string;
  mode: SourceMode;
  workspaceRoot: string;
  integrationRoot: string;
  topologyPath?: string;
  packages: PackageRecord[];
  corePackageIds: string[];
  compatPackageIds: string[];
  unresolvedWorkspaceDependencies: Array<{
    packageId: string;
    missing: string[];
  }>;
  manifestDrift: Array<{
    packageId: string;
    missing: string[];
  }>;
  unresolvedImports: string[];
};

type CertificationReport = {
  generatedAt: string;
  mode: SourceMode;
  workspaceRoot: string;
  certificationWorkspace: string;
  install: CommandResult;
  packageResults: PackageMatrixResult[];
  failures: Array<{
    packageId: string;
    command: string;
    code: number;
  }>;
};

type ConsumerSmokeReport = {
  generatedAt: string;
  mode: SourceMode;
  exampleRoot: string;
  certificationInstall: CommandResult;
  init: CommandResult;
  vendorSync: CommandResult;
  verifiedPaths: string[];
  packagedArtifacts: string[];
};

type TopologyRepository = {
  name: string;
  kind: RepositoryKind;
  path: string;
  url: string;
  branch?: string;
};

type TopologyManifest = {
  schemaVersion: 1;
  organization: string;
  consumerSmoke: {
    channel: string;
    libraryPackageId: string;
    pluginPackageId: string;
  };
  repositories: TopologyRepository[];
};

type RuntimeContext = {
  mode: SourceMode;
  integrationRoot: string;
  reportsRoot: string;
  tempRoot: string;
  sourceWorkspaceRoot: string;
  certificationWorkspaceRoot: string;
  consumerSmokeRoot: string;
  includeApps: boolean;
  topologyPath?: string;
  topology?: TopologyManifest;
};

const integrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localWorkspaceRoot = resolve(integrationRoot, "..", "..");
const reportsRoot = join(integrationRoot, "reports");
const tempRoot = join(integrationRoot, ".tmp");
const topologyPath = join(integrationRoot, "matrix", "live-topology.json");
const scriptOrder = ["lint", "typecheck", "test", "build"] as const;

async function main() {
  const command = process.argv[2] ?? "audit";
  mkdirSync(reportsRoot, { recursive: true });
  mkdirSync(tempRoot, { recursive: true });

  const mode = (process.env.GUTU_ECOSYSTEM_MODE ?? "live") === "local" ? "local" : "live";
  const context = prepareContext(mode);

  if (command === "audit") {
    const report = createAuditReport(context);
    writeAuditReport(context, report);
    assertAuditHealthy(report);
    return;
  }

  if (command === "certify") {
    const report = runCertification(context);
    writeCertificationReport(context, report);
    assertCertificationHealthy(report);
    return;
  }

  if (command === "consumer-smoke") {
    const report = await runConsumerSmoke(context);
    writeConsumerSmokeReport(context, report);
    assertConsumerSmokeHealthy(report);
    return;
  }

  throw new Error(`Unknown command '${command}'. Expected audit, certify, or consumer-smoke.`);
}

function prepareContext(mode: SourceMode): RuntimeContext {
  if (mode === "local") {
    return {
      mode,
      integrationRoot,
      reportsRoot,
      tempRoot,
      sourceWorkspaceRoot: localWorkspaceRoot,
      certificationWorkspaceRoot: join(tempRoot, "certify-workspace"),
      consumerSmokeRoot: join(tempRoot, "consumer-smoke"),
      includeApps: true
    };
  }

  if (!existsSync(topologyPath)) {
    throw new Error(`Missing live topology manifest at ${topologyPath}.`);
  }

  const topology = JSON.parse(readFileSync(topologyPath, "utf8")) as TopologyManifest;
  const sourceWorkspaceRoot = join(tempRoot, "live-workspace");
  stageLiveWorkspace(sourceWorkspaceRoot, topology);

  return {
    mode,
    integrationRoot,
    reportsRoot,
    tempRoot,
    sourceWorkspaceRoot,
    certificationWorkspaceRoot: join(tempRoot, "certify-workspace"),
    consumerSmokeRoot: join(tempRoot, "consumer-smoke"),
    includeApps: false,
    topologyPath,
    topology
  };
}

function stageLiveWorkspace(targetRoot: string, topology: TopologyManifest) {
  ensureCleanDirectory(targetRoot);

  for (const repository of topology.repositories) {
    const destination = join(targetRoot, repository.path);
    mkdirSync(dirname(destination), { recursive: true });
    const cloned = runCommand(targetRoot, [
      "git",
      "clone",
      "--depth",
      "1",
      "--branch",
      repository.branch ?? "main",
      repository.url,
      destination
    ]);
    if (!cloned.ok) {
      throw new Error(`Unable to clone ${repository.url}: ${cloned.stderr || cloned.stdout}`);
    }
  }
}

function createAuditReport(context: RuntimeContext): AuditReport {
  const packages = discoverPackages(context);
  const corePackageIds = discoverCorePackageIds(context.sourceWorkspaceRoot);
  const availablePackageIds = new Set<string>([
    ...packages.map((entry) => entry.id),
    ...corePackageIds
  ]);

  const unresolvedWorkspaceDependencies = packages
    .map((entry) => ({
      packageId: entry.id,
      missing: entry.workspaceDependencies.filter((dependency) => !availablePackageIds.has(dependency))
    }))
    .filter((entry) => entry.missing.length > 0);

  const manifestDrift = findManifestDrift(packages, availablePackageIds);
  const unresolvedImports = findUnresolvedImports(context, availablePackageIds);

  return {
    generatedAt: new Date().toISOString(),
    mode: context.mode,
    workspaceRoot: context.sourceWorkspaceRoot,
    integrationRoot: context.integrationRoot,
    ...(context.topologyPath ? { topologyPath: context.topologyPath } : {}),
    packages,
    corePackageIds,
    compatPackageIds: [],
    unresolvedWorkspaceDependencies,
    manifestDrift,
    unresolvedImports
  };
}

function runCertification(context: RuntimeContext): CertificationReport {
  const audit = createAuditReport(context);
  writeAuditReport(context, audit);

  ensureCleanDirectory(context.certificationWorkspaceRoot);
  copyRepoRoots(context, context.certificationWorkspaceRoot, audit.packages);
  copyCoreRoot(context, context.certificationWorkspaceRoot);
  writeCertificationWorkspacePackageJson(context.certificationWorkspaceRoot, context.includeApps);
  normalizeCertificationWorkspace(context.certificationWorkspaceRoot, context.includeApps);

  const install = runCommand(context.certificationWorkspaceRoot, ["bun", "install"]);
  const packageResults = new Map<string, PackageMatrixResult>();
  for (const entry of audit.packages) {
    packageResults.set(entry.id, {
      id: entry.id,
      kind: entry.kind,
      packageRelative: entry.packageRelative,
      commands: []
    });
  }

  if (install.ok) {
    for (const entry of audit.packages.sort((left, right) => left.id.localeCompare(right.id))) {
      const packagePath = join(context.certificationWorkspaceRoot, entry.packageRelative);
      const result = packageResults.get(entry.id);
      if (!result) {
        continue;
      }

      if (entry.scripts.lint) {
        result.commands.push(runCommand(packagePath, ["bun", "run", "lint"]));
      }
    }

    for (const entry of topologicalSortPackages(audit.packages)) {
      const packagePath = join(context.certificationWorkspaceRoot, entry.packageRelative);
      const result = packageResults.get(entry.id);
      if (entry.scripts.build) {
        result?.commands.push(runCommand(packagePath, ["bun", "run", "build"]));
      }
    }

    for (const entry of audit.packages.sort((left, right) => left.id.localeCompare(right.id))) {
      const packagePath = join(context.certificationWorkspaceRoot, entry.packageRelative);
      const result = packageResults.get(entry.id);
      if (!result) {
        continue;
      }

      for (const scriptName of scriptOrder) {
        if (scriptName === "build" || scriptName === "lint" || !entry.scripts[scriptName]) {
          continue;
        }

        result.commands.push(runCommand(packagePath, ["bun", "run", scriptName]));
      }

      if (!entry.private) {
        result.commands.push(runCommand(packagePath, ["npm", "pack", "--json", "--dry-run"]));
      }
    }
  }

  const packageResultsList = [...packageResults.values()];
  const failures = packageResultsList.flatMap((entry) =>
    entry.commands
      .filter((command) => !command.ok)
      .map((command) => ({
        packageId: entry.id,
        command: command.command,
        code: command.code
      }))
  );

  if (!install.ok) {
    failures.unshift({
      packageId: "workspace",
      command: install.command,
      code: install.code
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: context.mode,
    workspaceRoot: context.sourceWorkspaceRoot,
    certificationWorkspace: context.certificationWorkspaceRoot,
    install,
    packageResults: packageResultsList,
    failures
  };
}

async function runConsumerSmoke(context: RuntimeContext): Promise<ConsumerSmokeReport> {
  if (!existsSync(context.certificationWorkspaceRoot)) {
    const certification = runCertification(context);
    writeCertificationReport(context, certification);
    assertCertificationHealthy(certification);
  }

  const certificationInstall = runCommand(context.certificationWorkspaceRoot, ["bun", "install"]);
  ensureCleanDirectory(context.consumerSmokeRoot);

  const exampleRoot = join(context.consumerSmokeRoot, "demo-consumer");
  const coreRoot = join(context.certificationWorkspaceRoot, "gutu-core");
  const init = runCommand(coreRoot, ["bun", "run", "framework/core/cli/src/bin.ts", "init", exampleRoot]);

  let packagedArtifacts: string[] = [];

  if (context.mode === "live") {
    const libraryEntry = loadLiveChannelEntry(
      context,
      "library",
      context.topology?.consumerSmoke.channel ?? "stable",
      context.topology?.consumerSmoke.libraryPackageId ?? "@platform/communication"
    );
    const pluginEntry = loadLiveChannelEntry(
      context,
      "plugin",
      context.topology?.consumerSmoke.channel ?? "stable",
      context.topology?.consumerSmoke.pluginPackageId ?? "@plugins/notifications-core"
    );

    packagedArtifacts = [libraryEntry.artifact?.uri ?? "", pluginEntry.artifact?.uri ?? ""].filter((entry) => entry.length > 0);
    writeFileSync(
      join(exampleRoot, "gutu.lock.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          channel: context.topology?.consumerSmoke.channel ?? "stable",
          core: {
            package: "gutu-core",
            version: "0.0.1"
          },
          libraries: [libraryEntry],
          plugins: [pluginEntry]
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  } else {
    const certificationPackages = discoverPackagesAtRoot(context.certificationWorkspaceRoot, false);
    const communication = certificationPackages.find((entry) => entry.id === "@platform/communication");
    const notifications = certificationPackages.find((entry) => entry.id === "@plugins/notifications-core");
    if (!communication || !notifications) {
      throw new Error("Local consumer smoke could not locate the communication or notifications packages.");
    }

    packagedArtifacts = [
      packPublishedPackage(join(context.certificationWorkspaceRoot, communication.packageRelative)),
      packPublishedPackage(join(context.certificationWorkspaceRoot, notifications.packageRelative))
    ];

    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const libraries = [createFileLockEntry("@platform/communication", "library", packagedArtifacts[0], privateKey, publicKeyPem)];
    const plugins = [createFileLockEntry("@plugins/notifications-core", "plugin", packagedArtifacts[1], privateKey, publicKeyPem)];

    writeFileSync(
      join(exampleRoot, "gutu.lock.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          channel: "stable",
          core: {
            package: "gutu-core",
            version: "0.0.1"
          },
          libraries,
          plugins
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
  }

  const vendorSync = await runVendorSyncDirect(context.certificationWorkspaceRoot, exampleRoot);
  const verifiedPaths = [
    join(exampleRoot, "vendor", "libraries", "communication", "package.json"),
    join(exampleRoot, "vendor", "plugins", "notifications-core", "package.json")
  ].filter((entry) => existsSync(entry));

  return {
    generatedAt: new Date().toISOString(),
    mode: context.mode,
    exampleRoot,
    certificationInstall,
    init,
    vendorSync,
    verifiedPaths,
    packagedArtifacts
  };
}

async function runVendorSyncDirect(certificationWorkspaceRoot: string, exampleRoot: string): Promise<CommandResult> {
  const moduleUrl = pathToFileURL(
    join(certificationWorkspaceRoot, "gutu-core", "framework", "core", "ecosystem", "src", "index.ts")
  ).toString();

  try {
    const ecosystemModule = await import(moduleUrl);
    const result = await ecosystemModule.syncWorkspaceVendor(exampleRoot);
    return {
      ok: true,
      command: `syncWorkspaceVendor(${exampleRoot})`,
      code: 0,
      stdout: trimOutput(JSON.stringify(result, null, 2)),
      stderr: ""
    };
  } catch (error) {
    return {
      ok: false,
      command: `syncWorkspaceVendor(${exampleRoot})`,
      code: 1,
      stdout: "",
      stderr: trimOutput(error instanceof Error ? error.stack ?? error.message : String(error))
    };
  }
}

function discoverPackages(context: RuntimeContext): PackageRecord[] {
  return discoverPackagesAtRoot(context.sourceWorkspaceRoot, context.includeApps);
}

function discoverPackagesAtRoot(workspaceRoot: string, includeApps: boolean): PackageRecord[] {
  const packageRoots = [
    ...(includeApps ? [scanPackageRoots(workspaceRoot, join(workspaceRoot, "apps"), "app", ["apps"])] : []),
    scanPackageRoots(workspaceRoot, join(workspaceRoot, "libraries"), "library", ["framework", "libraries"]),
    scanPackageRoots(workspaceRoot, join(workspaceRoot, "plugins"), "plugin", ["framework", "builtin-plugins"])
  ];

  return packageRoots.flat().sort((left, right) => left.id.localeCompare(right.id));
}

function scanPackageRoots(
  workspaceRoot: string,
  baseRoot: string,
  kind: PackageKind,
  nestedSegments: string[]
): PackageRecord[] {
  if (!existsSync(baseRoot)) {
    return [];
  }

  const records: PackageRecord[] = [];
  for (const repoName of readdirSync(baseRoot)) {
    const repoRoot = join(baseRoot, repoName);
    const nestedRoot = join(repoRoot, ...nestedSegments);
    if (!existsSync(nestedRoot)) {
      continue;
    }

    for (const packageFolder of readdirSync(nestedRoot)) {
      const packageRoot = join(nestedRoot, packageFolder);
      const packageJsonPath = join(packageRoot, "package.json");
      if (!existsSync(packageJsonPath)) {
        continue;
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        name: string;
        private?: boolean;
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      const dependencies = {
        ...(packageJson.dependencies ?? {}),
        ...(packageJson.devDependencies ?? {})
      };

      records.push({
        id: packageJson.name,
        kind,
        private: Boolean(packageJson.private),
        repoRootRelative: relative(workspaceRoot, repoRoot),
        packageRelative: relative(workspaceRoot, packageRoot),
        packageAbsolute: packageRoot,
        scripts: packageJson.scripts ?? {},
        workspaceDependencies: Object.entries(dependencies)
          .filter(([, version]) => version.startsWith("workspace:"))
          .map(([dependency]) => dependency)
          .sort()
      });
    }
  }

  return records;
}

function discoverCorePackageIds(workspaceRoot: string): string[] {
  const coreFrameworkRoot = join(workspaceRoot, "gutu-core", "framework", "core");
  if (!existsSync(coreFrameworkRoot)) {
    return [];
  }

  return readdirSync(coreFrameworkRoot)
    .map((entry) => join(coreFrameworkRoot, entry, "package.json"))
    .filter((entry) => existsSync(entry))
    .map((entry) => JSON.parse(readFileSync(entry, "utf8")) as { name: string })
    .map((entry) => entry.name)
    .sort();
}

function findUnresolvedImports(context: RuntimeContext, availablePackageIds: Set<string>): string[] {
  const unresolved = new Set<string>();
  const importPattern = /from\s+["']([^"']+)["']/g;
  const roots = [
    ...(context.includeApps ? [join(context.sourceWorkspaceRoot, "apps")] : []),
    join(context.sourceWorkspaceRoot, "libraries"),
    join(context.sourceWorkspaceRoot, "plugins")
  ];

  for (const root of roots) {
    for (const file of walkFiles(root)) {
      if (!file.endsWith(".ts") && !file.endsWith(".tsx")) {
        continue;
      }

      const contents = readFileSync(file, "utf8");
      let match: RegExpExecArray | null = null;
      while ((match = importPattern.exec(contents)) !== null) {
        const dependency = match[1];
        if (
          (dependency.startsWith("@platform/") || dependency.startsWith("@plugins/") || dependency.startsWith("@apps/")) &&
          !availablePackageIds.has(dependency)
        ) {
          unresolved.add(dependency);
        }
      }
    }
  }

  return [...unresolved].sort();
}

function findManifestDrift(packages: PackageRecord[], availablePackageIds: Set<string>) {
  const firstPartyPattern = /^@(platform|plugins|apps)\//;

  return packages
    .map((entry) => {
      const imported = new Set<string>();
      const importPattern = /from\s+["']([^"']+)["']/g;

      for (const file of walkFiles(entry.packageAbsolute)) {
        if (!file.endsWith(".ts") && !file.endsWith(".tsx")) {
          continue;
        }

        const contents = readFileSync(file, "utf8");
        let match: RegExpExecArray | null = null;
        while ((match = importPattern.exec(contents)) !== null) {
          const dependency = match[1];
          if (firstPartyPattern.test(dependency) && availablePackageIds.has(dependency) && dependency !== entry.id) {
            imported.add(dependency);
          }
        }
      }

      const missing = [...imported].filter((dependency) => !entry.workspaceDependencies.includes(dependency)).sort();
      return {
        packageId: entry.id,
        missing
      };
    })
    .filter((entry) => entry.missing.length > 0);
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    for (const entry of readdirSync(current)) {
      const absolute = join(current, entry);
      if (entry === "node_modules" || entry === "dist" || entry === "coverage" || entry === ".git") {
        continue;
      }
      const fileStat = statSync(absolute);
      if (fileStat.isDirectory()) {
        queue.push(absolute);
      } else {
        files.push(absolute);
      }
    }
  }

  return files;
}

function ensureCleanDirectory(target: string) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
}

function copyRepoRoots(context: RuntimeContext, targetRoot: string, packages: PackageRecord[]) {
  const repoRoots = new Set(packages.map((entry) => entry.repoRootRelative));
  for (const repoRootRelative of repoRoots) {
    const source = join(context.sourceWorkspaceRoot, repoRootRelative);
    const destination = join(targetRoot, repoRootRelative);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, {
      recursive: true,
      filter(entry) {
        const name = entry.split("/").at(-1);
        return ![".git", "node_modules", "dist", "coverage", "artifacts"].includes(name ?? "");
      }
    });
  }
}

function copyCoreRoot(context: RuntimeContext, targetRoot: string) {
  const source = join(context.sourceWorkspaceRoot, "gutu-core");
  const destination = join(targetRoot, "gutu-core");
  cpSync(source, destination, {
    recursive: true,
    filter(entry) {
      const name = entry.split("/").at(-1);
      return ![".git", "node_modules", "dist", "coverage", "artifacts"].includes(name ?? "");
    }
  });
}

function writeCertificationWorkspacePackageJson(targetRoot: string, includeApps: boolean) {
  const workspaces = [
    "gutu-core/framework/core/*",
    "libraries/*/framework/libraries/*",
    "plugins/*/framework/builtin-plugins/*"
  ];
  if (includeApps) {
    workspaces.splice(1, 0, "apps/*/apps/*");
  }

  writeFileSync(
    join(targetRoot, "package.json"),
    JSON.stringify(
      {
        name: "gutu-ecosystem-certify-workspace",
        private: true,
        type: "module",
        workspaces,
        devDependencies: {
          "@eslint/js": "^9.25.1",
          "@types/react": "^19.2.2",
          "@types/react-dom": "^19.2.2",
          "bun-types": "^1.3.12",
          "eslint": "^9.25.1",
          "globals": "^16.0.0",
          "playwright": "^1.55.0",
          "react": "^19.1.0",
          "react-dom": "^19.1.0",
          "typescript": "5.8.3",
          "typescript-eslint": "^8.30.1",
          "zod": "^3.24.3"
        }
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

function normalizeCertificationWorkspace(targetRoot: string, includeApps: boolean) {
  for (const repoGroup of ["libraries", "plugins", ...(includeApps ? ["apps"] : [])] as const) {
    const groupRoot = join(targetRoot, repoGroup);
    if (!existsSync(groupRoot)) {
      continue;
    }

    for (const repoName of readdirSync(groupRoot)) {
      const repoRoot = join(groupRoot, repoName);
      const tsconfigBasePath = join(repoRoot, "tsconfig.base.json");
      if (!existsSync(tsconfigBasePath)) {
        continue;
      }

      writeFileSync(
        tsconfigBasePath,
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2022",
              module: "ESNext",
              moduleResolution: "Bundler",
              strict: true,
              noUncheckedIndexedAccess: true,
              exactOptionalPropertyTypes: true,
              verbatimModuleSyntax: true,
              skipLibCheck: true,
              jsx: "react-jsx",
              declaration: true,
              lib: ["ES2022", "DOM"],
              types: ["bun-types", "react", "react-dom"],
              baseUrl: ".",
              paths: {
                "@gutu/kernel": ["framework/core/kernel/src/index.ts"],
                "@gutu/ecosystem": ["framework/core/ecosystem/src/index.ts"],
                "@gutu/cli": ["framework/core/cli/src/index.ts"],
                "@gutu/release": ["framework/core/release/src/index.ts"]
              }
            }
          },
          null,
          2
        ) + "\n",
        "utf8"
      );
    }
  }

  if (includeApps) {
    const harnessPath = join(
      targetRoot,
      "apps",
      "gutu-app-platform-dev-console",
      "apps",
      "platform-dev-console",
      "src",
      "harness.tsx"
    );
    if (existsSync(harnessPath)) {
      const source = readFileSync(harnessPath, "utf8");
      writeFileSync(harnessPath, source.replace("/* eslint-disable react-refresh/only-export-components */\n", ""), "utf8");
    }
  }
}

function topologicalSortPackages(packages: PackageRecord[]): PackageRecord[] {
  const packageMap = new Map(packages.map((entry) => [entry.id, entry]));
  const ordered: PackageRecord[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(entry: PackageRecord) {
    if (visited.has(entry.id) || visiting.has(entry.id)) {
      return;
    }

    visiting.add(entry.id);
    for (const dependency of entry.workspaceDependencies) {
      const dependencyEntry = packageMap.get(dependency);
      if (dependencyEntry) {
        visit(dependencyEntry);
      }
    }
    visiting.delete(entry.id);
    visited.add(entry.id);
    ordered.push(entry);
  }

  for (const entry of packages) {
    visit(entry);
  }

  return ordered;
}

function runCommand(cwd: string, args: string[], extraEnv?: Record<string, string>): CommandResult {
  const [command, ...rest] = args;
  const result = spawnSync(command, rest, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv
    }
  });

  return {
    ok: result.status === 0,
    command: args.join(" "),
    code: result.status ?? 1,
    stdout: trimOutput(result.stdout),
    stderr: trimOutput(result.stderr)
  };
}

function trimOutput(output: string | null | undefined, maxChars = 4000): string {
  if (!output) {
    return "";
  }
  if (output.length <= maxChars) {
    return output;
  }
  return `${output.slice(0, maxChars)}\n...[truncated]...`;
}

function packPublishedPackage(packageRoot: string): string {
  const build = runCommand(packageRoot, ["bun", "run", "build"]);
  if (!build.ok) {
    throw new Error(`Unable to build package before packing: ${packageRoot}\n${build.stderr || build.stdout}`);
  }

  const packed = runCommand(packageRoot, ["npm", "pack", "--json"]);
  if (!packed.ok) {
    throw new Error(`Unable to pack package ${packageRoot}\n${packed.stderr || packed.stdout}`);
  }

  const metadata = JSON.parse(packed.stdout.trim()) as Array<{ filename: string }>;
  const filename = metadata[0]?.filename;
  if (!filename) {
    throw new Error(`npm pack did not return a filename for ${packageRoot}.`);
  }

  return join(packageRoot, filename);
}

function createFileLockEntry(
  id: string,
  kind: "library" | "plugin",
  artifactPath: string,
  privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"],
  publicKeyPem: string
) {
  const sha256 = createHash("sha256").update(readFileSync(artifactPath)).digest("hex");
  return {
    id,
    kind,
    repo: `gutula/${kind === "plugin" ? "gutu-plugin" : "gutu-lib"}-${id.split("/").at(-1)}`,
    version: "0.1.0",
    channel: "stable",
    artifact: {
      uri: pathToFileURL(artifactPath).toString(),
      format: "tgz",
      sha256,
      signature: sign(null, Buffer.from(sha256, "utf8"), privateKey).toString("base64"),
      publicKeyPem
    }
  };
}

function loadLiveChannelEntry(
  context: RuntimeContext,
  kind: "library" | "plugin",
  channel: string,
  packageId: string
) {
  const channelPath = join(
    context.sourceWorkspaceRoot,
    "catalogs",
    kind === "plugin" ? "gutu-plugins" : "gutu-libraries",
    "channels",
    `${channel}.json`
  );
  if (!existsSync(channelPath)) {
    throw new Error(`Missing ${kind} channel file at ${channelPath}.`);
  }

  const payload = JSON.parse(readFileSync(channelPath, "utf8")) as {
    packages?: Array<{
      id: string;
      kind: "library" | "plugin";
      repo: string;
      version: string;
      channel: string;
      artifact?: {
        uri: string;
        format: "tgz" | "directory";
        sha256: string;
        signature?: string;
        publicKeyPem?: string;
      };
    }>;
  };
  const match = payload.packages?.find((entry) => entry.id === packageId) as
    | {
        id: string;
        artifact?: {
          uri?: string;
        };
      }
    | undefined;
  if (!match?.artifact?.uri) {
    throw new Error(`Live channel '${channel}' does not contain a signed artifact for ${packageId}.`);
  }

  return match;
}

function writeAuditReport(context: RuntimeContext, report: AuditReport) {
  writeJson(join(context.reportsRoot, "ecosystem-audit.json"), report);
  writeFileSync(
    join(context.reportsRoot, "ecosystem-audit.md"),
    [
      "# Ecosystem Audit",
      "",
      `Generated: ${report.generatedAt}`,
      "",
      `- Source mode: ${report.mode}`,
      `- Source workspace: \`${report.workspaceRoot}\``,
      ...(report.topologyPath ? [`- Live topology: \`${report.topologyPath}\``] : []),
      `- Packages discovered: ${report.packages.length}`,
      `- Core runtime packages: ${report.corePackageIds.length}`,
      `- Compatibility shims: ${report.compatPackageIds.length}`,
      `- Unresolved workspace dependencies: ${report.unresolvedWorkspaceDependencies.length}`,
      `- Manifest drift findings: ${report.manifestDrift.length}`,
      `- Unresolved imports: ${report.unresolvedImports.length}`,
      "",
      "## Core Runtime Packages",
      "",
      ...report.corePackageIds.map((entry) => `- \`${entry}\``),
      "",
      "## Compatibility Shims",
      "",
      ...(report.compatPackageIds.length === 0 ? ["- none"] : report.compatPackageIds.map((entry) => `- \`${entry}\``)),
      "",
      "## Unresolved Workspace Dependencies",
      "",
      ...(report.unresolvedWorkspaceDependencies.length === 0
        ? ["- none"]
        : report.unresolvedWorkspaceDependencies.map(
            (entry) => `- \`${entry.packageId}\`: ${entry.missing.map((item) => `\`${item}\``).join(", ")}`
          )),
      "",
      "## Manifest Drift",
      "",
      ...(report.manifestDrift.length === 0
        ? ["- none"]
        : report.manifestDrift.map((entry) => `- \`${entry.packageId}\`: ${entry.missing.map((item) => `\`${item}\``).join(", ")}`)),
      "",
      "## Unresolved Imports",
      "",
      ...(report.unresolvedImports.length === 0 ? ["- none"] : report.unresolvedImports.map((entry) => `- \`${entry}\``))
    ].join("\n") + "\n",
    "utf8"
  );
}

function writeCertificationReport(context: RuntimeContext, report: CertificationReport) {
  writeJson(join(context.reportsRoot, "ecosystem-certify.json"), report);

  const totalCommands = report.packageResults.reduce((count, entry) => count + entry.commands.length, 0);
  const failedCommands = report.failures.length;
  writeFileSync(
    join(context.reportsRoot, "ecosystem-certify.md"),
    [
      "# Ecosystem Certification",
      "",
      `Generated: ${report.generatedAt}`,
      "",
      `- Source mode: ${report.mode}`,
      `- Certification workspace: \`${report.certificationWorkspace}\``,
      `- Workspace install: ${report.install.ok ? "pass" : "fail"}`,
      `- Packages checked: ${report.packageResults.length}`,
      `- Commands executed: ${totalCommands}`,
      `- Failed commands: ${failedCommands}`,
      "",
      "## Failures",
      "",
      ...(report.failures.length === 0
        ? ["- none"]
        : report.failures.map((entry) => `- \`${entry.packageId}\` failed \`${entry.command}\` with exit code ${entry.code}`)),
      "",
      "## Package Results",
      "",
      ...report.packageResults.flatMap((entry) => [
        `### ${entry.id}`,
        ...entry.commands.map((command) => `- ${command.ok ? "pass" : "fail"} \`${command.command}\` (${command.code})`),
        ""
      ])
    ].join("\n") + "\n",
    "utf8"
  );
}

function writeConsumerSmokeReport(context: RuntimeContext, report: ConsumerSmokeReport) {
  writeJson(join(context.reportsRoot, "consumer-smoke.json"), report);
  writeFileSync(
    join(context.reportsRoot, "consumer-smoke.md"),
    [
      "# Consumer Smoke",
      "",
      `Generated: ${report.generatedAt}`,
      "",
      `- Source mode: ${report.mode}`,
      `- Example root: \`${report.exampleRoot}\``,
      `- Certification workspace install: ${report.certificationInstall.ok ? "pass" : "fail"}`,
      `- Init: ${report.init.ok ? "pass" : "fail"}`,
      `- Vendor sync: ${report.vendorSync.ok ? "pass" : "fail"}`,
      "",
      "## Verified Paths",
      "",
      ...report.verifiedPaths.map((entry) => `- \`${entry}\``),
      "",
      "## Packaged Artifacts",
      "",
      ...report.packagedArtifacts.map((entry) => `- \`${entry}\``)
    ].join("\n") + "\n",
    "utf8"
  );
}

function assertAuditHealthy(report: AuditReport) {
  if (report.unresolvedWorkspaceDependencies.length > 0 || report.manifestDrift.length > 0 || report.unresolvedImports.length > 0) {
    throw new Error("Ecosystem audit found dependency or import drift. See reports/ecosystem-audit.md.");
  }
}

function assertCertificationHealthy(report: CertificationReport) {
  if (!report.install.ok || report.failures.length > 0) {
    throw new Error("Ecosystem certification failed. See reports/ecosystem-certify.md.");
  }
}

function assertConsumerSmokeHealthy(report: ConsumerSmokeReport) {
  if (!report.certificationInstall.ok || !report.init.ok || !report.vendorSync.ok || report.verifiedPaths.length !== 2) {
    throw new Error("Consumer smoke verification failed. See reports/consumer-smoke.md.");
  }
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
