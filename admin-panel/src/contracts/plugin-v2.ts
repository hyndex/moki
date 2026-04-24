/** Plugin contract v2 — the ecosystem-grade plugin surface.
 *
 *  Coexists with the legacy `Plugin` in `./plugin.ts` via a dual-mode
 *  wrapper in the host. Written plugins can choose either shape. The host
 *  normalises both into a v2 `ActivatedPlugin` at runtime.
 *
 *  Design goals (from the spec):
 *    - Zero shell edits to add a new plugin
 *    - Plugins ship independently (filesystem folder, npm pkg, remote URL)
 *    - Every hardcoded enum in the shell (field kinds, widget types, view
 *      modes, chart kinds, auth providers, data sources …) becomes an open
 *      registry that plugins contribute to at activation time
 *    - Capability-based permissions — plugins declare what they touch
 *    - Per-plugin error boundary isolation
 *    - Disposable contributions → hot-reload + safe uninstall
 *    - Dependency + semver resolution with topological activation order
 *    - Lazy activation via `activationEvents`
 */

import type { NavItem, NavSection } from "./nav";
import type { ResourceDefinition } from "./resources";
import type { View, DashboardWidget } from "./views";
import type { ActionDescriptor } from "./actions";
import type { CommandDescriptor } from "./commands";
import type { ConnectionDescriptor } from "./widgets";
import type { FilterTree } from "./saved-views";
import type { ReactNode, ComponentType } from "react";

/* ================================================================== */
/* Capabilities — the plugin's declared permission set                 */
/* ================================================================== */

/** Standard capability strings. Extensible via typed string templates. */
export type Capability =
  /* Data */
  | "resources:read"
  | "resources:write"
  | "resources:delete"
  /* UI surfaces */
  | "nav"
  | "topbar"
  | "commands"
  | "shortcuts"
  | "theme"
  | "layout"
  /* Identity */
  | "auth"
  /* External reach */
  | "data-source"
  | "fetch:external"
  | "clipboard"
  | "storage"
  /* Platform extension */
  | "register:field-kind"
  | "register:widget-type"
  | "register:view-mode"
  | "register:exporter"
  | "register:importer"
  | "register:chart-kind"
  | "register:action-kind"
  /* Fine-grained per-resource (advanced) */
  | `resource:${string}`
  | `resource:${string}:write`
  | `resource:${string}:delete`;

/* ================================================================== */
/* Activation events — lazy-load triggers                              */
/* ================================================================== */

export type ActivationEvent =
  /** Load at shell boot. Default when nothing else is declared. */
  | { readonly kind: "onStart" }
  /** Load when the user visits any path under `path`. */
  | { readonly kind: "onNav"; readonly path: string }
  /** Load when any code touches the given resource id. */
  | { readonly kind: "onResource"; readonly resource: string }
  /** Load when the given command id is invoked. */
  | { readonly kind: "onCommand"; readonly command: string }
  /** Load when another plugin activates. */
  | { readonly kind: "onPluginActivate"; readonly plugin: string }
  /** Load when the runtime emits the named bus event. */
  | { readonly kind: "onEvent"; readonly event: string };

/* ================================================================== */
/* Manifest — the identity / compatibility / activation descriptor     */
/* ================================================================== */

export interface PluginManifest {
  /** Reversed-DNS id, e.g. `com.acme.warehouse`. Uniquely identifies the
   *  plugin across every distribution channel. */
  readonly id: string;
  /** Semver version. */
  readonly version: string;
  /** Human-readable label. */
  readonly label: string;
  readonly description?: string;
  readonly vendor?: {
    readonly name: string;
    readonly url?: string;
    readonly email?: string;
  };
  /** lucide-react icon name. */
  readonly icon?: string;
  readonly homepage?: string;
  readonly license?: string;
  readonly keywords?: readonly string[];

  /** Compatibility. */
  readonly requires?: {
    /** Semver range against the shell's API version. */
    readonly shell?: string;
    /** Required peer plugins. id → semver range. */
    readonly plugins?: Readonly<Record<string, string>>;
    /** Capabilities the plugin needs. User must consent. */
    readonly capabilities?: readonly Capability[];
  };

  /** Activation — when to load this plugin. Defaults to onStart. */
  readonly activationEvents?: readonly ActivationEvent[];

  /** Optional sandboxing tier. */
  readonly sandbox?: "none" | "iframe" | "worker";

  /** Where the plugin came from — set by the loader, not the author. */
  readonly origin?: {
    readonly kind: "filesystem" | "npm" | "remote" | "explicit" | "legacy";
    readonly location?: string;
    readonly integrity?: string;
    readonly signature?: string;
  };
}

/* ================================================================== */
/* The plugin itself — manifest + activate + optional public API       */
/* ================================================================== */

export interface PluginV2<TApi = unknown> {
  readonly manifest: PluginManifest;
  /** Called once when the plugin activates. Register contributions here. */
  readonly activate: (ctx: PluginContext) => void | Promise<void>;
  /** Called when the plugin deactivates (shell shutdown or uninstall). */
  readonly deactivate?: () => void | Promise<void>;
  /** Optional typed API exposed to other plugins via `peers.get(id)?.api`. */
  readonly api?: TApi;
}

/* ================================================================== */
/* Disposable — every contribution is revocable                        */
/* ================================================================== */

export type Disposable = () => void;

/* ================================================================== */
/* PluginContext — everything the plugin gets during activate()        */
/* ================================================================== */

export interface PluginContext {
  /** The plugin's own manifest — useful for logging / asset resolution. */
  readonly manifest: PluginManifest;

  /** Typed declarative registrars. Each returns a Disposable. */
  readonly contribute: PluginContributions;

  /** Hot-pluggable extension registries — platform-level customisation. */
  readonly registries: ExtensionRegistries;

  /** Scoped runtime services — storage, logger, i18n, assets, events, etc. */
  readonly runtime: ScopedRuntime;

  /** Read-only view of peer plugins — for inter-plugin API calls. */
  readonly peers: PeerAccess;
}

export interface PluginContributions {
  nav(items: readonly NavItem[]): Disposable;
  navSections(sections: readonly NavSection[]): Disposable;
  views(views: readonly View[]): Disposable;
  resources(resources: readonly ResourceDefinition[]): Disposable;
  widgets(widgets: readonly DashboardWidget[]): Disposable;
  actions(actions: readonly ActionDescriptor[]): Disposable;
  commands(commands: readonly CommandDescriptor[]): Disposable;
  connections(desc: ConnectionDescriptor): Disposable;
  /** Extensions that augment another plugin's view. */
  viewExtensions(extensions: readonly ViewExtension[]): Disposable;
  /** Route guards fired before navigation. */
  routeGuards(guards: readonly RouteGuard[]): Disposable;
  /** Keyboard shortcuts (global). */
  shortcuts(shortcuts: readonly KeyboardShortcut[]): Disposable;
  /** Cron / scheduled jobs (run in a background timer). */
  jobs(jobs: readonly ScheduledJob[]): Disposable;
  /** Seed rows into the mock backend — opt-in. */
  seeds(seeds: readonly ResourceSeed[]): Disposable;
}

/* ================================================================== */
/* View extensions — augment another plugin's page                     */
/* ================================================================== */

export interface ViewExtension {
  /** Target view id (e.g. "com.gutu.sales.order-detail.view") or a predicate. */
  readonly target: string | ((viewId: string, resource?: string) => boolean);
  /** What to add. At least one of these should be non-null. */
  readonly tab?: {
    readonly id: string;
    readonly label: string;
    readonly priority?: number;
    readonly render: (record: Record<string, unknown>) => ReactNode;
    readonly visibleWhen?: (record: Record<string, unknown>) => boolean;
  };
  readonly section?: {
    readonly id: string;
    readonly title: string;
    readonly priority?: number;
    readonly render: (record: Record<string, unknown>) => ReactNode;
  };
  readonly rowAction?: ActionDescriptor;
  readonly pageAction?: ActionDescriptor;
  readonly bulkAction?: ActionDescriptor;
  /** Wrap the entire rendered view with middleware (auth gate, metrics, …). */
  readonly wrap?: (
    children: ReactNode,
    ctx: { viewId: string; resource?: string; record?: Record<string, unknown> },
  ) => ReactNode;
  /** A right-rail card for detail pages. */
  readonly railCard?: {
    readonly id: string;
    readonly priority?: number;
    readonly render: (record: Record<string, unknown>) => ReactNode;
  };
}

/* ================================================================== */
/* Route guards — middleware run before navigation                     */
/* ================================================================== */

export interface RouteGuard {
  /** String prefix or regex. */
  readonly match: string | RegExp;
  readonly priority?: number;
  /** Return `true`/`undefined` to allow, `false` to block silently, or
   *  an object to redirect. */
  readonly guard: (ctx: RouteGuardContext) =>
    | boolean
    | void
    | { redirect: string }
    | Promise<boolean | void | { redirect: string }>;
}

export interface RouteGuardContext {
  readonly path: string;
  readonly from?: string;
  readonly user?: { id?: string; roles?: readonly string[]; email?: string };
}

/* ================================================================== */
/* Keyboard shortcuts                                                  */
/* ================================================================== */

export interface KeyboardShortcut {
  /** e.g. "mod+k", "shift+?", "g h" (sequence). */
  readonly keys: string;
  readonly label?: string;
  readonly description?: string;
  readonly when?: () => boolean;
  readonly run: () => void | Promise<void>;
}

/* ================================================================== */
/* Scheduled jobs                                                      */
/* ================================================================== */

export interface ScheduledJob {
  readonly id: string;
  readonly label?: string;
  /** Simple interval in ms, or an rfc 5545-ish cron string ("every 5m"). */
  readonly schedule: number | string;
  readonly run: () => void | Promise<void>;
  /** Run once at activation as well. Default false. */
  readonly runOnActivate?: boolean;
}

/* ================================================================== */
/* Resource seeds (mock backend fixtures)                              */
/* ================================================================== */

export interface ResourceSeed {
  readonly resource: string;
  readonly rows: readonly Record<string, unknown>[];
}

/* ================================================================== */
/* Extension registries — the open-enum spine                          */
/* ================================================================== */

export interface Registry<K extends string, V> {
  register(key: K, value: V): Disposable;
  registerMany(entries: Readonly<Record<K, V>>): Disposable;
  get(key: K): V | undefined;
  has(key: K): boolean;
  list(): readonly RegistryEntry<K, V>[];
  keys(): readonly K[];
  onChange(cb: (ev: RegistryChangeEvent<K>) => void): Disposable;
}

export interface RegistryEntry<K extends string, V> {
  readonly key: K;
  readonly value: V;
  readonly contributor: string;
  readonly registeredAt: number;
}

export interface RegistryChangeEvent<K extends string> {
  readonly kind: "register" | "unregister";
  readonly key: K;
  readonly contributor: string;
}

/* ------ Registry payload types ------ */

export interface FieldKindSpec {
  /** Rendered in ListView cells + Overview sections. */
  readonly cell?: ComponentType<FieldKindCellProps>;
  /** Rendered inside the form renderer. */
  readonly form?: ComponentType<FieldKindFormProps>;
  /** Which filter operators apply to this kind. */
  readonly filterOperators?: readonly string[];
  /** Zod type for validation (optional). */
  readonly zodType?: unknown;
  /** Totaling function compatible with this kind. */
  readonly defaultTotaling?: "sum" | "avg" | "count" | "min" | "max";
  /** Is the value naturally right-aligned in tables? */
  readonly rightAlign?: boolean;
  /** Icon for UI affordances. */
  readonly icon?: string;
  /** Human label used in pickers. */
  readonly label?: string;
}

export interface FieldKindCellProps {
  readonly value: unknown;
  readonly record: Record<string, unknown>;
  readonly options?: readonly { value: string; label: string; intent?: string }[];
  readonly currency?: string;
}

export interface FieldKindFormProps {
  readonly name: string;
  readonly label?: string;
  readonly value: unknown;
  readonly onChange: (next: unknown) => void;
  readonly required?: boolean;
  readonly readonly?: boolean;
  readonly error?: string;
  readonly options?: readonly { value: string; label: string }[];
}

export interface WidgetTypeSpec {
  readonly render: ComponentType<{ widget: unknown }>;
  readonly defaultCol?: number;
  readonly defaultRow?: "short" | "tall";
  readonly label?: string;
  readonly icon?: string;
}

export interface ViewModeSpec {
  readonly renderer: ComponentType<ViewModeRendererProps>;
  readonly accepts: (view: View) => boolean;
  readonly label?: string;
  readonly icon?: string;
}

export interface ViewModeRendererProps {
  readonly view: View;
  readonly basePath: string;
}

export interface ThemeSpec {
  readonly label: string;
  readonly mode: "light" | "dark";
  readonly tokens: Readonly<Record<string, string>>;
}

export interface LayoutSpec {
  readonly label: string;
  readonly sidebar?: "left" | "right" | "hidden";
  readonly density?: "comfortable" | "compact" | "dense";
  readonly topbar?: "minimal" | "full" | "hidden";
}

export interface DataSourceAdapter<Cfg = unknown> {
  readonly label: string;
  connect(config: Cfg): DataSourceConnection;
  readonly configSchema?: unknown;
}

export interface DataSourceConnection {
  list(resource: string, query: unknown): Promise<{ rows: unknown[]; total?: number }>;
  get(resource: string, id: string): Promise<Record<string, unknown> | null>;
  create(resource: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(resource: string, id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>>;
  delete(resource: string, id: string): Promise<void>;
}

export interface ExporterSpec {
  readonly label: string;
  readonly extension: string;
  readonly mimeType: string;
  export(rows: readonly Record<string, unknown>[], meta: { fileName: string }): Promise<Blob>;
}

export interface ImporterSpec {
  readonly label: string;
  readonly accepts: readonly string[];
  parse(file: File): Promise<readonly Record<string, unknown>[]>;
}

export interface AuthProviderSpec {
  readonly label: string;
  readonly icon?: string;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  isSignedIn(): boolean;
}

export interface ChartKindSpec {
  readonly label: string;
  readonly render: ComponentType<{ data: unknown; height?: number; format?: unknown }>;
  readonly accepts: "series" | "groups" | "both";
}

export interface NotificationChannelSpec {
  readonly label: string;
  send(msg: { title: string; body?: string; level?: "info" | "warn" | "error" }): Promise<void>;
}

export interface ExtensionRegistries {
  readonly fieldKinds: Registry<string, FieldKindSpec>;
  readonly widgetTypes: Registry<string, WidgetTypeSpec>;
  readonly viewModes: Registry<string, ViewModeSpec>;
  readonly themes: Registry<string, ThemeSpec>;
  readonly layouts: Registry<string, LayoutSpec>;
  readonly dataSources: Registry<string, DataSourceAdapter>;
  readonly exporters: Registry<string, ExporterSpec>;
  readonly importers: Registry<string, ImporterSpec>;
  readonly authProviders: Registry<string, AuthProviderSpec>;
  readonly chartKinds: Registry<string, ChartKindSpec>;
  readonly notificationChannels: Registry<string, NotificationChannelSpec>;
  readonly filterOps: Registry<string, FilterOpSpec>;
  readonly expressionFunctions: Registry<string, ExpressionFunctionSpec>;
}

export interface FilterOpSpec {
  readonly label: string;
  readonly arity: 0 | 1 | 2;
  readonly appliesTo: readonly string[]; // field kinds
  evaluate(value: unknown, leaf: unknown, now: Date): boolean;
}

export interface ExpressionFunctionSpec {
  readonly arity: number | [number, number];
  readonly returns: "number" | "string" | "boolean" | "any";
  readonly call: (...args: unknown[]) => unknown;
}

/* ================================================================== */
/* ScopedRuntime — what plugins get under `ctx.runtime`                */
/* ================================================================== */

export interface ScopedRuntime {
  readonly resources: ScopedResourceClient;
  readonly bus: ScopedEventBus;
  readonly storage: PluginStorage;
  readonly logger: Logger;
  readonly i18n: I18n;
  readonly assets: AssetResolver;
  readonly permissions: PermissionGate;
  readonly analytics: Analytics;
  readonly notify: (msg: { title: string; body?: string; intent?: "info" | "success" | "warning" | "danger" }) => void;
}

export interface ScopedResourceClient {
  list(resource: string, query?: unknown): Promise<{ rows: Record<string, unknown>[]; total?: number }>;
  get(resource: string, id: string): Promise<Record<string, unknown> | null>;
  create(resource: string, body: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(resource: string, id: string, patch: Record<string, unknown>): Promise<Record<string, unknown>>;
  delete(resource: string, id: string): Promise<void>;
}

export interface ScopedEventBus {
  emit<T = unknown>(event: string, payload?: T): void;
  on<T = unknown>(event: string, handler: (payload: T) => void): Disposable;
  once<T = unknown>(event: string, handler: (payload: T) => void): Disposable;
}

export interface PluginStorage {
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
  keys(): readonly string[];
}

export interface Logger {
  trace(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface I18n {
  t(key: string, params?: Record<string, unknown>): string;
  locale(): string;
  setCatalog(locale: string, entries: Record<string, string>): void;
}

export interface AssetResolver {
  /** Resolve a relative URL inside the plugin's asset bundle. */
  url(relative: string): string;
}

export interface PermissionGate {
  has(capability: Capability): boolean;
  require(capability: Capability): void; // throws if not granted
}

export interface Analytics {
  emit(event: string, props?: Record<string, unknown>): void;
  setMeta(meta: Record<string, unknown>): void;
}

/* ================================================================== */
/* Peer access                                                         */
/* ================================================================== */

export interface PeerAccess {
  get<T = unknown>(pluginId: string): { api: T; manifest: PluginManifest } | undefined;
  isActive(pluginId: string): boolean;
  on(
    event: "activated" | "deactivated" | "quarantined",
    handler: (pluginId: string) => void,
  ): Disposable;
}

/* ================================================================== */
/* Installation state                                                  */
/* ================================================================== */

export type PluginStatus =
  | "pending"          // waiting for deps
  | "loading"          // module being imported
  | "activating"       // activate() running
  | "active"           // registered successfully
  | "quarantined"      // failed / disabled
  | "deactivated";     // cleaned up

export interface PluginInstallRecord {
  readonly manifest: PluginManifest;
  readonly status: PluginStatus;
  readonly error?: string;
  readonly activatedAt?: number;
  readonly contributionCounts?: Readonly<Record<string, number>>;
  readonly consentedCapabilities?: readonly Capability[];
}

/* ================================================================== */
/* definePlugin — the v2 author-facing helper                          */
/* ================================================================== */

/** Strongly typed helper for authoring a v2 plugin. Does no work; returns
 *  the object as-is. Exists so plugin files read like JSON config. */
export function definePlugin<TApi = unknown>(plugin: PluginV2<TApi>): PluginV2<TApi> {
  return plugin;
}

/* ================================================================== */
/* AnyPlugin — the union the host accepts                              */
/* ================================================================== */

import type { Plugin as LegacyPlugin } from "./plugin";
export type AnyPlugin = PluginV2 | LegacyPlugin;

export function isV2Plugin(p: AnyPlugin): p is PluginV2 {
  return "manifest" in p && "activate" in p && typeof (p as PluginV2).activate === "function";
}
