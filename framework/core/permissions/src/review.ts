import type { PackageManifest } from "@platform/kernel";

import {
  applyRestrictedMode,
  diffRequestedCapabilities,
  markCapabilityUsed,
  type CapabilityGrantRecord,
  type PermissionDiff
} from "./capabilities";

export type ReviewFindingSeverity = "info" | "warning" | "blocking";

export type ReviewFinding = {
  code: string;
  severity: ReviewFindingSeverity;
  message: string;
  path?: string | undefined;
};

export type InstallReviewMode = "auto-approved" | "manual-review" | "restricted-preview" | "rejected";

export type InstallReviewPlan = {
  manifestId: string;
  requestedManifest: PackageManifest;
  effectiveManifest: PackageManifest;
  mode: InstallReviewMode;
  findings: ReadonlyArray<ReviewFinding>;
  requiredApprovals: ReadonlyArray<string>;
  strippedCapabilities: ReadonlyArray<string>;
  strippedHosts: ReadonlyArray<string>;
  isAutoApproved: boolean;
  requiresManualReview: boolean;
  isRestrictedPreview: boolean;
  blocked: boolean;
};

export type StringDiff = {
  added: string[];
  removed: string[];
  unchanged: string[];
};

export type ManifestGovernanceDiff = {
  trustTierChanged: boolean;
  reviewTierChanged: boolean;
  isolationProfileChanged: boolean;
  capabilityDiff: PermissionDiff;
  hostDiff: StringDiff;
  routeDiff: StringDiff;
  slotDiff: StringDiff;
  ownershipDiff: StringDiff;
  migrationChanged: boolean;
};

export type UpdateReviewPlan = {
  manifestId: string;
  diff: ManifestGovernanceDiff;
  findings: ReadonlyArray<ReviewFinding>;
  requiredApprovals: ReadonlyArray<string>;
  requiresReapproval: boolean;
  blocked: boolean;
};

export type CapabilityGrantMutation = {
  upsert?: CapabilityGrantRecord[] | undefined;
  revoke?: string[] | undefined;
  markUsed?: Array<{ capability: string; usedAt?: string | Date | undefined }> | undefined;
};

export type CapabilityGrantStoreSnapshot = {
  version: number;
  grants: ReadonlyArray<CapabilityGrantRecord>;
};

export class CapabilityGrantConflictError extends Error {
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(expectedVersion: number, actualVersion: number) {
    super(`Capability grant update conflict: expected version ${expectedVersion}, found ${actualVersion}`);
    this.name = "CapabilityGrantConflictError";
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export function createInstallReviewPlan(
  manifest: PackageManifest,
  options: {
    allowRestrictedPreview?: boolean | undefined;
  } = {}
): InstallReviewPlan {
  const findings: ReviewFinding[] = [];
  const requestedManifest = manifest;
  let effectiveManifest = manifest;
  let strippedCapabilities: string[] = [];
  let strippedHosts: string[] = [];

  if (manifest.trustTier === "unknown") {
    findings.push({
      code: "install.review.unknown-plugin",
      severity: "warning",
      path: "trustTier",
      message: `Package '${manifest.id}' is unknown and enters quarantine until reviewed.`
    });

    if (options.allowRestrictedPreview) {
      effectiveManifest = applyRestrictedMode(manifest);
      const capabilityDiff = diffRequestedCapabilities(
        manifest.requestedCapabilities,
        effectiveManifest.requestedCapabilities
      );
      strippedCapabilities = capabilityDiff.removed;
      strippedHosts = diffStrings(manifest.requestedHosts, effectiveManifest.requestedHosts).removed;

      findings.push({
        code: "install.review.restricted-preview",
        severity: "warning",
        path: "isolationProfile",
        message: `Package '${manifest.id}' is activated only in restricted declarative-only preview mode.`
      });

      if (strippedCapabilities.length > 0) {
        findings.push({
          code: "install.review.restricted-capabilities-stripped",
          severity: "info",
          path: "requestedCapabilities",
          message: `Restricted preview removed capabilities: ${strippedCapabilities.join(", ")}`
        });
      }

      if (strippedHosts.length > 0) {
        findings.push({
          code: "install.review.restricted-hosts-stripped",
          severity: "info",
          path: "requestedHosts",
          message: `Restricted preview removed egress hosts: ${strippedHosts.join(", ")}`
        });
      }
    } else {
      findings.push({
        code: "install.review.restricted-preview-required",
        severity: "blocking",
        path: "trustTier",
        message: `Package '${manifest.id}' cannot activate until restricted preview is explicitly allowed.`
      });
    }
  }

  findings.push(...collectInstallReviewFindings(effectiveManifest));

  const blocked = findings.some((finding) => finding.severity === "blocking");
  const isRestrictedPreview = manifest.trustTier === "unknown" && !blocked;
  const isAutoApproved = !blocked && !isRestrictedPreview && isAutoApprovalCandidate(effectiveManifest);
  const requiresManualReview = !blocked && !isAutoApproved;

  const requiredApprovals = collectRequiredApprovals(findings, {
    requireTrustUpgrade: isRestrictedPreview
  });

  return {
    manifestId: manifest.id,
    requestedManifest,
    effectiveManifest,
    mode: blocked ? "rejected" : isRestrictedPreview ? "restricted-preview" : isAutoApproved ? "auto-approved" : "manual-review",
    findings: freezeFindings(findings),
    requiredApprovals: Object.freeze(requiredApprovals),
    strippedCapabilities: Object.freeze(strippedCapabilities),
    strippedHosts: Object.freeze(strippedHosts),
    isAutoApproved,
    requiresManualReview,
    isRestrictedPreview,
    blocked
  };
}

export function createManifestGovernanceDiff(
  previousManifest: PackageManifest,
  nextManifest: PackageManifest
): ManifestGovernanceDiff {
  return {
    trustTierChanged: previousManifest.trustTier !== nextManifest.trustTier,
    reviewTierChanged: previousManifest.reviewTier !== nextManifest.reviewTier,
    isolationProfileChanged: previousManifest.isolationProfile !== nextManifest.isolationProfile,
    capabilityDiff: diffRequestedCapabilities(
      previousManifest.requestedCapabilities,
      nextManifest.requestedCapabilities
    ),
    hostDiff: diffStrings(previousManifest.requestedHosts, nextManifest.requestedHosts),
    routeDiff: diffStrings(extractRoutes(previousManifest), extractRoutes(nextManifest)),
    slotDiff: diffStrings(previousManifest.slotClaims, nextManifest.slotClaims),
    ownershipDiff: diffStrings(
      [...previousManifest.ownsData, ...previousManifest.extendsData],
      [...nextManifest.ownsData, ...nextManifest.extendsData]
    ),
    migrationChanged: hasMigrationChange(previousManifest, nextManifest)
  };
}

export function createUpdateReviewPlan(
  previousManifest: PackageManifest,
  nextManifest: PackageManifest
): UpdateReviewPlan {
  const diff = createManifestGovernanceDiff(previousManifest, nextManifest);
  const findings: ReviewFinding[] = [];

  if (diff.trustTierChanged) {
    findings.push({
      code: "update.review.trust-tier",
      severity: "warning",
      path: "trustTier",
      message: `Update changes trust tier from '${previousManifest.trustTier}' to '${nextManifest.trustTier}'.`
    });
  }

  if (diff.reviewTierChanged) {
    findings.push({
      code: "update.review.review-tier",
      severity: "warning",
      path: "reviewTier",
      message: `Update changes review tier from '${previousManifest.reviewTier}' to '${nextManifest.reviewTier}'.`
    });
  }

  if (diff.isolationProfileChanged) {
    findings.push({
      code: "update.review.isolation-profile",
      severity: "warning",
      path: "isolationProfile",
      message: `Update changes isolation profile from '${previousManifest.isolationProfile}' to '${nextManifest.isolationProfile}'.`
    });
  }

  if (diff.capabilityDiff.added.length > 0 || diff.capabilityDiff.removed.length > 0) {
    findings.push({
      code: "update.review.capabilities",
      severity: diff.capabilityDiff.addedDangerous.length > 0 ? "warning" : "info",
      path: "requestedCapabilities",
      message: formatDiffMessage("capabilities", diff.capabilityDiff.added, diff.capabilityDiff.removed)
    });
  }

  if (diff.hostDiff.added.length > 0 || diff.hostDiff.removed.length > 0) {
    findings.push({
      code: "update.review.egress-hosts",
      severity: "warning",
      path: "requestedHosts",
      message: formatDiffMessage("egress hosts", diff.hostDiff.added, diff.hostDiff.removed)
    });
  }

  if (diff.routeDiff.added.length > 0 || diff.routeDiff.removed.length > 0) {
    findings.push({
      code: "update.review.routes",
      severity: "warning",
      path: "ui",
      message: formatDiffMessage("route claims", diff.routeDiff.added, diff.routeDiff.removed)
    });
  }

  if (diff.slotDiff.added.length > 0 || diff.slotDiff.removed.length > 0) {
    findings.push({
      code: "update.review.slots",
      severity: "warning",
      path: "slotClaims",
      message: formatDiffMessage("slot claims", diff.slotDiff.added, diff.slotDiff.removed)
    });
  }

  if (diff.ownershipDiff.added.length > 0 || diff.ownershipDiff.removed.length > 0) {
    findings.push({
      code: "update.review.ownership",
      severity: "warning",
      path: "ownsData",
      message: formatDiffMessage("ownership declarations", diff.ownershipDiff.added, diff.ownershipDiff.removed)
    });
  }

  if (diff.migrationChanged) {
    findings.push({
      code: "update.review.migrations",
      severity: "warning",
      path: "phases",
      message: "Update changes migration source, targets, or phases and requires re-review."
    });
  }

  const requiresReapproval =
    diff.trustTierChanged ||
    diff.reviewTierChanged ||
    diff.isolationProfileChanged ||
    diff.capabilityDiff.added.length > 0 ||
    diff.capabilityDiff.removed.length > 0 ||
    diff.hostDiff.added.length > 0 ||
    diff.routeDiff.added.length > 0 ||
    diff.routeDiff.removed.length > 0 ||
    diff.slotDiff.added.length > 0 ||
    diff.slotDiff.removed.length > 0 ||
    diff.ownershipDiff.added.length > 0 ||
    diff.ownershipDiff.removed.length > 0 ||
    diff.migrationChanged;

  return {
    manifestId: nextManifest.id,
    diff,
    findings: freezeFindings(findings),
    requiredApprovals: Object.freeze(collectRequiredApprovals(findings, { requireTrustUpgrade: diff.trustTierChanged })),
    requiresReapproval,
    blocked: false
  };
}

export function createCapabilityGrantStore(
  initialGrants: CapabilityGrantRecord[] = []
): {
  read(): CapabilityGrantStoreSnapshot;
  commit(expectedVersion: number, mutation: CapabilityGrantMutation): CapabilityGrantStoreSnapshot;
} {
  let version = 0;
  let grants = new Map(initialGrants.map((grant) => [grant.capability, grant]));

  return {
    read() {
      return createGrantStoreSnapshot(version, grants);
    },
    commit(expectedVersion, mutation) {
      if (expectedVersion !== version) {
        throw new CapabilityGrantConflictError(expectedVersion, version);
      }

      const nextGrants = new Map(grants);
      for (const grant of mutation.upsert ?? []) {
        nextGrants.set(grant.capability, grant);
      }
      for (const capability of mutation.revoke ?? []) {
        nextGrants.delete(capability);
      }
      for (const usage of mutation.markUsed ?? []) {
        const existing = nextGrants.get(usage.capability);
        if (existing) {
          nextGrants.set(usage.capability, markCapabilityUsed(existing, usage.usedAt ?? new Date()));
        }
      }

      grants = nextGrants;
      version += 1;
      return createGrantStoreSnapshot(version, grants);
    }
  };
}

function createGrantStoreSnapshot(
  version: number,
  grants: Map<string, CapabilityGrantRecord>
): CapabilityGrantStoreSnapshot {
  return Object.freeze({
    version,
    grants: Object.freeze(
      [...grants.values()].sort((left, right) => left.capability.localeCompare(right.capability))
    )
  });
}

function collectInstallReviewFindings(manifest: PackageManifest): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  if (manifest.requestedHosts.length > 0) {
    findings.push({
      code: "install.review.network-egress",
      severity: "warning",
      path: "requestedHosts",
      message: `Package '${manifest.id}' requests network egress to ${manifest.requestedHosts.join(", ")}.`
    });
  }

  if (hasSecrets(manifest)) {
    findings.push({
      code: "install.review.secrets",
      severity: "warning",
      path: "connector.secrets",
      message: `Package '${manifest.id}' requires secret access.`
    });
  }

  if (hasPrivilegedDataAccess(manifest)) {
    findings.push({
      code: "install.review.privileged-data",
      severity: "warning",
      path: "requestedCapabilities",
      message: `Package '${manifest.id}' requests privileged data access.`
    });
  }

  if ((manifest.ui?.zones?.length ?? 0) > 0) {
    findings.push({
      code: "install.review.ui-zones",
      severity: "warning",
      path: "ui.zones",
      message: `Package '${manifest.id}' mounts governed UI zones.`
    });
  }

  if (manifest.requestedCapabilities.some((capability) => capability.startsWith("jobs.") || capability.startsWith("workflow."))) {
    findings.push({
      code: "install.review.jobs",
      severity: "warning",
      path: "requestedCapabilities",
      message: `Package '${manifest.id}' requests background job or workflow execution.`
    });
  }

  if (manifest.requestedCapabilities.some((capability) => capability.startsWith("webhooks."))) {
    findings.push({
      code: "install.review.webhooks",
      severity: "warning",
      path: "requestedCapabilities",
      message: `Package '${manifest.id}' requests webhook reception.`
    });
  }

  if (manifest.kind === "migration-pack" || manifest.phases.length > 0) {
    findings.push({
      code: "install.review.migrations",
      severity: "warning",
      path: "phases",
      message: `Package '${manifest.id}' carries migration behavior.`
    });
  }

  if (manifest.requestedCapabilities.some((capability) => capability.startsWith("identity."))) {
    findings.push({
      code: "install.review.identity",
      severity: "warning",
      path: "requestedCapabilities",
      message: `Package '${manifest.id}' requests identity or impersonation capabilities.`
    });
  }

  if (manifest.requestedCapabilities.some((capability) => capability.startsWith("billing.payout"))) {
    findings.push({
      code: "install.review.payouts",
      severity: "warning",
      path: "requestedCapabilities",
      message: `Package '${manifest.id}' requests payout execution capability.`
    });
  }

  if (
    manifest.requestedCapabilities.some(
      (capability) => capability.startsWith("ai.model.invoke") || capability.startsWith("ai.tool.execute")
    )
  ) {
    findings.push({
      code: "install.review.ai-runtime",
      severity: "warning",
      path: "requestedCapabilities",
      message: `Package '${manifest.id}' can invoke models or execute AI-exposed tools and requires AI runtime review.`
    });
  }

  if (manifest.requestedCapabilities.some((capability) => capability.startsWith("ai.memory.export"))) {
    findings.push({
      code: "install.review.ai-memory-export",
      severity: "warning",
      path: "requestedCapabilities",
      message: `Package '${manifest.id}' can export grounded memory outside the platform boundary.`
    });
  }

  if (manifest.requestedCapabilities.some((capability) => capability.startsWith("backup.restore"))) {
    findings.push({
      code: "install.review.restore",
      severity: "warning",
      path: "requestedCapabilities",
      message: `Package '${manifest.id}' requests restore capability.`
    });
  }

  return findings;
}

function isAutoApprovalCandidate(manifest: PackageManifest): boolean {
  return (
    manifest.isolationProfile === "declarative-only" &&
    manifest.requestedHosts.length === 0 &&
    !hasSecrets(manifest) &&
    !hasPrivilegedDataAccess(manifest) &&
    extractRoutes(manifest).length === 0 &&
    manifest.slotClaims.length === 0
  );
}

function hasSecrets(manifest: PackageManifest): boolean {
  return (
    manifest.requestedCapabilities.some((capability) => capability.startsWith("secrets.")) ||
    (manifest.connector?.secrets.length ?? 0) > 0
  );
}

function hasPrivilegedDataAccess(manifest: PackageManifest): boolean {
  return manifest.requestedCapabilities.some(
    (capability) =>
      capability.startsWith("data.write") ||
      capability.startsWith("data.export") ||
      capability.startsWith("data.delete")
  );
}

function hasMigrationChange(previousManifest: PackageManifest, nextManifest: PackageManifest): boolean {
  return (
    previousManifest.kind !== nextManifest.kind ||
    previousManifest.sourceSystem !== nextManifest.sourceSystem ||
    !areSameStrings(previousManifest.targetDomains, nextManifest.targetDomains) ||
    !areSameStrings(previousManifest.phases, nextManifest.phases)
  );
}

function extractRoutes(manifest: PackageManifest): string[] {
  const embeddedRoutes = manifest.ui?.embeddedPages?.map((page) => page.route) ?? [];
  const zoneRoutes = manifest.ui?.zones?.flatMap((zone) => zone.routeOwnership) ?? [];
  return sortUnique([...embeddedRoutes, ...zoneRoutes]);
}

function diffStrings(previousValues: string[], nextValues: string[]): StringDiff {
  const previous = new Set(previousValues);
  const next = new Set(nextValues);

  return {
    added: [...next].filter((value) => !previous.has(value)).sort((left, right) => left.localeCompare(right)),
    removed: [...previous].filter((value) => !next.has(value)).sort((left, right) => left.localeCompare(right)),
    unchanged: [...next].filter((value) => previous.has(value)).sort((left, right) => left.localeCompare(right))
  };
}

function areSameStrings(previousValues: string[], nextValues: string[]): boolean {
  const previous = sortUnique(previousValues);
  const next = sortUnique(nextValues);
  return previous.length === next.length && previous.every((value, index) => value === next[index]);
}

function formatDiffMessage(label: string, added: string[], removed: string[]): string {
  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`added ${label}: ${added.join(", ")}`);
  }
  if (removed.length > 0) {
    parts.push(`removed ${label}: ${removed.join(", ")}`);
  }
  return parts.join("; ");
}

function collectRequiredApprovals(
  findings: ReviewFinding[],
  options: {
    requireTrustUpgrade: boolean;
  }
): string[] {
  const approvals = new Set<string>();

  for (const finding of findings) {
    if (finding.severity !== "warning" && finding.severity !== "blocking") {
      continue;
    }

    switch (finding.code) {
      case "install.review.network-egress":
      case "update.review.egress-hosts":
        approvals.add("approval:network-egress");
        break;
      case "install.review.secrets":
        approvals.add("approval:secret-access");
        break;
      case "install.review.privileged-data":
        approvals.add("approval:privileged-data");
        break;
      case "install.review.ui-zones":
        approvals.add("approval:ui-zones");
        break;
      case "install.review.jobs":
        approvals.add("approval:automation");
        break;
      case "install.review.webhooks":
        approvals.add("approval:webhooks");
        break;
      case "install.review.migrations":
      case "update.review.migrations":
        approvals.add("approval:migrations");
        break;
      case "install.review.identity":
        approvals.add("approval:identity");
        break;
      case "install.review.payouts":
        approvals.add("approval:payouts");
        break;
      case "install.review.ai-runtime":
        approvals.add("approval:ai-runtime");
        break;
      case "install.review.ai-memory-export":
        approvals.add("approval:ai-memory-export");
        break;
      case "install.review.restore":
        approvals.add("approval:restore");
        break;
      case "update.review.routes":
        approvals.add("approval:route-change");
        break;
      case "update.review.slots":
        approvals.add("approval:slot-change");
        break;
      case "update.review.ownership":
        approvals.add("approval:ownership-change");
        break;
      case "update.review.trust-tier":
        approvals.add("approval:trust-tier-change");
        break;
      case "update.review.review-tier":
        approvals.add("approval:review-tier-change");
        break;
      case "update.review.isolation-profile":
        approvals.add("approval:isolation-change");
        break;
      case "update.review.capabilities":
        approvals.add("approval:capability-change");
        break;
      default:
        break;
    }
  }

  if (options.requireTrustUpgrade) {
    approvals.add("approval:trust-upgrade");
  }

  return [...approvals].sort((left, right) => left.localeCompare(right));
}

function freezeFindings(findings: ReviewFinding[]): ReadonlyArray<ReviewFinding> {
  return Object.freeze(
    findings
      .slice()
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((finding) => Object.freeze({ ...finding }))
  );
}

function sortUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
