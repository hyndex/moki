import type { PackageManifest } from "@platform/kernel";

import { PermissionDeniedError } from "./errors";

export type CapabilityCategory =
  | "ui"
  | "routing"
  | "data-read"
  | "data-write"
  | "data-export-delete"
  | "files"
  | "secrets"
  | "network"
  | "webhooks"
  | "automation"
  | "identity"
  | "billing"
  | "ai"
  | "system"
  | "other";

export type PermissionDiff = {
  added: string[];
  removed: string[];
  unchanged: string[];
  addedDangerous: string[];
  removedDangerous: string[];
};

export type CapabilityGrantState = "active" | "reapproval-required" | "revoked";

export type CapabilityGrantRecord = {
  capability: string;
  required: boolean;
  grantedAt: string;
  lastRequestedAt?: string | undefined;
  lastUsedAt?: string | undefined;
  state: CapabilityGrantState;
};

export type DormantCapabilityResetPolicy = {
  now?: string | Date | undefined;
  staleAfterDays: number;
  revokeAfterDays?: number | undefined;
  dangerousOnly?: boolean | undefined;
};

export type DormantCapabilityResetResult = {
  active: string[];
  requireReapproval: string[];
  revoke: string[];
  preservedRequired: string[];
  updated: CapabilityGrantRecord[];
};

const dangerousPrefixes = [
  "network.egress",
  "secrets.read",
  "data.export",
  "data.delete",
  "billing.payout",
  "identity.impersonate",
  "ai.model.invoke",
  "ai.tool.execute",
  "ai.memory.export",
  "system.child_process",
  "backup.restore",
  "migration.cutover"
];

const restrictedModeAllowlist = [
  "ui.register.admin",
  "ui.register.portal",
  "ui.register.site"
];

export function classifyCapability(capability: string): CapabilityCategory {
  if (capability.startsWith("ui.")) return "ui";
  if (capability.startsWith("route.claim")) return "routing";
  if (capability.startsWith("data.read")) return "data-read";
  if (capability.startsWith("data.write")) return "data-write";
  if (capability.startsWith("data.export") || capability.startsWith("data.delete")) return "data-export-delete";
  if (capability.startsWith("files.")) return "files";
  if (capability.startsWith("secrets.")) return "secrets";
  if (capability.startsWith("network.")) return "network";
  if (capability.startsWith("webhooks.")) return "webhooks";
  if (capability.startsWith("jobs.") || capability.startsWith("workflow.")) return "automation";
  if (capability.startsWith("identity.")) return "identity";
  if (capability.startsWith("billing.")) return "billing";
  if (capability.startsWith("ai.")) return "ai";
  if (capability.startsWith("system.")) return "system";
  return "other";
}

export function isDangerousCapability(capability: string): boolean {
  return dangerousPrefixes.some((prefix) => capability.startsWith(prefix));
}

export function diffRequestedCapabilities(previousCapabilities: string[], nextCapabilities: string[]): PermissionDiff {
  const previous = new Set(previousCapabilities);
  const next = new Set(nextCapabilities);

  const added = [...next].filter((capability) => !previous.has(capability)).sort();
  const removed = [...previous].filter((capability) => !next.has(capability)).sort();
  const unchanged = [...next].filter((capability) => previous.has(capability)).sort();

  return {
    added,
    removed,
    unchanged,
    addedDangerous: added.filter(isDangerousCapability),
    removedDangerous: removed.filter(isDangerousCapability)
  };
}

export function createCapabilityGrantRecord(
  input: Omit<CapabilityGrantRecord, "state"> & { state?: CapabilityGrantState | undefined }
): CapabilityGrantRecord {
  return {
    ...input,
    grantedAt: normalizeTimestamp(input.grantedAt),
    ...(input.lastRequestedAt ? { lastRequestedAt: normalizeTimestamp(input.lastRequestedAt) } : {}),
    ...(input.lastUsedAt ? { lastUsedAt: normalizeTimestamp(input.lastUsedAt) } : {}),
    state: input.state ?? "active"
  };
}

export function markCapabilityUsed(
  grant: CapabilityGrantRecord,
  usedAt: string | Date = new Date()
): CapabilityGrantRecord {
  return {
    ...grant,
    lastUsedAt: normalizeTimestamp(usedAt),
    state: "active"
  };
}

export function evaluateDormantCapabilityReset(
  grants: CapabilityGrantRecord[],
  policy: DormantCapabilityResetPolicy
): DormantCapabilityResetResult {
  const now = normalizeTimestamp(policy.now ?? new Date());
  const active: string[] = [];
  const requireReapproval: string[] = [];
  const revoke: string[] = [];
  const preservedRequired: string[] = [];

  const updated = grants.map((grant) => {
    if (grant.required) {
      preservedRequired.push(grant.capability);
      active.push(grant.capability);
      return {
        ...grant,
        state: "active" as const
      };
    }

    if (grant.state === "revoked") {
      revoke.push(grant.capability);
      return grant;
    }

    if ((policy.dangerousOnly ?? true) && !isDangerousCapability(grant.capability)) {
      active.push(grant.capability);
      return {
        ...grant,
        state: "active" as const
      };
    }

    const referenceTimestamp = grant.lastUsedAt ?? grant.lastRequestedAt ?? grant.grantedAt;
    const inactiveDays = diffDays(referenceTimestamp, now);

    if (policy.revokeAfterDays !== undefined && inactiveDays >= policy.revokeAfterDays) {
      revoke.push(grant.capability);
      return {
        ...grant,
        state: "revoked" as const
      };
    }

    if (inactiveDays >= policy.staleAfterDays) {
      requireReapproval.push(grant.capability);
      return {
        ...grant,
        state: "reapproval-required" as const
      };
    }

    active.push(grant.capability);
    return {
      ...grant,
      state: "active" as const
    };
  });

  return {
    active: active.sort((left, right) => left.localeCompare(right)),
    requireReapproval: requireReapproval.sort((left, right) => left.localeCompare(right)),
    revoke: revoke.sort((left, right) => left.localeCompare(right)),
    preservedRequired: preservedRequired.sort((left, right) => left.localeCompare(right)),
    updated
  };
}

export function assertCapabilityAllowed(requestedCapability: string, grantedCapabilities: string[]): void {
  if (!grantedCapabilities.includes(requestedCapability)) {
    throw new PermissionDeniedError(`Missing required capability: ${requestedCapability}`);
  }
}

export function enforceUnknownPluginRestrictions(manifest: PackageManifest): string[] {
  if (manifest.trustTier !== "unknown") {
    return [];
  }

  const violations: string[] = [];
  if (manifest.isolationProfile !== "declarative-only") {
    violations.push("unknown plugins must run in declarative-only isolation");
  }
  if (manifest.requestedHosts.length > 0) {
    violations.push("unknown plugins may not request egress hosts");
  }
  if (manifest.requestedCapabilities.some(isDangerousCapability)) {
    violations.push("unknown plugins may not request dangerous capabilities");
  }
  return violations;
}

export function applyRestrictedMode(manifest: PackageManifest): PackageManifest {
  if (manifest.trustTier !== "unknown") {
    return manifest;
  }

  return {
    ...manifest,
    isolationProfile: "declarative-only",
    requestedCapabilities: manifest.requestedCapabilities.filter((capability) => restrictedModeAllowlist.includes(capability)),
    requestedHosts: []
  };
}

function normalizeTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function diffDays(from: string, to: string): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((Date.parse(to) - Date.parse(from)) / millisecondsPerDay);
}
