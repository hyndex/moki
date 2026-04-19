import { describe, expect, it } from "bun:test";
import {
  createPlatformQueryClient,
  createPlatformQueryKey,
  createShellQueryScope,
  invalidatePlatformScopes,
  invalidateShellDeskQueries,
  packageId,
  primePlatformQuery,
  resetTenantScopedQueries
} from "../../src";

describe("ui-query", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ui-query");
  });

  it("builds stable typed query keys", () => {
    expect(createPlatformQueryKey(["crm", "contacts"], "c1")).toEqual(["crm", "contacts", "c1"]);
  });

  it("primes and invalidates platform query scopes", async () => {
    const client = createPlatformQueryClient();
    primePlatformQuery(client, ["crm", "contacts"], [{ id: "c1" }]);

    expect(client.getQueryData<Array<{ id: string }>>(["crm", "contacts"])).toEqual([{ id: "c1" }]);

    await invalidatePlatformScopes(client, [["crm", "contacts"]]);
    expect(client.getQueryState(["crm", "contacts"])?.isInvalidated).toBe(true);
  });

  it("creates and invalidates shell-scoped query keys", async () => {
    const client = createPlatformQueryClient();
    const shellScope = createShellQueryScope({
      tenantId: "tenant-1",
      actorId: "actor-1",
      workspaceId: "crm"
    });

    primePlatformQuery(client, shellScope, { view: "desk" });
    await invalidateShellDeskQueries(client, {
      tenantId: "tenant-1",
      actorId: "actor-1",
      workspaceId: "crm"
    });
    expect(client.getQueryState(shellScope)?.isInvalidated).toBe(true);

    await resetTenantScopedQueries(client, "tenant-1");
    expect(client.getQueryState(shellScope)?.isInvalidated).toBe(true);
  });
});
