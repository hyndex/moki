import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "ai-evals",
  kind: "ai-pack",
  version: "0.1.0",
  displayName: "AI Evals",
  description: "Eval datasets, judges, regression baselines, and release-grade AI review.",
  extends: ["ai-core"],
  dependsOn: ["ai-core", "audit-core", "jobs-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["ai.evals", "ai.release-gates"],
  requestedCapabilities: ["ui.register.admin", "api.rest.mount", "data.write.ai", "jobs.execute.ai"],
  ownsData: ["ai.eval-datasets", "ai.eval-runs"],
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
