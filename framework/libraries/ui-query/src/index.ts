import {
  QueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
  useMutation,
  useQuery
} from "@tanstack/react-query";

export const packageId = "ui-query" as const;
export const packageDisplayName = "UI Query" as const;
export const packageDescription = "TanStack Query wrapper APIs." as const;

export type PlatformQueryScope = readonly [string, ...string[]];
export type ShellQueryScope = {
  tenantId: string;
  actorId: string;
  workspaceId?: string | undefined;
  reportId?: string | undefined;
  builderId?: string | undefined;
  impersonationActorId?: string | undefined;
};

export function createPlatformQueryKey(scope: PlatformQueryScope, ...parts: Array<string | number>): QueryKey {
  return [...scope, ...parts];
}

export function createPlatformQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false
      },
      mutations: {
        retry: 0
      }
    }
  });
}

export function usePlatformQuery<TQueryFnData, TError = Error, TData = TQueryFnData>(
  options: UseQueryOptions<TQueryFnData, TError, TData, QueryKey>
): UseQueryResult<TData, TError> {
  return useQuery(options);
}

export function usePlatformMutation<TData, TError = Error, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext> {
  return useMutation(options);
}

export async function invalidatePlatformScopes(queryClient: QueryClient, scopes: PlatformQueryScope[]): Promise<void> {
  for (const scope of scopes) {
    await queryClient.invalidateQueries({ queryKey: [...scope] });
  }
}

export function primePlatformQuery<TData>(queryClient: QueryClient, scope: PlatformQueryScope, data: TData): void {
  queryClient.setQueryData([...scope], data);
}

export function createShellQueryScope(input: ShellQueryScope): PlatformQueryScope {
  return [
    "shell",
    input.tenantId,
    input.actorId,
    input.workspaceId ?? "workspace:none",
    input.reportId ?? "report:none",
    input.builderId ?? "builder:none",
    input.impersonationActorId ?? "impersonation:none"
  ];
}

export async function invalidateShellDeskQueries(queryClient: QueryClient, scope: ShellQueryScope): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: createShellQueryScope(scope)
  });
}

export async function resetTenantScopedQueries(queryClient: QueryClient, tenantId: string): Promise<void> {
  await queryClient.invalidateQueries({
    predicate(query) {
      return Array.isArray(query.queryKey) && query.queryKey.includes(tenantId);
    }
  });
}
