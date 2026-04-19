import { describe, expect, it } from "bun:test";

import {
  defineBundle,
  defineConnector,
  defineMigrationPack,
  definePackage,
  validatePackageManifest
} from "../../src";

describe("kernel manifest DSL", () => {
  it("applies defaults for a normal package", () => {
    const manifest = definePackage({
      id: "crm-core",
      kind: "app",
      version: "0.1.0",
      displayName: "CRM Core",
      description: "CRM backbone.",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      providesCapabilities: ["crm.contacts"],
      requestedCapabilities: ["ui.register.admin"]
    });

    expect(manifest.publisher).toBe("local.workspace");
    expect(manifest.reviewTier).toBe("R1");
    expect(manifest.trustTier).toBe("first-party");
  });

  it("specializes connector manifests", () => {
    const manifest = defineConnector({
      id: "stripe-adapter",
      version: "0.1.0",
      displayName: "Stripe Adapter",
      description: "Payments adapter.",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres"]
      },
      dependsOn: ["payments-core"],
      connector: {
        provider: "stripe",
        secrets: ["STRIPE_SECRET_KEY"],
        webhooks: []
      }
    });

    expect(manifest.kind).toBe("connector");
    expect(manifest.isolationProfile).toBe("sidecar");
    expect(manifest.connector.provider).toBe("stripe");
  });

  it("specializes bundle manifests", () => {
    const bundle = defineBundle({
      id: "crm-growth-suite",
      version: "0.1.0",
      displayName: "CRM Growth Suite",
      description: "Bundle",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      includes: ["crm-core"],
      optionalIncludes: ["analytics-core"]
    });

    expect(bundle.kind).toBe("bundle");
    expect(bundle.isolationProfile).toBe("declarative-only");
    expect(bundle.includes).toEqual(["crm-core"]);
  });

  it("requires migration packs to declare source and targets", () => {
    const result = validatePackageManifest({
      id: "salesforce-import",
      kind: "migration-pack",
      version: "0.1.0",
      displayName: "Salesforce Import",
      description: "Migration",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres"]
      },
      reviewTier: "R2",
      trustTier: "first-party",
      isolationProfile: "sidecar"
    });

    expect(result.success).toBe(false);
  });

  it("accepts explicit migration pack definitions", () => {
    const migration = defineMigrationPack({
      id: "shopify-import",
      version: "0.1.0",
      displayName: "Shopify Import",
      description: "Commerce migration.",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      sourceSystem: "shopify",
      targetDomains: ["commerce.orders"],
      phases: ["discover", "map", "dry-run", "cutover", "reconcile"]
    });

    expect(migration.kind).toBe("migration-pack");
    expect(migration.sourceSystem).toBe("shopify");
  });
});
