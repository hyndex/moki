import { describe, expect, it } from "bun:test";

import { createPlatformQueryClient } from "@platform/ui-query";

import { applyOptimisticQueryUpdate, createUnifiedQueryKeys, packageId } from "../../src";

describe("query", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("query");
  });

  it("creates unified keys and optimistic updates", () => {
    const queryClient = createPlatformQueryClient();
    const keys = createUnifiedQueryKeys("crm");
    const queryKey = keys.detail("contacts", "contact-1", "tenant-1");
    queryClient.setQueryData(queryKey, { name: "Ada" });

    const rollback = applyOptimisticQueryUpdate(queryClient, queryKey, (current: { name: string } | undefined) => ({
      name: `${current?.name ?? "Unknown"} Lovelace`
    }));

    expect((queryClient.getQueryData(queryKey) as { name: string }).name).toBe("Ada Lovelace");
    rollback();
    expect((queryClient.getQueryData(queryKey) as { name: string }).name).toBe("Ada");
  });
});
