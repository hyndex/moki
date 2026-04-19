import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "community-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Community Core",
  description: "Community, groups, and membership backbone.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["community.memberships"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.community"],
  ownsData: ["community.memberships"],
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