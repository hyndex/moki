export const packageId = "kernel" as const;
export const packageDisplayName = "Kernel" as const;
export const packageDescription = "Platform kernel, manifest DSLs, registries, validation, and package contracts." as const;

export * from "./errors";
export * from "./manifest";
export * from "./registry";
export * from "./types";
