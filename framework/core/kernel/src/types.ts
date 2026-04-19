export const packageKindValues = [
  "library",
  "app",
  "feature-pack",
  "connector",
  "migration-pack",
  "bundle",
  "vertical-pack",
  "ui-surface",
  "policy-pack",
  "runtime-pack",
  "ai-pack"
] as const;

export const reviewTierValues = ["R0", "R1", "R2", "R3"] as const;
export const trustTierValues = [
  "declarative-only",
  "first-party",
  "partner-reviewed",
  "community-reviewed",
  "unknown"
] as const;
export const isolationProfileValues = [
  "declarative-only",
  "same-process-trusted",
  "sidecar",
  "containerized",
  "remote-service"
] as const;
export const dbEngineValues = ["postgres", "sqlite", "mysql"] as const;
export const migrationPhaseValues = [
  "discover",
  "map",
  "dry-run",
  "import",
  "delta-sync",
  "cutover",
  "reconcile",
  "archive"
] as const;

export type PackageKind = (typeof packageKindValues)[number];
export type ReviewTier = (typeof reviewTierValues)[number];
export type TrustTier = (typeof trustTierValues)[number];
export type IsolationProfile = (typeof isolationProfileValues)[number];
export type DbEngine = (typeof dbEngineValues)[number];
export type MigrationPhase = (typeof migrationPhaseValues)[number];

export type CapabilityRegistryEntry = {
  capability: string;
  providers: string[];
  requesters: string[];
};

export type ExtensionContribution = {
  extensionPoint: string;
  packageId: string;
  contributionId: string;
  metadata?: Record<string, unknown>;
};

export type DataOwnerEntry = {
  domain: string;
  owner: string;
};

export type SlotOwnerEntry = {
  slot: string;
  owner: string;
};

export type RouteOwnerEntry = {
  route: string;
  owner: string;
};
