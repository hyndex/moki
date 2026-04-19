import { defineResource } from "@platform/schema";
import { z } from "zod";

import { memoryCollections, memoryDocuments } from "../../db/schema";

export const MemoryCollectionResource = defineResource({
  id: "ai.memory-collections",
  table: memoryCollections,
  contract: z.object({
    id: z.string().min(2),
    tenantId: z.string().min(2).nullable(),
    label: z.string().min(2),
    classification: z.enum(["public", "internal", "restricted", "confidential"]),
    sourcePlugin: z.string().min(2),
    documentCount: z.number().int().nonnegative(),
    updatedAt: z.string()
  }),
  fields: {
    label: { searchable: true, sortable: true, label: "Label" },
    classification: { filter: "select", label: "Classification" },
    sourcePlugin: { searchable: true, sortable: true, label: "Source" },
    documentCount: { sortable: true, filter: "number", label: "Documents" },
    updatedAt: { sortable: true, label: "Updated" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["label", "classification", "sourcePlugin", "documentCount", "updatedAt"]
  },
  portal: { enabled: false },
  ai: {
    curatedReadModel: true,
    purpose: "Approved collections available for retrieval-grounded agent execution.",
    citationLabelField: "label",
    allowedFields: ["label", "classification", "sourcePlugin", "documentCount", "updatedAt"]
  }
});

export const MemoryDocumentResource = defineResource({
  id: "ai.memory-documents",
  table: memoryDocuments,
  contract: z.object({
    id: z.string().min(2),
    tenantId: z.string().min(2).nullable(),
    collectionId: z.string().min(2),
    title: z.string().min(2),
    sourceKind: z.string().min(2),
    classification: z.enum(["public", "internal", "restricted", "confidential"]),
    updatedAt: z.string()
  }),
  fields: {
    title: { searchable: true, sortable: true, label: "Title" },
    sourceKind: { filter: "select", label: "Source kind" },
    classification: { filter: "select", label: "Classification" },
    updatedAt: { sortable: true, label: "Updated" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["title", "sourceKind", "classification", "updatedAt"]
  },
  portal: { enabled: false },
  ai: {
    curatedReadModel: true,
    purpose: "Grounding documents that can be chunked, cited, and reindexed for agents.",
    citationLabelField: "title",
    allowedFields: ["title", "sourceKind", "classification", "updatedAt"]
  }
});

export const aiRagResources = [MemoryCollectionResource, MemoryDocumentResource] as const;
