import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "content-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Content Core",
  description: "Pages, posts, and content type backbone.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["content.entries"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.content"],
  ownsData: ["content.entries"],
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