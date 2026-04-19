import { betterAuth, type BetterAuthOptions } from "better-auth";

import type { JobDispatchRequest } from "@platform/jobs";
import { ValidationError } from "@platform/kernel";

export const packageId = "auth" as const;
export const packageDisplayName = "Auth" as const;
export const packageDescription = "Better Auth wrapper and platform auth contracts." as const;

export type TenantContext = {
  tenantId: string;
  orgId?: string | undefined;
  slug?: string | undefined;
};

export type ActorContext = {
  actorId: string;
  sessionId: string;
  tenantId: string;
  claims: string[];
  impersonatedBy?: string | undefined;
};

export type SessionSnapshot = {
  sessionId: string;
  userId: string;
  tenantId: string;
  claims: string[];
};

export type SessionBridgePayload = {
  actorId: string;
  tenantId: string;
  claims: string[];
  sessionId: string;
  requestId?: string | undefined;
};

export type SessionContext = {
  tenant: TenantContext;
  actor: ActorContext;
  session: SessionSnapshot;
  requestId?: string | undefined;
};

export type PlatformAuthFactory = {
  build: () => ReturnType<typeof betterAuth>;
  options: BetterAuthOptions;
};

export type ResolveSessionContextOptions = {
  session: SessionSnapshot;
  requestId?: string | undefined;
  resolveTenant?: ((tenantId: string) => TenantContext) | undefined;
};

export type ImpersonationRequest = {
  actorClaims: string[];
  actorId: string;
  targetActorId: string;
  tenantId: string;
  reason?: string | undefined;
};

export type SessionStore = {
  get(sessionId: string): SessionSnapshot | undefined;
  put(session: SessionSnapshot): SessionSnapshot;
  refresh(
    sessionId: string,
    updates?: Partial<Pick<SessionSnapshot, "sessionId" | "tenantId" | "claims">>
  ): SessionSnapshot;
  invalidate(sessionId: string): boolean;
  isActive(sessionId: string): boolean;
  list(): SessionSnapshot[];
};

export function createAuthFactory(options: BetterAuthOptions): PlatformAuthFactory {
  return Object.freeze({
    options,
    build() {
      return betterAuth(options);
    }
  });
}

export function createTenantContext(input: TenantContext): TenantContext {
  if (!input.tenantId) {
    throw new ValidationError("tenantId is required", [
      {
        code: "tenant-context",
        message: "tenantId is required",
        path: "tenantId"
      }
    ]);
  }
  return Object.freeze(input);
}

export function createActorContext(input: ActorContext): ActorContext {
  if (!input.claims.length) {
    throw new ValidationError("actor claims are required", [
      {
        code: "actor-context",
        message: "claims must not be empty",
        path: "claims"
      }
    ]);
  }
  return Object.freeze({
    ...input,
    claims: [...new Set(input.claims)].sort((left, right) => left.localeCompare(right))
  });
}

export function createSessionContext(input: {
  tenant: TenantContext;
  actor: ActorContext;
  session: SessionSnapshot;
  requestId?: string | undefined;
}): SessionContext {
  assertTenantAccess(input.actor, input.tenant.tenantId);
  if (input.session.tenantId !== input.tenant.tenantId) {
    throw new ValidationError("session tenant does not match actor tenant", [
      {
        code: "session-tenant-mismatch",
        message: "session tenant must match actor tenant",
        path: "session.tenantId"
      }
    ]);
  }

  return Object.freeze({
    tenant: input.tenant,
    actor: input.actor,
    session: createSessionSnapshot(input.session),
    requestId: input.requestId
  });
}

export function resolveSessionContext(options: ResolveSessionContextOptions): SessionContext {
  const tenant = options.resolveTenant
    ? options.resolveTenant(options.session.tenantId)
    : createTenantContext({ tenantId: options.session.tenantId });

  return createSessionContext({
    tenant,
    actor: createActorContext({
      actorId: options.session.userId,
      sessionId: options.session.sessionId,
      tenantId: options.session.tenantId,
      claims: options.session.claims
    }),
    session: options.session,
    requestId: options.requestId
  });
}

export function assertTenantAccess(actor: Pick<ActorContext, "tenantId">, tenantId: string): void {
  if (actor.tenantId !== tenantId) {
    throw new ValidationError("cross-tenant access is forbidden", [
      {
        code: "tenant-isolation",
        message: "actor tenant does not match target tenant",
        path: "tenantId"
      }
    ]);
  }
}

export function assertImpersonationAllowed(request: ImpersonationRequest): true {
  if (request.actorId === request.targetActorId) {
    throw new ValidationError("self impersonation is not allowed", [
      {
        code: "impersonation-self",
        message: "actor cannot impersonate themselves",
        path: "targetActorId"
      }
    ]);
  }

  if (!request.reason) {
    throw new ValidationError("impersonation requires a reason", [
      {
        code: "impersonation-reason",
        message: "reason is required for impersonation",
        path: "reason"
      }
    ]);
  }

  const allowed = request.actorClaims.includes("role:admin") || request.actorClaims.includes("auth.impersonate");
  if (!allowed) {
    throw new ValidationError("actor may not impersonate users", [
      {
        code: "impersonation-denied",
        message: "actor lacks impersonation rights",
        path: "actorClaims"
      }
    ]);
  }

  return true;
}

export function createSessionSnapshot(input: SessionSnapshot): SessionSnapshot {
  return Object.freeze({
    ...input,
    claims: normalizeClaims(input.claims)
  });
}

export function refreshSessionSnapshot(
  session: SessionSnapshot,
  updates: Partial<Pick<SessionSnapshot, "sessionId" | "tenantId" | "claims">> = {}
): SessionSnapshot {
  return createSessionSnapshot({
    ...session,
    ...updates,
    claims: updates.claims ?? session.claims
  });
}

export function createSessionBridgePayload(context: SessionContext): SessionBridgePayload {
  return {
    actorId: context.actor.actorId,
    tenantId: context.tenant.tenantId,
    claims: [...context.actor.claims],
    sessionId: context.session.sessionId,
    requestId: context.requestId
  };
}

export function createSessionBridgeHeaders(context: SessionContext): Headers {
  const payload = createSessionBridgePayload(context);
  const headers = new Headers({
    "x-session-id": payload.sessionId,
    "x-user-id": context.session.userId,
    "x-actor-id": payload.actorId,
    "x-tenant-id": payload.tenantId,
    "x-claims": payload.claims.join(",")
  });

  if (payload.requestId) {
    headers.set("x-request-id", payload.requestId);
  }

  return headers;
}

export function resolveSessionContextFromHeaders(
  headersLike: Request | Headers | Record<string, string | undefined>,
  options: {
    resolveTenant?: ((tenantId: string) => TenantContext) | undefined;
    requestId?: string | undefined;
  } = {}
): SessionContext {
  const headers = toHeaders(headersLike);
  const sessionId = requireHeader(headers, "x-session-id");
  const userId = requireHeader(headers, "x-user-id");
  const tenantId = requireHeader(headers, "x-tenant-id");
  const actorId = headers.get("x-actor-id") ?? userId;
  const claims = normalizeClaims((headers.get("x-claims") ?? "").split(",").filter(Boolean));

  return createSessionContext({
    tenant: options.resolveTenant ? options.resolveTenant(tenantId) : createTenantContext({ tenantId }),
    actor: createActorContext({
      actorId,
      sessionId,
      tenantId,
      claims
    }),
    session: createSessionSnapshot({
      sessionId,
      userId,
      tenantId,
      claims
    }),
    requestId: headers.get("x-request-id") ?? options.requestId
  });
}

export function bindSessionToJobDispatch<TPayload>(
  request: JobDispatchRequest<TPayload>,
  context: SessionContext
): JobDispatchRequest<TPayload> {
  return Object.freeze({
    ...request,
    requestId: request.requestId ?? context.requestId,
    tenantId: request.tenantId ?? context.tenant.tenantId,
    actorId: request.actorId ?? context.actor.actorId
  });
}

export function createInMemorySessionStore(initialSessions: SessionSnapshot[] = []): SessionStore {
  const sessions = new Map(initialSessions.map((session) => [session.sessionId, createSessionSnapshot(session)]));
  const invalidated = new Set<string>();

  return {
    get(sessionId) {
      return sessions.get(sessionId);
    },
    put(session) {
      const normalized = createSessionSnapshot(session);
      sessions.set(normalized.sessionId, normalized);
      invalidated.delete(normalized.sessionId);
      return normalized;
    },
    refresh(sessionId, updates = {}) {
      const session = sessions.get(sessionId);
      if (!session) {
        throw new ValidationError(`Session '${sessionId}' is not registered`, [
          {
            code: "session-missing",
            message: `session '${sessionId}' is not registered`,
            path: "sessionId"
          }
        ]);
      }

      const refreshed = refreshSessionSnapshot(session, updates);
      sessions.delete(sessionId);
      sessions.set(refreshed.sessionId, refreshed);
      invalidated.delete(sessionId);
      invalidated.delete(refreshed.sessionId);
      return refreshed;
    },
    invalidate(sessionId) {
      if (!sessions.has(sessionId)) {
        return false;
      }
      invalidated.add(sessionId);
      return true;
    },
    isActive(sessionId) {
      return sessions.has(sessionId) && !invalidated.has(sessionId);
    },
    list() {
      return [...sessions.values()].sort((left, right) => left.sessionId.localeCompare(right.sessionId));
    }
  };
}

function normalizeClaims(claims: string[]): string[] {
  return [...new Set(claims.map((claim) => claim.trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function toHeaders(headersLike: Request | Headers | Record<string, string | undefined>): Headers {
  if (headersLike instanceof Request) {
    return headersLike.headers;
  }

  if (headersLike instanceof Headers) {
    return headersLike;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(headersLike)) {
    if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

function requireHeader(headers: Headers, name: string): string {
  const value = headers.get(name);
  if (!value) {
    throw new ValidationError(`Missing required session header '${name}'`, [
      {
        code: "session-header-missing",
        message: `header '${name}' is required`,
        path: name
      }
    ]);
  }
  return value;
}
