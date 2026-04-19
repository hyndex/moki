import { defineAction } from "@platform/schema";
import { z } from "zod";

import {
  ingestMemoryDocument,
  reindexMemoryCollection,
  retrieveTenantKnowledge
} from "../services/main.service";

export const ingestMemoryDocumentAction = defineAction({
  id: "ai.memory.ingest",
  input: z.object({
    tenantId: z.string().min(2),
    collectionId: z.string().min(2),
    title: z.string().min(3),
    body: z.string().min(24),
    sourceObjectId: z.string().min(2),
    sourceKind: z.string().min(2),
    classification: z.enum(["public", "internal", "restricted", "confidential"])
  }),
  output: z.object({
    ok: z.literal(true),
    chunkCount: z.number().int().positive(),
    collectionId: z.string()
  }),
  permission: "ai.memory.ingest",
  idempotent: true,
  audit: true,
  ai: {
    purpose: "Ingest a governed document into a tenant-safe memory collection.",
    riskLevel: "moderate",
    approvalMode: "required",
    toolPolicies: ["tool.require_approval"],
    groundingInputs: [{ sourceId: "ai.memory-collections", required: true }],
    resultSummaryHint: "Return the collection id and number of memory chunks created.",
    replay: {
      deterministic: true,
      includeInputHash: true,
      includeOutputHash: true,
      note: "Ingestion replays are pinned to the submitted body hash."
    }
  },
  handler: ({ input }) => ingestMemoryDocument(input)
});

export const retrieveMemoryAction = defineAction({
  id: "ai.memory.retrieve",
  input: z.object({
    tenantId: z.string().min(2),
    query: z.string().min(3),
    collectionIds: z.array(z.string().min(2)).optional(),
    topK: z.number().int().positive().max(10).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    citationCount: z.number().int().nonnegative(),
    chunkIds: z.array(z.string())
  }),
  permission: "ai.memory.read",
  idempotent: true,
  audit: false,
  ai: {
    purpose: "Retrieve grounded memory with citations from approved collections.",
    riskLevel: "low",
    approvalMode: "none",
    toolPolicies: ["tool.allow"],
    groundingInputs: [{ sourceId: "ai.memory-documents", required: true }],
    resultSummaryHint: "Return the chunk ids and citation count for the retrieval response.",
    replay: {
      deterministic: true,
      includeInputHash: true,
      includeOutputHash: true,
      note: "Retrieval responses are anchored to collection selection and citation minimums."
    }
  },
  handler: ({ input }) => retrieveTenantKnowledge(input)
});

export const reindexMemoryCollectionAction = defineAction({
  id: "ai.memory.reindex",
  input: z.object({
    tenantId: z.string().min(2),
    collectionId: z.string().min(2)
  }),
  output: z.object({
    ok: z.literal(true),
    queuedDocuments: z.number().int().nonnegative()
  }),
  permission: "ai.memory.reindex",
  idempotent: true,
  audit: true,
  ai: {
    purpose: "Queue a memory collection for deterministic reindexing.",
    riskLevel: "moderate",
    approvalMode: "required",
    toolPolicies: ["tool.require_approval"],
    resultSummaryHint: "Return how many documents were queued for reindexing.",
    replay: {
      deterministic: true,
      includeInputHash: true,
      includeOutputHash: true,
      note: "Reindex requests capture the collection id and resulting queue count."
    }
  },
  handler: ({ input }) => reindexMemoryCollection(input)
});

export const aiRagActions = [
  ingestMemoryDocumentAction,
  retrieveMemoryAction,
  reindexMemoryCollectionAction
] as const;
