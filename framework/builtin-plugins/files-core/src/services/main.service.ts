import { normalizeActionInput } from "@platform/schema";

export type DomainActionInput = {
  assetId: string;
  tenantId: string;
  fileName: string;
  objectKey: string;
  storageAdapter: "local" | "s3";
  contentType: string;
  bytes: number;
  visibility: "private" | "tenant-shared" | "public";
  checksum: string;
  uploadedBy: "staff" | "portal-user" | "connector";
  reason?: string | undefined;
};

const dangerousContentTypes = new Set(["application/x-msdownload", "application/x-sh", "application/x-dosexec"]);

export function registerFileAsset(input: DomainActionInput): {
  ok: true;
  nextStatus: "quarantined" | "ready";
  malwareStatus: "pending" | "clean";
  secretRefs: string[];
  downloadPolicy: "blocked" | "signed-url" | "direct";
} {
  normalizeActionInput(input);
  if (input.objectKey.includes("..")) {
    throw new Error("object keys must be normalized and may not traverse parent segments");
  }

  const normalizedContentType = input.contentType.toLowerCase();
  const requiresQuarantine =
    dangerousContentTypes.has(normalizedContentType) ||
    (input.visibility === "public" && input.uploadedBy === "portal-user");
  const nextStatus = requiresQuarantine ? "quarantined" : "ready";
  const malwareStatus = requiresQuarantine ? "pending" : "clean";
  const secretRefs = input.storageAdapter === "s3" ? ["S3_STORAGE_SIGNING_KEY"] : [];
  const downloadPolicy = requiresQuarantine ? "blocked" : input.visibility === "public" ? "direct" : "signed-url";

  return { ok: true, nextStatus, malwareStatus, secretRefs, downloadPolicy };
}
