import { describe, expect, it } from "bun:test";

import { createCapabilityRegistry, createDataOwnershipRegistry, createRouteOwnershipRegistry } from "../../src";
import { definePackage } from "../../src/manifest";

describe("kernel registries", () => {
  it("builds capability, data, and route ownership maps deterministically", () => {
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
      providesCapabilities: ["crm.contacts"],
      requestedCapabilities: ["ui.register.admin"],
      ownsData: ["crm.contacts"],
      ui: {
        embeddedPages: [{ shell: "admin", route: "/admin/crm", permission: "crm.contacts.read" }]
      }
    });

    const marketing = definePackage({
      id: "marketing-core",
      kind: "app",
      version: "0.1.0",
      displayName: "Marketing",
      description: "Marketing",
      compatibility: {
        framework: "^0.1.0",
        runtime: "bun>=1.3.12",
        db: ["postgres", "sqlite"]
      },
      providesCapabilities: ["marketing.campaigns"],
      requestedCapabilities: ["crm.contacts.read"]
    });

    const capabilityRegistry = createCapabilityRegistry([marketing, crm]);
    const dataRegistry = createDataOwnershipRegistry([marketing, crm]);
    const routeRegistry = createRouteOwnershipRegistry([marketing, crm]);

    expect(capabilityRegistry.get("crm.contacts")?.providers).toEqual(["crm-core"]);
    expect(capabilityRegistry.get("crm.contacts.read")?.requesters).toEqual(["marketing-core"]);
    expect(dataRegistry.get("crm.contacts")?.owner).toBe("crm-core");
    expect(routeRegistry.get("/admin/crm")?.owner).toBe("crm-core");
  });
});
