import { z } from "zod";

import type { DbEngine, IsolationProfile, PackageKind, ReviewTier, TrustTier } from "./types";
import { ValidationError, type ValidationIssue } from "./errors";
import {
  dbEngineValues,
  isolationProfileValues,
  migrationPhaseValues,
  packageKindValues,
  reviewTierValues,
  trustTierValues
} from "./types";

const dbEngineSchema = z.enum(dbEngineValues);
const packageKindSchema = z.enum(packageKindValues);
const reviewTierSchema = z.enum(reviewTierValues);
const trustTierSchema = z.enum(trustTierValues);
const isolationProfileSchema = z.enum(isolationProfileValues);
const migrationPhaseSchema = z.enum(migrationPhaseValues);

const stringArray = z.array(z.string().min(1)).default([]);

const compatibilitySchema = z.object({
  framework: z.string().min(1),
  runtime: z.string().min(1),
  db: z.array(dbEngineSchema).min(1)
});

const webhookSchema = z.object({
  event: z.string().min(1),
  route: z.string().min(1)
});

const connectorConfigSchema = z.object({
  provider: z.string().min(1),
  secrets: stringArray,
  webhooks: z.array(webhookSchema).default([])
});

const uiSchema = z
  .object({
    embeddedPages: z
      .array(
        z.object({
          shell: z.enum(["admin", "portal", "site"]),
          route: z.string().min(1),
          permission: z.string().min(1).optional()
        })
      )
      .default([]),
    zones: z
      .array(
        z.object({
          id: z.string().min(1),
          mountPath: z.string().min(1),
          routeOwnership: stringArray
        })
      )
      .default([])
  })
  .partial()
  .optional();

const signingSchema = z
  .object({
    strategy: z.string().min(1),
    integrity: z.string().min(1),
    provenance: z.string().optional()
  })
  .optional();

const baseManifestSchema = z.object({
  id: z.string().min(1),
  kind: packageKindSchema,
  version: z.string().min(1),
  displayName: z.string().min(1),
  publisher: z.string().min(1).default("local.workspace"),
  description: z.string().min(1),
  compatibility: compatibilitySchema,
  extends: stringArray,
  dependsOn: stringArray,
  optionalWith: stringArray,
  conflictsWith: stringArray,
  providesCapabilities: stringArray,
  requestedCapabilities: stringArray,
  requestedHosts: stringArray,
  ownsData: stringArray,
  extendsData: stringArray,
  slotClaims: stringArray,
  reviewTier: reviewTierSchema,
  trustTier: trustTierSchema,
  isolationProfile: isolationProfileSchema,
  featureFlags: z.record(z.string(), z.unknown()).default({}),
  includes: stringArray,
  optionalIncludes: stringArray,
  connector: connectorConfigSchema.optional(),
  sourceSystem: z.string().min(1).optional(),
  targetDomains: stringArray,
  phases: z.array(migrationPhaseSchema).default([]),
  ui: uiSchema,
  signing: signingSchema
});

export const packageManifestSchema = baseManifestSchema.superRefine((manifest, ctx) => {
  if (manifest.kind === "connector" && !manifest.connector) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "connectors must declare connector metadata",
      path: ["connector"]
    });
  }

  if (manifest.kind === "migration-pack") {
    if (!manifest.sourceSystem) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "migration packs must declare sourceSystem",
        path: ["sourceSystem"]
      });
    }
    if (manifest.targetDomains.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "migration packs must declare targetDomains",
        path: ["targetDomains"]
      });
    }
    if (manifest.phases.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "migration packs must declare phases",
        path: ["phases"]
      });
    }
  }

  if (manifest.kind === "bundle" && manifest.includes.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "bundles must include at least one package",
      path: ["includes"]
    });
  }

  if (manifest.kind === "library" && manifest.requestedCapabilities.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "libraries may not request install-time capabilities",
      path: ["requestedCapabilities"]
    });
  }
});

export type PackageManifest = z.infer<typeof packageManifestSchema>;
export type CompatibilityManifest = PackageManifest["compatibility"];
export type ConnectorManifest = PackageManifest & { kind: "connector"; connector: NonNullable<PackageManifest["connector"]> };
export type MigrationPackManifest = PackageManifest & {
  kind: "migration-pack";
  sourceSystem: string;
  targetDomains: string[];
  phases: PackageManifest["phases"];
};
export type BundleManifest = PackageManifest & { kind: "bundle"; includes: string[] };

export type DefinePackageInput = Partial<PackageManifest> &
  Pick<PackageManifest, "id" | "kind" | "version" | "displayName" | "description" | "compatibility">;

export function inferDefaultReviewTier(kind: PackageKind): ReviewTier {
  return kind === "connector" || kind === "migration-pack" ? "R2" : "R1";
}

export function inferDefaultTrustTier(kind: PackageKind): TrustTier {
  return kind === "bundle" ? "declarative-only" : "first-party";
}

export function inferDefaultIsolationProfile(kind: PackageKind): IsolationProfile {
  if (kind === "bundle") {
    return "declarative-only";
  }
  if (kind === "connector" || kind === "migration-pack") {
    return "sidecar";
  }
  return "same-process-trusted";
}

export function withManifestDefaults(input: DefinePackageInput): PackageManifest {
  return {
    publisher: "local.workspace",
    extends: [],
    dependsOn: [],
    optionalWith: [],
    conflictsWith: [],
    providesCapabilities: [],
    requestedCapabilities: [],
    requestedHosts: [],
    ownsData: [],
    extendsData: [],
    slotClaims: [],
    reviewTier: inferDefaultReviewTier(input.kind),
    trustTier: inferDefaultTrustTier(input.kind),
    isolationProfile: inferDefaultIsolationProfile(input.kind),
    featureFlags: {},
    includes: [],
    optionalIncludes: [],
    targetDomains: [],
    phases: [],
    ...input
  };
}

function toValidationIssues(error: z.ZodError, packageId?: string): ValidationIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.join("."),
    packageId
  }));
}

export function validatePackageManifest(input: unknown): {
  success: true;
  data: PackageManifest;
} | {
  success: false;
  issues: ValidationIssue[];
} {
  const result = packageManifestSchema.safeParse(input);
  if (!result.success) {
    const packageId =
      typeof input === "object" &&
      input !== null &&
      "id" in input &&
      typeof (input as { id?: unknown }).id === "string"
        ? (input as { id: string }).id
        : undefined;
    return {
      success: false,
      issues: toValidationIssues(result.error, packageId)
    };
  }

  return {
    success: true,
    data: normalizeManifest(result.data)
  };
}

export function definePackage(input: DefinePackageInput): PackageManifest {
  const result = validatePackageManifest(withManifestDefaults(input));
  if (!result.success) {
    throw new ValidationError(`Invalid package manifest for ${input.id}`, result.issues);
  }

  return Object.freeze(result.data);
}

export function definePlugin(input: DefinePackageInput): PackageManifest {
  if (input.kind === "library") {
    throw new ValidationError("Plugins cannot use kind 'library'", [
      {
        code: "plugin-kind",
        message: "installable plugins cannot be libraries",
        path: "kind",
        packageId: input.id
      }
    ]);
  }
  return definePackage(input);
}

export function defineConnector(
  input: Omit<DefinePackageInput, "kind" | "description"> &
    { kind?: "connector"; description?: string; connector: NonNullable<PackageManifest["connector"]> }
): ConnectorManifest {
  return definePlugin({
    description: input.description ?? `${input.displayName} connector`,
    ...input,
    kind: "connector",
    isolationProfile: input.isolationProfile ?? "sidecar",
    reviewTier: input.reviewTier ?? "R2"
  }) as ConnectorManifest;
}

export function defineMigrationPack(
  input: Omit<DefinePackageInput, "kind" | "description"> &
    { kind?: "migration-pack"; description?: string } &
    Pick<MigrationPackManifest, "sourceSystem" | "targetDomains" | "phases">
): MigrationPackManifest {
  return definePlugin({
    description: input.description ?? `${input.displayName} migration pack`,
    ...input,
    kind: "migration-pack",
    isolationProfile: input.isolationProfile ?? "sidecar",
    reviewTier: input.reviewTier ?? "R2"
  }) as MigrationPackManifest;
}

export function defineBundle(
  input: Omit<DefinePackageInput, "kind" | "description" | "requestedCapabilities" | "providesCapabilities" | "reviewTier" | "trustTier" | "isolationProfile"> &
    { kind?: "bundle"; description?: string } &
    Pick<BundleManifest, "includes" | "optionalIncludes">
): BundleManifest {
  return definePlugin({
    description: input.description ?? `${input.displayName} bundle`,
    ...input,
    kind: "bundle",
    requestedCapabilities: [],
    providesCapabilities: [],
    reviewTier: "R1",
    trustTier: "declarative-only",
    isolationProfile: "declarative-only"
  }) as BundleManifest;
}

function normalizeManifest(manifest: PackageManifest): PackageManifest {
  return {
    ...manifest,
    extends: sortUnique(manifest.extends),
    dependsOn: sortUnique(manifest.dependsOn),
    optionalWith: sortUnique(manifest.optionalWith),
    conflictsWith: sortUnique(manifest.conflictsWith),
    providesCapabilities: sortUnique(manifest.providesCapabilities),
    requestedCapabilities: sortUnique(manifest.requestedCapabilities),
    requestedHosts: sortUnique(manifest.requestedHosts),
    ownsData: sortUnique(manifest.ownsData),
    extendsData: sortUnique(manifest.extendsData),
    slotClaims: sortUnique(manifest.slotClaims),
    includes: sortUnique(manifest.includes),
    optionalIncludes: sortUnique(manifest.optionalIncludes),
    targetDomains: sortUnique(manifest.targetDomains),
    phases: [...new Set(manifest.phases)]
  };
}

function sortUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function isSupportedDbEngine(engine: string): engine is DbEngine {
  return dbEngineValues.includes(engine as DbEngine);
}
