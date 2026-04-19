import type { NavigationTarget, PermissionIntrospector, ShellNavigationContract, UiRegistry, ZoneDefinition } from "./types";

export function listDeepLinks(registry: UiRegistry): string[] {
  const links = [
    ...registry.embeddedPages.map((entry) => normalizeHref(entry.route)),
    ...registry.zones.flatMap((zone) => zone.deepLinks.map((link) => normalizeHref(link)))
  ];
  return [...new Set(links)].sort((left, right) => left.localeCompare(right));
}

export function resolveNavigationTarget(registry: UiRegistry, href: string): NavigationTarget | undefined {
  const normalizedHref = normalizeHref(href);
  const embeddedPage = registry.embeddedPages.find((entry) => normalizeHref(entry.route) === normalizedHref);
  if (embeddedPage) {
    return {
      kind: "embedded-page",
      href: normalizedHref,
      sourceId: embeddedPage.route,
      shell: embeddedPage.shell,
      permission: embeddedPage.permission
    };
  }

  const zone = findMatchingZone(registry.zones, normalizedHref);
  if (!zone) {
    return undefined;
  }

  return {
    kind: "zone",
    href: normalizedHref,
    sourceId: zone.id,
    telemetryNamespace: zone.telemetryNamespace,
    authMode: zone.authMode
  };
}

export function createNavigationContract(
  registry: UiRegistry,
  permissions?: Pick<PermissionIntrospector, "has">
): ShellNavigationContract {
  const deepLinks = listDeepLinks(registry);
  return {
    deepLinks,
    resolve(href) {
      const target = resolveNavigationTarget(registry, href);
      if (!target) {
        return undefined;
      }

      if (target.permission && permissions && !permissions.has(target.permission)) {
        return undefined;
      }

      return target;
    }
  };
}

function findMatchingZone(zones: ZoneDefinition[], href: string): ZoneDefinition | undefined {
  const exactMatch = zones.find(
    (zone) =>
      normalizeHref(zone.mountPath) === href || zone.deepLinks.some((link) => normalizeHref(link) === href)
  );
  if (exactMatch) {
    return exactMatch;
  }

  return zones.find((zone) => matchesZone(zone, href));
}

function matchesZone(zone: ZoneDefinition, href: string): boolean {
  if (isPathPrefixMatch(zone.mountPath, href)) {
    return true;
  }

  return zone.routeOwnership.some((pattern) => matchesRoutePattern(pattern, href));
}

function matchesRoutePattern(pattern: string, href: string): boolean {
  const normalizedPattern = normalizeHref(pattern);
  if (normalizedPattern.endsWith("/*")) {
    return isPathPrefixMatch(normalizedPattern.slice(0, -2), href);
  }
  if (normalizedPattern.endsWith("*")) {
    return href.startsWith(normalizedPattern.slice(0, -1));
  }
  return normalizedPattern === href;
}

function isPathPrefixMatch(prefix: string, href: string): boolean {
  const normalizedPrefix = normalizeHref(prefix);
  return href === normalizedPrefix || href.startsWith(`${normalizedPrefix}/`);
}

function normalizeHref(input: string): string {
  const [path] = input.split(/[?#]/);
  if (!path || path === "/") {
    return "/";
  }
  return path.endsWith("/") ? path.slice(0, -1) : path;
}
