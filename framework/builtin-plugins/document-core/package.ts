import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "document-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Document Core",
  description: "Document lifecycle and generated document backbone.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["document.records"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.document"],
  ownsData: ["document.records"],
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