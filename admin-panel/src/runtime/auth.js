import { Emitter } from "@/lib/emitter";
/** Client-side auth store — owns the bearer token + current user.
 *  Persists to localStorage so reloads stay signed-in. Emits change events
 *  so the AuthGuard + topbar re-render when login/logout happens. */
const TOKEN_KEY = "gutu.auth.token";
const USER_KEY = "gutu.auth.user";
const TENANTS_KEY = "gutu.auth.tenants";
const ACTIVE_TENANT_KEY = "gutu.auth.activeTenant";
class AuthStore {
    _token = null;
    _user = null;
    _available = [];
    _active = null;
    emitter = new Emitter();
    constructor() {
        try {
            this._token = localStorage.getItem(TOKEN_KEY);
            const raw = localStorage.getItem(USER_KEY);
            this._user = raw ? JSON.parse(raw) : null;
            const rawT = localStorage.getItem(TENANTS_KEY);
            this._available = rawT ? JSON.parse(rawT) : [];
            const rawA = localStorage.getItem(ACTIVE_TENANT_KEY);
            this._active = rawA ? JSON.parse(rawA) : null;
        }
        catch {
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
    setSession(token, user) {
        this._token = token;
        this._user = user;
        try {
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        }
        catch {
            /* no-op */
        }
        this.emitter.emit("change", { token, user });
    }
    setTenants(available, active) {
        this._available = available;
        this._active = active;
        try {
            localStorage.setItem(TENANTS_KEY, JSON.stringify(available));
            if (active)
                localStorage.setItem(ACTIVE_TENANT_KEY, JSON.stringify(active));
            else
                localStorage.removeItem(ACTIVE_TENANT_KEY);
        }
        catch {
            /* no-op */
        }
        this.emitter.emit("tenant", { active, available });
    }
    clear() {
        this._token = null;
        this._user = null;
        this._available = [];
        this._active = null;
        try {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(TENANTS_KEY);
            localStorage.removeItem(ACTIVE_TENANT_KEY);
        }
        catch {
            /* no-op */
        }
        this.emitter.emit("change", { token: null, user: null });
        this.emitter.emit("tenant", { active: null, available: [] });
    }
}
export const authStore = new AuthStore();
/* -- API helpers ---------------------------------------------------------- */
const BASE = import.meta.env
    ?.VITE_API_BASE ?? "/api";
export class ApiError extends Error {
    status;
    body;
    constructor(status, body, message) {
        super(message ?? `API ${status}`);
        this.status = status;
        this.body = body;
        this.name = "ApiError";
    }
}
export async function apiFetch(path, init = {}) {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    // Don't tag FormData with application/json — the browser sets
    // multipart/form-data with the right boundary when Content-Type is unset.
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (init.body && !isFormData && !headers.has("Content-Type"))
        headers.set("Content-Type", "application/json");
    if (authStore.token)
        headers.set("Authorization", `Bearer ${authStore.token}`);
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    if (!res.ok) {
        let body = null;
        try {
            body = await res.json();
        }
        catch {
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
    if (res.status === 204)
        return undefined;
    return (await res.json());
}
export async function login(email, password) {
    const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
    authStore.setSession(res.token, res.user);
    return res.user;
}
export async function signup(email, name, password) {
    const res = await apiFetch("/auth/signup", { method: "POST", body: JSON.stringify({ email, name, password }) });
    authStore.setSession(res.token, res.user);
    return res.user;
}
export async function logout() {
    try {
        await apiFetch("/auth/logout", { method: "POST" });
    }
    catch {
        /* ignore — we clear the session either way */
    }
    authStore.clear();
}
export async function verifySession() {
    if (!authStore.token)
        return null;
    try {
        const user = await apiFetch("/auth/me");
        authStore.setSession(authStore.token, user);
        return user;
    }
    catch {
        authStore.clear();
        return null;
    }
}
/* -- Tenant helpers ------------------------------------------------------- */
export async function fetchMemberships() {
    const res = await apiFetch("/auth/memberships");
    // If no active set but only one available, treat it as the active tenant.
    const active = res.active ?? (res.tenants.length === 1 ? res.tenants[0] : null);
    authStore.setTenants(res.tenants, active);
    return { tenants: res.tenants, active };
}
export async function switchTenant(tenantId) {
    const res = await apiFetch("/auth/switch-tenant", {
        method: "POST",
        body: JSON.stringify({ tenantId }),
    });
    authStore.setTenants(authStore.availableTenants, res.active);
    return res.active;
}
let cachedConfig = null;
let configPromise = null;
export async function fetchPlatformConfig() {
    if (cachedConfig)
        return cachedConfig;
    if (configPromise)
        return configPromise;
    configPromise = apiFetch("/config").then((c) => {
        cachedConfig = c;
        configPromise = null;
        return c;
    });
    return configPromise;
}
export function getCachedConfig() {
    return cachedConfig;
}
