import type React from "react";

import { ValidationError } from "@platform/kernel";

export const packageId = "ui-router" as const;
export const packageDisplayName = "UI Router" as const;
export const packageDescription = "TanStack Router wrapper APIs." as const;

export type RouteLoaderData =
  | null
  | boolean
  | number
  | string
  | RouteLoaderData[]
  | { [key: string]: RouteLoaderData };

export type PlatformRouteDefinition<TSearch extends Record<string, unknown> = Record<string, never>> = {
  id: string;
  path: string;
  shell: "admin" | "portal" | "site";
  permission?: string;
  component?: React.ComponentType;
  validateSearch?: (search: unknown) => TSearch;
  loader?: (params: Record<string, string>, search: TSearch) => Promise<RouteLoaderData> | RouteLoaderData;
};

export type RouteManifest = {
  routes: PlatformRouteDefinition[];
};

export type DeepLinkContract = {
  routeId: string;
  href: string;
};

export type AdminRouteTaxonomy = {
  home: PlatformRouteDefinition;
  workspace: PlatformRouteDefinition<{ workspace?: string }>;
  resourceList: PlatformRouteDefinition;
  resourceDetail: PlatformRouteDefinition;
  resourceEdit: PlatformRouteDefinition;
  report: PlatformRouteDefinition;
  builder: PlatformRouteDefinition;
  zone: PlatformRouteDefinition;
};

export function defineRoute<TSearch extends Record<string, unknown> = Record<string, never>>(
  route: PlatformRouteDefinition<TSearch>
): PlatformRouteDefinition<TSearch> {
  if (!route.path.startsWith("/")) {
    throw new ValidationError(`Route '${route.id}' must start with '/'`, [
      {
        code: "ui-route-path",
        message: "route paths must start with '/'",
        path: "path"
      }
    ]);
  }

  return Object.freeze(route);
}

export function createRouteManifest(routes: PlatformRouteDefinition[]): RouteManifest {
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();

  for (const route of routes) {
    if (seenIds.has(route.id)) {
      throw new ValidationError(`Duplicate route id '${route.id}'`, [
        {
          code: "ui-route-id",
          message: `duplicate route id '${route.id}'`,
          path: "id"
        }
      ]);
    }
    if (seenPaths.has(route.path)) {
      throw new ValidationError(`Duplicate route path '${route.path}'`, [
        {
          code: "ui-route-path-duplicate",
          message: `duplicate route path '${route.path}'`,
          path: "path"
        }
      ]);
    }

    seenIds.add(route.id);
    seenPaths.add(route.path);
  }

  return Object.freeze({
    routes: [...routes].sort((left, right) => left.path.localeCompare(right.path))
  });
}

export function buildRouteHref<TSearch extends Record<string, unknown>>(
  route: PlatformRouteDefinition<TSearch>,
  options: {
    params?: Record<string, string | number>;
    search?: Record<string, string | number | boolean | undefined>;
  } = {}
): string {
  let href = route.path;
  for (const [key, value] of Object.entries(options.params ?? {})) {
    href = href.replace(`:${key}`, encodeURIComponent(String(value)));
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(options.search ?? {})) {
    if (value === undefined) {
      continue;
    }
    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `${href}?${queryString}` : href;
}

export function matchRoute(manifest: RouteManifest, pathname: string): PlatformRouteDefinition | undefined {
  const pathSegments = pathname.split("/").filter(Boolean);
  return manifest.routes.find((route) => {
    const routeSegments = route.path.split("/").filter(Boolean);
    if (routeSegments.length !== pathSegments.length) {
      return false;
    }
    return routeSegments.every((segment, index) => segment.startsWith(":") || segment === pathSegments[index]);
  });
}

export function extractRouteParams(route: PlatformRouteDefinition, pathname: string): Record<string, string> {
  const routeSegments = route.path.split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);

  if (routeSegments.length !== pathSegments.length) {
    throw new ValidationError(`Path '${pathname}' does not match route '${route.id}'`, [
      {
        code: "ui-route-match",
        message: "path does not match route shape",
        path: "pathname"
      }
    ]);
  }

  const params: Record<string, string> = {};
  for (const [index, segment] of routeSegments.entries()) {
    if (!segment.startsWith(":")) {
      continue;
    }
    params[segment.slice(1)] = decodeURIComponent(pathSegments[index] ?? "");
  }
  return params;
}

export function createDeepLink<TSearch extends Record<string, unknown>>(
  route: PlatformRouteDefinition<TSearch>,
  options?: Parameters<typeof buildRouteHref>[1]
): DeepLinkContract {
  return {
    routeId: route.id,
    href: buildRouteHref(route, options)
  };
}

export function createAdminRouteTaxonomy(domain: string, resource: string): AdminRouteTaxonomy {
  return {
    home: defineRoute({
      id: "admin.home",
      path: "/admin",
      shell: "admin"
    }),
    workspace: defineRoute({
      id: "admin.workspace",
      path: "/admin/workspace/:workspace",
      shell: "admin"
    }),
    resourceList: defineRoute({
      id: `${domain}.${resource}.list`,
      path: `/admin/${domain}/${resource}`,
      shell: "admin"
    }),
    resourceDetail: defineRoute({
      id: `${domain}.${resource}.detail`,
      path: `/admin/${domain}/${resource}/:id`,
      shell: "admin"
    }),
    resourceEdit: defineRoute({
      id: `${domain}.${resource}.edit`,
      path: `/admin/${domain}/${resource}/:id/edit`,
      shell: "admin"
    }),
    report: defineRoute({
      id: `${domain}.${resource}.report`,
      path: "/admin/reports/:reportId",
      shell: "admin"
    }),
    builder: defineRoute({
      id: `${domain}.${resource}.builder`,
      path: "/admin/tools/:builderId",
      shell: "admin"
    }),
    zone: defineRoute({
      id: `${domain}.${resource}.zone`,
      path: "/apps/:zone",
      shell: "admin"
    })
  };
}
