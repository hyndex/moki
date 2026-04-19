import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "jobs-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Jobs Core",
  description: "Background jobs, schedules, and execution metadata.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["jobs.executions"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.jobs"],
  ownsData: ["jobs.executions"],
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