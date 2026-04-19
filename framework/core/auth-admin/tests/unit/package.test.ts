import { describe, expect, it } from "bun:test";
import { assertAdminAccess, assertAdminReason, createAdminAuditEvent, executeAdminOperation, packageId } from "../../src";

describe("auth-admin", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("auth-admin");
  });

  it("blocks admin operations without the right claims", () => {
    expect(() => assertAdminAccess(["role:operator"], "impersonate-user")).toThrow("not allowed");
  });

  it("requires reasons for sensitive operations", () => {
    expect(() => assertAdminReason(undefined, "ban-user")).toThrow("requires a reason");
  });

  it("executes allowed admin operations through wrappers", async () => {
    const result = await executeAdminOperation(
      {
        impersonateUser: (userId) => ({ impersonatedUserId: userId })
      },
      {
        operation: "impersonate-user",
        actor: {
          actorId: "admin-1",
          claims: ["role:admin"]
        },
        targetUserId: "user-2",
        reason: "support escalation"
      }
    );

    expect(result).toEqual({ impersonatedUserId: "user-2" });
  });

  it("emits explicit audit records for sensitive admin operations", async () => {
    const audits: unknown[] = [];
    await executeAdminOperation(
      {
        banUser: () => undefined
      },
      {
        operation: "ban-user",
        actor: {
          actorId: "admin-1",
          claims: ["role:admin"]
        },
        targetUserId: "user-2",
        reason: "fraud review"
      },
      {
        now: "2026-04-18T00:00:00.000Z",
        recordAudit: (event) => {
          audits.push(event);
        }
      }
    );

    expect(audits).toEqual([
      createAdminAuditEvent(
        {
          operation: "ban-user",
          actor: {
            actorId: "admin-1",
            claims: ["role:admin"]
          },
          targetUserId: "user-2",
          reason: "fraud review"
        },
        { ok: true },
        "2026-04-18T00:00:00.000Z"
      )
    ]);
  });
});
