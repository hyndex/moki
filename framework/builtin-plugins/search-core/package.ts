import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "search-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Search Core",
  description: "Typed search indexing and query abstractions.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["search.documents"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.search"],
  ownsData: ["search.documents"],
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