import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "user-directory",
  kind: "app",
  version: "0.1.0",
  displayName: "User Directory",
  description: "Internal person and directory backbone.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["directory.people"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.directory"],
  ownsData: ["directory.people"],
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