import type {
  CapabilityRegistryEntry,
  DataOwnerEntry,
  ExtensionContribution,
  RouteOwnerEntry,
  SlotOwnerEntry
} from "./types";
import type { PackageManifest } from "./manifest";

export function createCapabilityRegistry(manifests: PackageManifest[]): Map<string, CapabilityRegistryEntry> {
  const registry = new Map<string, CapabilityRegistryEntry>();

  for (const manifest of manifests) {
    for (const capability of manifest.providesCapabilities) {
      const current = registry.get(capability) ?? {
        capability,
        providers: [],
        requesters: []
      };
      current.providers = sortedPush(current.providers, manifest.id);
      registry.set(capability, current);
    }

    for (const capability of manifest.requestedCapabilities) {
      const current = registry.get(capability) ?? {
        capability,
        providers: [],
        requesters: []
      };
      current.requesters = sortedPush(current.requesters, manifest.id);
      registry.set(capability, current);
    }
  }

  return registry;
}

export function createExtensionRegistry(contributions: ExtensionContribution[]): Map<string, ExtensionContribution[]> {
  const registry = new Map<string, ExtensionContribution[]>();
  for (const contribution of contributions) {
    const current = registry.get(contribution.extensionPoint) ?? [];
    current.push(contribution);
    current.sort((left, right) => {
      const packageComparison = left.packageId.localeCompare(right.packageId);
      return packageComparison !== 0 ? packageComparison : left.contributionId.localeCompare(right.contributionId);
    });
    registry.set(contribution.extensionPoint, current);
  }
  return registry;
}

export function createDataOwnershipRegistry(manifests: PackageManifest[]): Map<string, DataOwnerEntry> {
  const registry = new Map<string, DataOwnerEntry>();
  for (const manifest of manifests) {
    for (const domain of manifest.ownsData) {
      registry.set(domain, { domain, owner: manifest.id });
    }
  }
  return registry;
}

export function createSlotOwnershipRegistry(manifests: PackageManifest[]): Map<string, SlotOwnerEntry> {
  const registry = new Map<string, SlotOwnerEntry>();
  for (const manifest of manifests) {
    for (const slot of manifest.slotClaims) {
      registry.set(slot, { slot, owner: manifest.id });
    }
  }
  return registry;
}

export function createRouteOwnershipRegistry(manifests: PackageManifest[]): Map<string, RouteOwnerEntry> {
  const registry = new Map<string, RouteOwnerEntry>();
  for (const manifest of manifests) {
    for (const route of extractRoutes(manifest)) {
      registry.set(route, { route, owner: manifest.id });
    }
  }
  return registry;
}

function extractRoutes(manifest: PackageManifest): string[] {
  const embeddedPages = manifest.ui?.embeddedPages?.map((entry) => entry.route) ?? [];
  const zones = manifest.ui?.zones?.flatMap((zone) => zone.routeOwnership) ?? [];
  return [...new Set([...embeddedPages, ...zones])].sort((left, right) => left.localeCompare(right));
}

function sortedPush(values: string[], next: string): string[] {
  const merged = [...values, next];
  return [...new Set(merged)].sort((left, right) => left.localeCompare(right));
}
