import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "dashboard-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Dashboard Core",
  description: "Dashboard, widget, and saved view backbone.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["dashboard.views"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.dashboard"],
  ownsData: ["dashboard.views"],
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