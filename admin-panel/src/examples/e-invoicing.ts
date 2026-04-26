import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_LIFECYCLE } from "./_factory/options";
import { COMPANIES, code, daysAgo, money, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
import type { ReportDefinition, ReportResult } from "@/contracts/widgets";

const controlRoomView = buildCompactControlRoom({
  viewId: "e-invoicing.control-room.view",
  resource: "e-invoicing.document",
  title: "E-Invoicing Control Room",
  description: "Cross-border e-invoice compliance pulse.",
  kpis: [
    { label: "Issued (30d)", resource: "e-invoicing.document", range: "last-30" },
    { label: "Pending", resource: "e-invoicing.document",
      filter: { field: "status", op: "eq", value: "pending" }, warnAbove: 5 },
    { label: "Rejected", resource: "e-invoicing.document",
      filter: { field: "status", op: "eq", value: "archived" }, warnAbove: 2, dangerAbove: 10 },
    { label: "Total value (30d)", resource: "e-invoicing.document",
      fn: "sum", field: "amount", format: "currency", range: "last-30" },
  ],
  charts: [
    { label: "By country", resource: "e-invoicing.document", chart: "donut", groupBy: "country" },
    { label: "By status", resource: "e-invoicing.document", chart: "donut", groupBy: "status" },
  ],
  shortcuts: [
    { label: "New e-invoice", icon: "Plus", href: "/finance/e-invoices/new" },
    { label: "Reports", icon: "BarChart3", href: "/finance/e-invoices/reports" },
  ],
});

async function fetchAll(r: import("@/runtime/resourceClient").ResourceClient, resource: string) {
  return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows as Record<string, unknown>[];
}
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const complianceReport: ReportDefinition = {
  id: "e-inv-compliance", label: "Compliance Status",
  description: "Compliance snapshot per country.",
  icon: "Globe", resource: "e-invoicing.document", filters: [],
  async execute({ resources }): Promise<ReportResult> {
    const docs = await fetchAll(resources, "e-invoicing.document");
    const by = new Map<string, { country: string; total: number; approved: number; pending: number; rejected: number; rate: number }>();
    for (const d of docs) {
      const c = str(d.country);
      const r = by.get(c) ?? { country: c, total: 0, approved: 0, pending: 0, rejected: 0, rate: 0 };
      r.total++;
      if (d.status === "approved" || d.status === "published") r.approved++;
      else if (d.status === "pending") r.pending++;
      else if (d.status === "archived") r.rejected++;
      by.set(c, r);
    }
    const rows = [...by.values()].map((r) => ({
      ...r,
      rate: r.total > 0 ? Math.round((r.approved / r.total) * 100) : 0,
    }));
    return {
      columns: [
        { field: "country", label: "Country", fieldtype: "enum" },
        { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "approved", label: "Approved", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "pending", label: "Pending", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "rejected", label: "Rejected", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "rate", label: "Approval %", fieldtype: "percent", align: "right" },
      ],
      rows,
    };
  },
};

const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
  indexViewId: "e-invoicing.reports.view",
  detailViewId: "e-invoicing.reports-detail.view",
  resource: "e-invoicing.document",
  title: "E-Invoicing Reports",
  description: "Compliance snapshot per country.",
  basePath: "/finance/e-invoices/reports",
  reports: [complianceReport],
});

export const eInvoicingPlugin = buildDomainPlugin({
  id: "e-invoicing",
  label: "E-Invoicing",
  icon: "ScrollText",
  section: SECTIONS.finance,
  order: 3,
  resources: [
    {
      id: "document",
      singular: "E-Invoice",
      plural: "E-Invoices",
      icon: "ScrollText",
      path: "/finance/e-invoices",
      displayField: "irn",
      defaultSort: { field: "issuedAt", dir: "desc" },
      fields: [
        { name: "irn", label: "IRN", kind: "text", required: true, sortable: true, width: 200 },
        { name: "country", kind: "enum", options: [
          { value: "IN", label: "India" }, { value: "MX", label: "Mexico" },
          { value: "IT", label: "Italy" }, { value: "AE", label: "UAE" },
          { value: "BR", label: "Brazil" }, { value: "ES", label: "Spain" },
          { value: "SA", label: "Saudi Arabia" },
        ] },
        { name: "counterparty", kind: "text", required: true, sortable: true },
        { name: "taxId", kind: "text", width: 160 },
        { name: "amount", kind: "currency", align: "right", required: true, sortable: true },
        { name: "currency", kind: "text", width: 90 },
        { name: "taxAmount", kind: "currency", align: "right" },
        { name: "qrCode", label: "QR code", kind: "text", width: 140 },
        { name: "digitalSignature", kind: "text", width: 160 },
        { name: "submittedAt", kind: "datetime", sortable: true },
        { name: "acknowledgedAt", kind: "datetime" },
        { name: "status", kind: "enum", options: STATUS_LIFECYCLE, sortable: true },
        { name: "issuedAt", kind: "datetime", required: true, sortable: true },
      ],
      seedCount: 30,
      seed: (i) => ({
        irn: code("IRN", i, 10),
        country: pick(["IN", "MX", "IT", "AE", "BR", "ES", "SA"], i),
        counterparty: pick(COMPANIES, i),
        taxId: `TAX-${String(100000 + i * 37).slice(-6)}`,
        amount: money(i, 200, 15000),
        currency: pick(["INR", "MXN", "EUR", "AED", "BRL", "EUR", "SAR"], i),
        taxAmount: Math.round(money(i, 200, 15000) * 0.18),
        qrCode: `QR-${String(1000 + i).slice(-4)}`,
        digitalSignature: `SIG-${String(10000 + i * 17).slice(-5)}`,
        submittedAt: daysAgo(i),
        acknowledgedAt: i % 5 === 0 ? "" : daysAgo(i - 0.1),
        status: pick(["pending", "approved", "published", "archived"], i),
        issuedAt: daysAgo(i),
      }),
    },
  ],
  extraNav: [
    { id: "e-invoicing.control-room.nav", label: "E Invoicing Control Room", icon: "LayoutDashboard", path: "/finance/e-invoices/control-room", view: "e-invoicing.control-room.view", order: 0 },
    { id: "e-invoicing.reports.nav", label: "Reports", icon: "BarChart3", path: "/finance/e-invoices/reports", view: "e-invoicing.reports.view" },
  ],
  extraViews: [controlRoomView, reportsIndex, reportsDetail],
  commands: [
    { id: "e-inv.go.control-room", label: "E-Invoicing: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/finance/e-invoices/control-room"; } },
    { id: "e-inv.go.reports", label: "E-Invoicing: Reports", icon: "BarChart3", run: () => { window.location.hash = "/finance/e-invoices/reports"; } },
    { id: "e-inv.new", label: "New e-invoice", icon: "Plus", run: () => { window.location.hash = "/finance/e-invoices/new"; } },
  ],
});
