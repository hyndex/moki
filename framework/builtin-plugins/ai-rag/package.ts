import { definePackage } from "@platform/kernel";

export default definePackage({
  id: "ai-rag",
  kind: "ai-pack",
  version: "0.1.0",
  displayName: "AI RAG",
  description: "Tenant-safe memory collections, retrieval diagnostics, and grounded knowledge pipelines.",
  extends: ["ai-core"],
  dependsOn: ["ai-core", "knowledge-core", "jobs-core"],
  optionalWith: [],
  conflictsWith: [],
  providesCapabilities: ["ai.memory", "ai.retrieval"],
  requestedCapabilities: [
    "ui.register.admin",
    "api.rest.mount",
    "data.write.ai",
    "jobs.execute.ai",
    "ai.tool.execute"
  ],
  ownsData: ["ai.memory-collections", "ai.memory-documents"],
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
