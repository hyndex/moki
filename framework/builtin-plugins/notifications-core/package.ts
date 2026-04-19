import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "notifications-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Notifications Core",
  description: "Outbound and in-app notifications.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["notifications.messages"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.notifications"],
  ownsData: ["notifications.messages"],
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