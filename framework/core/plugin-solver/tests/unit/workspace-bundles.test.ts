import { describe, expect, it } from "bun:test";

import { defineBundle } from "@platform/kernel";
import { manifest as auditCore } from "@plugins/audit-core";
import { manifest as authCore } from "@plugins/auth-core";
import { manifest as contentCore } from "@plugins/content-core";
import { manifest as dashboardCore } from "@plugins/dashboard-core";
import { manifest as filesCore } from "@plugins/files-core";
import { manifest as formsCore } from "@plugins/forms-core";
import { manifest as knowledgeCore } from "@plugins/knowledge-core";
import { manifest as orgTenantCore } from "@plugins/org-tenant-core";
import { manifest as portalCore } from "@plugins/portal-core";
import { manifest as rolePolicyCore } from "@plugins/role-policy-core";
import { manifest as userDirectory } from "@plugins/user-directory";
import { manifest as notificationsCore } from "@plugins/notifications-core";
import { manifest as pageBuilderCore } from "@plugins/page-builder-core";
import { manifest as workflowCore } from "@plugins/workflow-core";

import { solvePackageGraph } from "../../src";

describe("workspace bundle resolution", () => {
  it("resolves the admin foundation bundle against real manifests", () => {
    const adminFoundation = defineBundle({
      id: "admin-foundation",
      version: "0.1.0",
      displayName: "Admin Foundation",
      includes: [
        "auth-core",
        "user-directory",
        "org-tenant-core",
        "role-policy-core",
        "audit-core",
        "dashboard-core",
        "portal-core"
      ],
      optionalIncludes: [],
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      }
    });

    const result = solvePackageGraph({
      requested: [adminFoundation.id],
      manifests: [
        adminFoundation,
        authCore,
        userDirectory,
        orgTenantCore,
        rolePolicyCore,
        auditCore,
        dashboardCore,
        portalCore
      ],
      platformVersion: "0.1.0",
      runtimeVersion: "1.3.12",
      dbEngine: "postgres"
    });

    expect(result.resolvedPackages.map((entry) => entry.id)).toEqual([
      "admin-foundation",
      "audit-core",
      "auth-core",
      "dashboard-core",
      "org-tenant-core",
      "portal-core",
      "role-policy-core",
      "user-directory"
    ]);
    expect(result.orderedActivation).toContain("admin-foundation");
  });

  it("includes optional members when partial bundle activation is allowed", () => {
    const collaborationSuite = defineBundle({
      id: "collaboration-suite",
      version: "0.1.0",
      displayName: "Collaboration Suite",
      includes: ["portal-core", "content-core", "knowledge-core", "workflow-core"],
      optionalIncludes: ["notifications-core", "files-core", "forms-core", "page-builder-core"],
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      }
    });

    const result = solvePackageGraph({
      requested: [collaborationSuite.id],
      manifests: [
        collaborationSuite,
        authCore,
        auditCore,
        contentCore,
        filesCore,
        formsCore,
        knowledgeCore,
        notificationsCore,
        orgTenantCore,
        pageBuilderCore,
        portalCore,
        rolePolicyCore,
        workflowCore
      ],
      platformVersion: "0.1.0",
      runtimeVersion: "1.3.12",
      dbEngine: "postgres",
      allowPartialBundles: true
    });

    expect(result.resolvedPackages.map((entry) => entry.id)).toContain("page-builder-core");
    expect(result.orderedActivation[0]).toBe("auth-core");
    expect(result.orderedActivation).toContain("collaboration-suite");
  });
});
