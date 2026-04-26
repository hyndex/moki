import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { CURRENCY } from "./_factory/options";
import { code, money, pick, daysAgo, daysFromNow } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "pricing-tax.control-room.view",
    resource: "pricing-tax.price",
    title: "Pricing & Tax Control Room",
    description: "Price books, discounts, tax jurisdictions.",
    kpis: [
        { label: "Active prices", resource: "pricing-tax.price" },
        { label: "Price rules", resource: "pricing-tax.price-rule" },
        { label: "Tax rules", resource: "pricing-tax.tax-rule" },
        { label: "Discounts", resource: "pricing-tax.discount",
            filter: { field: "active", op: "eq", value: true } },
    ],
    charts: [
        { label: "Prices by currency", resource: "pricing-tax.price", chart: "donut", groupBy: "currency" },
        { label: "Tax rules by region", resource: "pricing-tax.tax-rule", chart: "bar", groupBy: "region" },
    ],
    shortcuts: [
        { label: "New price", icon: "Plus", href: "/pricing/prices/new" },
        { label: "New tax rule", icon: "ScrollText", href: "/pricing/tax/new" },
        { label: "New discount", icon: "BadgePercent", href: "/pricing/discounts/new" },
        { label: "Reports", icon: "BarChart3", href: "/pricing/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const priceSpreadReport = {
    id: "price-spread", label: "Price Spread",
    description: "Price range per currency.",
    icon: "BarChart", resource: "pricing-tax.price", filters: [],
    async execute({ resources }) {
        const prices = await fetchAll(resources, "pricing-tax.price");
        const by = new Map();
        for (const p of prices) {
            const c = str(p.currency);
            const amt = num(p.amount);
            const r = by.get(c) ?? { currency: c, min: Infinity, max: 0, avg: 0, count: 0, total: 0 };
            r.count++;
            r.total += amt;
            r.min = Math.min(r.min, amt);
            r.max = Math.max(r.max, amt);
            by.set(c, r);
        }
        const rows = [...by.values()].map((r) => ({
            ...r,
            min: r.min === Infinity ? 0 : r.min,
            avg: r.count > 0 ? Math.round(r.total / r.count) : 0,
        }));
        return {
            columns: [
                { field: "currency", label: "Currency", fieldtype: "enum" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "min", label: "Min", fieldtype: "currency", align: "right", options: "USD" },
                { field: "avg", label: "Avg", fieldtype: "currency", align: "right", options: "USD" },
                { field: "max", label: "Max", fieldtype: "currency", align: "right", options: "USD" },
            ],
            rows,
        };
    },
};
const discountUsageReport = {
    id: "discount-usage", label: "Discount Usage",
    description: "Usage counts per discount code.",
    icon: "BadgePercent", resource: "pricing-tax.discount", filters: [],
    async execute({ resources }) {
        const discounts = await fetchAll(resources, "pricing-tax.discount");
        const rows = discounts.map((d) => ({
            code: str(d.code),
            name: str(d.name),
            kind: str(d.kind),
            value: num(d.value),
            usageCount: num(d.usageCount),
            active: d.active ? "Yes" : "No",
        })).sort((a, b) => b.usageCount - a.usageCount);
        return {
            columns: [
                { field: "code", label: "Code", fieldtype: "text" },
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "kind", label: "Kind", fieldtype: "enum" },
                { field: "value", label: "Value", fieldtype: "number", align: "right" },
                { field: "usageCount", label: "Usage", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "active", label: "Active", fieldtype: "text" },
            ],
            rows,
        };
    },
};
const taxByRegionReport = {
    id: "tax-by-region", label: "Tax by Region",
    description: "Effective tax rates per region.",
    icon: "Globe", resource: "pricing-tax.tax-rule", filters: [],
    async execute({ resources }) {
        const rules = await fetchAll(resources, "pricing-tax.tax-rule");
        const rows = rules.map((r) => ({
            name: str(r.name),
            region: str(r.region),
            rate: num(r.rate) * 100,
            kind: str(r.kind),
            active: r.active ? "Yes" : "No",
        })).sort((a, b) => b.rate - a.rate);
        return {
            columns: [
                { field: "region", label: "Region", fieldtype: "text" },
                { field: "name", label: "Rule", fieldtype: "text" },
                { field: "kind", label: "Kind", fieldtype: "enum" },
                { field: "rate", label: "Rate %", fieldtype: "percent", align: "right" },
                { field: "active", label: "Active", fieldtype: "text" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "pricing-tax.reports.view",
    detailViewId: "pricing-tax.reports-detail.view",
    resource: "pricing-tax.price",
    title: "Pricing & Tax Reports",
    description: "Price spread, discount usage, tax by region.",
    basePath: "/pricing/reports",
    reports: [priceSpreadReport, discountUsageReport, taxByRegionReport],
});
export const pricingTaxPlugin = buildDomainPlugin({
    id: "pricing-tax",
    label: "Pricing & Tax",
    icon: "Percent",
    section: SECTIONS.commerce,
    order: 2,
    resources: [
        {
            id: "price",
            singular: "Price",
            plural: "Prices",
            icon: "Tag",
            path: "/pricing/prices",
            displayField: "sku",
            fields: [
                { name: "sku", kind: "text", required: true, sortable: true, width: 120 },
                { name: "name", kind: "text" },
                { name: "priceList", kind: "enum", options: [
                        { value: "standard", label: "Standard" },
                        { value: "wholesale", label: "Wholesale" },
                        { value: "retail", label: "Retail" },
                        { value: "enterprise", label: "Enterprise" },
                        { value: "partner", label: "Partner" },
                    ] },
                { name: "amount", kind: "currency", align: "right", required: true, sortable: true },
                { name: "currency", kind: "enum", options: CURRENCY, width: 100 },
                { name: "validFrom", kind: "date" },
                { name: "validTo", kind: "date" },
            ],
            seedCount: 40,
            seed: (i) => ({
                sku: code("PR", i, 5),
                name: pick(["Widget A", "Gizmo B", "Part C", "Bracket D"], i),
                priceList: pick(["standard", "wholesale", "retail", "enterprise", "partner"], i),
                amount: money(i, 5, 500),
                currency: pick(["USD", "EUR", "GBP"], i),
                validFrom: daysAgo(30),
                validTo: daysFromNow(365),
            }),
        },
        {
            id: "tax-rule",
            singular: "Tax Rule",
            plural: "Tax Rules",
            icon: "ScrollText",
            path: "/pricing/tax",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "region", kind: "text", sortable: true },
                { name: "country", kind: "text" },
                { name: "kind", label: "Type", kind: "enum", options: [
                        { value: "vat", label: "VAT" },
                        { value: "sales", label: "Sales tax" },
                        { value: "gst", label: "GST" },
                        { value: "excise", label: "Excise" },
                    ] },
                { name: "rate", kind: "number", align: "right", sortable: true },
                { name: "validFrom", kind: "date" },
                { name: "active", kind: "boolean" },
            ],
            seedCount: 12,
            seed: (i) => ({
                name: pick(["US sales tax", "EU VAT", "UK VAT", "CA GST", "IN GST", "JP Consumption", "AU GST"], i),
                region: pick(["US-CA", "EU-DE", "UK", "CA-ON", "IN-MH", "JP", "AU"], i),
                country: pick(["USA", "Germany", "UK", "Canada", "India", "Japan", "Australia"], i),
                kind: pick(["sales", "vat", "vat", "gst", "gst", "gst", "gst"], i),
                rate: 0.05 + (i * 0.02),
                validFrom: daysAgo(365),
                active: i !== 11,
            }),
        },
        {
            id: "price-rule",
            singular: "Price Rule",
            plural: "Price Rules",
            icon: "BadgePercent",
            path: "/pricing/price-rules",
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "kind", label: "Type", kind: "enum", options: [
                        { value: "quantity", label: "Quantity break" },
                        { value: "customer-tier", label: "Customer tier" },
                        { value: "campaign", label: "Campaign" },
                        { value: "bundle", label: "Bundle" },
                    ] },
                { name: "discountPct", kind: "number", align: "right" },
                { name: "minQty", kind: "number", align: "right" },
                { name: "active", kind: "boolean" },
            ],
            seedCount: 8,
            seed: (i) => ({
                code: code("PRL", i, 4),
                name: pick(["Volume 100+", "Enterprise tier", "Partner wholesale", "Summer promo", "Bundle combo"], i),
                kind: pick(["quantity", "customer-tier", "customer-tier", "campaign", "bundle"], i),
                discountPct: 5 + i * 3,
                minQty: pick([0, 10, 50, 100, 500], i),
                active: true,
            }),
        },
        {
            id: "discount",
            singular: "Discount",
            plural: "Discounts",
            icon: "Percent",
            path: "/pricing/discounts",
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "kind", label: "Type", kind: "enum", options: [
                        { value: "percent", label: "Percent" },
                        { value: "amount", label: "Amount" },
                        { value: "bogo", label: "BOGO" },
                        { value: "free-ship", label: "Free shipping" },
                    ] },
                { name: "value", kind: "number", align: "right" },
                { name: "usageCount", kind: "number", align: "right" },
                { name: "usageLimit", kind: "number", align: "right" },
                { name: "validFrom", kind: "date" },
                { name: "validTo", kind: "date" },
                { name: "active", kind: "boolean" },
            ],
            seedCount: 12,
            seed: (i) => ({
                code: pick(["WELCOME10", "SAVE20", "FREESHIP", "BOGO50", "EARLY30"], i) + (i + 1),
                name: pick(["Welcome 10%", "Save 20%", "Free shipping", "BOGO 50% off", "Early-bird 30%"], i),
                kind: pick(["percent", "percent", "free-ship", "bogo", "percent"], i),
                value: pick([10, 20, 0, 50, 30], i),
                usageCount: (i * 17) % 500,
                usageLimit: 1000,
                validFrom: daysAgo(30),
                validTo: daysFromNow(30),
                active: i !== 11,
            }),
        },
    ],
    extraNav: [
        { id: "pricing-tax.control-room.nav", label: "Pricing Pricing Tax Tax Control Room", icon: "LayoutDashboard", path: "/pricing/control-room", view: "pricing-tax.control-room.view", order: 0 },
        { id: "pricing-tax.reports.nav", label: "Reports", icon: "BarChart3", path: "/pricing/reports", view: "pricing-tax.reports.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail],
    commands: [
        { id: "pricing.go.control-room", label: "Pricing: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/pricing/control-room"; } },
        { id: "pricing.go.reports", label: "Pricing: Reports", icon: "BarChart3", run: () => { window.location.hash = "/pricing/reports"; } },
        { id: "pricing.new-price", label: "New price", icon: "Plus", run: () => { window.location.hash = "/pricing/prices/new"; } },
        { id: "pricing.new-discount", label: "New discount", icon: "BadgePercent", run: () => { window.location.hash = "/pricing/discounts/new"; } },
    ],
});
