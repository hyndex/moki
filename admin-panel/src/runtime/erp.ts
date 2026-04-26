import type { ErpDocumentMappingAction } from "@/contracts/erp-metadata";
import { apiFetch } from "./auth";

export interface MapDocumentInput {
  sourceResource: string;
  sourceId: string;
  statusField?: string;
  action: ErpDocumentMappingAction;
  idempotencyKey?: string;
  targetId?: string;
  defaults?: Record<string, unknown>;
}

export interface MapDocumentResult {
  mapping: {
    id: string;
    sourceResource: string;
    sourceId: string;
    actionId: string;
    relation: string;
    targetResource: string;
    targetId: string;
    status: string;
    createdAt: string;
  };
  target: Record<string, unknown>;
  reused: boolean;
}

export type ErpPostingEngine = "accounting" | "stock" | "custom";

export interface PostingEntryInput {
  account?: string;
  item?: string;
  warehouse?: string;
  debit?: number;
  credit?: number;
  quantity?: number;
  valuationRate?: number;
  amount?: number;
  currency?: string;
  payload?: Record<string, unknown>;
}

export interface PostingInput {
  engine: ErpPostingEngine;
  voucherResource: string;
  voucherId: string;
  idempotencyKey?: string;
  postingDate?: string;
  entries: PostingEntryInput[];
  payload?: Record<string, unknown>;
}

export interface PostingBatchResult {
  batch: {
    id: string;
    tenantId: string;
    engine: ErpPostingEngine;
    voucherResource: string;
    voucherId: string;
    status: string;
    idempotencyKey: string;
    payload: Record<string, unknown> | null;
    createdBy: string;
    createdAt: string;
  };
  reused?: boolean;
  entries?: PostingEntryInput[];
  imbalance?: { currency: string; debit: number; credit: number; delta: number }[];
}

export interface WorkflowTransitionInput {
  resource: string;
  recordId: string;
  stateField: string;
  from: string;
  to: string;
  reason?: string;
}

export interface DocumentLifecycleInput {
  resource: string;
  recordId: string;
  reason?: string;
  idempotencyKey?: string;
}

export interface ReconciliationInput extends DocumentLifecycleInput {
  reconciliationKey?: string;
  matchedRecordIds?: string[];
}

export interface RelatedPostingEntry {
  id: string;
  batchId: string;
  engine: ErpPostingEngine;
  account: string | null;
  item: string | null;
  warehouse: string | null;
  debit: number;
  credit: number;
  quantity: number;
  valuationRate: number;
  amount: number;
  currency: string | null;
  postingDate: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface ErpReportRunInput {
  reportId: "general-ledger" | "stock-ledger" | "trial-balance" | string;
  resource?: string;
  recordId?: string;
}

export interface ErpReportRunResult {
  id: string;
  columns: { field: string; label: string; fieldtype: string }[];
  rows: Record<string, unknown>[];
  totals?: Record<string, number>;
}

export interface RelatedErpDocument {
  id: string;
  sourceResource: string;
  sourceId: string;
  actionId: string;
  relation: string;
  targetResource: string;
  targetId: string;
  status: string;
  createdAt: string;
}

export interface PrintDocumentResult {
  title: string;
  resource: string;
  recordId: string;
  formatId: string;
  audience: string;
  generatedAt: string;
  summary: Record<string, unknown>;
  fields: { key: string; label: string; value: string }[];
  childTables: {
    key: string;
    label: string;
    columns: string[];
    rows: Record<string, string>[];
    truncated: boolean;
  }[];
  html: string;
}

export interface CreatePortalLinkInput {
  resource: string;
  recordId: string;
  audience?: "customer" | "supplier" | "employee" | "partner" | "public";
  formatId?: string;
  title?: string;
  expiresAt?: string;
}

export interface CreatePortalLinkResult {
  id: string;
  token: string;
  url: string;
  audience: string;
  formatId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export class ErpClient {
  mapDocument(input: MapDocumentInput): Promise<MapDocumentResult> {
    return apiFetch<MapDocumentResult>("/erp/actions/map-document", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  previewPosting(input: PostingInput): Promise<PostingBatchResult> {
    return apiFetch<PostingBatchResult>("/erp/actions/postings/preview", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  postEntries(input: PostingInput): Promise<PostingBatchResult> {
    return apiFetch<PostingBatchResult>("/erp/actions/postings", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  transitionWorkflow(input: WorkflowTransitionInput): Promise<{ record: Record<string, unknown> }> {
    return apiFetch<{ record: Record<string, unknown> }>("/erp/actions/transition", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  cancelDocument(input: DocumentLifecycleInput): Promise<{ record: Record<string, unknown> }> {
    return apiFetch<{ record: Record<string, unknown> }>("/erp/actions/cancel", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  reverseDocument(input: DocumentLifecycleInput): Promise<PostingBatchResult> {
    return apiFetch<PostingBatchResult>("/erp/actions/reverse", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  reconcileDocument(input: ReconciliationInput): Promise<{ record: Record<string, unknown> }> {
    return apiFetch<{ record: Record<string, unknown> }>("/erp/actions/reconcile", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  relatedLedger(resource: string, id: string): Promise<{ rows: RelatedPostingEntry[] }> {
    return apiFetch<{ rows: RelatedPostingEntry[] }>(
      `/erp/ledger/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    );
  }

  relatedStock(resource: string, id: string): Promise<{ rows: RelatedPostingEntry[] }> {
    return apiFetch<{ rows: RelatedPostingEntry[] }>(
      `/erp/stock/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    );
  }

  runReport(input: ErpReportRunInput): Promise<ErpReportRunResult> {
    const qs = new URLSearchParams();
    if (input.resource) qs.set("resource", input.resource);
    if (input.recordId) qs.set("recordId", input.recordId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<ErpReportRunResult>(`/erp/reports/${encodeURIComponent(input.reportId)}${suffix}`);
  }

  listRelated(resource: string, id: string): Promise<{ rows: RelatedErpDocument[] }> {
    return apiFetch<{ rows: RelatedErpDocument[] }>(
      `/erp/related/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    );
  }

  renderPrint(resource: string, id: string, formatId = "standard"): Promise<PrintDocumentResult> {
    const qs = new URLSearchParams({ format: formatId });
    return apiFetch<PrintDocumentResult>(
      `/erp/print/${encodeURIComponent(resource)}/${encodeURIComponent(id)}?${qs.toString()}`,
    );
  }

  createPortalLink(input: CreatePortalLinkInput): Promise<CreatePortalLinkResult> {
    return apiFetch<CreatePortalLinkResult>("/erp/portal-links", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  revokePortalLink(id: string): Promise<{ ok: true; revokedAt: string }> {
    return apiFetch<{ ok: true; revokedAt: string }>(
      `/erp/portal-links/${encodeURIComponent(id)}/revoke`,
      { method: "POST" },
    );
  }
}
