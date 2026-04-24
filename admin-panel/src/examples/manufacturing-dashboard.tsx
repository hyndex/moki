import type { WorkspaceDescriptor, ReportDefinition, ReportResult } from "@/contracts/widgets";
import { buildControlRoom } from "./_factory/controlRoomHelper";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";

const workspace: WorkspaceDescriptor = {
  id: "manufacturing.control-room",
  label: "Manufacturing Control Room",
  widgets: [
    { id: "h1", type: "header", col: 12, label: "Production pulse", level: 2 },
    { id: "k-active", type: "number_card", col: 3, label: "Active orders",
      aggregation: { resource: "manufacturing.order", fn: "count",
        filter: { field: "status", op: "eq", value: "in_progress" } },
      drilldown: "/manufacturing/orders" },
    { id: "k-output", type: "number_card", col: 3, label: "Units produced MTD",
      aggregation: { resource: "manufacturing.order", fn: "sum", field: "completedQty",
        range: { kind: "mtd" } } },
    { id: "k-scrap", type: "number_card", col: 3, label: "Scrap rate % (30d)",
      aggregation: { resource: "manufacturing.order", fn: "avg", field: "scrapRatePct",
        range: { kind: "last", days: 30 } } },
    { id: "k-wip", type: "number_card", col: 3, label: "WIP units",
      aggregation: { resource: "manufacturing.order", fn: "sum", field: "wipQty" } },
    { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
    { id: "c-status", type: "chart", col: 6, label: "Orders by status", chart: "donut",
      aggregation: { resource: "manufacturing.order", fn: "count", groupBy: "status" } },
    { id: "c-product", type: "chart", col: 6, label: "Output by product", chart: "bar",
      aggregation: { resource: "manufacturing.order", fn: "sum", field: "completedQty", groupBy: "product" } },
    { id: "c-trend", type: "chart", col: 6, label: "Production (30d)", chart: "area",
      aggregation: { resource: "manufacturing.order", fn: "sum", field: "completedQty", period: "day", range: { kind: "last", days: 30 } } },
    { id: "c-operator", type: "chart", col: 6, label: "Output by operator", chart: "bar",
      aggregation: { resource: "manufacturing.order", fn: "sum", field: "completedQty", groupBy: "operator" } },
    { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
    { id: "sc-new-mo", type: "shortcut", col: 3, label: "New production order", icon: "Plus", href: "/manufacturing/orders/new" },
    { id: "sc-bom", type: "shortcut", col: 3, label: "BOMs", icon: "TreePine", href: "/manufacturing/boms" },
    { id: "sc-routing", type: "shortcut", col: 3, label: "Routings", icon: "GitBranch", href: "/manufacturing/routings" },
    { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/manufacturing/reports" },
  ],
};

export const manufacturingControlRoomView = buildControlRoom({
  viewId: "manufacturing.control-room.view",
  resource: "manufacturing.order",
  title: "Manufacturing Control Room",
  description: "Production pulse, WIP, scrap rate, operator output.",
  workspace,
});

async function fetchAll(r: import("@/runtime/resourceClient").ResourceClient, resource: string) {
  return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows as Record<string, unknown>[];
}
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const yieldReport: ReportDefinition = {
  id: "yield-analysis", label: "Yield Analysis",
  description: "Yield % per product + operator.",
  icon: "Target", resource: "manufacturing.order", filters: [],
  async execute({ resources }): Promise<ReportResult> {
    const orders = await fetchAll(resources, "manufacturing.order");
    const by = new Map<string, { product: string; planned: number; good: number; scrap: number; yieldPct: number }>();
    for (const o of orders) {
      const p = str(o.product);
      const r = by.get(p) ?? { product: p, planned: 0, good: 0, scrap: 0, yieldPct: 0 };
      r.planned += num(o.quantity);
      r.good += num(o.completedQty);
      r.scrap += num(o.scrapQty);
      by.set(p, r);
    }
    const rows = [...by.values()]
      .map((r) => ({ ...r, yieldPct: r.planned > 0 ? Math.round((r.good / r.planned) * 100) : 0 }))
      .sort((a, b) => b.good - a.good);
    return {
      columns: [
        { field: "product", label: "Product", fieldtype: "text" },
        { field: "planned", label: "Planned", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "good", label: "Good", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "scrap", label: "Scrap", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "yieldPct", label: "Yield %", fieldtype: "percent", align: "right" },
      ],
      rows,
    };
  },
};

const orderStatusReport: ReportDefinition = {
  id: "order-status", label: "Order Status",
  description: "MO funnel: open → in_progress → resolved.",
  icon: "LayoutList", resource: "manufacturing.order", filters: [],
  async execute({ resources }) {
    const orders = await fetchAll(resources, "manufacturing.order");
    const by = new Map<string, { status: string; count: number; plannedQty: number; completedQty: number }>();
    for (const o of orders) {
      const s = str(o.status);
      const r = by.get(s) ?? { status: s, count: 0, plannedQty: 0, completedQty: 0 };
      r.count++;
      r.plannedQty += num(o.quantity);
      r.completedQty += num(o.completedQty);
      by.set(s, r);
    }
    const rows = [...by.values()];
    return {
      columns: [
        { field: "status", label: "Status", fieldtype: "enum" },
        { field: "count", label: "Orders", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "plannedQty", label: "Planned", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "completedQty", label: "Completed", fieldtype: "number", align: "right", totaling: "sum" },
      ],
      rows,
    };
  },
};

const workCenterUtilizationReport: ReportDefinition = {
  id: "work-center-util", label: "Work Center Utilization",
  description: "Hours scheduled vs capacity per work center.",
  icon: "Settings", resource: "manufacturing.work-center", filters: [],
  async execute({ resources }) {
    const centers = await fetchAll(resources, "manufacturing.work-center");
    const rows = centers.map((c) => ({
      code: str(c.code),
      name: str(c.name),
      capacityHrs: num(c.capacityHrs),
      scheduledHrs: num(c.scheduledHrs),
      utilizationPct: num(c.capacityHrs) > 0 ? Math.round((num(c.scheduledHrs) / num(c.capacityHrs)) * 100) : 0,
    })).sort((a, b) => b.utilizationPct - a.utilizationPct);
    return {
      columns: [
        { field: "code", label: "Code", fieldtype: "text" },
        { field: "name", label: "Name", fieldtype: "text" },
        { field: "capacityHrs", label: "Capacity", fieldtype: "number", align: "right" },
        { field: "scheduledHrs", label: "Scheduled", fieldtype: "number", align: "right" },
        { field: "utilizationPct", label: "Utilization %", fieldtype: "percent", align: "right" },
      ],
      rows,
    };
  },
};

const bomReport: ReportDefinition = {
  id: "bom-cost", label: "BOM Cost Rollup",
  description: "Material + labor cost per BOM.",
  icon: "TreePine", resource: "manufacturing.bom", filters: [],
  async execute({ resources }) {
    const boms = await fetchAll(resources, "manufacturing.bom");
    const rows = boms.map((b) => ({
      code: str(b.code),
      product: str(b.product),
      version: str(b.version),
      materialCost: num(b.materialCost),
      laborCost: num(b.laborCost),
      overheadCost: num(b.overheadCost),
      total: num(b.materialCost) + num(b.laborCost) + num(b.overheadCost),
      active: b.active ? "Yes" : "No",
    })).sort((a, b) => b.total - a.total);
    return {
      columns: [
        { field: "code", label: "BOM", fieldtype: "text" },
        { field: "product", label: "Product", fieldtype: "text" },
        { field: "version", label: "Version", fieldtype: "text" },
        { field: "materialCost", label: "Material", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
        { field: "laborCost", label: "Labor", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
        { field: "overheadCost", label: "Overhead", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
        { field: "total", label: "Total", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
        { field: "active", label: "Active", fieldtype: "text" },
      ],
      rows,
    };
  },
};

const scrapReport: ReportDefinition = {
  id: "scrap-analysis", label: "Scrap Analysis",
  description: "Scrap quantity + cost per product.",
  icon: "Trash2", resource: "manufacturing.order", filters: [],
  async execute({ resources }) {
    const orders = await fetchAll(resources, "manufacturing.order");
    const by = new Map<string, { product: string; scrapQty: number; scrapCost: number }>();
    for (const o of orders) {
      const p = str(o.product);
      const r = by.get(p) ?? { product: p, scrapQty: 0, scrapCost: 0 };
      r.scrapQty += num(o.scrapQty);
      r.scrapCost += num(o.scrapQty) * num(o.unitCost);
      by.set(p, r);
    }
    const rows = [...by.values()].sort((a, b) => b.scrapCost - a.scrapCost);
    return {
      columns: [
        { field: "product", label: "Product", fieldtype: "text" },
        { field: "scrapQty", label: "Scrap qty", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "scrapCost", label: "Scrap cost", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
      ],
      rows,
    };
  },
};

export const MANUFACTURING_REPORTS: readonly ReportDefinition[] = [
  yieldReport, orderStatusReport, workCenterUtilizationReport, bomReport, scrapReport,
];

const { indexView, detailView } = buildReportLibrary({
  indexViewId: "manufacturing.reports.view",
  detailViewId: "manufacturing.reports-detail.view",
  resource: "manufacturing.order",
  title: "Manufacturing Reports",
  description: "Yield, order status, work center utilization, BOM cost, scrap.",
  basePath: "/manufacturing/reports",
  reports: MANUFACTURING_REPORTS,
});

export const manufacturingReportsIndexView = indexView;
export const manufacturingReportsDetailView = detailView;
