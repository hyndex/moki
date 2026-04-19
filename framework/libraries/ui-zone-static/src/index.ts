import { ValidationError } from "@platform/kernel";
import { defineZone, type ZoneDefinition } from "@platform/ui-shell";

export const packageId = "ui-zone-static" as const;
export const packageDisplayName = "UI Zone Static" as const;
export const packageDescription = "Static React zone adapter." as const;

export function createStaticZone(input: {
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
        code: "ui-zone-static-mount",
        message: "mountPath must start with '/'",
        path: "mountPath"
      }
    ]);
  }

  return defineZone({
    id: input.id,
    adapter: "static-react",
    mountPath: input.mountPath,
    assetPrefix: input.assetPrefix ?? `${input.mountPath}/assets`,
    authMode: "platform-session",
    telemetryNamespace: input.telemetryNamespace ?? input.id,
    deepLinks: input.deepLinks ?? [input.mountPath],
    routeOwnership: input.routeOwnership ?? [input.mountPath]
  });
}
