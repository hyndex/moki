export const packageId = "schema" as const;
export const packageDisplayName = "Schema" as const;
export const packageDescription = "Resource, action, and contract DSLs with semantic metadata for runtime and agent understanding." as const;

export * from "./action";
export * from "./resource";
export * from "./utils";
