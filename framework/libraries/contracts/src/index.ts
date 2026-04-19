export const packageId = "contracts" as const;
export const packageDisplayName = "Contracts" as const;
export const packageDescription = "Canonical public contract surface for admin plugins." as const;

export * from "@platform/admin-contracts";
export * from "@platform/kernel";
export * from "@platform/schema";
export { z } from "zod";
