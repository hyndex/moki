import { describe, expect, it } from "bun:test";

import {
  createUnderstandingDocPack,
  packageId,
  understandingDocFilenames,
  validateUnderstandingDocPack
} from "../../src";

describe("agent-understanding", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("agent-understanding");
  });

  it("renders the full understanding document pack", () => {
    const pack = createUnderstandingDocPack({
      id: "dashboard-core",
      displayName: "Dashboard Core",
      description: "Universal desk, widget, and saved view backbone.",
      location: "framework/builtin-plugins/dashboard-core",
      targetType: "package",
      packageKind: "app",
      dependsOn: ["auth-core"],
      providesCapabilities: ["dashboard.views"],
      requestedCapabilities: ["ui.register.admin"],
      resources: [
        {
          id: "dashboard.views",
          description: "Operator dashboards and saved layouts.",
          fields: [{ name: "name", label: "Name", description: "Primary operator label for the dashboard view." }]
        }
      ],
      actions: [
        {
          id: "dashboard.views.publish",
          permission: "dashboard.views.publish",
          description: "Publish a saved dashboard layout for governed operator use."
        }
      ],
      workflows: []
    });

    expect(Object.keys(pack).sort()).toEqual([...understandingDocFilenames].sort());
    expect(pack["AGENT_CONTEXT.md"]).toContain("Dashboard Core Agent Context");
    expect(pack["GLOSSARY.md"]).toContain("name");
  });

  it("reports missing required doc files", () => {
    expect(validateUnderstandingDocPack(["AGENT_CONTEXT.md"])).toHaveLength(understandingDocFilenames.length - 1);
  });
});
