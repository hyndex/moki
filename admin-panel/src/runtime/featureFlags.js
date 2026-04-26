const STORAGE_KEY = "gutu-admin-flag-overrides";
class FeatureFlagStoreImpl {
    rules = [];
    overrides;
    constructor(initial = []) {
        this.rules.push(...initial);
        this.overrides = this.loadOverrides();
    }
    loadOverrides() {
        if (typeof window === "undefined")
            return {};
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw)
                return {};
            const parsed = JSON.parse(raw);
            return typeof parsed === "object" && parsed !== null ? parsed : {};
        }
        catch {
            return {};
        }
    }
    persistOverrides() {
        if (typeof window === "undefined")
            return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.overrides));
        }
        catch {
            /* quota or private mode — silently drop */
        }
    }
    get(key, fallback) {
        if (key in this.overrides)
            return this.overrides[key];
        const match = this.rules.find((r) => r.key === key);
        if (!match)
            return fallback;
        return match.value;
    }
    isEnabled(key) {
        const v = this.get(key, false);
        return v === true;
    }
    setOverride(key, value) {
        this.overrides[key] = value;
        this.persistOverrides();
    }
    clearOverride(key) {
        delete this.overrides[key];
        this.persistOverrides();
    }
    all() {
        const out = {};
        for (const r of this.rules)
            out[r.key] = r.value;
        return { ...out, ...this.overrides };
    }
    register(rules) {
        this.rules.push(...rules);
    }
}
export function createFeatureFlags(rules) {
    return new FeatureFlagStoreImpl(rules);
}
class CapabilityRegistryImpl {
    map = new Map();
    has(capability) {
        return (this.map.get(capability)?.size ?? 0) > 0;
    }
    providers(capability) {
        return Array.from(this.map.get(capability) ?? []);
    }
    register(pluginId, capabilities) {
        for (const cap of capabilities) {
            const set = this.map.get(cap) ?? new Set();
            set.add(pluginId);
            this.map.set(cap, set);
        }
    }
}
export function createCapabilityRegistry() {
    return new CapabilityRegistryImpl();
}
