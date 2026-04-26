import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { PageHeader } from "@/admin-primitives/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/admin-primitives/Card";
import { Badge } from "@/primitives/Badge";
import { Button } from "@/primitives/Button";
import { Input } from "@/primitives/Input";
import { AlertTriangle, CheckCircle2, Download, HelpCircle, Package, Power, RefreshCw, Trash2, } from "lucide-react";
import { usePluginHost2, usePluginHostVersion } from "@/host/pluginHostContext";
/** Plugin Inspector — the admin UI for managing installed plugins.
 *
 *  Shows every plugin in the host with its manifest, status, capabilities,
 *  contribution counts, and any errors. Supports install-from-URL, reload,
 *  and uninstall. Lists every extension-registry entry with its contributor
 *  so operators can see exactly who added what. */
export function PluginInspectorPage() {
    const host = usePluginHost2();
    const version = usePluginHostVersion();
    void version; // force re-render on change
    const [installUrl, setInstallUrl] = React.useState("");
    const [installing, setInstalling] = React.useState(false);
    const [installError, setInstallError] = React.useState(null);
    const records = host?.getRecords() ?? [];
    const conflicts = host?.contributions.conflicts ?? [];
    const handleInstall = async () => {
        if (!host)
            return;
        const url = installUrl.trim();
        if (!url)
            return;
        setInstalling(true);
        setInstallError(null);
        try {
            await host.installFromURL(url);
            setInstallUrl("");
        }
        catch (err) {
            setInstallError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setInstalling(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(PageHeader, { title: "Plugins", description: "Every installed plugin \u2014 their manifest, contributions, and current health." }), _jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Download, { className: "h-4 w-4 text-accent" }), "Install from URL"] }) }), _jsx(CardDescription, { children: "Paste a plugin manifest URL. The shell fetches the module, verifies integrity (when declared), and activates it." })] }), _jsxs(CardContent, { className: "flex items-center gap-2", children: [_jsx(Input, { className: "flex-1", placeholder: "https://plugins.example.com/my-plugin/1.0.0/manifest.json", value: installUrl, onChange: (e) => setInstallUrl(e.target.value) }), _jsx(Button, { variant: "primary", size: "sm", onClick: handleInstall, loading: installing, disabled: !installUrl.trim() || !host, children: "Install" })] }), installError && (_jsx("div", { className: "px-4 pb-3 text-xs text-intent-danger", children: installError }))] }), conflicts.length > 0 && (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(AlertTriangle, { className: "h-4 w-4 text-intent-warning" }), "Conflicts \u2014 ", conflicts.length] }) }), _jsx(CardDescription, { children: "Two or more plugins claimed the same contribution id. The last to register wins; earlier registrations are shadowed." })] }), _jsx(CardContent, { children: _jsx("ul", { className: "divide-y divide-border-subtle text-xs", children: conflicts.map((c) => (_jsxs("li", { className: "flex items-center gap-3 py-2", children: [_jsx(Badge, { intent: "warning", children: c.kind }), _jsx("code", { className: "font-mono", children: c.key }), _jsxs("span", { className: "ml-auto text-text-muted", children: ["by ", c.contributors.join(", ")] })] }, `${c.kind}::${c.key}`))) }) })] })), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(Package, { className: "h-4 w-4 text-accent" }), "Installed \u2014 ", records.length] }) }) }), _jsx(CardContent, { className: "p-0", children: _jsx("ul", { className: "divide-y divide-border-subtle", children: records.length === 0 ? (_jsx("li", { className: "px-4 py-6 text-sm text-text-muted text-center", children: "No plugins installed." })) : (records.map((r) => (_jsx(PluginRow, { record: r, host: host }, r.manifest.id)))) }) })] }), _jsx(ThemeAndLayoutPicker, {}), _jsx(AuthProvidersCard, {}), _jsx(TrustedKeysCard, {}), _jsx(RegistriesCard, {})] }));
}
function PluginRow({ record, host, }) {
    const { manifest, status, error, contributionCounts, activationDurationMs } = record;
    const [busy, setBusy] = React.useState(false);
    const onReload = async () => {
        if (!host)
            return;
        setBusy(true);
        try {
            await host.reload(manifest.id);
        }
        finally {
            setBusy(false);
        }
    };
    const onUninstall = async () => {
        if (!host)
            return;
        setBusy(true);
        try {
            await host.uninstall(manifest.id);
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx("li", { className: "px-4 py-3", children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(StatusIcon, { status: status }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "font-medium text-sm", children: manifest.label }), _jsx("code", { className: "font-mono text-xs text-text-muted", children: manifest.id }), _jsx(Badge, { intent: "neutral", children: manifest.version }), manifest.origin?.kind && (_jsx(Badge, { intent: "info", children: manifest.origin.kind })), _jsx(StatusBadge, { status: status }), activationDurationMs !== undefined && (_jsxs("span", { className: "text-[10px] font-mono text-text-muted", title: `Time spent inside activate()`, children: [activationDurationMs.toFixed(1), "ms"] }))] }), manifest.description && (_jsx("div", { className: "text-xs text-text-muted mt-1", children: manifest.description })), manifest.requires?.plugins && Object.keys(manifest.requires.plugins).length > 0 && (_jsxs("div", { className: "text-[11px] text-text-muted mt-1", children: ["Requires:", " ", Object.entries(manifest.requires.plugins).map(([id, range], i, arr) => (_jsxs("span", { children: [_jsx("code", { className: "font-mono", children: id }), " ", _jsx("span", { className: "opacity-75", children: range }), i < arr.length - 1 ? ", " : ""] }, id)))] })), error && (_jsx("div", { className: "text-xs text-intent-danger mt-1 font-mono break-words", children: error })), contributionCounts && Object.keys(contributionCounts).length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1 mt-2", children: Object.entries(contributionCounts).map(([k, v]) => (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-sm border border-border bg-surface-0 px-1.5 py-0.5 text-[10px] font-mono", children: [k, ": ", v] }, k))) })), manifest.requires?.capabilities && manifest.requires.capabilities.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1 mt-2", children: manifest.requires.capabilities.map((c) => (_jsx(Badge, { intent: "neutral", children: c }, c))) }))] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { variant: "ghost", size: "xs", onClick: onReload, disabled: busy || !host, iconLeft: _jsx(RefreshCw, { className: "h-3 w-3" }), children: "Reload" }), _jsx(Button, { variant: "ghost", size: "xs", onClick: onUninstall, disabled: busy || !host, iconLeft: _jsx(Trash2, { className: "h-3 w-3" }), children: "Uninstall" })] })] }) }));
}
function StatusIcon({ status }) {
    switch (status) {
        case "active": return _jsx(CheckCircle2, { className: "h-4 w-4 text-intent-success mt-0.5" });
        case "quarantined": return _jsx(AlertTriangle, { className: "h-4 w-4 text-intent-danger mt-0.5" });
        case "deactivated": return _jsx(Power, { className: "h-4 w-4 text-text-muted mt-0.5" });
        case "loading":
        case "activating":
        case "pending": return _jsx(RefreshCw, { className: "h-4 w-4 text-accent mt-0.5 animate-spin" });
        default: return _jsx(HelpCircle, { className: "h-4 w-4 text-text-muted mt-0.5" });
    }
}
function StatusBadge({ status }) {
    const map = {
        active: { label: "Active", intent: "success" },
        quarantined: { label: "Quarantined", intent: "danger" },
        deactivated: { label: "Deactivated", intent: "neutral" },
        loading: { label: "Loading", intent: "info" },
        activating: { label: "Activating", intent: "info" },
        pending: { label: "Pending", intent: "warning" },
    };
    const { label, intent } = map[status];
    return _jsx(Badge, { intent: intent, children: label });
}
/** Theme + Layout picker — reads live from the registries, applies the
 *  selected theme's CSS custom properties to document.documentElement, and
 *  persists the choice in localStorage. */
function ThemeAndLayoutPicker() {
    const host = usePluginHost2();
    const version = usePluginHostVersion();
    void version;
    const [theme, setTheme] = React.useState(() => localStorage.getItem("gutu.theme") ?? "shell.light");
    const [layout, setLayout] = React.useState(() => localStorage.getItem("gutu.layout") ?? "shell.standard");
    React.useEffect(() => {
        if (!host)
            return;
        const spec = host.registries.themes.get(theme);
        if (!spec)
            return;
        const root = document.documentElement;
        // Record the chosen colour scheme + overlay its tokens.
        root.dataset.theme = theme;
        root.dataset.colorScheme = spec.mode;
        for (const [k, v] of Object.entries(spec.tokens ?? {})) {
            root.style.setProperty(k, v);
        }
        localStorage.setItem("gutu.theme", theme);
    }, [theme, host]);
    React.useEffect(() => {
        if (!host)
            return;
        const spec = host.registries.layouts.get(layout);
        if (!spec)
            return;
        document.documentElement.dataset.layout = layout;
        if (spec.density)
            document.documentElement.dataset.density = spec.density;
        if (spec.sidebar)
            document.documentElement.dataset.sidebar = spec.sidebar;
        if (spec.topbar)
            document.documentElement.dataset.topbar = spec.topbar;
        localStorage.setItem("gutu.layout", layout);
    }, [layout, host]);
    if (!host)
        return null;
    const themes = host.registries.themes.list();
    const layouts = host.registries.layouts.list();
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Appearance" }), _jsxs(CardDescription, { children: ["Pick a theme / layout. Any plugin can contribute its own via", " ", _jsx("code", { className: "font-mono", children: "ctx.registries.themes.register(...)" }), "."] })] }), _jsx(CardContent, { children: _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Theme" }), _jsx("select", { value: theme, onChange: (e) => setTheme(e.target.value), className: "w-full h-9 rounded border border-border bg-surface-0 px-2 text-sm", children: themes.map((t) => (_jsxs("option", { value: t.key, children: [t.value.label ?? t.key, " \u00B7 ", t.value.mode, " \u00B7 by ", t.contributor] }, t.key))) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-text-muted uppercase tracking-wider mb-1", children: "Layout" }), _jsx("select", { value: layout, onChange: (e) => setLayout(e.target.value), className: "w-full h-9 rounded border border-border bg-surface-0 px-2 text-sm", children: layouts.map((l) => (_jsxs("option", { value: l.key, children: [l.value.label ?? l.key, " \u00B7 by ", l.contributor] }, l.key))) })] })] }) })] }));
}
/** Auth providers card — lists every contributed auth provider with a
 *  one-click "Sign in with …" button. Useful for re-authentication and
 *  linking secondary identities. Pre-auth sign-in integration is a
 *  separate architectural change (requires loading auth-provider plugins
 *  before RuntimeProvider mounts). */
function AuthProvidersCard() {
    const host = usePluginHost2();
    const version = usePluginHostVersion();
    void version;
    if (!host)
        return null;
    const providers = host.registries.authProviders.list();
    if (providers.length === 0)
        return null;
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Auth providers" }), _jsx(CardDescription, { children: "Additional sign-in methods contributed by plugins. Click to authenticate." })] }), _jsx(CardContent, { children: _jsx("div", { className: "flex flex-wrap gap-2", children: providers.map((p) => (_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => void p.value.signIn().catch(() => { }), iconLeft: _jsx(Download, { className: "h-3 w-3" }), children: ["Sign in with ", p.value.label, _jsxs("span", { className: "ml-2 text-[10px] text-text-muted", children: ["\u00B7 ", p.contributor] })] }, p.key))) }) })] }));
}
/** Trusted publisher keys — used by signature verification during
 *  install-from-URL. Operators add publishers they trust. */
function TrustedKeysCard() {
    const [keys, setKeys] = React.useState([]);
    const [keyId, setKeyId] = React.useState("");
    const [label, setLabel] = React.useState("");
    const [publicKey, setPublicKey] = React.useState("");
    const [error, setError] = React.useState(null);
    React.useEffect(() => {
        /* Lazy-load to keep the signature module out of the initial bundle. */
        import("@/runtime/pluginSignature").then((m) => {
            setKeys(m.loadTrustedKeys());
        });
    }, []);
    const add = async () => {
        setError(null);
        const pk = publicKey.trim();
        if (!pk) {
            setError("Public key is required");
            return;
        }
        try {
            const m = await import("@/runtime/pluginSignature");
            const next = m.addTrustedKey({
                publicKey: pk,
                keyId: keyId.trim() || `key_${Date.now()}`,
                label: label.trim() || "unnamed",
                addedAt: new Date().toISOString(),
            });
            setKeys(next);
            setKeyId("");
            setLabel("");
            setPublicKey("");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    };
    const remove = async (pk) => {
        const m = await import("@/runtime/pluginSignature");
        setKeys(m.removeTrustedKey(pk));
    };
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Trusted publisher keys" }), _jsxs(CardDescription, { children: ["Remote-plugin manifests that declare a ", _jsx("code", { children: "signature" }), " must be signed by one of these Ed25519 public keys. Signed-plugin install is refused when the publisher's key isn't here."] })] }), _jsxs(CardContent, { className: "flex flex-col gap-3", children: [_jsx("ul", { className: "divide-y divide-border-subtle", children: keys.length === 0 ? (_jsx("li", { className: "px-1 py-3 text-xs text-text-muted", children: "No trusted keys yet." })) : (keys.map((k) => (_jsxs("li", { className: "flex items-start gap-2 py-2", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium", children: k.label }), _jsx("div", { className: "text-[10px] font-mono text-text-muted break-all", children: k.publicKey }), _jsxs("div", { className: "text-[10px] text-text-muted", children: ["id: ", k.keyId, " \u00B7 added ", new Date(k.addedAt).toLocaleString()] })] }), _jsx(Button, { variant: "ghost", size: "xs", onClick: () => void remove(k.publicKey), children: "Remove" })] }, k.publicKey)))) }), _jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsx(Input, { placeholder: "Label (e.g. Acme Labs)", value: label, onChange: (e) => setLabel(e.target.value), className: "col-span-1" }), _jsx(Input, { placeholder: "Key ID (e.g. acme-2024)", value: keyId, onChange: (e) => setKeyId(e.target.value), className: "col-span-1" }), _jsx(Input, { placeholder: "SPKI public key (base64)", value: publicKey, onChange: (e) => setPublicKey(e.target.value), className: "col-span-1 font-mono text-xs" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "primary", size: "sm", onClick: () => void add(), disabled: !publicKey.trim(), children: "Add trusted key" }), error && _jsx("span", { className: "text-xs text-intent-danger", children: error })] })] })] }));
}
function RegistriesCard() {
    const host = usePluginHost2();
    const version = usePluginHostVersion();
    void version;
    if (!host)
        return null;
    const { registries } = host;
    const sections = [
        { label: "Field kinds", entries: registries.fieldKinds.list() },
        { label: "Widget types", entries: registries.widgetTypes.list() },
        { label: "View modes", entries: registries.viewModes.list() },
        { label: "Chart kinds", entries: registries.chartKinds.list() },
        { label: "Themes", entries: registries.themes.list() },
        { label: "Layouts", entries: registries.layouts.list() },
        { label: "Data sources", entries: registries.dataSources.list() },
        { label: "Exporters", entries: registries.exporters.list() },
        { label: "Importers", entries: registries.importers.list() },
        { label: "Auth providers", entries: registries.authProviders.list() },
        { label: "Notification channels", entries: registries.notificationChannels.list() },
        { label: "Filter operators", entries: registries.filterOps.list() },
        { label: "Expression functions", entries: registries.expressionFunctions.list() },
    ].filter((s) => s.entries.length > 0);
    return (_jsxs(Card, { children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Extension registries" }), _jsxs(CardDescription, { children: ["Every open extension point \u2014 the shell seeds defaults; plugins extend by registering during ", _jsx("code", { children: "activate()" }), "."] })] }), _jsx(CardContent, { children: _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs", children: sections.map((s) => (_jsxs("div", { children: [_jsxs("div", { className: "font-medium text-text-primary mb-1", children: [s.label, " \u2014 ", s.entries.length] }), _jsx("ul", { className: "space-y-0.5", children: s.entries.map((e) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx("code", { className: "font-mono text-[11px]", children: e.key }), _jsx("span", { className: "text-text-muted ml-auto", children: e.contributor })] }, e.key))) })] }, s.label))) }) })] }));
}
