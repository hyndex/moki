export const packageId = "router" as const;
export const packageDisplayName = "Router" as const;
export const packageDescription = "Canonical router wrapper with admin guards and safe zone links." as const;

export * from "@platform/ui-router";

export type RouteAccessContext = {
  tenantId?: string | undefined;
  currentTenantId?: string | undefined;
  grantedPermissions: string[];
};

export function assertRouteAccess(input: {
  permission?: string | undefined;
  context: RouteAccessContext;
}): true {
  if (input.permission && !input.context.grantedPermissions.includes(input.permission)) {
    throw new Error(`missing route permission: ${input.permission}`);
  }
  if (input.context.tenantId && input.context.currentTenantId && input.context.tenantId !== input.context.currentTenantId) {
    throw new Error(`cross-tenant route access denied: ${input.context.currentTenantId} -> ${input.context.tenantId}`);
  }
  return true;
}

export function createZoneSafeHref(zoneId: string, path = ""): string {
  const normalizedPath = path.replace(/^\/+/, "");
  return normalizedPath ? `/apps/${zoneId}/${normalizedPath}` : `/apps/${zoneId}`;
}
