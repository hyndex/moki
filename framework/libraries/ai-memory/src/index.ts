import { tokenizeSearchQuery } from "@platform/search";

export const packageId = "ai-memory" as const;
export const packageDisplayName = "AI Memory" as const;
export const packageDescription = "Tenant-safe memory collections, chunking, retrieval, and citation contracts." as const;

export type MemoryClassification = "public" | "internal" | "restricted" | "confidential";

export type MemoryPolicy = {
  tenantScoped: boolean;
  allowedCollectionIds?: string[] | undefined;
  requiredCollectionIds?: string[] | undefined;
  freshnessWindowMs?: number | undefined;
  requiredCitationCount?: number | undefined;
  allowedSourceKinds?: string[] | undefined;
  allowedClassifications?: MemoryClassification[] | undefined;
};

export type MemoryCollection = {
  id: string;
  label: string;
  policyScope: "tenant" | "package" | "global";
  sourcePlugin: string;
  tenantId?: string | undefined;
  classification: MemoryClassification;
  metadata?: Record<string, unknown> | undefined;
};

export type MemoryDocument = {
  id: string;
  collectionId: string;
  sourcePlugin: string;
  sourceObjectId: string;
  sourceKind: string;
  title: string;
  body: string;
  tenantId?: string | undefined;
  classification: MemoryClassification;
  createdAt: string;
  updatedAt: string;
  tags?: string[] | undefined;
};

export type MemoryChunk = {
  id: string;
  documentId: string;
  collectionId: string;
  sourcePlugin: string;
  sourceObjectId: string;
  sourceKind: string;
  ordinal: number;
  text: string;
  tokenCount: number;
  createdAt: string;
  tenantId?: string | undefined;
  classification: MemoryClassification;
};

export type RetrievalQuery = {
  tenantId?: string | undefined;
  text: string;
  collectionIds?: string[] | undefined;
  topK?: number | undefined;
  policy?: MemoryPolicy | undefined;
  now?: string | Date | undefined;
};

export type RetrievalPlan = {
  tenantId?: string | undefined;
  collectionIds: string[];
  tokens: string[];
  topK: number;
  policy: MemoryPolicy;
  freshnessCutoff?: string | undefined;
};

export type Citation = {
  chunkId: string;
  documentId: string;
  collectionId: string;
  sourcePlugin: string;
  sourceObjectId: string;
  excerpt: string;
  score: number;
  confidence: number;
};

export type RetrievalResult = {
  query: string;
  plan: RetrievalPlan;
  chunks: MemoryChunk[];
  citations: Citation[];
};

export class MemoryAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryAccessError";
  }
}

export function defineMemoryCollection(collection: MemoryCollection): MemoryCollection {
  return Object.freeze({
    ...collection,
    ...(collection.metadata ? { metadata: { ...collection.metadata } } : {})
  });
}

export function defineMemoryDocument(document: MemoryDocument): MemoryDocument {
  return Object.freeze({
    ...document,
    tags: [...(document.tags ?? [])].sort((left, right) => left.localeCompare(right))
  });
}

export function defineMemoryPolicy(policy: MemoryPolicy): MemoryPolicy {
  return Object.freeze({
    ...policy,
    ...(policy.allowedCollectionIds ? { allowedCollectionIds: [...policy.allowedCollectionIds].sort((left, right) => left.localeCompare(right)) } : {}),
    ...(policy.requiredCollectionIds ? { requiredCollectionIds: [...policy.requiredCollectionIds].sort((left, right) => left.localeCompare(right)) } : {}),
    ...(policy.allowedSourceKinds ? { allowedSourceKinds: [...policy.allowedSourceKinds].sort((left, right) => left.localeCompare(right)) } : {}),
    ...(policy.allowedClassifications ? { allowedClassifications: [...policy.allowedClassifications] } : {})
  });
}

export function chunkMemoryDocument(
  document: MemoryDocument,
  options: {
    chunkSize?: number | undefined;
    overlap?: number | undefined;
    createdAt?: string | Date | undefined;
  } = {}
): MemoryChunk[] {
  const chunkSize = Math.max(options.chunkSize ?? 120, 20);
  const overlap = Math.max(Math.min(options.overlap ?? 24, chunkSize - 1), 0);
  const tokens = document.body.split(/\s+/).filter(Boolean);
  const chunks: MemoryChunk[] = [];
  let cursor = 0;
  let ordinal = 0;
  const createdAt = normalizeTimestamp(options.createdAt ?? document.updatedAt);

  while (cursor < tokens.length) {
    const slice = tokens.slice(cursor, cursor + chunkSize);
    if (slice.length === 0) {
      break;
    }

    chunks.push({
      id: `${document.id}:chunk:${ordinal}`,
      documentId: document.id,
      collectionId: document.collectionId,
      sourcePlugin: document.sourcePlugin,
      sourceObjectId: document.sourceObjectId,
      sourceKind: document.sourceKind,
      ordinal,
      text: slice.join(" "),
      tokenCount: slice.length,
      createdAt,
      ...(document.tenantId ? { tenantId: document.tenantId } : {}),
      classification: document.classification
    });

    ordinal += 1;
    cursor += Math.max(chunkSize - overlap, 1);
  }

  return chunks;
}

export function buildRetrievalPlan(query: RetrievalQuery, collections: MemoryCollection[]): RetrievalPlan {
  const policy = defineMemoryPolicy(
    query.policy ?? {
      tenantScoped: true,
      requiredCitationCount: 1
    }
  );
  const collectionIds = collections
    .filter((collection) => collectionMatchesPolicy(collection, query.tenantId, policy))
    .filter((collection) => !query.collectionIds || query.collectionIds.includes(collection.id))
    .map((collection) => collection.id)
    .sort((left, right) => left.localeCompare(right));

  if (policy.requiredCollectionIds?.some((requiredCollectionId) => !collectionIds.includes(requiredCollectionId))) {
    throw new MemoryAccessError("retrieval plan is missing required collections");
  }

  return Object.freeze({
    ...(query.tenantId ? { tenantId: query.tenantId } : {}),
    collectionIds,
    tokens: tokenizeSearchQuery(query.text),
    topK: Math.max(1, Math.min(query.topK ?? 5, 25)),
    policy,
    ...(policy.freshnessWindowMs !== undefined ? { freshnessCutoff: new Date(resolveNow(query.now) - policy.freshnessWindowMs).toISOString() } : {})
  });
}

export function retrieveMemory(input: {
  collections: MemoryCollection[];
  documents: MemoryDocument[];
  chunks: MemoryChunk[];
  query: RetrievalQuery;
}): RetrievalResult {
  const plan = buildRetrievalPlan(input.query, input.collections);
  const collectionById = new Map(input.collections.map((collection) => [collection.id, collection]));
  const documentById = new Map(input.documents.map((document) => [document.id, document]));

  const scoredChunks = input.chunks
    .filter((chunk) => plan.collectionIds.includes(chunk.collectionId))
    .filter((chunk) => chunkMatchesPolicy(chunk, plan))
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk.text, plan.tokens)
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.chunk.id.localeCompare(right.chunk.id))
    .slice(0, plan.topK);

  const citations = scoredChunks.map(({ chunk, score }) => {
    const document = documentById.get(chunk.documentId);
    const collection = collectionById.get(chunk.collectionId);

    return {
      chunkId: chunk.id,
      documentId: chunk.documentId,
      collectionId: chunk.collectionId,
      sourcePlugin: chunk.sourcePlugin,
      sourceObjectId: chunk.sourceObjectId,
      excerpt: summarizeExcerpt(chunk.text, plan.tokens),
      score,
      confidence: Number(Math.min(1, score / Math.max(plan.tokens.length * 3, 1)).toFixed(3)),
      ...(document && collection ? {} : {})
    } satisfies Citation;
  });

  if ((plan.policy.requiredCitationCount ?? 0) > citations.length) {
    throw new MemoryAccessError("retrieval result does not satisfy the citation minimum");
  }

  return Object.freeze({
    query: input.query.text,
    plan,
    chunks: scoredChunks.map(({ chunk }) => chunk),
    citations
  });
}

export function assertMemoryAccess(collection: MemoryCollection, tenantId: string | undefined, policy: MemoryPolicy): void {
  if (!collectionMatchesPolicy(collection, tenantId, policy)) {
    throw new MemoryAccessError(`collection '${collection.id}' is not allowed by policy`);
  }
}

function collectionMatchesPolicy(collection: MemoryCollection, tenantId: string | undefined, policy: MemoryPolicy): boolean {
  if (policy.tenantScoped && tenantId && collection.tenantId && collection.tenantId !== tenantId) {
    return false;
  }
  if (policy.allowedCollectionIds && !policy.allowedCollectionIds.includes(collection.id)) {
    return false;
  }
  if (policy.allowedClassifications && !policy.allowedClassifications.includes(collection.classification)) {
    return false;
  }
  return true;
}

function chunkMatchesPolicy(chunk: MemoryChunk, plan: RetrievalPlan): boolean {
  if (plan.policy.tenantScoped && plan.tenantId && chunk.tenantId && chunk.tenantId !== plan.tenantId) {
    return false;
  }
  if (plan.policy.allowedClassifications && !plan.policy.allowedClassifications.includes(chunk.classification)) {
    return false;
  }
  if (plan.policy.allowedSourceKinds && !plan.policy.allowedSourceKinds.includes(chunk.sourceKind)) {
    return false;
  }
  if (plan.freshnessCutoff && Date.parse(chunk.createdAt) < Date.parse(plan.freshnessCutoff)) {
    return false;
  }
  return true;
}

function scoreChunk(text: string, tokens: string[]): number {
  const normalized = text.toLowerCase();
  return tokens.reduce((score, token) => {
    const occurrences = normalized.split(token.toLowerCase()).length - 1;
    return score + occurrences * 2 + (normalized.includes(token.toLowerCase()) ? 1 : 0);
  }, 0);
}

function summarizeExcerpt(text: string, tokens: string[]): string {
  const lowered = text.toLowerCase();
  const firstMatch = tokens.map((token) => lowered.indexOf(token.toLowerCase())).find((index) => index >= 0) ?? 0;
  const start = Math.max(firstMatch - 40, 0);
  const end = Math.min(firstMatch + 120, text.length);
  return text.slice(start, end).trim();
}

function resolveNow(now?: string | Date): number {
  if (!now) {
    return Date.now();
  }
  return typeof now === "string" ? Date.parse(now) : now.getTime();
}

function normalizeTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
