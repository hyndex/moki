import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const workspace = {
    id: "inventory.control-room",
    label: "Inventory Control Room",
    filterBar: [
        { field: "warehouse", label: "Warehouse", kind: "text" },
        { field: "category", label: "Category", kind: "text" },
        { field: "sku", label: "SKU", kind: "text", placeholder: "Exact or partial" },
    ],
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Stock pulse", level: 2 },
        { id: "k-items", type: "number_card", col: 3, label: "Active SKUs",
            aggregation: { resource: "inventory.item", fn: "count" },
            drilldown: "/inventory/items" },
        { id: "k-value", type: "number_card", col: 3, label: "Inventory value",
            aggregation: { resource: "inventory.item", fn: "sum", field: "inventoryValue" },
            format: "currency", drilldown: "/inventory/items" },
        { id: "k-low", type: "number_card", col: 3, label: "Below reorder",
            aggregation: { resource: "inventory.item", fn: "count",
                filter: { field: "belowReorder", op: "eq", value: true } },
            drilldown: "/inventory/alerts", warnAbove: 5, dangerAbove: 15 },
        { id: "k-moves", type: "number_card", col: 3, label: "Stock moves MTD",
            aggregation: { resource: "inventory.stock-entry", fn: "count", range: { kind: "mtd" } },
            drilldown: "/inventory/stock-entries" },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-category", type: "chart", col: 6, label: "SKUs by category", chart: "donut",
            aggregation: { resource: "inventory.item", fn: "count", groupBy: "category" },
            drilldown: "/inventory/items" },
        { id: "c-warehouse", type: "chart", col: 6, label: "On-hand by warehouse", chart: "bar",
            aggregation: { resource: "inventory.bin", fn: "sum", field: "onHand", groupBy: "warehouse" } },
        { id: "c-movement", type: "chart", col: 6, label: "Stock moves (30d)", chart: "area",
            aggregation: { resource: "inventory.stock-entry", fn: "count", period: "day", range: { kind: "last", days: 30 } } },
        { id: "c-batch", type: "chart", col: 6, label: "Batches expiring (90d)", chart: "bar",
            aggregation: { resource: "inventory.batch", fn: "count", groupBy: "expiryBucket",
                filter: { field: "expiresInDays", op: "lte", value: 90 } } },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-item", type: "shortcut", col: 3, label: "New item", icon: "Box", href: "/inventory/items/new" },
        { id: "sc-entry", type: "shortcut", col: 3, label: "Stock entry", icon: "ArrowLeftRight", href: "/inventory/stock-entries/new" },
        { id: "sc-reorder", type: "shortcut", col: 3, label: "Material request", icon: "ClipboardList", href: "/inventory/material-requests/new" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/inventory/reports" },
        { id: "h4", type: "header", col: 12, label: "Attention", level: 2 },
        { id: "ql-alerts", type: "quick_list", col: 6, label: "Low-stock SKUs",
            resource: "inventory.item", sort: { field: "onHand", dir: "asc" }, limit: 10,
            primary: "sku", secondary: "name",
            filter: { field: "belowReorder", op: "eq", value: true },
            href: (r) => `/inventory/items/${r.id}` },
        { id: "ql-expiring", type: "quick_list", col: 6, label: "Expiring batches",
            resource: "inventory.batch", sort: { field: "expiresAt", dir: "asc" }, limit: 10,
            primary: "code", secondary: "product",
            href: (r) => `/inventory/batches/${r.id}` },
    ],
};
export const inventoryControlRoomView = buildControlRoom({
    viewId: "inventory.control-room.view",
    resource: "inventory.item",
    title: "Inventory Control Room",
    description: "Live stock pulse — on-hand, reorder alerts, movements, expiring batches.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const stockBalanceReport = {
    id: "stock-balance", label: "Stock Balance",
    description: "On-hand quantities per SKU per warehouse — the daily ops workhorse.",
    icon: "Package", resource: "inventory.item", filters: [],
    async execute({ resources }) {
        const bins = await fetchAll(resources, "inventory.bin");
        const items = await fetchAll(resources, "inventory.item");
        const nameMap = new Map(items.map((i) => [str(i.sku), str(i.name)]));
        const rows = bins.map((b) => ({
            sku: str(b.sku),
            name: nameMap.get(str(b.sku)) ?? "",
            warehouse: str(b.warehouse),
            onHand: num(b.onHand),
            reserved: num(b.reserved),
            available: Math.max(0, num(b.onHand) - num(b.reserved)),
            unitCost: num(b.unitCost),
            value: Math.round(num(b.onHand) * num(b.unitCost)),
        })).sort((a, b) => b.value - a.value);
        return {
            columns: [
                { field: "sku", label: "SKU", fieldtype: "text" },
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "warehouse", label: "Warehouse", fieldtype: "text" },
                { field: "onHand", label: "On hand", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "reserved", label: "Reserved", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "available", label: "Available", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "unitCost", label: "Unit cost", fieldtype: "currency", align: "right", options: "USD" },
                { field: "value", label: "Value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            chart: {
                kind: "bar", label: "Top 10 by value", format: "currency", currency: "USD",
                from: (rs) => rs.slice(0, 10).map((r) => ({ label: r.sku, value: r.value })),
            },
        };
    },
};
const stockLedgerReport = {
    id: "stock-ledger", label: "Stock Ledger",
    description: "Every stock movement — in, out, transfer — with running balance.",
    icon: "ScrollText", resource: "inventory.stock-entry", filters: [],
    async execute({ resources }) {
        const entries = await fetchAll(resources, "inventory.stock-entry");
        const rows = entries
            .slice()
            .sort((a, b) => str(b.postedAt).localeCompare(str(a.postedAt)))
            .map((e) => ({
            postedAt: str(e.postedAt),
            code: str(e.code),
            kind: str(e.kind),
            sku: str(e.sku),
            warehouse: str(e.warehouse),
            qty: num(e.qty),
            direction: str(e.direction),
            reference: str(e.reference),
        }));
        return {
            columns: [
                { field: "postedAt", label: "Posted", fieldtype: "datetime" },
                { field: "code", label: "Code", fieldtype: "text" },
                { field: "kind", label: "Kind", fieldtype: "enum" },
                { field: "sku", label: "SKU", fieldtype: "text" },
                { field: "warehouse", label: "Warehouse", fieldtype: "text" },
                { field: "direction", label: "Direction", fieldtype: "enum" },
                { field: "qty", label: "Qty", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "reference", label: "Reference", fieldtype: "text" },
            ],
            rows,
        };
    },
};
const stockAgingReport = {
    id: "stock-aging", label: "Stock Ageing",
    description: "How long inventory has sat on the shelf — bucketed.",
    icon: "Clock", resource: "inventory.item", filters: [],
    async execute({ resources }) {
        const items = await fetchAll(resources, "inventory.item");
        const now = Date.now();
        const buckets = [
            { label: "0-30 days", min: 0, max: 30 },
            { label: "31-60 days", min: 31, max: 60 },
            { label: "61-90 days", min: 61, max: 90 },
            { label: "91-180 days", min: 91, max: 180 },
            { label: "180+ days", min: 181, max: Infinity },
        ];
        const rows = buckets.map((b) => ({ bucket: b.label, items: 0, units: 0, value: 0 }));
        for (const i of items) {
            const last = i.lastReceivedAt ? new Date(str(i.lastReceivedAt)) : null;
            if (!last || Number.isNaN(last.getTime()))
                continue;
            const age = Math.floor((now - last.getTime()) / 86_400_000);
            const idx = buckets.findIndex((b) => age >= b.min && age <= b.max);
            if (idx >= 0) {
                rows[idx].items++;
                rows[idx].units += num(i.onHand);
                rows[idx].value += num(i.onHand) * num(i.unitCost);
            }
        }
        return {
            columns: [
                { field: "bucket", label: "Bucket", fieldtype: "text" },
                { field: "items", label: "Items", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "units", label: "Units", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "value", label: "Value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            chart: {
                kind: "donut", label: "Value by age", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.bucket, value: r.value })),
            },
        };
    },
};
const stockProjectedReport = {
    id: "stock-projected", label: "Stock Projected Qty",
    description: "On-hand + incoming (PO) − outgoing (SO) = projected balance.",
    icon: "Radar", resource: "inventory.item", filters: [],
    async execute({ resources }) {
        const items = await fetchAll(resources, "inventory.item");
        const rows = items.map((i) => ({
            sku: str(i.sku),
            name: str(i.name),
            onHand: num(i.onHand),
            incoming: num(i.incomingQty),
            outgoing: num(i.outgoingQty),
            reserved: num(i.reservedQty),
            projected: num(i.onHand) + num(i.incomingQty) - num(i.outgoingQty) - num(i.reservedQty),
            reorderPoint: num(i.reorderPoint),
        })).sort((a, b) => a.projected - b.projected);
        return {
            columns: [
                { field: "sku", label: "SKU", fieldtype: "text" },
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "onHand", label: "On hand", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "incoming", label: "Incoming", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "outgoing", label: "Outgoing", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "reserved", label: "Reserved", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "projected", label: "Projected", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "reorderPoint", label: "Reorder @", fieldtype: "number", align: "right" },
            ],
            rows,
        };
    },
};
const warehouseBalanceReport = {
    id: "warehouse-balance", label: "Warehouse-Wise Balance",
    description: "Total on-hand units + value by warehouse.",
    icon: "Warehouse", resource: "inventory.bin", filters: [],
    async execute({ resources }) {
        const bins = await fetchAll(resources, "inventory.bin");
        const by = new Map();
        for (const b of bins) {
            const wh = str(b.warehouse);
            const r = by.get(wh) ?? { warehouse: wh, skus: 0, units: 0, value: 0 };
            r.skus++;
            r.units += num(b.onHand);
            r.value += num(b.onHand) * num(b.unitCost);
            by.set(wh, r);
        }
        const rows = [...by.values()].sort((a, b) => b.value - a.value);
        return {
            columns: [
                { field: "warehouse", label: "Warehouse", fieldtype: "text" },
                { field: "skus", label: "SKUs", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "units", label: "Units", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "value", label: "Value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            chart: {
                kind: "bar", label: "Value by warehouse", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.warehouse, value: r.value })),
            },
        };
    },
};
const reorderReport = {
    id: "reorder-level", label: "Reorder Level",
    description: "SKUs below reorder point — ranked by urgency.",
    icon: "AlertTriangle", resource: "inventory.item", filters: [],
    async execute({ resources }) {
        const items = await fetchAll(resources, "inventory.item");
        const rows = items
            .filter((i) => num(i.onHand) <= num(i.reorderPoint))
            .map((i) => {
            const onHand = num(i.onHand);
            const reorder = num(i.reorderPoint);
            const daily = num(i.avgDailyUsage) || 1;
            return {
                sku: str(i.sku),
                name: str(i.name),
                onHand,
                reorderPoint: reorder,
                gap: reorder - onHand,
                daysLeft: Math.floor(onHand / daily),
                suggestedOrder: Math.max(reorder * 2 - onHand, reorder),
                supplier: str(i.preferredSupplier),
            };
        })
            .sort((a, b) => a.daysLeft - b.daysLeft);
        return {
            columns: [
                { field: "sku", label: "SKU", fieldtype: "text" },
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "onHand", label: "On hand", fieldtype: "number", align: "right" },
                { field: "reorderPoint", label: "Reorder @", fieldtype: "number", align: "right" },
                { field: "gap", label: "Gap", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "daysLeft", label: "Days left", fieldtype: "number", align: "right" },
                { field: "suggestedOrder", label: "Suggested order", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "supplier", label: "Supplier", fieldtype: "text" },
            ],
            rows,
        };
    },
};
const batchExpiryReport = {
    id: "batch-expiry", label: "Batch Expiry",
    description: "Batches expiring soon — avoid spoilage + write-offs.",
    icon: "CalendarClock", resource: "inventory.batch", filters: [],
    async execute({ resources }) {
        const batches = await fetchAll(resources, "inventory.batch");
        const now = Date.now();
        const rows = batches
            .map((b) => {
            const expiry = b.expiresAt ? new Date(str(b.expiresAt)) : null;
            const days = expiry && !Number.isNaN(expiry.getTime())
                ? Math.floor((expiry.getTime() - now) / 86_400_000)
                : Infinity;
            return {
                code: str(b.code),
                product: str(b.product),
                onHand: num(b.onHand),
                manufacturedAt: str(b.manufacturedAt),
                expiresAt: str(b.expiresAt),
                daysLeft: Number.isFinite(days) ? days : 0,
                status: days < 0 ? "expired" : days < 30 ? "critical" : days < 90 ? "soon" : "ok",
            };
        })
            .sort((a, b) => a.daysLeft - b.daysLeft);
        return {
            columns: [
                { field: "code", label: "Batch", fieldtype: "text" },
                { field: "product", label: "Product", fieldtype: "text" },
                { field: "onHand", label: "On hand", fieldtype: "number", align: "right" },
                { field: "manufacturedAt", label: "Made", fieldtype: "date" },
                { field: "expiresAt", label: "Expires", fieldtype: "date" },
                { field: "daysLeft", label: "Days left", fieldtype: "number", align: "right" },
                { field: "status", label: "Status", fieldtype: "enum" },
            ],
            rows,
        };
    },
};
const itemShortageReport = {
    id: "item-shortage", label: "Item Shortage",
    description: "SKUs where open SO > (on-hand + incoming). Fulfillment risk.",
    icon: "PackageX", resource: "inventory.item", filters: [],
    async execute({ resources }) {
        const items = await fetchAll(resources, "inventory.item");
        const rows = items
            .map((i) => {
            const need = num(i.outgoingQty) + num(i.reservedQty);
            const supply = num(i.onHand) + num(i.incomingQty);
            const shortage = need - supply;
            return {
                sku: str(i.sku),
                name: str(i.name),
                required: need,
                available: supply,
                shortage,
                nextPoEta: str(i.nextPoEta),
            };
        })
            .filter((r) => r.shortage > 0)
            .sort((a, b) => b.shortage - a.shortage);
        return {
            columns: [
                { field: "sku", label: "SKU", fieldtype: "text" },
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "required", label: "Required", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "available", label: "Available", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "shortage", label: "Shortage", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "nextPoEta", label: "Next PO ETA", fieldtype: "date" },
            ],
            rows,
        };
    },
};
const stockValuationReport = {
    id: "stock-valuation", label: "Stock Valuation",
    description: "Inventory value by category + valuation method (FIFO/Average).",
    icon: "Coins", resource: "inventory.item", filters: [],
    async execute({ resources }) {
        const items = await fetchAll(resources, "inventory.item");
        const by = new Map();
        for (const i of items) {
            const cat = str(i.category, "uncategorized");
            const r = by.get(cat) ?? { category: cat, skus: 0, units: 0, value: 0 };
            r.skus++;
            r.units += num(i.onHand);
            r.value += num(i.onHand) * num(i.unitCost);
            by.set(cat, r);
        }
        const rows = [...by.values()].sort((a, b) => b.value - a.value);
        return {
            columns: [
                { field: "category", label: "Category", fieldtype: "enum" },
                { field: "skus", label: "SKUs", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "units", label: "Units", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "value", label: "Value", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
            chart: {
                kind: "donut", label: "Value by category", format: "currency", currency: "USD",
                from: (rs) => rs.map((r) => ({ label: r.category, value: r.value })),
            },
        };
    },
};
export const INVENTORY_REPORTS = [
    stockBalanceReport,
    stockLedgerReport,
    stockAgingReport,
    stockProjectedReport,
    warehouseBalanceReport,
    reorderReport,
    batchExpiryReport,
    itemShortageReport,
    stockValuationReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "inventory.reports.view",
    detailViewId: "inventory.reports-detail.view",
    resource: "inventory.item",
    title: "Inventory Reports",
    description: "Stock balance, ledger, aging, projected, reorder, expiry, shortage, valuation.",
    basePath: "/inventory/reports",
    reports: INVENTORY_REPORTS,
});
export const inventoryReportsIndexView = indexView;
export const inventoryReportsDetailView = detailView;
