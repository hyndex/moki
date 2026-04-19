import { defineAction } from "@platform/schema";
import { z } from "zod";
import { registerFileAsset } from "../services/main.service";

export const registerFileAssetAction = defineAction({
  id: "files.assets.register",
  input: z.object({
    assetId: z.string().uuid(),
    tenantId: z.string().uuid(),
    fileName: z.string().min(1),
    objectKey: z.string().min(3),
    storageAdapter: z.enum(["local", "s3"]),
    contentType: z.string().min(3),
    bytes: z.number().int().positive(),
    visibility: z.enum(["private", "tenant-shared", "public"]),
    checksum: z.string().min(8),
    uploadedBy: z.enum(["staff", "portal-user", "connector"]),
    reason: z.string().min(3).optional()
  }),
  output: z.object({
    ok: z.literal(true),
    nextStatus: z.enum(["quarantined", "ready"]),
    malwareStatus: z.enum(["pending", "clean"]),
    secretRefs: z.array(z.string()),
    downloadPolicy: z.enum(["blocked", "signed-url", "direct"])
  }),
  permission: "files.assets.register",
  idempotent: true,
  audit: true,
  handler: ({ input }) => registerFileAsset(input)
});
