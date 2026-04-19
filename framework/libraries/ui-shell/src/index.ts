export const packageId = "ui-shell" as const;
export const packageDisplayName = "UI Shell" as const;
export const packageDescription = "Shared shell registry, navigation, provider, and telemetry contracts." as const;

export * from "./registry";
export * from "./shells";
export * from "./navigation";
export * from "./providers";
export * from "./telemetry";
export * from "./types";
