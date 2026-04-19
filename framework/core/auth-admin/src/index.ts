import { admin, type AdminOptions } from "better-auth/plugins/admin";

import type { ActorContext } from "@platform/auth";
import { ValidationError } from "@platform/kernel";

export const packageId = "auth-admin" as const;
export const packageDisplayName = "Auth Admin" as const;
export const packageDescription = "Administrative auth operations wrappers." as const;

export type AdminOperation =
  | "list-users"
  | "set-role"
  | "ban-user"
  | "unban-user"
  | "impersonate-user"
  | "stop-impersonating"
  | "revoke-sessions";

export type AdminOperationInput = {
  operation: AdminOperation;
  actor: Pick<ActorContext, "actorId" | "claims">;
  targetUserId?: string;
  reason?: string;
};

export type AuthAdminHandlers = {
  listUsers?: () => Promise<unknown[]> | unknown[];
  setRole?: (userId: string, role: string) => Promise<void> | void;
  impersonateUser?: (userId: string) => Promise<{ impersonatedUserId: string }> | { impersonatedUserId: string };
  stopImpersonating?: () => Promise<void> | void;
  banUser?: (userId: string, reason: string) => Promise<void> | void;
  unbanUser?: (userId: string) => Promise<void> | void;
  revokeSessions?: (userId: string) => Promise<void> | void;
};

export type AdminAuditEvent = {
  type: "auth.admin.operation";
  operation: AdminOperation;
  actorId: string;
  targetUserId?: string | undefined;
  reason?: string | undefined;
  at: string;
  result: "ok";
  details?: Record<string, unknown> | undefined;
};

export function createAuthAdminPlugin(options?: AdminOptions) {
  return admin(options);
}

export function assertAdminAccess(actorClaims: string[], operation: AdminOperation): void {
  const allowed =
    actorClaims.includes("role:admin") ||
    actorClaims.includes(`auth.admin.${operation}`) ||
    actorClaims.includes("auth.admin.*");

  if (!allowed) {
    throw new ValidationError(`Admin operation '${operation}' is not allowed`, [
      {
        code: "auth-admin-denied",
        message: `actor lacks permission for '${operation}'`,
        path: "actorClaims"
      }
    ]);
  }
}

export function assertAdminReason(reason: string | undefined, operation: AdminOperation): void {
  if (["ban-user", "impersonate-user", "set-role"].includes(operation) && !reason) {
    throw new ValidationError(`Admin operation '${operation}' requires a reason`, [
      {
        code: "auth-admin-reason",
        message: `operation '${operation}' requires a reason`,
        path: "reason"
      }
    ]);
  }
}

export async function executeAdminOperation(
  handlers: AuthAdminHandlers,
  input: AdminOperationInput & {
    role?: string;
  },
  options: {
    recordAudit?: ((event: AdminAuditEvent) => void) | undefined;
    now?: string | undefined;
  } = {}
): Promise<unknown> {
  assertAdminAccess(input.actor.claims, input.operation);
  assertAdminReason(input.reason, input.operation);

  let result: unknown;
  switch (input.operation) {
    case "list-users":
      result = handlers.listUsers?.() ?? [];
      break;
    case "set-role":
      if (!input.targetUserId || !input.role) {
        throw missingTargetError(input.operation);
      }
      await handlers.setRole?.(input.targetUserId, input.role);
      result = { ok: true };
      break;
    case "impersonate-user":
      if (!input.targetUserId) {
        throw missingTargetError(input.operation);
      }
      result = handlers.impersonateUser?.(input.targetUserId) ?? { impersonatedUserId: input.targetUserId };
      break;
    case "stop-impersonating":
      await handlers.stopImpersonating?.();
      result = { ok: true };
      break;
    case "ban-user":
      if (!input.targetUserId || !input.reason) {
        throw missingTargetError(input.operation);
      }
      await handlers.banUser?.(input.targetUserId, input.reason);
      result = { ok: true };
      break;
    case "unban-user":
      if (!input.targetUserId) {
        throw missingTargetError(input.operation);
      }
      await handlers.unbanUser?.(input.targetUserId);
      result = { ok: true };
      break;
    case "revoke-sessions":
      if (!input.targetUserId) {
        throw missingTargetError(input.operation);
      }
      await handlers.revokeSessions?.(input.targetUserId);
      result = { ok: true };
      break;
  }

  options.recordAudit?.(createAdminAuditEvent(input, result, options.now));
  return result;
}

export function createAdminAuditEvent(
  input: AdminOperationInput & {
    role?: string;
  },
  result: unknown,
  at = new Date().toISOString()
): AdminAuditEvent {
  return {
    type: "auth.admin.operation",
    operation: input.operation,
    actorId: input.actor.actorId,
    ...(input.targetUserId ? { targetUserId: input.targetUserId } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    at,
    result: "ok",
    details: {
      ...(input.role ? { role: input.role } : {}),
      result
    }
  };
}

function missingTargetError(operation: AdminOperation): ValidationError {
  return new ValidationError(`Admin operation '${operation}' requires a target user`, [
    {
      code: "auth-admin-target",
      message: `operation '${operation}' requires a target user`,
      path: "targetUserId"
    }
  ]);
}
