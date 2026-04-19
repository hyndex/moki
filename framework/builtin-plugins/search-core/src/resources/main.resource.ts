import { defineResource } from "@platform/schema";
import { z } from "zod";
import { domainRecords } from "../../db/schema";

export const SearchDocumentResource = defineResource({
  id: "search.documents",
  table: domainRecords,
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    label: z.string().min(2).describe("SearchDocument label"),
    status: z.enum(["draft", "active", "inactive"]),
    createdAt: z.string()
  }),
  fields: {
    label: { searchable: true, sortable: true, label: "Label" },
    status: { filter: "select", label: "Status" },
    createdAt: { sortable: true, label: "Created" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["label", "status", "createdAt"]
  },
  portal: { enabled: false }
});