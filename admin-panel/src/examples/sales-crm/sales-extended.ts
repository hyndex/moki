import { z } from "zod";
import { defineResource, defineListView } from "@/builders";
import type { View } from "@/contracts/views";
import type { ResourceDefinition } from "@/contracts/resources";
import { formViewFromZod } from "../_factory/formFromZod";
import { detailViewFromZod } from "../_factory/detailFromZod";

const ProductBundleSchema = z.object({
  id: z.string(), code: z.string(), name: z.string(),
  bundledSkus: z.array(z.string()), totalPrice: z.number(),
  discountPct: z.number(), active: z.boolean(),
});
const InstallationNoteSchema = z.object({
  id: z.string(), code: z.string(), customer: z.string(),
  item: z.string(), installedAt: z.string(), technician: z.string(),
  status: z.enum(["scheduled", "in-progress", "completed", "cancelled"]),
  notes: z.string().optional(),
});
const SalesPartnerSchema = z.object({
  id: z.string(), name: z.string(), partnerType: z.string(),
  commissionRate: z.number(), territory: z.string(),
  ytdRevenue: z.number(), active: z.boolean(),
});
const SalesTeamSchema = z.object({
  id: z.string(), name: z.string(), region: z.string(),
  leaderEmail: z.string(), members: z.number(),
  quarterlyTarget: z.number(), currentAttainment: z.number(),
});
const CustomerCreditLimitSchema = z.object({
  id: z.string(), customer: z.string(), limit: z.number(),
  utilized: z.number(), currency: z.string(),
  status: z.enum(["within-limit", "near-limit", "exceeded"]),
  reviewedAt: z.string(),
});
const TerritorySchema = z.object({
  id: z.string(), name: z.string(), manager: z.string(),
  region: z.string(), countries: z.array(z.string()),
  accountCount: z.number(), ytdRevenue: z.number(), target: z.number(),
});
const CommissionRuleSchema = z.object({
  id: z.string(), name: z.string(),
  kind: z.enum(["percent-of-revenue", "flat-per-deal", "tiered", "gross-margin"]),
  rate: z.number(), minDealSize: z.number().optional(),
  appliesTo: z.string(), active: z.boolean(),
});
const PricingRuleSchema = z.object({
  id: z.string(), name: z.string(),
  priority: z.number(),
  condition: z.string(),
  discountType: z.enum(["percent", "amount", "price-override"]),
  discountValue: z.number(),
  validFrom: z.string(), validTo: z.string().optional(),
  active: z.boolean(),
});
const DeliveryScheduleSchema = z.object({
  id: z.string(), orderId: z.string(), item: z.string(),
  qty: z.number(), scheduledAt: z.string(),
  status: z.enum(["pending", "in-transit", "delivered", "delayed"]),
  carrier: z.string().optional(),
});

const TERRITORIES = ["NA East", "NA West", "EMEA", "APAC", "LATAM"];
const OWNERS = ["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev", "jordan@gutu.dev"];
const CUSTOMERS = ["Initech", "Umbrella", "Globex", "Tyrell", "Cyberdyne", "Hooli", "Stark Industries", "Dunder Mifflin", "Acme Co", "Massive Dynamic"];
const pick = <T>(a: readonly T[], i: number) => a[i % a.length];
const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const code = (p: string, i: number, pad = 4) => `${p}-${String(i + 1).padStart(pad, "0")}`;

function tag<T extends ResourceDefinition>(r: T, rows: Record<string, unknown>[]) {
  (r as unknown as { __seed: Record<string, unknown>[] }).__seed = rows;
  return r;
}

export const productBundleResource = tag(defineResource({
  id: "sales.product-bundle", singular: "Product Bundle", plural: "Product Bundles",
  schema: ProductBundleSchema, displayField: "name", icon: "Package2",
  searchable: ["name", "code"],
}), Array.from({ length: 8 }, (_, i) => ({
  id: `bundle_${i + 1}`, code: code("BND", i),
  name: pick(["Starter Kit", "Pro Suite", "Enterprise Stack", "Plus Bundle", "Essentials Pack"], i),
  bundledSkus: [`SKU-${1000 + i}`, `SKU-${2000 + i}`, `SKU-${3000 + i}`],
  totalPrice: 2000 + ((i * 317) % 9000),
  discountPct: 10 + (i % 20),
  active: i % 5 !== 0,
})));

export const installationNoteResource = tag(defineResource({
  id: "sales.installation-note", singular: "Installation Note", plural: "Installation Notes",
  schema: InstallationNoteSchema, displayField: "code", icon: "Wrench",
  searchable: ["code", "customer", "item"],
}), Array.from({ length: 15 }, (_, i) => ({
  id: `inst_${i + 1}`, code: code("IN", i),
  customer: pick(CUSTOMERS, i), item: `ITEM-${1000 + i}`,
  installedAt: days(-3 + i * 2), technician: pick(OWNERS, i),
  status: pick(["scheduled", "in-progress", "completed", "cancelled"] as const, i),
})));

export const salesPartnerResource = tag(defineResource({
  id: "sales.sales-partner", singular: "Sales Partner", plural: "Sales Partners",
  schema: SalesPartnerSchema, displayField: "name", icon: "Handshake",
  searchable: ["name"],
}), Array.from({ length: 6 }, (_, i) => ({
  id: `sp_${i + 1}`, name: pick(["Gamma Partners", "Delta Alliance", "Beta Retailers", "Zeta Solutions", "Omega Group", "Sigma Reseller"], i),
  partnerType: pick(["Reseller", "Distributor", "Referral", "OEM"], i),
  commissionRate: 10 + (i * 3), territory: pick(TERRITORIES, i),
  ytdRevenue: 100_000 + (i * 47_000), active: i % 5 !== 0,
})));

export const salesTeamResource = tag(defineResource({
  id: "sales.sales-team", singular: "Sales Team", plural: "Sales Teams",
  schema: SalesTeamSchema, displayField: "name", icon: "Users",
}), Array.from({ length: 5 }, (_, i) => ({
  id: `st_${i + 1}`, name: `${pick(TERRITORIES, i)} Team`,
  region: pick(TERRITORIES, i), leaderEmail: pick(OWNERS, i),
  members: 4 + (i % 5),
  quarterlyTarget: 500_000 + (i * 150_000),
  currentAttainment: 70 + (i * 5),
})));

export const customerCreditLimitResource = tag(defineResource({
  id: "sales.customer-credit-limit", singular: "Credit Limit", plural: "Credit Limits",
  schema: CustomerCreditLimitSchema, displayField: "customer", icon: "CreditCard",
}), Array.from({ length: 20 }, (_, i) => {
  const limit = 50_000 + (i * 12_500);
  const utilized = Math.round(limit * (0.3 + (i * 0.035) % 0.7));
  const util = utilized / limit;
  return {
    id: `cl_${i + 1}`, customer: pick(CUSTOMERS, i),
    limit, utilized, currency: "USD",
    status: util >= 1 ? "exceeded" : util >= 0.8 ? "near-limit" : "within-limit",
    reviewedAt: days(i * 7),
  };
}));

export const territoryResource = tag(defineResource({
  id: "sales.territory", singular: "Territory", plural: "Territories",
  schema: TerritorySchema, displayField: "name", icon: "Map",
}), TERRITORIES.map((name, i) => ({
  id: `terr_${i + 1}`, name, manager: pick(OWNERS, i), region: name,
  countries: pick([["USA", "Canada"], ["Mexico", "Brazil"], ["UK", "Germany", "France"], ["Japan", "Singapore", "Australia"], ["Argentina", "Colombia"]], i),
  accountCount: 30 + (i * 17), ytdRevenue: 1_200_000 + (i * 480_000),
  target: 2_000_000 + (i * 500_000),
})));

export const commissionRuleResource = tag(defineResource({
  id: "sales.commission-rule", singular: "Commission Rule", plural: "Commission Rules",
  schema: CommissionRuleSchema, displayField: "name", icon: "Percent",
}), Array.from({ length: 8 }, (_, i) => ({
  id: `cr_${i + 1}`, name: pick(["Standard AE", "Enterprise tier", "Partner referral", "Net-new logo bonus", "Gross-margin based", "Renewal", "Expansion", "SPIFF Q4"], i),
  kind: pick(["percent-of-revenue", "flat-per-deal", "tiered", "gross-margin"] as const, i),
  rate: 5 + (i * 2), minDealSize: i % 2 === 0 ? 10_000 : undefined,
  appliesTo: pick(["All AEs", "Enterprise team", "Partners only", "New logo only"], i),
  active: i % 7 !== 6,
})));

export const pricingRuleResource = tag(defineResource({
  id: "sales.pricing-rule", singular: "Pricing Rule", plural: "Pricing Rules",
  schema: PricingRuleSchema, displayField: "name", icon: "Tag",
}), Array.from({ length: 12 }, (_, i) => ({
  id: `pr_${i + 1}`, name: pick([
    "Volume discount ≥100 units", "Enterprise tier pricing", "Partner wholesale rate",
    "Back-to-school promo", "Black Friday flash", "Loyalty 5% off", "Net-30 rebate",
    "Multi-year prepay", "Startup program", "Non-profit discount", "Bulk licence pack",
    "Q4 clearance",
  ], i),
  priority: 10 - (i % 10),
  condition: pick(["qty >= 100", "customer.tier = 'enterprise'", "customer.partner = true", "region = 'EU'"], i),
  discountType: pick(["percent", "amount", "price-override"] as const, i),
  discountValue: 5 + (i * 2),
  validFrom: days(30 - i),
  validTo: i % 3 === 0 ? undefined : days(-60 - i),
  active: i % 5 !== 4,
})));

export const deliveryScheduleResource = tag(defineResource({
  id: "sales.delivery-schedule", singular: "Delivery Schedule", plural: "Delivery Schedules",
  schema: DeliveryScheduleSchema, displayField: "orderId", icon: "Truck",
}), Array.from({ length: 25 }, (_, i) => ({
  id: `ds_${i + 1}`, orderId: code("ORD", i),
  item: `ITEM-${1000 + (i % 20)}`, qty: 5 + (i % 45),
  scheduledAt: days(-3 + i * 0.6),
  status: pick(["pending", "in-transit", "delivered", "delayed"] as const, i),
  carrier: pick(["FedEx", "UPS", "DHL", "USPS"], i),
})));

/* List views */
const opts = {
  deal: [
    { value: "qualify", label: "Qualify", intent: "neutral" }, { value: "proposal", label: "Proposal", intent: "info" },
    { value: "negotiate", label: "Negotiate", intent: "warning" }, { value: "won", label: "Closed Won", intent: "success" },
    { value: "lost", label: "Closed Lost", intent: "danger" },
  ],
};

export const SALES_EXTENDED_RESOURCES: readonly ResourceDefinition[] = [
  productBundleResource, installationNoteResource, salesPartnerResource,
  salesTeamResource, customerCreditLimitResource, territoryResource,
  commissionRuleResource, pricingRuleResource, deliveryScheduleResource,
];

export const SALES_EXTENDED_VIEWS: readonly View[] = [
  defineListView({
    id: "sales.product-bundles.list", title: "Product Bundles", resource: "sales.product-bundle",
    search: true,
    columns: [
      { field: "code", label: "Code", width: 90 },
      { field: "name", label: "Name", sortable: true },
      { field: "totalPrice", label: "Price", align: "right", kind: "currency", sortable: true, totaling: "avg" },
      { field: "discountPct", label: "Discount %", align: "right", kind: "number" },
      { field: "active", label: "Active", kind: "boolean" },
    ],
  }),
  defineListView({
    id: "sales.installation-notes.list", title: "Installation Notes", resource: "sales.installation-note",
    search: true, defaultSort: { field: "installedAt", dir: "desc" },
    columns: [
      { field: "code", label: "Code", width: 90 },
      { field: "customer", label: "Customer", sortable: true },
      { field: "item", label: "Item" },
      { field: "technician", label: "Technician" },
      { field: "installedAt", label: "Installed", kind: "datetime", sortable: true },
      { field: "status", label: "Status", kind: "enum", options: [
        { value: "scheduled", label: "Scheduled", intent: "info" }, { value: "in-progress", label: "In progress", intent: "warning" },
        { value: "completed", label: "Completed", intent: "success" }, { value: "cancelled", label: "Cancelled", intent: "neutral" },
      ]},
    ],
  }),
  defineListView({
    id: "sales.sales-partners.list", title: "Sales Partners", resource: "sales.sales-partner",
    columns: [
      { field: "name", label: "Name", sortable: true },
      { field: "partnerType", label: "Type", kind: "enum" },
      { field: "territory", label: "Territory", kind: "enum" },
      { field: "commissionRate", label: "Commission %", align: "right", kind: "number" },
      { field: "ytdRevenue", label: "YTD Revenue", align: "right", kind: "currency", sortable: true, totaling: "sum" },
      // Calculated: commission earned = ytdRevenue * commissionRate / 100
      { field: "commissionEarned", label: "Commission earned", align: "right", kind: "currency",
        expr: "ytdRevenue * commissionRate / 100", totaling: "sum" },
      { field: "active", label: "Active", kind: "boolean" },
    ],
  }),
  defineListView({
    id: "sales.sales-teams.list", title: "Sales Teams", resource: "sales.sales-team",
    columns: [
      { field: "name", label: "Team", sortable: true },
      { field: "region", label: "Region" },
      { field: "leaderEmail", label: "Leader" },
      { field: "members", label: "Members", align: "right", kind: "number" },
      { field: "quarterlyTarget", label: "Target", align: "right", kind: "currency", totaling: "sum" },
      { field: "currentAttainment", label: "Attainment %", align: "right", kind: "number" },
    ],
  }),
  defineListView({
    id: "sales.customer-credit-limits.list", title: "Credit Limits", resource: "sales.customer-credit-limit",
    search: true,
    columns: [
      { field: "customer", label: "Customer", sortable: true },
      { field: "limit", label: "Limit", align: "right", kind: "currency", totaling: "sum" },
      { field: "utilized", label: "Utilized", align: "right", kind: "currency", totaling: "sum" },
      // Calculated: available head-room = limit - utilized
      { field: "available", label: "Available", align: "right", kind: "currency",
        expr: "limit - utilized", totaling: "sum" },
      // Calculated: utilization % rounded to 1 dp
      { field: "utilizationPct", label: "Utilization %", align: "right", kind: "number",
        expr: "round(utilized / limit * 100, 1)" },
      { field: "status", label: "Status", kind: "enum", options: [
        { value: "within-limit", label: "Within limit", intent: "success" },
        { value: "near-limit", label: "Near limit", intent: "warning" },
        { value: "exceeded", label: "Exceeded", intent: "danger" },
      ]},
      { field: "reviewedAt", label: "Last review", kind: "date" },
    ],
  }),
  defineListView({
    id: "sales.territories.list", title: "Territories", resource: "sales.territory",
    columns: [
      { field: "name", label: "Name", sortable: true },
      { field: "manager", label: "Manager" },
      { field: "accountCount", label: "Accounts", align: "right", kind: "number", totaling: "sum" },
      { field: "ytdRevenue", label: "YTD revenue", align: "right", kind: "currency", totaling: "sum" },
      { field: "target", label: "Target", align: "right", kind: "currency", totaling: "sum" },
      // Calculated: attainment % of target
      { field: "attainmentPct", label: "Attainment %", align: "right", kind: "number",
        expr: "round(ytdRevenue / target * 100, 1)" },
      // Calculated: gap (positive = over target, negative = behind)
      { field: "gap", label: "Gap", align: "right", kind: "currency",
        expr: "ytdRevenue - target", totaling: "sum" },
    ],
  }),
  defineListView({
    id: "sales.commission-rules.list", title: "Commission Rules", resource: "sales.commission-rule",
    columns: [
      { field: "name", label: "Name", sortable: true },
      { field: "kind", label: "Kind", kind: "enum" },
      { field: "rate", label: "Rate %", align: "right", kind: "number" },
      { field: "appliesTo", label: "Applies to" },
      { field: "active", label: "Active", kind: "boolean" },
    ],
  }),
  defineListView({
    id: "sales.pricing-rules.list", title: "Pricing Rules", resource: "sales.pricing-rule",
    defaultSort: { field: "priority", dir: "desc" },
    columns: [
      { field: "priority", label: "Priority", align: "right", width: 80 },
      { field: "name", label: "Name", sortable: true },
      { field: "condition", label: "Condition" },
      { field: "discountType", label: "Type", kind: "enum" },
      { field: "discountValue", label: "Value", align: "right", kind: "number" },
      { field: "validFrom", label: "From", kind: "date" },
      { field: "active", label: "Active", kind: "boolean" },
    ],
  }),
  defineListView({
    id: "sales.delivery-schedules.list", title: "Delivery Schedules", resource: "sales.delivery-schedule",
    defaultSort: { field: "scheduledAt", dir: "asc" },
    columns: [
      { field: "orderId", label: "Order", width: 110 },
      { field: "item", label: "Item" },
      { field: "qty", label: "Qty", align: "right", kind: "number" },
      { field: "scheduledAt", label: "Scheduled", kind: "datetime", sortable: true },
      { field: "status", label: "Status", kind: "enum", options: [
        { value: "pending", label: "Pending", intent: "info" },
        { value: "in-transit", label: "In transit", intent: "warning" },
        { value: "delivered", label: "Delivered", intent: "success" },
        { value: "delayed", label: "Delayed", intent: "danger" },
      ]},
      { field: "carrier", label: "Carrier" },
    ],
  }),
  /* ---- Auto-generated form views from Zod schemas ---- */
  formViewFromZod({
    id: "sales.product-bundle.form",
    title: "Product Bundle",
    resource: "sales.product-bundle",
    schema: ProductBundleSchema,
    defaults: { active: true, discountPct: 0, totalPrice: 0, bundledSkus: [] },
  }),
  formViewFromZod({
    id: "sales.installation-note.form",
    title: "Installation Note",
    resource: "sales.installation-note",
    schema: InstallationNoteSchema,
    defaults: { status: "scheduled" },
  }),
  formViewFromZod({
    id: "sales.sales-partner.form",
    title: "Sales Partner",
    resource: "sales.sales-partner",
    schema: SalesPartnerSchema,
    defaults: { active: true, commissionRate: 10, ytdRevenue: 0 },
  }),
  formViewFromZod({
    id: "sales.sales-team.form",
    title: "Sales Team",
    resource: "sales.sales-team",
    schema: SalesTeamSchema,
    defaults: { members: 0, currentAttainment: 0, quarterlyTarget: 0 },
  }),
  formViewFromZod({
    id: "sales.customer-credit-limit.form",
    title: "Customer Credit Limit",
    resource: "sales.customer-credit-limit",
    schema: CustomerCreditLimitSchema,
    defaults: { status: "within-limit", currency: "USD", utilized: 0 },
  }),
  formViewFromZod({
    id: "sales.territory.form",
    title: "Territory",
    resource: "sales.territory",
    schema: TerritorySchema,
    defaults: { accountCount: 0, ytdRevenue: 0, target: 0, countries: [] },
  }),
  formViewFromZod({
    id: "sales.commission-rule.form",
    title: "Commission Rule",
    resource: "sales.commission-rule",
    schema: CommissionRuleSchema,
    defaults: { active: true, rate: 10, kind: "percent-of-revenue" },
  }),
  formViewFromZod({
    id: "sales.pricing-rule.form",
    title: "Pricing Rule",
    resource: "sales.pricing-rule",
    schema: PricingRuleSchema,
    defaults: {
      active: true,
      priority: 10,
      discountType: "percent",
      discountValue: 0,
    },
  }),
  formViewFromZod({
    id: "sales.delivery-schedule.form",
    title: "Delivery Schedule",
    resource: "sales.delivery-schedule",
    schema: DeliveryScheduleSchema,
    defaults: { status: "pending", qty: 1 },
  }),
  /* ---- Auto-generated rich detail views ---- */
  detailViewFromZod({
    resource: "sales.product-bundle", singular: "Product Bundle", plural: "Product Bundles",
    pluginLabel: "Sales", path: "/sales/product-bundles", icon: "Package",
    schema: ProductBundleSchema, displayField: "name",
  }),
  detailViewFromZod({
    resource: "sales.installation-note", singular: "Installation Note", plural: "Installation Notes",
    pluginLabel: "Sales", path: "/sales/installation-notes", icon: "ClipboardCheck",
    schema: InstallationNoteSchema, displayField: "code",
  }),
  detailViewFromZod({
    resource: "sales.sales-partner", singular: "Sales Partner", plural: "Sales Partners",
    pluginLabel: "Sales", path: "/sales/partners", icon: "Handshake",
    schema: SalesPartnerSchema, displayField: "name",
  }),
  detailViewFromZod({
    resource: "sales.sales-team", singular: "Sales Team", plural: "Sales Teams",
    pluginLabel: "Sales", path: "/sales/teams", icon: "Users",
    schema: SalesTeamSchema, displayField: "name",
  }),
  detailViewFromZod({
    resource: "sales.customer-credit-limit", singular: "Credit Limit", plural: "Credit Limits",
    pluginLabel: "Sales", path: "/sales/credit-limits", icon: "CreditCard",
    schema: CustomerCreditLimitSchema, displayField: "customer",
  }),
  detailViewFromZod({
    resource: "sales.territory", singular: "Territory", plural: "Territories",
    pluginLabel: "Sales", path: "/sales/territories", icon: "Map",
    schema: TerritorySchema, displayField: "name",
  }),
  detailViewFromZod({
    resource: "sales.commission-rule", singular: "Commission Rule", plural: "Commission Rules",
    pluginLabel: "Sales", path: "/sales/commission-rules", icon: "Percent",
    schema: CommissionRuleSchema, displayField: "name",
  }),
  detailViewFromZod({
    resource: "sales.pricing-rule", singular: "Pricing Rule", plural: "Pricing Rules",
    pluginLabel: "Sales", path: "/sales/pricing-rules", icon: "Tag",
    schema: PricingRuleSchema, displayField: "name",
  }),
  detailViewFromZod({
    resource: "sales.delivery-schedule", singular: "Delivery Schedule", plural: "Delivery Schedules",
    pluginLabel: "Sales", path: "/sales/delivery-schedules", icon: "Truck",
    schema: DeliveryScheduleSchema, displayField: "orderId",
  }),
];

void opts;
