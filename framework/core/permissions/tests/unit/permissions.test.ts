import { describe, expect, it } from "bun:test";

import { definePackage } from "@platform/kernel";

import {
  applyRestrictedMode,
  classifyCapability,
  createCapabilityGrantStore,
  createCapabilityGrantRecord,
  createInstallReviewPlan,
  createUpdateReviewPlan,
  CapabilityGrantConflictError,
  definePolicy,
  diffRequestedCapabilities,
  evaluateDormantCapabilityReset,
  enforceUnknownPluginRestrictions,
  evaluatePolicy,
  isDangerousCapability,
  markCapabilityUsed
} from "../../src";

describe("permissions", () => {
  it("defines and evaluates policies", () => {
    const policy = definePolicy({
      id: "crm.default",
      rules: [
        {
          permission: "crm.contacts.archive",
          allowIf: ["role:manager"],
          requireReason: true
        }
      ]
    });

    expect(evaluatePolicy(policy, { permission: "crm.contacts.archive", actorClaims: ["role:manager"], reason: "cleanup" })).toBe(true);
    expect(evaluatePolicy(policy, { permission: "crm.contacts.archive", actorClaims: ["role:manager"] })).toBe(false);
  });

  it("classifies and diffs requested capabilities", () => {
    expect(classifyCapability("network.egress.allowlist")).toBe("network");
    expect(isDangerousCapability("identity.impersonate")).toBe(true);
    expect(isDangerousCapability("ai.tool.execute.crm.contacts.archive")).toBe(true);

    expect(
      diffRequestedCapabilities(["ui.register.admin"], ["ui.register.admin", "identity.impersonate"])
    ).toEqual({
      added: ["identity.impersonate"],
      removed: [],
      unchanged: ["ui.register.admin"],
      addedDangerous: ["identity.impersonate"],
      removedDangerous: []
    });
  });

  it("enforces unknown plugin restrictions", () => {
    const manifest = definePackage({
      id: "unknown-widget-pack",
      kind: "feature-pack",
      version: "0.1.0",
      displayName: "Unknown Widget Pack",
      description: "Untrusted package.",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["sqlite"]
      },
      trustTier: "unknown",
      isolationProfile: "sidecar",
      requestedHosts: ["api.example.com"],
      requestedCapabilities: ["network.egress.allowlist", "ui.register.admin"]
    });

    const violations = enforceUnknownPluginRestrictions(manifest);
    expect(violations.length).toBe(3);

    const restricted = applyRestrictedMode(manifest);
    expect(restricted.isolationProfile).toBe("declarative-only");
    expect(restricted.requestedCapabilities).toEqual(["ui.register.admin"]);
    expect(restricted.requestedHosts).toEqual([]);
  });

  it("evaluates dormant dangerous optional grants without revoking required scopes", () => {
    const requiredGrant = createCapabilityGrantRecord({
      capability: "billing.payout.approve",
      required: true,
      grantedAt: "2026-01-01T00:00:00.000Z",
      lastUsedAt: "2026-01-10T00:00:00.000Z"
    });
    const staleOptionalGrant = createCapabilityGrantRecord({
      capability: "identity.impersonate",
      required: false,
      grantedAt: "2026-01-01T00:00:00.000Z",
      lastUsedAt: "2026-03-01T00:00:00.000Z"
    });
    const revokedOptionalGrant = createCapabilityGrantRecord({
      capability: "backup.restore.execute",
      required: false,
      grantedAt: "2026-01-01T00:00:00.000Z",
      lastRequestedAt: "2026-01-05T00:00:00.000Z"
    });
    const harmlessGrant = createCapabilityGrantRecord({
      capability: "ui.register.admin",
      required: false,
      grantedAt: "2026-01-01T00:00:00.000Z"
    });

    const result = evaluateDormantCapabilityReset(
      [requiredGrant, staleOptionalGrant, revokedOptionalGrant, harmlessGrant],
      {
        now: "2026-04-18T00:00:00.000Z",
        staleAfterDays: 30,
        revokeAfterDays: 90
      }
    );

    expect(result.preservedRequired).toEqual(["billing.payout.approve"]);
    expect(result.requireReapproval).toEqual(["identity.impersonate"]);
    expect(result.revoke).toEqual(["backup.restore.execute"]);
    expect(result.active).toEqual(["billing.payout.approve", "ui.register.admin"]);
    expect(result.updated.find((grant) => grant.capability === "identity.impersonate")?.state).toBe("reapproval-required");
  });

  it("marks capability grants as used when a dangerous runtime scope is exercised", () => {
    const grant = createCapabilityGrantRecord({
      capability: "identity.impersonate",
      required: false,
      grantedAt: "2026-01-01T00:00:00.000Z"
    });

    expect(markCapabilityUsed(grant, "2026-04-18T10:15:00.000Z")).toEqual({
      capability: "identity.impersonate",
      required: false,
      grantedAt: "2026-01-01T00:00:00.000Z",
      lastUsedAt: "2026-04-18T10:15:00.000Z",
      state: "active"
    });
  });

  it("creates restricted-preview install review plans for unknown plugins", () => {
    const manifest = definePackage({
      id: "unknown-widget-pack",
      kind: "feature-pack",
      version: "0.1.0",
      displayName: "Unknown Widget Pack",
      description: "Untrusted package.",
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

    const plan = createInstallReviewPlan(manifest, {
      allowRestrictedPreview: true
    });

    expect(plan.mode).toBe("restricted-preview");
    expect(plan.effectiveManifest.isolationProfile).toBe("declarative-only");
    expect(plan.effectiveManifest.requestedCapabilities).toEqual(["ui.register.admin"]);
    expect(plan.effectiveManifest.requestedHosts).toEqual([]);
    expect(plan.requiredApprovals).toContain("approval:trust-upgrade");
    expect(plan.strippedCapabilities).toEqual(["data.export.crm"]);
    expect(plan.strippedHosts).toEqual(["api.example.com"]);
  });

  it("creates governance update review plans when permissions and routes change", () => {
    const previousManifest = definePackage({
      id: "crm-core",
      kind: "app",
      version: "0.1.0",
      displayName: "CRM Core",
      description: "Contacts.",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      requestedCapabilities: ["ui.register.admin"],
      ui: {
        embeddedPages: [
          {
            shell: "admin",
            route: "/admin/crm",
            permission: "crm.contacts.read"
          }
        ],
        zones: []
      }
    });
    const nextManifest = definePackage({
      ...previousManifest,
      requestedCapabilities: ["data.export.crm", "ui.register.admin"],
      ui: {
        embeddedPages: [
          {
            shell: "admin",
            route: "/admin/crm",
            permission: "crm.contacts.read"
          },
          {
            shell: "admin",
            route: "/admin/crm/export",
            permission: "crm.contacts.export"
          }
        ],
        zones: []
      }
    });

    const plan = createUpdateReviewPlan(previousManifest, nextManifest);

    expect(plan.requiresReapproval).toBe(true);
    expect(plan.diff.capabilityDiff.addedDangerous).toEqual(["data.export.crm"]);
    expect(plan.diff.routeDiff.added).toEqual(["/admin/crm/export"]);
    expect(plan.requiredApprovals).toContain("approval:capability-change");
    expect(plan.requiredApprovals).toContain("approval:route-change");
  });

  it("flags AI runtime and memory-export capabilities during install review", () => {
    const manifest = definePackage({
      id: "ai-ops-pack",
      kind: "ai-pack",
      version: "0.1.0",
      displayName: "AI Ops Pack",
      description: "Durable AI runtime surfaces.",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      requestedCapabilities: [
        "ui.register.admin",
        "ai.model.invoke",
        "ai.tool.execute.crm.contacts.archive",
        "ai.memory.export.knowledge"
      ]
    });

    const plan = createInstallReviewPlan(manifest);

    expect(plan.findings.map((finding) => finding.code)).toContain("install.review.ai-runtime");
    expect(plan.findings.map((finding) => finding.code)).toContain("install.review.ai-memory-export");
    expect(plan.requiredApprovals).toContain("approval:ai-runtime");
    expect(plan.requiredApprovals).toContain("approval:ai-memory-export");
  });

  it("rejects simultaneous permission updates with optimistic version conflicts", () => {
    const store = createCapabilityGrantStore([
      createCapabilityGrantRecord({
        capability: "ui.register.admin",
        required: true,
        grantedAt: "2026-01-01T00:00:00.000Z"
      })
    ]);

    const firstSnapshot = store.read();
    const committed = store.commit(firstSnapshot.version, {
      upsert: [
        createCapabilityGrantRecord({
          capability: "identity.impersonate",
          required: false,
          grantedAt: "2026-04-19T00:00:00.000Z"
        })
      ]
    });

    expect(committed.version).toBe(1);
    expect(() =>
      store.commit(firstSnapshot.version, {
        revoke: ["ui.register.admin"]
      })
    ).toThrow(CapabilityGrantConflictError);
  });
});
