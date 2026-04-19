import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "page-builder-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Page Builder Core",
  description: "Layout, block, and builder canvas backbone.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["page-builder.layouts"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.page-builder"],
  ownsData: ["page-builder.layouts"],
  extendsData: [],
  slotClaims: [],
  trustTier: "first-party",
  reviewTier: "R1",
  isolationProfile: "same-process-trusted",
  compatibility: {
    framework: "^0.1.0",
    runtime: "bun>=1.3.12",
    db: ["postgres", "sqlite"]
  }
});