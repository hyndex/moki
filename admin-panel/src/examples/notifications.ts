import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { daysAgo, hoursAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
import type { ReportDefinition, ReportResult } from "@/contracts/widgets";

const controlRoomView = buildCompactControlRoom({
  viewId: "notifications.control-room.view",
  resource: "notifications.delivery",
  title: "Notifications Control Room",
  description: "Templates, deliveries, channel health.",
  kpis: [
    { label: "Sent (24h)", resource: "notifications.delivery",
      filter: { field: "status", op: "eq", value: "sent" }, range: "last-30" },
    { label: "Bounced (24h)", resource: "notifications.delivery",
      filter: { field: "status", op: "eq", value: "bounced" }, range: "last-30",
      warnAbove: 5, dangerAbove: 20 },
    { label: "Active templates", resource: "notifications.template",
      filter: { field: "status", op: "eq", value: "active" } },
    { label: "Queued", resource: "notifications.delivery",
      filter: { field: "status", op: "eq", value: "queued" } },
  ],
  charts: [
    { label: "Deliveries by channel", resource: "notifications.delivery", chart: "donut", groupBy: "channel" },
    { label: "Deliveries (30d)", resource: "notifications.delivery", chart: "area", period: "day", lastDays: 30 },
  ],
  shortcuts: [
    { label: "New template", icon: "Plus", href: "/notifications/templates/new" },
    { label: "Deliveries", icon: "Send", href: "/notifications/deliveries" },
    { label: "Channels", icon: "Radio", href: "/notifications/channels" },
    { label: "Reports", icon: "BarChart3", href: "/notifications/reports" },
  ],
});

async function fetchAll(r: import("@/runtime/resourceClient").ResourceClient, resource: string) {
  return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows as Record<string, unknown>[];
}
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const channelStatsReport: ReportDefinition = {
  id: "channel-stats", label: "Channel Stats",
  description: "Delivery rate per channel.",
  icon: "Radio", resource: "notifications.delivery", filters: [],
  async execute({ resources }): Promise<ReportResult> {
    const deliveries = await fetchAll(resources, "notifications.delivery");
    const by = new Map<string, { channel: string; sent: number; bounced: number; rate: number }>();
    for (const d of deliveries) {
      const c = str(d.channel);
      const r = by.get(c) ?? { channel: c, sent: 0, bounced: 0, rate: 0 };
      if (d.status === "sent") r.sent++;
      if (d.status === "bounced") r.bounced++;
      by.set(c, r);
    }
    const rows = [...by.values()].map((r) => ({
      ...r,
      rate: (r.sent + r.bounced) > 0 ? Math.round((r.sent / (r.sent + r.bounced)) * 100) : 0,
    }));
    return {
      columns: [
        { field: "channel", label: "Channel", fieldtype: "enum" },
        { field: "sent", label: "Sent", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "bounced", label: "Bounced", fieldtype: "number", align: "right", totaling: "sum" },
        { field: "rate", label: "Delivery %", fieldtype: "percent", align: "right" },
      ],
      rows,
    };
  },
};

const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
  indexViewId: "notifications.reports.view",
  detailViewId: "notifications.reports-detail.view",
  resource: "notifications.template",
  title: "Notifications Reports",
  description: "Channel stats.",
  basePath: "/notifications/reports",
  reports: [channelStatsReport],
});

export const notificationsPlugin = buildDomainPlugin({
  id: "notifications",
  label: "Notifications",
  icon: "Bell",
  section: SECTIONS.automation,
  order: 4,
  resources: [
    {
      id: "template",
      singular: "Template",
      plural: "Templates",
      icon: "Mail",
      path: "/notifications/templates",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "channel", kind: "enum", options: [
          { value: "email", label: "Email" }, { value: "sms", label: "SMS" },
          { value: "push", label: "Push" }, { value: "inapp", label: "In-app" },
          { value: "slack", label: "Slack" }, { value: "webhook", label: "Webhook" },
        ], sortable: true },
        { name: "subject", kind: "text" },
        { name: "body", kind: "textarea", formSection: "Body" },
        { name: "variables", kind: "text" },
        { name: "status", kind: "enum", options: STATUS_ACTIVE },
        { name: "updatedAt", kind: "datetime", sortable: true },
      ],
      seedCount: 14,
      seed: (i) => ({
        name: pick(["Welcome", "Invoice sent", "Password reset", "Booking confirmed", "Payment failed"], i),
        channel: pick(["email", "email", "sms", "push", "slack", "webhook"], i),
        subject: pick(["Welcome!", "Your invoice", "Reset your password"], i),
        body: "Hi {{name}}…",
        variables: "{{name}}, {{link}}",
        status: pick(["active", "active", "inactive"], i),
        updatedAt: daysAgo(i),
      }),
    },
    {
      id: "delivery",
      singular: "Delivery",
      plural: "Deliveries",
      icon: "Send",
      path: "/notifications/deliveries",
      readOnly: true,
      displayField: "id",
      defaultSort: { field: "sentAt", dir: "desc" },
      fields: [
        { name: "template", kind: "text", sortable: true },
        { name: "channel", kind: "enum", options: [
          { value: "email", label: "Email" }, { value: "sms", label: "SMS" },
          { value: "push", label: "Push" }, { value: "inapp", label: "In-app" },
        ] },
        { name: "recipient", kind: "text", sortable: true },
        { name: "status", kind: "enum", options: [
          { value: "queued", label: "Queued", intent: "warning" },
          { value: "sent", label: "Sent", intent: "success" },
          { value: "delivered", label: "Delivered", intent: "success" },
          { value: "bounced", label: "Bounced", intent: "danger" },
          { value: "complained", label: "Complained", intent: "warning" },
          { value: "clicked", label: "Clicked", intent: "accent" },
        ], sortable: true },
        { name: "sentAt", kind: "datetime", sortable: true },
      ],
      seedCount: 40,
      seed: (i) => ({
        template: pick(["Welcome", "Invoice sent", "Password reset"], i),
        channel: pick(["email", "email", "sms", "push"], i),
        recipient: `user+${i}@example.com`,
        status: pick(["sent", "delivered", "sent", "bounced", "queued", "clicked"], i),
        sentAt: hoursAgo(i),
      }),
    },
    {
      id: "channel",
      singular: "Channel",
      plural: "Channels",
      icon: "Radio",
      path: "/notifications/channels",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "kind", kind: "enum", options: [
          { value: "email", label: "Email" }, { value: "sms", label: "SMS" },
          { value: "push", label: "Push" }, { value: "webhook", label: "Webhook" },
        ] },
        { name: "provider", kind: "text" },
        { name: "active", kind: "boolean" },
      ],
      seedCount: 6,
      seed: (i) => ({
        name: pick(["Primary email", "SMS production", "Mobile push", "Ops webhook"], i),
        kind: pick(["email", "sms", "push", "webhook"], i),
        provider: pick(["SendGrid", "Twilio", "Firebase", "OpsGenie"], i),
        active: true,
      }),
    },
    {
      id: "preference",
      singular: "Preference",
      plural: "Preferences",
      icon: "SlidersHorizontal",
      path: "/notifications/preferences",
      fields: [
        { name: "user", kind: "text", required: true, sortable: true },
        { name: "category", kind: "text" },
        { name: "email", kind: "boolean" },
        { name: "sms", kind: "boolean" },
        { name: "push", kind: "boolean" },
      ],
      seedCount: 14,
      seed: (i) => ({
        user: `user+${i}@example.com`,
        category: pick(["Account", "Marketing", "Billing", "Alerts"], i),
        email: true,
        sms: i % 2 === 0,
        push: i % 3 === 0,
      }),
    },
  ],
  extraNav: [
    { id: "notifications.control-room.nav", label: "Notifications Control Room", icon: "LayoutDashboard", path: "/notifications/control-room", view: "notifications.control-room.view", order: 0 },
    { id: "notifications.reports.nav", label: "Reports", icon: "BarChart3", path: "/notifications/reports", view: "notifications.reports.view" },
  ],
  extraViews: [controlRoomView, reportsIndex, reportsDetail],
  commands: [
    { id: "notif.go.control-room", label: "Notifications: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/notifications/control-room"; } },
    { id: "notif.new-template", label: "New template", icon: "Plus", run: () => { window.location.hash = "/notifications/templates/new"; } },
  ],
});
