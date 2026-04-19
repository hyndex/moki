import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const packageId = "query" as const;
export const packageDisplayName = "Query" as const;
export const packageDescription = "Canonical TanStack Query wrapper with unified keys and optimistic helpers." as const;

export * from "@platform/ui-query";

export function createUnifiedQueryKeys(namespace: string) {
  return {
    all(...parts: Array<string | number>): QueryKey {
      return [namespace, ...parts];
    },
    list(resource: string, tenantId: string): QueryKey {
      return [namespace, resource, "list", tenantId];
    },
    detail(resource: string, id: string, tenantId: string): QueryKey {
      return [namespace, resource, "detail", tenantId, id];
    }
  };
}

export function applyOptimisticQueryUpdate<TValue>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (current: TValue | undefined) => TValue
): () => void {
  const previous = queryClient.getQueryData<TValue>(queryKey);
  queryClient.setQueryData(queryKey, updater(previous));
  return () => {
    queryClient.setQueryData(queryKey, previous);
  };
}

export async function invalidateAdminQueryScopes(
  queryClient: QueryClient,
  scopes: QueryKey[]
): Promise<void> {
  for (const scope of scopes) {
    await queryClient.invalidateQueries({
      queryKey: scope
    });
  }
}
