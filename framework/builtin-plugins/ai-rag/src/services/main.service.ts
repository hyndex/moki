import {
  chunkMemoryDocument,
  defineMemoryCollection,
  defineMemoryDocument,
  defineMemoryPolicy,
  retrieveMemory
} from "@platform/ai-memory";
import { normalizeActionInput } from "@platform/schema";

export type IngestMemoryDocumentInput = {
  tenantId: string;
  collectionId: string;
  title: string;
  body: string;
  sourceObjectId: string;
  sourceKind: string;
  classification: "public" | "internal" | "restricted" | "confidential";
};

export type RetrievalRequestInput = {
  tenantId: string;
  query: string;
  collectionIds?: string[] | undefined;
  topK?: number | undefined;
};

export type ReindexMemoryCollectionInput = {
  tenantId: string;
  collectionId: string;
};

export const memoryCollectionsFixture = Object.freeze([
  defineMemoryCollection({
    id: "memory-collection:ops",
    label: "Ops Playbooks",
    policyScope: "tenant",
    sourcePlugin: "knowledge-core",
    tenantId: "tenant-platform",
    classification: "internal",
    metadata: {
      documentCount: 2
    }
  }),
  defineMemoryCollection({
    id: "memory-collection:kb",
    label: "Support Knowledge",
    policyScope: "tenant",
    sourcePlugin: "knowledge-core",
    tenantId: "tenant-platform",
    classification: "restricted",
    metadata: {
      documentCount: 1
    }
  })
]);

export const documentFixtures = Object.freeze([
  defineMemoryDocument({
    id: "memory-document:ops-handoff",
    collectionId: "memory-collection:ops",
    sourcePlugin: "knowledge-core",
    sourceObjectId: "article:ops-handoff",
    sourceKind: "knowledge-article",
    title: "Shift handoff checklist",
    body: "Confirm open incidents, verify export backlog, and review approvals before ending the shift.",
    tenantId: "tenant-platform",
    classification: "internal",
    createdAt: "2026-04-18T08:00:00.000Z",
    updatedAt: "2026-04-18T08:30:00.000Z",
    tags: ["ops", "handoff"]
  }),
  defineMemoryDocument({
    id: "memory-document:finance-escalations",
    collectionId: "memory-collection:kb",
    sourcePlugin: "knowledge-core",
    sourceObjectId: "article:finance-escalations",
    sourceKind: "knowledge-article",
    title: "Finance escalation policy",
    body: "Finance exception approvals require a human checkpoint, an audit reason, and replay-safe prompt metadata.",
    tenantId: "tenant-platform",
    classification: "restricted",
    createdAt: "2026-04-17T11:00:00.000Z",
    updatedAt: "2026-04-18T10:45:00.000Z",
    tags: ["finance", "approvals"]
  }),
  defineMemoryDocument({
    id: "memory-document:retrieval-debugging",
    collectionId: "memory-collection:ops",
    sourcePlugin: "ai-rag",
    sourceObjectId: "diagnostic:retrieval-debugging",
    sourceKind: "diagnostic-note",
    title: "Retrieval diagnostics",
    body: "Inspect freshness windows, source classifications, and citation minimums when a run produces weak grounding.",
    tenantId: "tenant-platform",
    classification: "internal",
    createdAt: "2026-04-18T07:00:00.000Z",
    updatedAt: "2026-04-18T09:20:00.000Z",
    tags: ["retrieval", "diagnostics"]
  })
]);

export const chunkFixtures = Object.freeze(
  documentFixtures.flatMap((document) => chunkMemoryDocument(document, { chunkSize: 18, overlap: 4 }))
);

export const retrievalFixture = Object.freeze(
  retrieveMemory({
    collections: [...memoryCollectionsFixture],
    documents: [...documentFixtures],
    chunks: [...chunkFixtures],
    query: {
      tenantId: "tenant-platform",
      text: "finance approval replay metadata",
      collectionIds: ["memory-collection:kb", "memory-collection:ops"],
      topK: 3,
      policy: defineMemoryPolicy({
        tenantScoped: true,
        requiredCitationCount: 1,
        allowedClassifications: ["internal", "restricted"],
        allowedSourceKinds: ["knowledge-article", "diagnostic-note"]
      }),
      now: "2026-04-18T12:00:00.000Z"
    }
  })
);

export function ingestMemoryDocument(input: IngestMemoryDocumentInput): {
  ok: true;
  chunkCount: number;
  collectionId: string;
} {
  normalizeActionInput(input);
  const document = defineMemoryDocument({
    id: `memory-document:${input.sourceObjectId}`,
    collectionId: input.collectionId,
    sourcePlugin: "ai-rag",
    sourceObjectId: input.sourceObjectId,
    sourceKind: input.sourceKind,
    title: input.title,
    body: input.body,
    tenantId: input.tenantId,
    classification: input.classification,
    createdAt: "2026-04-19T10:00:00.000Z",
    updatedAt: "2026-04-19T10:00:00.000Z"
  });

  const chunks = chunkMemoryDocument(document, {
    chunkSize: 24,
    overlap: 6
  });

  return {
    ok: true,
    chunkCount: chunks.length,
    collectionId: input.collectionId
  };
}

export function retrieveTenantKnowledge(input: RetrievalRequestInput): {
  ok: true;
  citationCount: number;
  chunkIds: string[];
} {
  normalizeActionInput(input);
  const retrieval = retrieveMemory({
    collections: [...memoryCollectionsFixture],
    documents: [...documentFixtures],
    chunks: [...chunkFixtures],
    query: {
      tenantId: input.tenantId,
      text: input.query,
      collectionIds: input.collectionIds,
      topK: input.topK ?? 3,
      policy: defineMemoryPolicy({
        tenantScoped: true,
        requiredCitationCount: 1,
        allowedClassifications: ["internal", "restricted"],
        allowedSourceKinds: ["knowledge-article", "diagnostic-note"]
      }),
      now: "2026-04-18T12:00:00.000Z"
    }
  });

  return {
    ok: true,
    citationCount: retrieval.citations.length,
    chunkIds: retrieval.chunks.map((chunk) => chunk.id)
  };
}

export function reindexMemoryCollection(input: ReindexMemoryCollectionInput): {
  ok: true;
  queuedDocuments: number;
} {
  normalizeActionInput(input);
  return {
    ok: true,
    queuedDocuments: documentFixtures.filter((document) => document.collectionId === input.collectionId).length
  };
}
