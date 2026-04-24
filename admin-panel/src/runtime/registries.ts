/** Extension registries — the open-enum spine of the plugin system.
 *
 *  Every hardcoded enum in the shell (field kinds, widget types, view
 *  modes, chart kinds, filter ops, exporters, data sources …) becomes a
 *  live Registry that plugins contribute to at activation time. The shell
 *  ships defaults (via `seedBuiltInRegistries`) so existing plugins keep
 *  working; new plugins can then extend.
 *
 *  A Registry is observable: components that render with contributed
 *  entries (e.g. ListView reading field-kind cell renderers) subscribe via
 *  `onChange` so they re-render when a plugin activates or deactivates.
 *
 *  Every entry records its `contributor` (the plugin id) so the Plugin
 *  Inspector can attribute contributions and so the shell can clean up
 *  when a plugin is uninstalled.
 */

import type {
  Registry,
  RegistryEntry,
  RegistryChangeEvent,
  Disposable,
  ExtensionRegistries,
  FieldKindSpec,
  WidgetTypeSpec,
  ViewModeSpec,
  ThemeSpec,
  LayoutSpec,
  DataSourceAdapter,
  ExporterSpec,
  ImporterSpec,
  AuthProviderSpec,
  ChartKindSpec,
  NotificationChannelSpec,
  FilterOpSpec,
  ExpressionFunctionSpec,
} from "@/contracts/plugin-v2";

/* ================================================================== */
/* Registry<K,V> implementation                                        */
/* ================================================================== */

class RegistryImpl<K extends string, V> implements Registry<K, V> {
  private readonly entries = new Map<K, RegistryEntry<K, V>>();
  private readonly listeners = new Set<(ev: RegistryChangeEvent<K>) => void>();
  /** Current contributor while `register` runs — set by the host via
   *  `withContributor(id, fn)`. Plugins never set this themselves. */
  private currentContributor: string = "shell";

  /** Used by the host to scope registrations to a given plugin. */
  _withContributor<T>(contributor: string, fn: () => T): T {
    const prev = this.currentContributor;
    this.currentContributor = contributor;
    try {
      return fn();
    } finally {
      this.currentContributor = prev;
    }
  }

  register(key: K, value: V): Disposable {
    if (this.entries.has(key)) {
      // Soft conflict — later registration wins but we emit a warning.
      const prev = this.entries.get(key)!;
      // eslint-disable-next-line no-console
      console.warn(
        `[registry] Key "${key}" re-registered by "${this.currentContributor}" (previously from "${prev.contributor}"). Previous entry shadowed.`,
      );
    }
    const entry: RegistryEntry<K, V> = {
      key,
      value,
      contributor: this.currentContributor,
      registeredAt: Date.now(),
    };
    this.entries.set(key, entry);
    this.emit({ kind: "register", key, contributor: entry.contributor });
    const contributor = this.currentContributor;
    return () => {
      const current = this.entries.get(key);
      // Only unregister if we still own it (guards against hot-swap races).
      if (current && current.contributor === contributor) {
        this.entries.delete(key);
        this.emit({ kind: "unregister", key, contributor });
      }
    };
  }

  registerMany(entries: Readonly<Record<K, V>>): Disposable {
    const disposers: Disposable[] = [];
    for (const [k, v] of Object.entries(entries) as [K, V][]) {
      disposers.push(this.register(k, v));
    }
    return () => {
      for (const d of disposers) d();
    };
  }

  get(key: K): V | undefined {
    return this.entries.get(key)?.value;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  list(): readonly RegistryEntry<K, V>[] {
    return Array.from(this.entries.values());
  }

  keys(): readonly K[] {
    return Array.from(this.entries.keys());
  }

  onChange(cb: (ev: RegistryChangeEvent<K>) => void): Disposable {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit(ev: RegistryChangeEvent<K>): void {
    for (const l of this.listeners) {
      try {
        l(ev);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[registry] listener threw", err);
      }
    }
  }
}

/* ================================================================== */
/* Registries — one instance per shell                                 */
/* ================================================================== */

export interface ExtensionRegistriesMutable extends ExtensionRegistries {
  /** Internal helper — scopes the next N `register(...)` calls to the
   *  given contributor id. Used by pluginContext.ts. */
  _withContributor<T>(contributor: string, fn: () => T): T;
}

export function createExtensionRegistries(): ExtensionRegistriesMutable {
  const fieldKinds = new RegistryImpl<string, FieldKindSpec>();
  const widgetTypes = new RegistryImpl<string, WidgetTypeSpec>();
  const viewModes = new RegistryImpl<string, ViewModeSpec>();
  const themes = new RegistryImpl<string, ThemeSpec>();
  const layouts = new RegistryImpl<string, LayoutSpec>();
  const dataSources = new RegistryImpl<string, DataSourceAdapter>();
  const exporters = new RegistryImpl<string, ExporterSpec>();
  const importers = new RegistryImpl<string, ImporterSpec>();
  const authProviders = new RegistryImpl<string, AuthProviderSpec>();
  const chartKinds = new RegistryImpl<string, ChartKindSpec>();
  const notificationChannels = new RegistryImpl<string, NotificationChannelSpec>();
  const filterOps = new RegistryImpl<string, FilterOpSpec>();
  const expressionFunctions = new RegistryImpl<string, ExpressionFunctionSpec>();

  const all = [
    fieldKinds, widgetTypes, viewModes, themes, layouts,
    dataSources, exporters, importers, authProviders, chartKinds,
    notificationChannels, filterOps, expressionFunctions,
  ];

  return {
    fieldKinds,
    widgetTypes,
    viewModes,
    themes,
    layouts,
    dataSources,
    exporters,
    importers,
    authProviders,
    chartKinds,
    notificationChannels,
    filterOps,
    expressionFunctions,
    _withContributor<T>(contributor: string, fn: () => T): T {
      // Enter contributor scope on every registry, run fn, exit.
      // We nest by simply setting on all and restoring on all.
      let result!: T;
      const run = (idx: number) => {
        if (idx === all.length) {
          result = fn();
          return;
        }
        (all[idx] as RegistryImpl<string, unknown>)._withContributor(contributor, () => {
          run(idx + 1);
        });
      };
      run(0);
      return result;
    },
  };
}

/* ================================================================== */
/* Built-in defaults — seeded at shell boot so plugins keep working    */
/* ================================================================== */

export function seedBuiltInRegistries(registries: ExtensionRegistriesMutable): void {
  registries._withContributor("shell", () => {
    /* Built-in field kinds — pure data markers; actual rendering stays in
     * renderCellValue / FormView for backward compat. Plugins may override
     * any of these entries by registering a fieldKinds entry with the same
     * key plus a `cell` or `form` component. */
    const DEFAULT_FIELD_KINDS: Array<[string, FieldKindSpec]> = [
      ["text", { label: "Text", filterOperators: ["eq", "neq", "contains", "starts_with", "ends_with", "is_null", "is_not_null"] }],
      ["textarea", { label: "Long text", filterOperators: ["contains"] }],
      ["number", { label: "Number", rightAlign: true, defaultTotaling: "sum", filterOperators: ["eq", "neq", "lt", "lte", "gt", "gte", "between"] }],
      ["currency", { label: "Currency", rightAlign: true, defaultTotaling: "sum", filterOperators: ["eq", "neq", "lt", "lte", "gt", "gte", "between"] }],
      ["email", { label: "Email", filterOperators: ["eq", "neq", "contains"] }],
      ["url", { label: "URL", filterOperators: ["eq", "contains"] }],
      ["phone", { label: "Phone", filterOperators: ["eq", "contains"] }],
      ["boolean", { label: "Boolean", filterOperators: ["eq"] }],
      ["date", { label: "Date", filterOperators: ["eq", "lt", "lte", "gt", "gte", "between", "last_n_days", "today", "yesterday", "this_week", "this_month", "this_quarter", "this_year", "mtd", "qtd", "ytd"] }],
      ["datetime", { label: "Date & time", filterOperators: ["eq", "lt", "lte", "gt", "gte", "between", "last_n_days", "today"] }],
      ["enum", { label: "Enum", filterOperators: ["eq", "neq", "in", "nin"] }],
      ["multi-enum", { label: "Multi-enum", filterOperators: ["in", "nin"] }],
      ["reference", { label: "Reference", filterOperators: ["eq", "neq"] }],
      ["json", { label: "JSON", filterOperators: [] }],
      ["custom", { label: "Custom", filterOperators: [] }],
    ];
    for (const [key, spec] of DEFAULT_FIELD_KINDS) {
      registries.fieldKinds.register(key, spec);
    }

    /* Built-in themes — expose current shell defaults as a named entry
     * so plugins can fork them. */
    registries.themes.register("shell.light", {
      label: "Light (default)",
      mode: "light",
      tokens: {},
    });
    registries.themes.register("shell.dark", {
      label: "Dark",
      mode: "dark",
      tokens: {},
    });

    /* Built-in layouts */
    registries.layouts.register("shell.standard", {
      label: "Standard",
      sidebar: "left",
      density: "compact",
      topbar: "full",
    });
    registries.layouts.register("shell.minimal", {
      label: "Minimal",
      sidebar: "left",
      density: "dense",
      topbar: "minimal",
    });

    /* Built-in exporters — CSV + JSON. xlsx lives in ExportCenter. */
    registries.exporters.register("csv", {
      label: "CSV",
      extension: "csv",
      mimeType: "text/csv",
      export: async (rows, { fileName }) => {
        void fileName;
        const keys = Array.from(
          rows.reduce((s, r) => {
            Object.keys(r).forEach((k) => s.add(k));
            return s;
          }, new Set<string>()),
        );
        const esc = (v: unknown) => {
          if (v == null) return "";
          const s = typeof v === "object" ? JSON.stringify(v) : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const header = keys.join(",");
        const body = rows.map((r) => keys.map((k) => esc(r[k])).join(",")).join("\n");
        return new Blob([header + "\n" + body], { type: "text/csv" });
      },
    });
    registries.exporters.register("json", {
      label: "JSON",
      extension: "json",
      mimeType: "application/json",
      export: async (rows) =>
        new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }),
    });
  });
}
