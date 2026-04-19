import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "workflow-core",
  kind: "app",
  version: "0.1.0",
  displayName: "Workflow Core",
  description: "Explicit workflows and approval state machines.",
  extends: [],
  dependsOn: ["auth-core","org-tenant-core","role-policy-core","audit-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["workflow.instances"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.workflow"],
  ownsData: ["workflow.instances"],
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