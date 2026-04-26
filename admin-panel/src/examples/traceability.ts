import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { code, daysAgo, daysFromNow, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
import type { ReportDefinition, ReportResult } from "@/contracts/widgets";

const controlRoomView = buildCompactControlRoom({
  viewId: "traceability.control-room.view",
  resource: "traceability.lot",
  title: "Traceability Control Room",
  description: "Lot history + origin + recall status.",
  kpis: [
    { label: "Active lots", resource: "traceability.lot",
      filter: { field: "status", op: "eq", value: "active" } },
    { label: "Produced (30d)", resource: "traceability.lot", range: "last-30" },
    { label: "Expiring (30d)", resource: "traceability.lot",
      filter: { field: "expiringSoon", op: "eq", value: true } },
    { label: "Recalled", resource: "traceability.recall",
      filter: { field: "status", op: "eq", value: "open" }, dangerAbove: 1 },
  ],
  charts: [
    { label: "By origin", resource: "traceability.lot", chart: "donut", groupBy: "origin" },
    { label: "By product", resource: "traceability.lot", chart: "donut", groupBy: "product" },
  ],
  shortcuts: [
    { label: "New lot", icon: "Plus", href: "/traceability/lots/new" },
    { label: "Recalls", icon: "AlertTriangle", href: "/traceability/recalls" },
    { label: "Events", icon: "History", href: "/traceability/events" },
    { label: "Reports", icon: "BarChart3", href: "/traceability/reports" },
  ],
});

async function fetchAll(r: import("@/runtime/resourceClient").ResourceClient, resource: string) {
  return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows as Record<string, unknown>[];
}
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const lotOriginReport: ReportDefinition = {
  id: "lot-origin", label: "Lots by Origin",
  description: "Distribution across origins/plants.",
  icon: "Factory", resource: "traceability.lot", filters: [],
  async execute({ resources }): Promise<ReportResult> {
    const lots = await fetchAll(resources, "traceability.lot");
    const by = new Map<string, { origin: string; count: number }>();
    for (const l of lots) {
      const o = str(l.origin);
      const r = by.get(o) ?? { origin: o, count: 0 };
      r.count++;
      by.set(o, r);
    }
    const rows = [...by.values()].sort((a, b) => b.count - a.count);
    return {
      columns: [
        { field: "origin", label: "Origin", fieldtype: "text" },
        { field: "count", label: "Lots", fieldtype: "number", align: "right", totaling: "sum" },
      ],
      rows,
    };
  },
};

const recallsReport: ReportDefinition = {
  id: "recalls", label: "Recalls",
  description: "Active + closed recalls.",
  icon: "AlertTriangle", resource: "traceability.recall", filters: [],
  async execute({ resources }) {
    const recalls = await fetchAll(resources, "traceability.recall");
    const rows = recalls.map((r) => ({
      code: str(r.code),
      reason: str(r.reason),
      lotsAffected: num(r.lotsAffected),
      unitsAffected: num(r.unitsAffected),
      status: str(r.status),
      openedAt: str(r.openedAt),
    })).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    return {
      columns: [
        { field: "code", label: "Code", fieldtype: "text" },
        { field: "reason", label: "Reason", fieldtype: "text" },
        { field: "lotsAffected", label: "Lots", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "unitsAffected", label: "Units", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "status", label: "Status", fieldtype: "enum" },
        { field: "openedAt", label: "Opened", fieldtype: "date" },
      ],
      rows,
    };
  },
};

const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
  indexViewId: "traceability.reports.view",
  detailViewId: "traceability.reports-detail.view",
  resource: "traceability.lot",
  title: "Traceability Reports",
  description: "Lots by origin + recall registry.",
  basePath: "/traceability/reports",
  reports: [lotOriginReport, recallsReport],
});

export const traceabilityPlugin = buildDomainPlugin({
  id: "traceability",
  label: "Traceability",
  icon: "Footprints",
  section: SECTIONS.supplyChain,
  order: 8,
  resources: [
    {
      id: "lot",
      singular: "Lot",
      plural: "Lots",
      icon: "Barcode",
      path: "/traceability/lots",
      displayField: "code",
      defaultSort: { field: "producedAt", dir: "desc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true, width: 140 },
        { name: "product", kind: "text", required: true, sortable: true },
        { name: "origin", kind: "text", required: true, sortable: true },
        { name: "producedAt", kind: "date", required: true, sortable: true },
        { name: "expiresAt", kind: "date", sortable: true },
        { name: "expiringSoon", kind: "boolean" },
        { name: "quantity", kind: "number", align: "right" },
        { name: "status", kind: "enum", options: [
          { value: "active", label: "Active", intent: "success" },
          { value: "consumed", label: "Consumed", intent: "neutral" },
          { value: "expired", label: "Expired", intent: "warning" },
          { value: "recalled", label: "Recalled", intent: "danger" },
        ] },
        { name: "supplier", kind: "text" },
        { name: "qaPassed", label: "QA passed", kind: "boolean" },
      ],
      seedCount: 30,
      seed: (i) => {
        const expires = daysFromNow(60 - i * 5);
        return {
          code: code("LOT", i, 8),
          product: pick(["Widget A", "Gizmo B", "Part C"], i),
          origin: pick(["SFO Plant", "Tokyo Plant", "Berlin Plant"], i),
          producedAt: daysAgo(i * 3),
          expiresAt: expires,
          expiringSoon: (Date.parse(expires) - Date.now()) / 86_400_000 < 30,
          quantity: 100 + (i * 73) % 900,
          status: pick(["active", "active", "consumed", "expired", "recalled"], i),
          supplier: pick(["Acme Supply", "Globex", "Initech"], i),
          qaPassed: i % 5 !== 4,
        };
      },
    },
    {
      id: "event",
      singular: "Trace Event",
      plural: "Trace Events",
      icon: "History",
      path: "/traceability/events",
      readOnly: true,
      defaultSort: { field: "occurredAt", dir: "desc" },
      fields: [
        { name: "lotCode", label: "Lot", kind: "text", required: true, sortable: true },
        { name: "kind", label: "Type", kind: "enum", options: [
          { value: "produced", label: "Produced" },
          { value: "shipped", label: "Shipped" },
          { value: "received", label: "Received" },
          { value: "transformed", label: "Transformed" },
          { value: "sold", label: "Sold" },
          { value: "recalled", label: "Recalled" },
        ] },
        { name: "location", kind: "text" },
        { name: "quantity", kind: "number", align: "right" },
        { name: "occurredAt", kind: "datetime", sortable: true },
      ],
      seedCount: 60,
      seed: (i) => ({
        lotCode: code("LOT", i % 30, 8),
        kind: pick(["produced", "shipped", "received", "transformed", "sold"], i),
        location: pick(["SFO Plant", "Tokyo Plant", "Berlin Plant", "NY Warehouse"], i),
        quantity: 10 + (i * 7) % 200,
        occurredAt: daysAgo(i * 0.5),
      }),
    },
    {
      id: "recall",
      singular: "Recall",
      plural: "Recalls",
      icon: "AlertTriangle",
      path: "/traceability/recalls",
      defaultSort: { field: "openedAt", dir: "desc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true },
        { name: "reason", kind: "text", required: true },
        { name: "lotsAffected", kind: "number", align: "right" },
        { name: "unitsAffected", kind: "number", align: "right" },
        { name: "severity", kind: "enum", options: [
          { value: "minor", label: "Minor", intent: "info" },
          { value: "major", label: "Major", intent: "warning" },
          { value: "critical", label: "Critical", intent: "danger" },
        ] },
        { name: "openedAt", kind: "date", sortable: true },
        { name: "closedAt", kind: "date" },
        { name: "status", kind: "enum", options: [
          { value: "open", label: "Open", intent: "warning" },
          { value: "in-progress", label: "In progress", intent: "info" },
          { value: "resolved", label: "Resolved", intent: "success" },
        ] },
      ],
      seedCount: 4,
      seed: (i) => ({
        code: code("RCL", i, 5),
        reason: pick(["Quality defect", "Safety concern", "Regulatory", "Customer complaint"], i),
        lotsAffected: 2 + i,
        unitsAffected: 50 + i * 100,
        severity: pick(["minor", "major", "critical", "major"], i),
        openedAt: daysAgo(i * 30),
        closedAt: i > 1 ? daysAgo(i * 15) : "",
        status: i > 1 ? "resolved" : i > 0 ? "in-progress" : "open",
      }),
    },
  ],
  extraNav: [
    { id: "traceability.control-room.nav", label: "Traceability Control Room", icon: "LayoutDashboard", path: "/traceability/control-room", view: "traceability.control-room.view", order: 0 },
    { id: "traceability.reports.nav", label: "Reports", icon: "BarChart3", path: "/traceability/reports", view: "traceability.reports.view" },
  ],
  extraViews: [controlRoomView, reportsIndex, reportsDetail],
  commands: [
    { id: "trace.go.control-room", label: "Traceability: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/traceability/control-room"; } },
    { id: "trace.go.reports", label: "Traceability: Reports", icon: "BarChart3", run: () => { window.location.hash = "/traceability/reports"; } },
    { id: "trace.new-recall", label: "New recall", icon: "AlertTriangle", run: () => { window.location.hash = "/traceability/recalls/new"; } },
  ],
});
