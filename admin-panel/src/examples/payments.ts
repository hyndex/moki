import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { CURRENCY } from "./_factory/options";
import { code, daysAgo, daysFromNow, money, personName, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
import type { ReportDefinition, ReportResult } from "@/contracts/widgets";

const controlRoomView = buildCompactControlRoom({
  viewId: "payments.control-room.view",
  resource: "payments.payment",
  title: "Payments Control Room",
  description: "Authorization, capture, refund pulse.",
  kpis: [
    { label: "Succeeded (30d)", resource: "payments.payment",
      filter: { field: "status", op: "eq", value: "succeeded" }, range: "last-30" },
    { label: "Volume (30d)", resource: "payments.payment",
      fn: "sum", field: "amount",
      filter: { field: "status", op: "eq", value: "succeeded" },
      range: "last-30", format: "currency" },
    { label: "Failed (7d)", resource: "payments.payment",
      filter: { field: "status", op: "eq", value: "failed" }, range: "last-7",
      warnAbove: 5, dangerAbove: 20 },
    { label: "Refunded (30d)", resource: "payments.payment",
      filter: { field: "status", op: "eq", value: "refunded" }, range: "last-30" },
  ],
  charts: [
    { label: "By method", resource: "payments.payment", chart: "donut", groupBy: "method" },
    { label: "By status", resource: "payments.payment", chart: "donut", groupBy: "status" },
    { label: "Volume (30d)", resource: "payments.payment", chart: "area",
      period: "day", fn: "sum", field: "amount", lastDays: 30 },
    { label: "Failure rate (30d)", resource: "payments.payment", chart: "line",
      period: "day", lastDays: 30 },
  ],
  shortcuts: [
    { label: "New payment", icon: "Plus", href: "/finance/payments/new" },
    { label: "Refunds", icon: "Undo2", href: "/finance/payments/refunds" },
    { label: "Disputes", icon: "Gavel", href: "/finance/payments/disputes" },
    { label: "Reports", icon: "BarChart3", href: "/finance/payments/reports" },
  ],
});

async function fetchAll(r: import("@/runtime/resourceClient").ResourceClient, resource: string) {
  return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows as Record<string, unknown>[];
}
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const paymentStatusReport: ReportDefinition = {
  id: "payment-status", label: "Payment Status",
  description: "Success rate by method.",
  icon: "BarChart", resource: "payments.payment", filters: [],
  async execute({ resources }): Promise<ReportResult> {
    const payments = await fetchAll(resources, "payments.payment");
    const by = new Map<string, { method: string; total: number; succeeded: number; failed: number; rate: number }>();
    for (const p of payments) {
      const m = str(p.method);
      const r = by.get(m) ?? { method: m, total: 0, succeeded: 0, failed: 0, rate: 0 };
      r.total++;
      if (p.status === "succeeded") r.succeeded++;
      else if (p.status === "failed") r.failed++;
      by.set(m, r);
    }
    const rows = [...by.values()].map((r) => ({
      ...r,
      rate: r.total > 0 ? Math.round((r.succeeded / r.total) * 100) : 0,
    }));
    return {
      columns: [
        { field: "method", label: "Method", fieldtype: "enum" },
        { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "succeeded", label: "Succeeded", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "failed", label: "Failed", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "rate", label: "Success %", fieldtype: "percent", align: "right" },
      ],
      rows,
    };
  },
};

const refundReport: ReportDefinition = {
  id: "refunds", label: "Refunds",
  description: "Refunds issued by reason.",
  icon: "Undo2", resource: "payments.refund", filters: [],
  async execute({ resources }) {
    const refunds = await fetchAll(resources, "payments.refund");
    const by = new Map<string, { reason: string; count: number; amount: number }>();
    for (const r of refunds) {
      const reason = str(r.reason);
      const row = by.get(reason) ?? { reason, count: 0, amount: 0 };
      row.count++;
      row.amount += num(r.amount);
      by.set(reason, row);
    }
    const rows = [...by.values()].sort((a, b) => b.amount - a.amount);
    return {
      columns: [
        { field: "reason", label: "Reason", fieldtype: "text" },
        { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "amount", label: "Amount", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
      ],
      rows,
    };
  },
};

const disputeReport: ReportDefinition = {
  id: "disputes", label: "Disputes",
  description: "Open disputes + chargebacks.",
  icon: "Gavel", resource: "payments.dispute", filters: [],
  async execute({ resources }) {
    const disputes = await fetchAll(resources, "payments.dispute");
    const rows = disputes.map((d) => ({
      code: str(d.code),
      payer: str(d.payer),
      amount: num(d.amount),
      reason: str(d.reason),
      status: str(d.status),
      respondBy: str(d.respondBy),
    })).sort((a, b) => a.respondBy.localeCompare(b.respondBy));
    return {
      columns: [
        { field: "code", label: "Code", fieldtype: "text" },
        { field: "payer", label: "Payer", fieldtype: "text" },
        { field: "amount", label: "Amount", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
        { field: "reason", label: "Reason", fieldtype: "text" },
        { field: "status", label: "Status", fieldtype: "enum" },
        { field: "respondBy", label: "Respond by", fieldtype: "date" },
      ],
      rows,
    };
  },
};

const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
  indexViewId: "payments.reports.view",
  detailViewId: "payments.reports-detail.view",
  resource: "payments.payment",
  title: "Payment Reports",
  description: "Status, refunds, disputes.",
  basePath: "/finance/payments/reports",
  reports: [paymentStatusReport, refundReport, disputeReport],
});

export const paymentsPlugin = buildDomainPlugin({
  id: "payments",
  label: "Payments",
  icon: "CreditCard",
  section: SECTIONS.finance,
  order: 2,
  resources: [
    {
      id: "payment",
      singular: "Payment",
      plural: "Payments",
      icon: "CreditCard",
      path: "/finance/payments",
      displayField: "reference",
      defaultSort: { field: "paidAt", dir: "desc" },
      fields: [
        { name: "reference", kind: "text", required: true, sortable: true, width: 140 },
        { name: "payer", kind: "text", sortable: true },
        { name: "customer", kind: "text" },
        { name: "amount", kind: "currency", align: "right", required: true, sortable: true },
        { name: "currency", kind: "enum", options: CURRENCY, width: 100 },
        { name: "method", kind: "enum", required: true, options: [
          { value: "card", label: "Card" }, { value: "ach", label: "ACH" },
          { value: "wire", label: "Wire" }, { value: "crypto", label: "Crypto" },
          { value: "apple-pay", label: "Apple Pay" }, { value: "google-pay", label: "Google Pay" },
        ] },
        { name: "gateway", kind: "enum", options: [
          { value: "stripe", label: "Stripe" }, { value: "adyen", label: "Adyen" },
          { value: "square", label: "Square" }, { value: "braintree", label: "Braintree" },
        ] },
        { name: "status", kind: "enum", required: true, options: [
          { value: "succeeded", label: "Succeeded", intent: "success" },
          { value: "failed", label: "Failed", intent: "danger" },
          { value: "refunded", label: "Refunded", intent: "warning" },
          { value: "pending", label: "Pending", intent: "neutral" },
          { value: "chargeback", label: "Chargeback", intent: "danger" },
        ], sortable: true },
        { name: "fee", kind: "currency", align: "right" },
        { name: "netAmount", kind: "currency", align: "right" },
        { name: "last4", kind: "text", width: 90 },
        { name: "paidAt", kind: "datetime", sortable: true },
        { name: "failureReason", kind: "text" },
      ],
      seedCount: 40,
      seed: (i) => {
        const amount = money(i, 20, 5000);
        const fee = Math.round(amount * 0.029 + 30) / 100;
        return {
          reference: code("PAY", i, 6),
          payer: personName(i),
          customer: pick(["Acme Corp", "Globex", "Initech", "Hooli"], i),
          amount,
          currency: pick(["USD", "EUR", "GBP"], i),
          method: pick(["card", "ach", "wire", "apple-pay", "google-pay"], i),
          gateway: pick(["stripe", "adyen", "square", "braintree"], i),
          status: pick(["succeeded", "succeeded", "succeeded", "succeeded", "failed", "refunded", "pending"], i),
          fee,
          netAmount: amount - fee,
          last4: String(1000 + i * 37).slice(-4),
          paidAt: daysAgo(i * 0.5),
          failureReason: i % 10 === 4 ? pick(["insufficient-funds", "card-declined", "fraud-suspected"], i) : "",
        };
      },
    },
    {
      id: "refund",
      singular: "Refund",
      plural: "Refunds",
      icon: "Undo2",
      path: "/finance/payments/refunds",
      defaultSort: { field: "issuedAt", dir: "desc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true },
        { name: "paymentRef", kind: "text", sortable: true },
        { name: "amount", kind: "currency", align: "right", required: true, sortable: true },
        { name: "reason", kind: "enum", options: [
          { value: "customer-request", label: "Customer request" },
          { value: "duplicate", label: "Duplicate" },
          { value: "fraudulent", label: "Fraudulent" },
          { value: "quality-issue", label: "Quality issue" },
          { value: "not-as-described", label: "Not as described" },
        ] },
        { name: "status", kind: "enum", options: [
          { value: "pending", label: "Pending", intent: "warning" },
          { value: "succeeded", label: "Succeeded", intent: "success" },
          { value: "failed", label: "Failed", intent: "danger" },
        ] },
        { name: "issuedAt", kind: "datetime", sortable: true },
      ],
      seedCount: 14,
      seed: (i) => ({
        code: code("RFD", i, 6),
        paymentRef: code("PAY", i, 6),
        amount: money(i, 20, 2000),
        reason: pick(["customer-request", "duplicate", "fraudulent", "quality-issue", "not-as-described"], i),
        status: pick(["succeeded", "succeeded", "pending", "failed"], i),
        issuedAt: daysAgo(i),
      }),
    },
    {
      id: "dispute",
      singular: "Dispute",
      plural: "Disputes",
      icon: "Gavel",
      path: "/finance/payments/disputes",
      defaultSort: { field: "openedAt", dir: "desc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true },
        { name: "paymentRef", kind: "text" },
        { name: "payer", kind: "text" },
        { name: "amount", kind: "currency", align: "right" },
        { name: "reason", kind: "text" },
        { name: "status", kind: "enum", options: [
          { value: "needs-response", label: "Needs response", intent: "warning" },
          { value: "under-review", label: "Under review", intent: "info" },
          { value: "won", label: "Won", intent: "success" },
          { value: "lost", label: "Lost", intent: "danger" },
          { value: "accepted", label: "Accepted", intent: "neutral" },
        ] },
        { name: "openedAt", kind: "datetime", sortable: true },
        { name: "respondBy", kind: "date", sortable: true },
      ],
      seedCount: 8,
      seed: (i) => ({
        code: code("DSP", i, 6),
        paymentRef: code("PAY", i, 6),
        payer: personName(i),
        amount: money(i, 50, 3000),
        reason: pick(["Not received", "Unauthorized", "Duplicate", "Not as described"], i),
        status: pick(["needs-response", "under-review", "won", "lost", "accepted"], i),
        openedAt: daysAgo(i * 3),
        respondBy: daysFromNow(14 - i),
      }),
    },
    {
      id: "payout",
      singular: "Payout",
      plural: "Payouts",
      icon: "Landmark",
      path: "/finance/payments/payouts",
      defaultSort: { field: "arrivedAt", dir: "desc" },
      fields: [
        { name: "code", kind: "text", required: true, sortable: true },
        { name: "amount", kind: "currency", align: "right", required: true, sortable: true },
        { name: "currency", kind: "text", width: 90 },
        { name: "bankAccount", kind: "text" },
        { name: "status", kind: "enum", options: [
          { value: "pending", label: "Pending", intent: "warning" },
          { value: "in-transit", label: "In transit", intent: "info" },
          { value: "paid", label: "Paid", intent: "success" },
          { value: "failed", label: "Failed", intent: "danger" },
        ] },
        { name: "paymentsCount", kind: "number", align: "right" },
        { name: "scheduledAt", kind: "datetime" },
        { name: "arrivedAt", kind: "datetime", sortable: true },
      ],
      seedCount: 10,
      seed: (i) => ({
        code: code("POUT", i, 6),
        amount: 10_000 + (i * 7537) % 90_000,
        currency: pick(["USD", "EUR", "GBP"], i),
        bankAccount: pick(["Ops USD", "Reserve EUR"], i),
        status: pick(["paid", "paid", "paid", "in-transit", "pending"], i),
        paymentsCount: 5 + (i * 3),
        scheduledAt: daysAgo(i * 7 - 2),
        arrivedAt: daysAgo(i * 7),
      }),
    },
  ],
  extraNav: [
    { id: "payments.control-room.nav", label: "Control Room", icon: "LayoutDashboard", path: "/finance/payments/control-room", view: "payments.control-room.view", order: 0 },
    { id: "payments.reports.nav", label: "Reports", icon: "BarChart3", path: "/finance/payments/reports", view: "payments.reports.view" },
  ],
  extraViews: [controlRoomView, reportsIndex, reportsDetail],
  commands: [
    { id: "payments.go.control-room", label: "Payments: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/finance/payments/control-room"; } },
    { id: "payments.go.reports", label: "Payments: Reports", icon: "BarChart3", run: () => { window.location.hash = "/finance/payments/reports"; } },
    { id: "payments.new", label: "New payment", icon: "Plus", run: () => { window.location.hash = "/finance/payments/new"; } },
    { id: "payments.new-refund", label: "New refund", icon: "Undo2", run: () => { window.location.hash = "/finance/payments/refunds/new"; } },
  ],
});
