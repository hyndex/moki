/** Sample plugin — Warehouse.
 *
 *  Demonstrates every key v2 feature end-to-end. Drop this file (any folder
 *  under `src/plugins/`) and the shell auto-discovers + activates it.
 *  Zero edits to `App.tsx`, `src/examples/index.ts`, or the shell.
 *
 *  Features demonstrated:
 *    1. `activate(ctx)` pattern with typed contributions.
 *    2. Resource + list + form + detail via `buildDomainPlugin` (still
 *       usable from inside a v2 plugin).
 *    3. Custom field kind registered on the fieldKinds registry — any
 *       other plugin can use `{ field: "sku", kind: "barcode" }`.
 *    4. View extension — adds a "Warehouse stock" tab to any Sales order
 *       detail page (inter-plugin composition).
 *    5. Route guard — logs every navigation under `/warehouse/`.
 *    6. Keyboard shortcut — `g w` jumps to the warehouse.
 *    7. Scheduled job — every 2 minutes, rebalances low-stock alerts.
 *    8. Public API — other plugins can call
 *       `ctx.peers.get<WarehouseApi>("com.gutu.warehouse")?.api.reorder(...)`. */

import * as React from "react";
import { z } from "zod";
import { Barcode, Package, TriangleAlert } from "lucide-react";
import { definePlugin } from "@/contracts/plugin-v2";
import { buildDomainPlugin } from "@/examples/_factory/buildDomainPlugin";
import { Badge } from "@/primitives/Badge";
import type { FieldKindSpec } from "@/contracts/plugin-v2";

/* -------------------------------------------------------------- */
/* Public API exposed to peer plugins                              */
/* -------------------------------------------------------------- */
export interface WarehouseApi {
  reorder(sku: string, qty: number): Promise<void>;
  stockFor(sku: string): Promise<number>;
}

/* -------------------------------------------------------------- */
/* Custom "barcode" field kind                                      */
/* -------------------------------------------------------------- */
const BarcodeCell: FieldKindSpec["cell"] = ({ value }) => {
  if (!value) return <span className="text-text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <Barcode className="h-3 w-3 text-accent" />
      {String(value)}
    </span>
  );
};

const BarcodeForm: FieldKindSpec["form"] = ({ name, value, onChange, required, readonly }) => (
  <input
    type="text"
    inputMode="numeric"
    pattern="[0-9]{13}"
    placeholder="0000000000000"
    value={(value as string) ?? ""}
    onChange={(e) => onChange(e.target.value)}
    required={required}
    readOnly={readonly}
    name={name}
    className="w-full h-9 rounded border border-border bg-surface-0 px-2 text-sm font-mono tabular-nums"
  />
);

/* -------------------------------------------------------------- */
/* Resource construction (factory-backed)                           */
/* -------------------------------------------------------------- */
const warehouseDomain = buildDomainPlugin({
  id: "com.gutu.warehouse",
  label: "Warehouse",
  icon: "Warehouse",
  section: { id: "operations", label: "Operations", order: 30 },
  order: 900,
  resources: [
    {
      id: "item",
      singular: "Warehouse Item",
      plural: "Warehouse Items",
      icon: "Package",
      path: "/warehouse/items",
      displayField: "name",
      fields: [
        { name: "sku", label: "SKU", kind: "text", sortable: true, width: 140 },
        // Uses the custom `barcode` field kind — renders via the cell
        // component registered in activate(). Other plugins can also use it.
        { name: "barcode", label: "Barcode", kind: "barcode" as unknown as "text", sortable: true, width: 160 },
        { name: "name", label: "Name", kind: "text", required: true, sortable: true },
        {
          name: "status",
          label: "Status",
          kind: "enum",
          sortable: true,
          options: [
            { value: "in_stock",     label: "In stock",     intent: "success" },
            { value: "low_stock",    label: "Low stock",    intent: "warning" },
            { value: "out_of_stock", label: "Out of stock", intent: "danger" },
            { value: "retired",      label: "Retired",      intent: "neutral" },
          ],
        },
        { name: "onHand", label: "On hand", kind: "number", align: "right", sortable: true },
        { name: "reorderAt", label: "Reorder at", kind: "number", align: "right" },
        { name: "unitCost", label: "Unit cost", kind: "currency", align: "right" },
        { name: "warehouse", label: "Warehouse", kind: "text" },
        { name: "updatedAt", label: "Updated", kind: "datetime", sortable: true },
      ],
      seedCount: 40,
      seed: (i) => {
        const onHand = [0, 5, 12, 40, 150, 600, 2400][i % 7];
        const reorderAt = [10, 20, 50, 100][i % 4];
        const status =
          onHand === 0
            ? "out_of_stock"
            : onHand < reorderAt
              ? "low_stock"
              : i % 19 === 0
                ? "retired"
                : "in_stock";
        return {
          id: `whi_${i + 1}`,
          sku: `WH-${String(1000 + i).padStart(5, "0")}`,
          barcode: `${String(4000000000000 + i * 17).slice(0, 13)}`,
          name: [
            "Hex Bolt M10", "Steel Bearing", "Silicone Gasket", "Cable Gland",
            "Power Supply 5V", "Cooling Fan", "LED Panel", "Roll Pin 4mm",
          ][i % 8] + " #" + (i + 1),
          status,
          onHand,
          reorderAt,
          unitCost: Math.round((1 + i * 0.7) * 100) / 100,
          warehouse: ["North-1", "South-2", "DC-East", "DC-West"][i % 4],
          updatedAt: new Date(Date.now() - i * 3_600_000).toISOString(),
        };
      },
    },
  ],
});

/* -------------------------------------------------------------- */
/* The v2 plugin — wraps the domain contributions + extra hooks    */
/* -------------------------------------------------------------- */
export default definePlugin<WarehouseApi>({
  manifest: {
    id: "com.gutu.warehouse",
    version: "1.0.0",
    label: "Warehouse",
    description: "Inventory items, stock levels, reorder points. Demo v2 plugin.",
    vendor: { name: "Gutu Labs", url: "https://gutu.dev" },
    icon: "Warehouse",
    license: "MIT",
    keywords: ["inventory", "warehouse", "stock"],
    requires: {
      shell: "^2.0.0",
      capabilities: [
        "resources:read",
        "resources:write",
        "resources:delete",
        "nav",
        "commands",
        "shortcuts",
        "storage",
        "register:field-kind",
      ],
    },
    activationEvents: [{ kind: "onStart" }],
    origin: { kind: "filesystem", location: "src/plugins/warehouse" },
  },

  api: {
    async reorder(_sku, _qty) {
      /* Stub — in production this would issue a PO via the procurement plugin. */
    },
    async stockFor(_sku) {
      return 0;
    },
  },

  async activate(ctx) {
    ctx.runtime.logger.info("Warehouse activating…");

    /* 1. Expose the barcode field kind — every plugin can use kind:"barcode". */
    ctx.registries.fieldKinds.register("barcode", {
      label: "Barcode",
      icon: "Barcode",
      cell: BarcodeCell,
      form: BarcodeForm,
      zodType: z.string().regex(/^\d{13}$/, "Barcode must be 13 digits"),
      filterOperators: ["eq", "neq", "contains", "starts_with", "ends_with"],
    });

    /* 2. Register the auto-generated domain contributions (resources/views/
     *    nav/actions) from the factory. */
    if (warehouseDomain.admin?.navSections) {
      ctx.contribute.navSections(warehouseDomain.admin.navSections);
    }
    if (warehouseDomain.admin?.nav) {
      ctx.contribute.nav(warehouseDomain.admin.nav);
    }
    if (warehouseDomain.admin?.resources) {
      ctx.contribute.resources(warehouseDomain.admin.resources);
    }
    if (warehouseDomain.admin?.views) {
      ctx.contribute.views(warehouseDomain.admin.views);
    }
    if (warehouseDomain.admin?.commands?.length) {
      ctx.contribute.commands(warehouseDomain.admin.commands);
    }

    /* 3. View extension — add "Warehouse stock" tab to any Sales Order detail. */
    ctx.contribute.viewExtensions([
      {
        // Broad match — any sales.* detail page. Includes sales-partner,
        // territory, credit-limit, etc. Demonstrates cross-plugin view
        // augmentation end-to-end.
        target: (viewId) => /^sales\..*-detail\.view$/.test(viewId),
        tab: {
          id: "warehouse.stock",
          label: "Warehouse stock",
          priority: 60,
          render: (record) => (
            <div className="rounded-md border border-border p-3 text-sm">
              <div className="font-medium text-text-primary mb-2 inline-flex items-center gap-2">
                <Package className="h-4 w-4 text-accent" />
                Warehouse availability for this order
              </div>
              <div className="text-xs text-text-muted">
                Order id: <code className="font-mono">{String(record.id ?? "—")}</code>
              </div>
              <div className="mt-2 text-xs">
                Contributed by the Warehouse plugin via <code className="font-mono">viewExtensions</code>.
              </div>
            </div>
          ),
        },
      },
    ]);

    /* 4. Route guard — log every navigation under `/warehouse/`. */
    ctx.contribute.routeGuards([
      {
        match: "/warehouse/",
        priority: 10,
        guard: ({ path, from }) => {
          ctx.runtime.logger.debug("nav", from ?? "(initial)", "→", path);
          return true;
        },
      },
    ]);

    /* 5. Keyboard shortcut — `g w` jumps to the warehouse items list. */
    ctx.contribute.shortcuts([
      {
        keys: "g w",
        label: "Go to warehouse",
        description: "Jump to the warehouse items list.",
        run: () => {
          window.location.hash = "/warehouse/items";
        },
      },
    ]);

    /* 6. Scheduled job — every 2 minutes rebalance low-stock alerts. */
    ctx.contribute.jobs([
      {
        id: "rebalance-low-stock",
        label: "Rebalance low-stock alerts",
        schedule: "every 2m",
        runOnActivate: false,
        run: async () => {
          // In production we'd query for items where onHand < reorderAt
          // and push a notification. Demo logs instead.
          ctx.runtime.logger.info("rebalance tick");
        },
      },
    ]);

    ctx.runtime.logger.info("Warehouse activated.");
  },

  deactivate() {
    // Nothing explicit — all contributions auto-dispose via the host.
  },
});

// Named export so findPluginExport works even without default.
export { default as warehousePlugin } from "./index";

/* -------------------------------------------------------------- */
/* Demonstrate the "barcode" field kind showing up on the list.   */
/* -------------------------------------------------------------- */

// Rewrite the `sku` column declaration above to use the custom kind once
// the registry has it. For demonstration purposes the resource defines
// `kind: "text"` so the list works even if another plugin disables the
// barcode contribution — registry extensions are opt-in augmentations.
// A real author could switch to `kind: "barcode"` once confident the
// contribution is permanent.

void TriangleAlert; // keep the icon import live for future UI
