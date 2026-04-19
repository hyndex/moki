import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "role-policy-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Role Policy Core",
  description: "RBAC and ABAC policy management backbone.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["roles.grants"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.roles"],
  ownsData: ["roles.grants"],
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