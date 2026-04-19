import { describe, expect, it } from "bun:test";

import {
  buildRetrievalPlan,
  chunkMemoryDocument,
  defineMemoryCollection,
  defineMemoryDocument,
  packageId,
  retrieveMemory
} from "../../src";

describe("ai-memory", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ai-memory");
  });

  it("chunks documents and retrieves tenant-safe citations", () => {
    const collection = defineMemoryCollection({
      id: "crm-knowledge",
      label: "CRM Knowledge",
      policyScope: "tenant",
      sourcePlugin: "ai-rag",
      tenantId: "tenant-1",
      classification: "internal"
    });

    const document = defineMemoryDocument({
      id: "doc-1",
      collectionId: collection.id,
      sourcePlugin: "crm-core",
      sourceObjectId: "account-1",
      sourceKind: "crm.account.note",
      title: "Acme renewal plan",
      body: "Acme renewal is at risk because onboarding slipped. Success depends on a pricing concession and a support playbook.",
      tenantId: "tenant-1",
      classification: "internal",
      createdAt: "2026-04-19T00:00:00.000Z",
      updatedAt: "2026-04-19T00:00:00.000Z"
    });

    const chunks = chunkMemoryDocument(document, {
      chunkSize: 8,
      overlap: 2
    });

    const plan = buildRetrievalPlan(
      {
        tenantId: "tenant-1",
        text: "pricing concession playbook"
      },
      [collection]
    );

    expect(plan.collectionIds).toEqual(["crm-knowledge"]);

    const result = retrieveMemory({
      collections: [collection],
      documents: [document],
      chunks,
      query: {
        tenantId: "tenant-1",
        text: "pricing concession playbook",
        topK: 2
      }
    });

    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.citations[0]?.collectionId).toBe("crm-knowledge");
  });
});
