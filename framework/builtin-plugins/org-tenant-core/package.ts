import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "org-tenant-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Org Tenant Core",
  description: "Tenant and organization graph management.",
  extends: [],
  dependsOn: ["auth-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["org.tenants"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.org"],
  ownsData: ["org.tenants"],
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