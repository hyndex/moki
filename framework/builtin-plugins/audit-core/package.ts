import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "audit-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Audit Core",
  description: "Canonical audit trail and sensitive action history.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["audit.events"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.audit"],
  ownsData: ["audit.events"],
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