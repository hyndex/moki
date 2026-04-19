import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "portal-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Portal Core",
  description: "Portal shell and self-service entrypoint backbone.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["portal.accounts"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.portal"],
  ownsData: ["portal.accounts"],
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