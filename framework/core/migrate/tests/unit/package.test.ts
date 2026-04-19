import { describe, expect, it } from "bun:test";
import { defineMigrationPack } from "@platform/kernel";

import {
  createExpandBackfillSwitchContractPlan,
  createMigrationMetadata,
  createMigrationPlan,
  packageId,
  registerMigrationPack,
  runMigrationPlan,
  summarizeMigrationPlan
} from "../../src";

describe("migrate", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("migrate");
  });

  it("orders migration steps deterministically", () => {
    const manifest = defineMigrationPack({
      id: "shopify-import",
      kind: "migration-pack",
      version: "0.1.0",
      displayName: "Shopify Import",
      description: "Imports products and orders.",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      sourceSystem: "shopify",
      targetDomains: ["commerce.orders"],
      phases: ["discover", "map", "import", "reconcile"]
    });

    const pack = registerMigrationPack({
      manifest,
      steps: [
        {
          id: "shopify-import.import-orders",
          packageId: manifest.id,
          phase: "import",
          description: "Import orders",
          up: () => undefined
        },
        {
          id: "shopify-import.discover-orders",
          packageId: manifest.id,
          phase: "discover",
          description: "Discover orders",
          up: () => undefined
        }
      ]
    });

    const plan = createMigrationPlan([pack]);
    expect(plan.map((entry) => entry.id)).toEqual([
      "shopify-import.discover-orders",
      "shopify-import.import-orders"
    ]);
    expect(summarizeMigrationPlan(plan)[0]).toContain("[discover]");
  });

  it("supports dry-run execution without mutating state", async () => {
    let executed = false;
    const result = await runMigrationPlan(
      [
        {
          order: 1,
          id: "crm-import.map-accounts",
          packageId: "crm-import",
          phase: "map",
          description: "Map accounts",
          up: () => {
            executed = true;
          }
        }
      ],
      { dryRun: true }
    );

    expect(result.success).toBe(true);
    expect(executed).toBe(false);
    expect(result.results[0]?.status).toBe("planned");
  });

  it("rolls back completed steps after a failure", async () => {
    const calls: string[] = [];
    const result = await runMigrationPlan([
      {
        order: 1,
        id: "workspace-import.import-docs",
        packageId: "workspace-import",
        phase: "import",
        description: "Import docs",
        up: () => {
          calls.push("up:docs");
        },
        rollback: () => {
          calls.push("rollback:docs");
        }
      },
      {
        order: 2,
        id: "workspace-import.import-files",
        packageId: "workspace-import",
        phase: "import",
        description: "Import files",
        up: () => {
          throw new Error("files failed");
        }
      }
    ]);

    expect(result.success).toBe(false);
    expect(calls).toEqual(["up:docs", "rollback:docs"]);
    expect(result.results.map((entry) => entry.status)).toContain("rolled-back");
  });

  it("publishes metadata for registered packs", () => {
    const manifest = defineMigrationPack({
      id: "contentful-import",
      kind: "migration-pack",
      version: "0.1.0",
      displayName: "Contentful Import",
      description: "Imports content types and entries.",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      sourceSystem: "contentful",
      targetDomains: ["content.entries"],
      phases: ["discover", "map", "dry-run", "import", "reconcile"]
    });

    const pack = registerMigrationPack({
      manifest,
      steps: createExpandBackfillSwitchContractPlan(manifest.id).filter((step) =>
        ["import", "reconcile"].includes(step.phase)
      )
    });

    const metadata = createMigrationMetadata(pack);
    expect(metadata.sourceSystem).toBe("contentful");
    expect(metadata.stepIds.length).toBeGreaterThan(0);
  });
});
