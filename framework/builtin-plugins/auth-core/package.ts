import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "auth-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Auth Core",
  description: "Canonical identity and session backbone.",
  extends: [],
  dependsOn: [],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["auth.identities"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.auth"],
  ownsData: ["auth.identities"],
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