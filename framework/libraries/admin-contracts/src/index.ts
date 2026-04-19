export const packageId = "admin-contracts" as const;
export const packageDisplayName = "Admin Contracts" as const;
export const packageDescription = "Governed admin-desk contracts, registries, access helpers, and legacy adapters." as const;

export * from "./access";
export * from "./legacy";
export * from "./registry";
export * from "./types";
