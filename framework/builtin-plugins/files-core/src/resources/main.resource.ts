import { defineResource } from "@platform/schema";
import { z } from "zod";
import { domainRecords } from "../../db/schema";

export const FileAssetResource = defineResource({
  id: "files.assets",
  table: domainRecords,
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    fileName: z.string().min(1),
    objectKey: z.string().min(3),
    storageAdapter: z.enum(["local", "s3"]),
    contentType: z.string().min(3),
    bytes: z.number().int().nonnegative(),
    visibility: z.enum(["private", "tenant-shared", "public"]),
    checksum: z.string().min(8),
    malwareStatus: z.enum(["pending", "clean", "blocked"]),
    status: z.enum(["quarantined", "ready", "archived"]),
    createdAt: z.string()
  }),
  fields: {
    bytes: { filter: "number", label: "Bytes" },
    contentType: { searchable: true, sortable: true, label: "Content Type" },
    createdAt: { sortable: true, label: "Created" },
    fileName: { searchable: true, sortable: true, label: "File Name" },
    malwareStatus: { filter: "select", label: "Malware" },
    status: { filter: "select", label: "Status" },
    visibility: { filter: "select", label: "Visibility" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["fileName", "contentType", "visibility", "malwareStatus", "status", "createdAt"]
  },
  portal: { enabled: false }
});
