import { describe, expect, it } from "bun:test";
import {
  assertImpersonationAllowed,
  assertTenantAccess,
  bindSessionToJobDispatch,
  createInMemorySessionStore,
  createActorContext,
  createSessionBridgeHeaders,
  createSessionBridgePayload,
  createSessionContext,
  createSessionSnapshot,
  createTenantContext,
  packageId,
  refreshSessionSnapshot,
  resolveSessionContextFromHeaders,
  resolveSessionContext
} from "../../src";

describe("auth", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("auth");
  });

  it("enforces tenant isolation", () => {
    expect(() =>
      assertTenantAccess(
        {
          tenantId: "tenant-a"
        },
        "tenant-b"
      )
    ).toThrow("cross-tenant access is forbidden");
  });

  it("requires strong impersonation guardrails", () => {
    expect(() =>
      assertImpersonationAllowed({
        actorClaims: ["role:operator"],
        actorId: "user-1",
        targetActorId: "user-2",
        tenantId: "tenant-a",
        reason: "support"
      })
    ).toThrow("may not impersonate users");

    expect(
      assertImpersonationAllowed({
        actorClaims: ["role:admin"],
        actorId: "user-1",
        targetActorId: "user-2",
        tenantId: "tenant-a",
        reason: "support escalation"
      })
    ).toBe(true);
  });

  it("resolves a session context with actor and tenant metadata", () => {
    const context = resolveSessionContext({
      session: {
        sessionId: "session-1",
        userId: "user-1",
        tenantId: "tenant-a",
        claims: ["role:admin"]
      },
      requestId: "req-1"
    });

    expect(context.actor.actorId).toBe("user-1");
    expect(context.tenant.tenantId).toBe("tenant-a");
    expect(createSessionBridgePayload(context)).toEqual({
      actorId: "user-1",
      tenantId: "tenant-a",
      claims: ["role:admin"],
      sessionId: "session-1",
      requestId: "req-1"
    });
  });

  it("creates explicit session contexts", () => {
    const tenant = createTenantContext({ tenantId: "tenant-a", slug: "acme" });
    const actor = createActorContext({
      actorId: "user-1",
      sessionId: "session-1",
      tenantId: "tenant-a",
      claims: ["role:operator", "role:operator", "role:admin"]
    });
    const context = createSessionContext({
      tenant,
      actor,
      session: {
        sessionId: "session-1",
        userId: "user-1",
        tenantId: "tenant-a",
        claims: actor.claims
      }
    });

    expect(context.actor.claims).toEqual(["role:admin", "role:operator"]);
  });

  it("refreshes and invalidates session snapshots through the session store", () => {
    const store = createInMemorySessionStore([
      createSessionSnapshot({
        sessionId: "session-1",
        userId: "user-1",
        tenantId: "tenant-a",
        claims: ["role:operator"]
      })
    ]);

    const refreshed = store.refresh("session-1", {
      sessionId: "session-2",
      claims: ["role:admin", "role:operator"]
    });

    expect(refreshed).toEqual({
      sessionId: "session-2",
      userId: "user-1",
      tenantId: "tenant-a",
      claims: ["role:admin", "role:operator"]
    });
    expect(store.invalidate("session-2")).toBe(true);
    expect(store.isActive("session-2")).toBe(false);
  });

  it("bridges session context through HTTP headers", () => {
    const context = resolveSessionContext({
      session: {
        sessionId: "session-1",
        userId: "user-1",
        tenantId: "tenant-a",
        claims: ["role:admin"]
      },
      requestId: "req-1"
    });

    const headers = createSessionBridgeHeaders(context);
    const restored = resolveSessionContextFromHeaders(headers);

    expect(restored).toEqual(context);
  });

  it("applies session context to job dispatch requests", () => {
    const context = resolveSessionContext({
      session: {
        sessionId: "session-1",
        userId: "user-1",
        tenantId: "tenant-a",
        claims: ["role:admin"]
      },
      requestId: "req-1"
    });

    expect(
      bindSessionToJobDispatch(
        {
          jobDefinitionId: "billing.sync",
          payload: {
            accountId: "acct-1"
          }
        },
        context
      )
    ).toEqual({
      jobDefinitionId: "billing.sync",
      payload: {
        accountId: "acct-1"
      },
      actorId: "user-1",
      tenantId: "tenant-a",
      requestId: "req-1"
    });
  });

  it("refreshes individual session snapshots deterministically", () => {
    expect(
      refreshSessionSnapshot(
        {
          sessionId: "session-1",
          userId: "user-1",
          tenantId: "tenant-a",
          claims: ["role:operator"]
        },
        {
          claims: ["role:admin", "role:operator"]
        }
      )
    ).toEqual({
      sessionId: "session-1",
      userId: "user-1",
      tenantId: "tenant-a",
      claims: ["role:admin", "role:operator"]
    });
  });
});
