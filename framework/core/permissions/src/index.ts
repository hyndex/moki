export const packageId = "permissions" as const;
export const packageDisplayName = "Permissions" as const;
export const packageDescription =
  "Permission evaluation, install review planning, capability diffs, and policy enforcement helpers." as const;

export * from "./capabilities";
export * from "./errors";
export * from "./policy";
export * from "./review";
