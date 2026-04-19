import { ValidationError } from "@platform/kernel";
import { defineZone, type ZoneDefinition } from "@platform/ui-shell";

export const packageId = "ui-zone-next" as const;
export const packageDisplayName = "UI Zone Next" as const;
export const packageDescription = "Next.js product zone adapter." as const;

export function createNextZone(input: {
  id: string;
  mountPath: string;
  assetPrefix?: string;
  routeOwnership?: string[];
  deepLinks?: string[];
  telemetryNamespace?: string;
}): ZoneDefinition {
  if (!input.mountPath.startsWith("/")) {
    throw new ValidationError("zone mount paths must start with '/'", [
      {
        code: "ui-zone-next-mount",
        message: "mountPath must start with '/'",
        path: "mountPath"
      }
    ]);
  }

  return defineZone({
    id: input.id,
    adapter: "nextjs",
    mountPath: input.mountPath,
    assetPrefix: input.assetPrefix ?? `${input.mountPath}/_next`,
    authMode: "platform-session",
    telemetryNamespace: input.telemetryNamespace ?? input.id,
    deepLinks: input.deepLinks ?? [input.mountPath],
    routeOwnership: input.routeOwnership ?? [input.mountPath]
  });
}
