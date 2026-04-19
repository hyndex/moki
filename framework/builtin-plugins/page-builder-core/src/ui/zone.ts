import { defineZone } from "@platform/ui-shell";

export const pageBuilderZone = defineZone({
  id: "page-builder-zone",
  adapter: "ui-zone-static",
  mountPath: "/apps/page-builder",
  assetPrefix: "/_assets/plugins/page-builder",
  authMode: "platform-session",
  telemetryNamespace: "page.builder",
  deepLinks: ["/apps/page-builder", "/apps/page-builder/layouts"],
  routeOwnership: ["/apps/page-builder/*"]
});
