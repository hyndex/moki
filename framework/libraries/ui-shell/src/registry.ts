import type { UiRegistry, UiSurfaceDefinition, ZoneDefinition } from "./types";

export function defineUiSurface(definition: UiSurfaceDefinition): UiSurfaceDefinition {
  return Object.freeze({
    embeddedPages: [...definition.embeddedPages].sort((left, right) => left.route.localeCompare(right.route)),
    widgets: [...definition.widgets].sort((left, right) => left.slot.localeCompare(right.slot))
  });
}

export function defineZone(zone: ZoneDefinition): ZoneDefinition {
  return Object.freeze({
    ...zone,
    deepLinks: [...zone.deepLinks].sort((left, right) => left.localeCompare(right)),
    routeOwnership: [...zone.routeOwnership].sort((left, right) => left.localeCompare(right))
  });
}

export function createUiRegistry(): UiRegistry {
  return {
    embeddedPages: [],
    widgets: [],
    zones: []
  };
}

export function registerUiSurface(registry: UiRegistry, surface: UiSurfaceDefinition): UiRegistry {
  const nextRegistry = {
    ...registry,
    embeddedPages: [...registry.embeddedPages, ...surface.embeddedPages],
    widgets: [...registry.widgets, ...surface.widgets],
    zones: [...registry.zones]
  };
  validateUiRegistry(nextRegistry);
  return nextRegistry;
}

export function registerZone(registry: UiRegistry, zone: ZoneDefinition): UiRegistry {
  const nextRegistry = {
    ...registry,
    embeddedPages: [...registry.embeddedPages],
    widgets: [...registry.widgets],
    zones: [...registry.zones, zone]
  };
  validateUiRegistry(nextRegistry);
  return nextRegistry;
}

export function validateUiRegistry(registry: UiRegistry): void {
  const seenRoutes = new Set<string>();
  const seenWidgetSlots = new Set<string>();
  for (const entry of registry.embeddedPages) {
    if (seenRoutes.has(entry.route)) {
      throw new Error(`duplicate embedded route registration: ${entry.route}`);
    }
    seenRoutes.add(entry.route);
  }

  for (const widget of registry.widgets) {
    const widgetKey = `${widget.shell}:${widget.slot}`;
    if (seenWidgetSlots.has(widgetKey)) {
      throw new Error(`duplicate widget slot registration: ${widgetKey}`);
    }
    seenWidgetSlots.add(widgetKey);
  }

  const seenZoneMounts = new Set<string>();
  const seenAssetPrefixes = new Set<string>();
  const seenZoneIds = new Set<string>();
  const seenTelemetryNamespaces = new Set<string>();
  const seenRouteOwnership = new Set<string>();
  for (const zone of registry.zones) {
    if (seenZoneIds.has(zone.id)) {
      throw new Error(`duplicate zone id: ${zone.id}`);
    }
    if (seenZoneMounts.has(zone.mountPath)) {
      throw new Error(`duplicate zone mount path: ${zone.mountPath}`);
    }
    if (seenAssetPrefixes.has(zone.assetPrefix)) {
      throw new Error(`duplicate zone asset prefix: ${zone.assetPrefix}`);
    }
    if (seenTelemetryNamespaces.has(zone.telemetryNamespace)) {
      throw new Error(`duplicate zone telemetry namespace: ${zone.telemetryNamespace}`);
    }
    if (seenRoutes.has(zone.mountPath)) {
      throw new Error(`zone mount path collides with embedded route: ${zone.mountPath}`);
    }
    seenZoneIds.add(zone.id);
    seenZoneMounts.add(zone.mountPath);
    seenAssetPrefixes.add(zone.assetPrefix);
    seenTelemetryNamespaces.add(zone.telemetryNamespace);

    for (const routePattern of zone.routeOwnership) {
      if (seenRouteOwnership.has(routePattern)) {
        throw new Error(`duplicate zone route ownership: ${routePattern}`);
      }
      if (seenRoutes.has(routePattern)) {
        throw new Error(`zone route ownership collides with embedded route: ${routePattern}`);
      }
      seenRouteOwnership.add(routePattern);
    }
  }
}

export function listShellRoutes(registry: UiRegistry, shell: "admin" | "portal" | "site"): string[] {
  return registry.embeddedPages
    .filter((entry) => entry.shell === shell)
    .map((entry) => entry.route)
    .sort((left, right) => left.localeCompare(right));
}
