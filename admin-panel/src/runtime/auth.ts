import { Emitter } from "@/lib/emitter";

/** Client-side auth store — owns the bearer token + current user.
 *  Persists to localStorage so reloads stay signed-in. Emits change events
 *  so the AuthGuard + topbar re-render when login/logout happens. */

const TOKEN_KEY = "gutu.auth.token";
const USER_KEY = "gutu.auth.user";
const TENANTS_KEY = "gutu.auth.tenants";
const ACTIVE_TENANT_KEY = "gutu.auth.activeTenant";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface TenantSummary {
  id: string;
  slug: string;
  name: string;
  role?: string;
  plan?: string;
  status?: "active" | "suspended" | "archived";
}

export type AuthEvents = {
  change: { user: SessionUser | null; token: string | null };
  tenant: { active: TenantSummary | null; available: TenantSummary[] };
};

class AuthStore {
  private _token: string | null = null;
  private _user: SessionUser | null = null;
  private _available: TenantSummary[] = [];
  private _active: TenantSummary | null = null;
  readonly emitter = new Emitter<AuthEvents>();

  constructor() {
    try {
      this._token = localStorage.getItem(TOKEN_KEY);
      const raw = localStorage.getItem(USER_KEY);
      this._user = raw ? (JSON.parse(raw) as SessionUser) : null;
      const rawT = localStorage.getItem(TENANTS_KEY);
      this._available = rawT ? (JSON.parse(rawT) as TenantSummary[]) : [];
      const rawA = localStorage.getItem(ACTIVE_TENANT_KEY);
      this._active = rawA ? (JSON.parse(rawA) as TenantSummary) : null;
    } catch {
      /* disabled storage — auth will just not persist */
    }
  }

  get token() {
    return this._token;
  }
  get user() {
    return this._user;
  }
  get isSignedIn() {
    return this._token != null && this._user != null;
  }
  get activeTenant() {
    return this._active;
  }
  get availableTenants() {
    return this._available;
  }

  setSession(token: string, user: SessionUser): void {
    this._token = token;
    this._user = user;
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* no-op */
    }
    this.emitter.emit("change", { token, user });
  }

  setTenants(available: TenantSummary[], active: TenantSummary | null): void {
    this._available = available;
    this._active = active;
    try {
      localStorage.setItem(TENANTS_KEY, JSON.stringify(available));
      if (active) localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(active));
      else localStorage.removeItem(ACTIVE_TENANT_KEY);
    } catch {
      /* no-op */
    }
    this.emitter.emit("tenant", { active, available });
  }

  clear(): void {
    this._token = null;
    this._user = null;
    this._available = [];
    this._active = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TENANTS_KEY);
      localStorage.removeItem(ACTIVE_TENANT_KEY);
    } catch {
      /* no-op */
    }
    this.emitter.emit("change", { token: null, user: null });
    this.emitter.emit("tenant", { active: null, available: [] });
  }
}

export const authStore = new AuthStore();

/* -- API helpers ---------------------------------------------------------- */

const BASE = (import.meta as { env?: { VITE_API_BASE?: string } }).env
  ?.VITE_API_BASE ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `API ${status}`);
    this.name = "ApiError";
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  // Don't tag FormData with application/json — the browser sets
  // multipart/form-data with the right boundary when Content-Type is unset.
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (authStore.token) headers.set("Authorization", `Bearer ${authStore.token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* plain text */
    }
    // 401 on an auth-flow endpoint ("invalid credentials", "mfa_required",
    // "invalid_mfa_code") is normal signal — do NOT log the caller out.
    // Only clear storage on 401 from a protected endpoint (i.e. a real
    // session-expired response).
    if (res.status === 401 && !path.startsWith("/auth/")) {
      authStore.clear();
    }
    throw new ApiError(res.status, body, `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function login(
  email: string,
  password: string,
): Promise<SessionUser> {
  const res = await apiFetch<{ token: string; user: SessionUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  authStore.setSession(res.token, res.user);
  return res.user;
}

export async function signup(
  email: string,
  name: string,
  password: string,
): Promise<SessionUser> {
  const res = await apiFetch<{ token: string; user: SessionUser }>(
    "/auth/signup",
    { method: "POST", body: JSON.stringify({ email, name, password }) },
  );
  authStore.setSession(res.token, res.user);
  return res.user;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    /* ignore — we clear the session either way */
  }
  authStore.clear();
}

export async function verifySession(): Promise<SessionUser | null> {
  if (!authStore.token) return null;
  try {
    const user = await apiFetch<SessionUser>("/auth/me");
    authStore.setSession(authStore.token, user);
    return user;
  } catch {
    authStore.clear();
    return null;
  }
}

/* -- Tenant helpers ------------------------------------------------------- */

export async function fetchMemberships(): Promise<{
  tenants: TenantSummary[];
  active: TenantSummary | null;
}> {
  const res = await apiFetch<{ tenants: TenantSummary[]; active: TenantSummary | null }>(
    "/auth/memberships",
  );
  // If no active set but only one available, treat it as the active tenant.
  const active = res.active ?? (res.tenants.length === 1 ? res.tenants[0] : null);
  authStore.setTenants(res.tenants, active);
  return { tenants: res.tenants, active };
}

export async function switchTenant(tenantId: string): Promise<TenantSummary> {
  const res = await apiFetch<{ ok: boolean; active: TenantSummary }>("/auth/switch-tenant", {
    method: "POST",
    body: JSON.stringify({ tenantId }),
  });
  authStore.setTenants(authStore.availableTenants, res.active);
  return res.active;
}

export interface PlatformConfig {
  multisite: boolean;
  dbKind: "sqlite" | "postgres";
  tenantResolution: "subdomain" | "header" | "path";
  rootDomain: string | null;
  defaultTenantSlug: string;
}

let cachedConfig: PlatformConfig | null = null;
let configPromise: Promise<PlatformConfig> | null = null;

export async function fetchPlatformConfig(): Promise<PlatformConfig> {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;
  configPromise = apiFetch<PlatformConfig>("/config").then((c) => {
    cachedConfig = c;
    configPromise = null;
    return c;
  });
  return configPromise;
}

export function getCachedConfig(): PlatformConfig | null {
  return cachedConfig;
}
