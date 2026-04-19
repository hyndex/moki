import { defineResource } from "@platform/schema";
import { z } from "zod";
import { domainRecords } from "../../db/schema";

export const IdentityResource = defineResource({
  id: "auth.identities",
  table: domainRecords,
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().min(2),
    authProvider: z.enum(["password", "oidc", "saml"]),
    status: z.enum(["invited", "active", "suspended"]),
    lastAuthenticatedAt: z.string().nullable(),
    createdAt: z.string()
  }),
  fields: {
    email: { searchable: true, sortable: true, label: "Email" },
    displayName: { searchable: true, sortable: true, label: "Display Name" },
    authProvider: { filter: "select", label: "Provider" },
    status: { filter: "select", label: "Status" },
    createdAt: { sortable: true, label: "Created" }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["displayName", "email", "authProvider", "status", "createdAt"]
  },
  portal: { enabled: false }
});
