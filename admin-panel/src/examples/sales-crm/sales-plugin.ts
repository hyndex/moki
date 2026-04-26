import { z } from "zod";
import { defineResource } from "@/builders";
import { definePlugin } from "@/contracts/plugin-v2";
import {
  salesDealDetailView,
  salesDealsView,
  salesForecastView,
  salesFunnelView,
  salesLeaderboardView,
  salesOverviewView,
  salesPipelineView,
  salesQuotesView,
  salesRevenueView,
} from "./sales-pages";
import { SALES_EXTENDED_RESOURCES, SALES_EXTENDED_VIEWS } from "./sales-extended";
import { salesControlRoomView, salesReportsIndexView, salesReportsDetailView } from "./sales-dashboard";
import { DEALS, QUOTES } from "./data";

const DealSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  account: z.string(),
  contact: z.string(),
  owner: z.string(),
  stage: z.enum(["qualify", "proposal", "negotiate", "won", "lost"]),
  amount: z.number(),
  probability: z.number(),
  closeAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const dealResource = defineResource({
  id: "sales.deal",
  singular: "Deal",
  plural: "Deals",
  schema: DealSchema,
  displayField: "name",
  searchable: ["name", "account", "code"],
  icon: "Handshake",
});
(dealResource as unknown as { __seed: Record<string, unknown>[] }).__seed =
  DEALS as unknown as Record<string, unknown>[];

const QuoteSchema = z.object({
  id: z.string(),
  number: z.string(),
  account: z.string(),
  amount: z.number(),
  status: z.enum(["draft", "sent", "accepted", "expired"]),
  expiresAt: z.string(),
  items: z.array(z.record(z.unknown())).optional(),
});

const quoteResource = defineResource({
  id: "sales.quote",
  singular: "Quote",
  plural: "Quotes",
  schema: QuoteSchema,
  displayField: "number",
  icon: "FileText",
  erp: {
    documentType: "selling.Quotation",
    module: "Selling",
    namingSeries: "QTN-.YYYY.-.#####",
    statusField: "status",
    submittedStatuses: ["sent", "accepted"],
    titleField: "number",
    childTables: [
      {
        field: "items",
        label: "Items",
        itemField: "item",
        quantityField: "quantity",
        amountField: "amount",
        fields: [
          { name: "item", kind: "link", referenceTo: "inventory.item", required: true },
          { name: "description", kind: "text" },
          { name: "quantity", kind: "number", required: true },
          { name: "rate", kind: "currency", required: true },
          { name: "amount", kind: "currency", readonly: true }
        ]
      }
    ],
    links: [{ field: "account", targetResourceId: "party.entity", reverseRelation: "quotations" }],
    mappingActions: [
      {
        id: "quotation-to-sales-order",
        label: "Create Sales Order",
        relation: "creates-sales-order",
        targetResourceId: "sales.order",
        targetDocumentType: "selling.Sales Order",
        visibleInStatuses: ["accepted"],
        fieldMap: { customer: "account", amount: "amount" },
        childTableMap: { items: "items" },
        defaults: { status: "draft" }
      },
      {
        id: "quotation-to-project",
        label: "Create Project",
        relation: "creates-project",
        targetResourceId: "projects.project",
        targetDocumentType: "projects.Project",
        visibleInStatuses: ["accepted"],
        fieldMap: { customer: "account" },
        defaults: { status: "draft" }
      }
    ],
    printFormats: [{ id: "quotation", label: "Quotation", default: true, paperSize: "A4" }],
    portal: { route: "/quotations/:id", audience: "customer", enabledByDefault: true },
    workspaceLinks: [
      { label: "Sales Orders", path: "/sales/orders", kind: "document", group: "Quote to cash" },
      { label: "Quotation Trends", path: "/sales/reports/quotation-trends", kind: "report", group: "Reports" }
    ],
    builderSurfaces: [
      { id: "quotation-web-form-builder", label: "Quotation web form", kind: "web-form", path: "/settings/web-forms/quotation", exportableToPack: true }
    ]
  },
});
(quoteResource as unknown as { __seed: Record<string, unknown>[] }).__seed =
  QUOTES as unknown as Record<string, unknown>[];

const salesNavSections = [{ id: "sales", label: "Sales & CRM", order: 10 }];
const salesNav = [
      { id: "sales.overview", label: "Sales overview", icon: "LayoutDashboard", path: "/sales", view: "sales.overview.view", section: "sales", order: 20 },
      { id: "sales.control-room", label: "Sales Control Room", icon: "Gauge", path: "/sales/control-room", view: "sales.control-room.view", section: "sales", order: 20.5 },
      { id: "sales.deals", label: "Deals", icon: "Handshake", path: "/sales/deals", view: "sales.deals.view", section: "sales", order: 21 },
      { id: "sales.pipeline", label: "Pipeline", icon: "Layers", path: "/sales/pipeline", view: "sales.pipeline.view", section: "sales", order: 22 },
      { id: "sales.forecast", label: "Forecast", icon: "Target", path: "/sales/forecast", view: "sales.forecast.view", section: "sales", order: 23 },
      { id: "sales.leaderboard", label: "Leaderboard", icon: "Trophy", path: "/sales/leaderboard", view: "sales.leaderboard.view", section: "sales", order: 24 },
      { id: "sales.revenue", label: "Revenue", icon: "TrendingUp", path: "/sales/revenue", view: "sales.revenue.view", section: "sales", order: 25 },
      { id: "sales.funnel", label: "Funnel", icon: "GitFork", path: "/sales/funnel", view: "sales.funnel.view", section: "sales", order: 26 },
      { id: "sales.quotes", label: "Quotes", icon: "FileText", path: "/sales/quotes", view: "sales.quotes.view", section: "sales", order: 27 },
      { id: "sales.orders", label: "Sales Orders", icon: "FileCheck2", path: "/sales/orders", view: "sales.orders.list", section: "sales", order: 28 },
      { id: "sales.bundles", label: "Product Bundles", icon: "Package2", path: "/sales/product-bundles", view: "sales.product-bundles.list", section: "sales", order: 28.3 },
      { id: "sales.installation-notes", label: "Installation Notes", icon: "Wrench", path: "/sales/installation-notes", view: "sales.installation-notes.list", section: "sales", order: 28.5 },
      { id: "sales.partners", label: "Partners", icon: "Handshake", path: "/sales/partners", view: "sales.sales-partners.list", section: "sales", order: 29 },
      { id: "sales.teams", label: "Teams", icon: "Users", path: "/sales/teams", view: "sales.sales-teams.list", section: "sales", order: 29.3 },
      { id: "sales.credit-limits", label: "Credit Limits", icon: "CreditCard", path: "/sales/credit-limits", view: "sales.customer-credit-limits.list", section: "sales", order: 29.5 },
      { id: "sales.territories", label: "Territories", icon: "Map", path: "/sales/territories", view: "sales.territories.list", section: "sales", order: 29.7 },
      { id: "sales.commission", label: "Commission Rules", icon: "Percent", path: "/sales/commission-rules", view: "sales.commission-rules.list", section: "sales", order: 29.8 },
      { id: "sales.pricing", label: "Pricing Rules", icon: "Tag", path: "/sales/pricing-rules", view: "sales.pricing-rules.list", section: "sales", order: 29.85 },
      { id: "sales.delivery", label: "Delivery Schedule", icon: "Truck", path: "/sales/delivery-schedules", view: "sales.delivery-schedules.list", section: "sales", order: 29.9 },
  { id: "sales.reports", label: "Reports", icon: "BarChart3", path: "/sales/reports", view: "sales.reports.view", section: "sales", order: 29.95 },
];
const salesResources = [dealResource, quoteResource, ...SALES_EXTENDED_RESOURCES];
const salesViews = [
  salesOverviewView,
  salesDealsView,
  salesPipelineView,
  salesForecastView,
  salesLeaderboardView,
  salesRevenueView,
  salesFunnelView,
  salesQuotesView,
  salesDealDetailView,
  salesControlRoomView,
  salesReportsIndexView,
  salesReportsDetailView,
  ...SALES_EXTENDED_VIEWS,
];
const salesCommands = [
  { id: "sales.go.overview", label: "Sales: Overview", icon: "LayoutDashboard", run: () => { window.location.hash = "/sales"; } },
  { id: "sales.go.control-room", label: "Sales: Control Room", icon: "Gauge", run: () => { window.location.hash = "/sales/control-room"; } },
  { id: "sales.go.pipeline", label: "Sales: Pipeline", icon: "Layers", run: () => { window.location.hash = "/sales/pipeline"; } },
  { id: "sales.go.forecast", label: "Sales: Forecast", icon: "Target", run: () => { window.location.hash = "/sales/forecast"; } },
  { id: "sales.go.leaderboard", label: "Sales: Leaderboard", icon: "Trophy", run: () => { window.location.hash = "/sales/leaderboard"; } },
  { id: "sales.go.reports", label: "Sales: Reports", icon: "BarChart3", run: () => { window.location.hash = "/sales/reports"; } },
];

export const salesPlugin = definePlugin({
  manifest: {
    id: "sales",
    version: "0.2.0",
    label: "Sales",
    description: "Deals, quotes, forecast, and leaderboard.",
    icon: "TrendingUp",
    requires: {
      shell: "*",
      capabilities: ["resources:read", "resources:write", "resources:delete", "nav", "commands"],
    },
    activationEvents: [{ kind: "onStart" }],
    origin: { kind: "explicit" },
  },
  async activate(ctx) {
    ctx.contribute.navSections(salesNavSections);
    ctx.contribute.nav(salesNav);
    ctx.contribute.resources(salesResources);
    ctx.contribute.views(salesViews);
    ctx.contribute.commands(salesCommands);
  },
});
