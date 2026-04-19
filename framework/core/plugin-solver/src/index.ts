import {
  PluginActivationError,
  type PackageManifest,
  createCapabilityRegistry,
  createDataOwnershipRegistry,
  createRouteOwnershipRegistry,
  createSlotOwnershipRegistry
} from "@platform/kernel";
import {
  createInstallReviewPlan,
  diffRequestedCapabilities,
  enforceUnknownPluginRestrictions
} from "@platform/permissions";

export const packageId = "plugin-solver" as const;
export const packageDisplayName = "Plugin Solver" as const;
export const packageDescription =
  "Dependency resolution, activation ordering, ownership conflict detection, and rollback planning for package graphs." as const;

export type SolverConflict = {
  code:
    | "missing-package"
    | "cyclic-dependency"
    | "compatibility"
    | "data-ownership"
    | "route-ownership"
    | "slot-ownership"
    | "unknown-plugin";
  message: string;
  packageId?: string;
  resourceId?: string;
};

export type SolveRequest = {
  requested: string[];
  manifests: PackageManifest[];
  platformVersion: string;
  runtimeVersion: string;
  dbEngine: "postgres" | "sqlite" | "mysql";
  allowPartialBundles?: boolean;
  allowRestrictedPreviewForUnknownPlugins?: boolean;
};

export type SolveResult = {
  resolvedPackages: PackageManifest[];
  orderedActivation: string[];
  permissionDiff: ReturnType<typeof diffRequestedCapabilities>;
  routeMap: Map<string, string>;
  slotMap: Map<string, string>;
  ownershipMap: Map<string, string>;
  migrationPlan: string[];
  rollbackCheckpoints: RollbackCheckpoint[];
  warnings: string[];
};

export type RollbackCheckpoint = {
  checkpointId: string;
  afterPackageId: string;
  rollbackOrder: string[];
  revertMigrations: string[];
  releaseRoutes: string[];
  releaseSlots: string[];
  releaseOwnership: string[];
};

export function solvePackageGraph(request: SolveRequest): SolveResult {
  const resolved = new Map<string, PackageManifest>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const orderedActivation: string[] = [];
  const warnings: string[] = [];
  const conflicts: SolverConflict[] = [];
  const preparedManifests = request.manifests.map((manifest) => {
    if (manifest.trustTier !== "unknown") {
      return manifest;
    }

    const reviewPlan = createInstallReviewPlan(manifest, {
      allowRestrictedPreview: request.allowRestrictedPreviewForUnknownPlugins ?? false
    });

    for (const finding of reviewPlan.findings) {
      if (finding.severity === "blocking") {
        conflicts.push({
          code: "unknown-plugin",
          message: finding.message,
          packageId: manifest.id
        });
        continue;
      }

      warnings.push(`Package '${manifest.id}': ${finding.message}`);
    }

    return reviewPlan.effectiveManifest;
  });
  const manifestsById = new Map(preparedManifests.map((manifest) => [manifest.id, manifest]));

  for (const packageId of request.requested) {
    visit(packageId, null);
  }

  if (conflicts.length > 0) {
    throw new PluginActivationError(
      "Package graph resolution failed",
      conflicts.map((conflict) => ({
        code: conflict.code,
        message: conflict.message,
        path: conflict.resourceId ?? conflict.packageId ?? "package"
      }))
    );
  }

  const resolvedPackages = [...resolved.values()].sort((left, right) => left.id.localeCompare(right.id));
  validateOwnershipConflicts(resolvedPackages, conflicts);

  for (const manifest of resolvedPackages) {
    const unknownViolations = enforceUnknownPluginRestrictions(manifest);
    for (const violation of unknownViolations) {
      conflicts.push({
        code: "unknown-plugin",
        message: violation,
        packageId: manifest.id
      });
    }
  }

  if (conflicts.length > 0) {
    throw new PluginActivationError(
      "Package graph validation failed",
      conflicts.map((conflict) => ({
        code: conflict.code,
        message: conflict.message,
        path: conflict.resourceId ?? conflict.packageId ?? "package"
      }))
    );
  }

  const capabilityRegistry = createCapabilityRegistry(resolvedPackages);
  const routeRegistry = createRouteOwnershipRegistry(resolvedPackages);
  const slotRegistry = createSlotOwnershipRegistry(resolvedPackages);
  const dataRegistry = createDataOwnershipRegistry(resolvedPackages);
  const permissionDiff = diffRequestedCapabilities(
    [],
    resolvedPackages.flatMap((manifest) => manifest.requestedCapabilities).sort((left, right) => left.localeCompare(right))
  );
  const dangerousCapabilityWarning =
    permissionDiff.addedDangerous.length > 0
      ? [
          `Admin acknowledgement required for dangerous capabilities: ${permissionDiff.addedDangerous.join(", ")}`
        ]
      : [];

  return {
    resolvedPackages,
    orderedActivation,
    permissionDiff,
    routeMap: new Map([...routeRegistry.entries()].map(([route, entry]) => [route, entry.owner])),
    slotMap: new Map([...slotRegistry.entries()].map(([slot, entry]) => [slot, entry.owner])),
    ownershipMap: new Map([...dataRegistry.entries()].map(([domain, entry]) => [domain, entry.owner])),
    migrationPlan: orderedActivation.filter((id) => manifestsById.get(id)?.kind === "migration-pack"),
    rollbackCheckpoints: buildRollbackCheckpoints(orderedActivation, manifestsById),
    warnings: [
      ...warnings,
      ...dangerousCapabilityWarning,
      ...[...capabilityRegistry.values()]
        .filter((entry) => entry.providers.length === 0)
        .map((entry) => `No provider found for requested capability ${entry.capability}`)
    ]
  };

  function visit(packageId: string, parentId: string | null): void {
    if (visited.has(packageId)) {
      return;
    }

    const manifest = manifestsById.get(packageId);
    if (!manifest) {
      conflicts.push({
        code: "missing-package",
        message: `Package '${packageId}' required by '${parentId ?? "root"}' is missing`,
        packageId
      });
      return;
    }

    if (!isManifestCompatible(manifest, request)) {
      conflicts.push({
        code: "compatibility",
        message: `Package '${manifest.id}' is incompatible with runtime ${request.runtimeVersion} and db ${request.dbEngine}`,
        packageId: manifest.id
      });
      return;
    }

    if (visiting.has(packageId)) {
      conflicts.push({
        code: "cyclic-dependency",
        message: `Cyclic dependency detected at '${packageId}'`,
        packageId
      });
      return;
    }

    visiting.add(packageId);

    const hardDependencies = manifest.kind === "bundle" ? [...manifest.includes, ...manifest.dependsOn] : manifest.dependsOn;
    for (const dependencyId of hardDependencies) {
      visit(dependencyId, manifest.id);
    }

    if (manifest.kind === "bundle") {
      for (const optionalId of manifest.optionalIncludes) {
        if (!manifestsById.has(optionalId)) {
          warnings.push(`Bundle '${manifest.id}' optional package '${optionalId}' is unavailable`);
          continue;
        }
        if (request.allowPartialBundles) {
          visit(optionalId, manifest.id);
        }
      }
    }

    visiting.delete(packageId);
    visited.add(packageId);
    resolved.set(packageId, manifest);
    orderedActivation.push(packageId);
  }
}

function validateOwnershipConflicts(manifests: PackageManifest[], conflicts: SolverConflict[]): void {
  const dataOwners = new Map<string, string>();
  const routeOwners = new Map<string, string>();
  const slotOwners = new Map<string, string>();

  for (const manifest of manifests) {
    for (const domain of manifest.ownsData) {
      const existingOwner = dataOwners.get(domain);
      if (existingOwner && existingOwner !== manifest.id) {
        conflicts.push({
          code: "data-ownership",
          message: `Data domain '${domain}' is owned by both '${existingOwner}' and '${manifest.id}'`,
          packageId: manifest.id,
          resourceId: domain
        });
      } else {
        dataOwners.set(domain, manifest.id);
      }
    }

    for (const route of extractRoutes(manifest)) {
      const existingOwner = routeOwners.get(route);
      if (existingOwner && existingOwner !== manifest.id) {
        conflicts.push({
          code: "route-ownership",
          message: `Route '${route}' is claimed by both '${existingOwner}' and '${manifest.id}'`,
          packageId: manifest.id,
          resourceId: route
        });
      } else {
        routeOwners.set(route, manifest.id);
      }
    }

    for (const slot of manifest.slotClaims) {
      const existingOwner = slotOwners.get(slot);
      if (existingOwner && existingOwner !== manifest.id) {
        conflicts.push({
          code: "slot-ownership",
          message: `Slot '${slot}' is claimed by both '${existingOwner}' and '${manifest.id}'`,
          packageId: manifest.id,
          resourceId: slot
        });
      } else {
        slotOwners.set(slot, manifest.id);
      }
    }
  }
}

function extractRoutes(manifest: PackageManifest): string[] {
  const embeddedRoutes = manifest.ui?.embeddedPages?.map((page) => page.route) ?? [];
  const zoneRoutes = manifest.ui?.zones?.flatMap((zone) => zone.routeOwnership) ?? [];
  return [...embeddedRoutes, ...zoneRoutes];
}

function isManifestCompatible(manifest: PackageManifest, request: SolveRequest): boolean {
  if (!manifest.compatibility.db.includes(request.dbEngine)) {
    return false;
  }

  if (!satisfiesRuntime(manifest.compatibility.runtime, request.runtimeVersion)) {
    return false;
  }

  return satisfiesFramework(manifest.compatibility.framework, request.platformVersion);
}

function buildRollbackCheckpoints(
  orderedActivation: string[],
  manifestsById: Map<string, PackageManifest>
): RollbackCheckpoint[] {
  return orderedActivation.map((packageId, index) => {
    const activatedPackageIds = orderedActivation.slice(0, index + 1);
    const activatedManifests = activatedPackageIds
      .map((activatedPackageId) => manifestsById.get(activatedPackageId))
      .filter((manifest): manifest is PackageManifest => manifest !== undefined);

    return {
      checkpointId: `rollback:${packageId}`,
      afterPackageId: packageId,
      rollbackOrder: [...activatedPackageIds].reverse(),
      revertMigrations: activatedManifests
        .filter((manifest) => manifest.kind === "migration-pack")
        .map((manifest) => manifest.id)
        .reverse(),
      releaseRoutes: sortUnique(activatedManifests.flatMap((manifest) => extractRoutes(manifest))),
      releaseSlots: sortUnique(activatedManifests.flatMap((manifest) => manifest.slotClaims)),
      releaseOwnership: sortUnique(activatedManifests.flatMap((manifest) => manifest.ownsData))
    };
  });
}

function satisfiesFramework(range: string, version: string): boolean {
  if (!range.startsWith("^")) {
    return range === version;
  }

  return range.slice(1).split(".")[0] === version.split(".")[0];
}

function satisfiesRuntime(range: string, runtimeVersion: string): boolean {
  const match = /^bun>=([0-9.]+)$/.exec(range);
  const minimumVersion = match?.[1];
  if (!minimumVersion) {
    return range === runtimeVersion;
  }

  return compareVersions(runtimeVersion, minimumVersion) >= 0;
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

function sortUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
