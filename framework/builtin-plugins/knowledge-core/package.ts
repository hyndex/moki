import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "knowledge-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Knowledge Core",
  description: "Knowledge base, docs, and article tree backbone.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["knowledge.articles"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.knowledge"],
  ownsData: ["knowledge.articles"],
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