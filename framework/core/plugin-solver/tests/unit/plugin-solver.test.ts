import { describe, expect, it } from "bun:test";

import { defineBundle, definePackage } from "@platform/kernel";

import { solvePackageGraph } from "../../src";

describe("plugin solver", () => {
  it("resolves dependencies and bundle members in activation order", () => {
    const auth = definePackage({
      id: "auth-core",
      kind: "app",
      version: "0.1.0",
      displayName: "Auth",
      description: "Auth",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      }
    });

    const crm = definePackage({
      id: "crm-core",
      kind: "app",
      version: "0.1.0",
      displayName: "CRM",
      description: "CRM",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      dependsOn: ["auth-core"],
      ownsData: ["crm.contacts"],
      requestedCapabilities: ["ui.register.admin"]
    });

    const bundle = defineBundle({
      id: "crm-growth-suite",
      version: "0.1.0",
      displayName: "CRM Growth",
      description: "Bundle",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      includes: ["crm-core"],
      optionalIncludes: []
    });

    const result = solvePackageGraph({
      requested: ["crm-growth-suite"],
      manifests: [bundle, crm, auth],
      platformVersion: "0.1.0",
      runtimeVersion: "1.3.12",
      dbEngine: "postgres"
    });

    expect(result.orderedActivation).toEqual(["auth-core", "crm-core", "crm-growth-suite"]);
    expect(result.ownershipMap.get("crm.contacts")).toBe("crm-core");
    expect(result.rollbackCheckpoints).toEqual([
      {
        checkpointId: "rollback:auth-core",
        afterPackageId: "auth-core",
        rollbackOrder: ["auth-core"],
        revertMigrations: [],
        releaseRoutes: [],
        releaseSlots: [],
        releaseOwnership: []
      },
      {
        checkpointId: "rollback:crm-core",
        afterPackageId: "crm-core",
        rollbackOrder: ["crm-core", "auth-core"],
        revertMigrations: [],
        releaseRoutes: [],
        releaseSlots: [],
        releaseOwnership: ["crm.contacts"]
      },
      {
        checkpointId: "rollback:crm-growth-suite",
        afterPackageId: "crm-growth-suite",
        rollbackOrder: ["crm-growth-suite", "crm-core", "auth-core"],
        revertMigrations: [],
        releaseRoutes: [],
        releaseSlots: [],
        releaseOwnership: ["crm.contacts"]
      }
    ]);
  });

  it("fails on duplicate ownership", () => {
    const first = definePackage({
      id: "crm-core",
      kind: "app",
      version: "0.1.0",
      displayName: "CRM",
      description: "CRM",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      ownsData: ["crm.contacts"]
    });

    const second = definePackage({
      id: "custom-crm-pack",
      kind: "feature-pack",
      version: "0.1.0",
      displayName: "CRM extension",
      description: "Duplicate owner",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      ownsData: ["crm.contacts"]
    });

    expect(() =>
      solvePackageGraph({
        requested: ["crm-core", "custom-crm-pack"],
        manifests: [first, second],
        platformVersion: "0.1.0",
        runtimeVersion: "1.3.12",
        dbEngine: "sqlite"
      })
    ).toThrow("Package graph validation failed");
  });

  it("fails unknown plugins requesting dangerous capabilities", () => {
    const unknownPlugin = definePackage({
      id: "unknown-export-pack",
      kind: "feature-pack",
      version: "0.1.0",
      displayName: "Unknown Export",
      description: "Unsafe plugin",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["sqlite"]
      },
      trustTier: "unknown",
      isolationProfile: "sidecar",
      requestedCapabilities: ["data.export.crm"]
    });

    expect(() =>
      solvePackageGraph({
        requested: ["unknown-export-pack"],
        manifests: [unknownPlugin],
        platformVersion: "0.1.0",
        runtimeVersion: "1.3.12",
        dbEngine: "sqlite"
      })
    ).toThrow("Package graph resolution failed");
  });

  it("warns when dangerous capabilities need admin acknowledgement", () => {
    const exportPack = definePackage({
      id: "reporting-export-pack",
      kind: "feature-pack",
      version: "0.1.0",
      displayName: "Reporting export",
      description: "Exports regulated data",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      requestedCapabilities: ["data.export.crm"]
    });

    const result = solvePackageGraph({
      requested: ["reporting-export-pack"],
      manifests: [exportPack],
      platformVersion: "0.1.0",
      runtimeVersion: "1.3.12",
      dbEngine: "postgres"
    });

    expect(result.warnings).toContain(
      "Admin acknowledgement required for dangerous capabilities: data.export.crm"
    );
  });

  it("deduplicates repeated activation requests", () => {
    const auth = definePackage({
      id: "auth-core",
      kind: "app",
      version: "0.1.0",
      displayName: "Auth",
      description: "Auth",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      }
    });

    const result = solvePackageGraph({
      requested: ["auth-core", "auth-core"],
      manifests: [auth],
      platformVersion: "0.1.0",
      runtimeVersion: "1.3.12",
      dbEngine: "postgres"
    });

    expect(result.orderedActivation).toEqual(["auth-core"]);
    expect(result.resolvedPackages.map((entry) => entry.id)).toEqual(["auth-core"]);
  });

  it("allows missing optional bundle members during partial activation", () => {
    const auth = definePackage({
      id: "auth-core",
      kind: "app",
      version: "0.1.0",
      displayName: "Auth",
      description: "Auth",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      }
    });
    const bundle = defineBundle({
      id: "workspace-suite",
      version: "0.1.0",
      displayName: "Workspace Suite",
      description: "Bundle",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      includes: ["auth-core"],
      optionalIncludes: ["slack-adapter"]
    });

    const result = solvePackageGraph({
      requested: ["workspace-suite"],
      manifests: [auth, bundle],
      platformVersion: "0.1.0",
      runtimeVersion: "1.3.12",
      dbEngine: "postgres",
      allowPartialBundles: true
    });

    expect(result.resolvedPackages.map((entry) => entry.id)).toEqual(["auth-core", "workspace-suite"]);
    expect(result.warnings).toContain("Bundle 'workspace-suite' optional package 'slack-adapter' is unavailable");
  });

  it("activates unknown plugins in restricted preview when explicitly allowed", () => {
    const unknownPlugin = definePackage({
      id: "unknown-dashboard-pack",
      kind: "feature-pack",
      version: "0.1.0",
      displayName: "Unknown Dashboard",
      description: "Unsigned plugin.",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["sqlite"]
      },
      trustTier: "unknown",
      isolationProfile: "sidecar",
      requestedHosts: ["api.example.com"],
      requestedCapabilities: ["data.export.crm", "ui.register.admin"]
    });

    const result = solvePackageGraph({
      requested: ["unknown-dashboard-pack"],
      manifests: [unknownPlugin],
      platformVersion: "0.1.0",
      runtimeVersion: "1.3.12",
      dbEngine: "sqlite",
      allowRestrictedPreviewForUnknownPlugins: true
    });

    expect(result.resolvedPackages).toHaveLength(1);
    expect(result.resolvedPackages[0]?.isolationProfile).toBe("declarative-only");
    expect(result.resolvedPackages[0]?.requestedCapabilities).toEqual(["ui.register.admin"]);
    expect(result.resolvedPackages[0]?.requestedHosts).toEqual([]);
    expect(result.warnings).toContain(
      "Package 'unknown-dashboard-pack': Package 'unknown-dashboard-pack' is activated only in restricted declarative-only preview mode."
    );
  });
});
