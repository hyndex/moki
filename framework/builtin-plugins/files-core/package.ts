import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "files-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Files Core",
  description: "File references and storage abstractions.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["files.assets"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.files"],
  ownsData: ["files.assets"],
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