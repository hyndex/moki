import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { code, money, pick, daysAgo, daysFromNow } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "product-catalog.control-room.view",
    resource: "product-catalog.product",
    title: "Product Catalog Control Room",
    description: "Catalog pulse — active SKUs, categories, pricing.",
    kpis: [
        { label: "Active SKUs", resource: "product-catalog.product",
            filter: { field: "status", op: "eq", value: "active" }, drilldown: "/catalog/products" },
        { label: "Total SKUs", resource: "product-catalog.product" },
        { label: "New this month", resource: "product-catalog.product",
            fn: "count", range: "mtd" },
        { label: "Avg price", resource: "product-catalog.product",
            fn: "avg", field: "price", format: "currency" },
    ],
    charts: [
        { label: "Products by category", resource: "product-catalog.product", chart: "donut", groupBy: "category" },
        { label: "Products by status", resource: "product-catalog.product", chart: "donut", groupBy: "status" },
    ],
    shortcuts: [
        { label: "New product", icon: "Plus", href: "/catalog/products/new" },
        { label: "Collections", icon: "FolderKanban", href: "/catalog/collections" },
        { label: "Brands", icon: "Award", href: "/catalog/brands" },
        { label: "Reports", icon: "BarChart3", href: "/catalog/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const byCategoryReport = {
    id: "by-category", label: "Catalog by Category",
    description: "SKU counts + avg price by category.",
    icon: "Tag", resource: "product-catalog.product", filters: [],
    async execute({ resources }) {
        const products = await fetchAll(resources, "product-catalog.product");
        const by = new Map();
        for (const p of products) {
            const c = str(p.category);
            const r = by.get(c) ?? { category: c, total: 0, active: 0, totalPrice: 0, avgPrice: 0 };
            r.total++;
            if (p.status === "active")
                r.active++;
            r.totalPrice += num(p.price);
            by.set(c, r);
        }
        const rows = [...by.values()].map((r) => ({
            ...r,
            avgPrice: r.total > 0 ? Math.round(r.totalPrice / r.total) : 0,
        })).sort((a, b) => b.total - a.total);
        return {
            columns: [
                { field: "category", label: "Category", fieldtype: "enum" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "active", label: "Active", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "avgPrice", label: "Avg price", fieldtype: "currency", align: "right", options: "USD" },
            ],
            rows,
        };
    },
};
const priceDistReport = {
    id: "price-distribution", label: "Price Distribution",
    description: "Products bucketed by price range.",
    icon: "DollarSign", resource: "product-catalog.product", filters: [],
    async execute({ resources }) {
        const products = await fetchAll(resources, "product-catalog.product");
        const buckets = [
            { label: "$0-$50", min: 0, max: 50 },
            { label: "$50-$100", min: 50, max: 100 },
            { label: "$100-$200", min: 100, max: 200 },
            { label: "$200-$500", min: 200, max: 500 },
            { label: "$500+", min: 500, max: Infinity },
        ];
        const rows = buckets.map((b) => ({ bucket: b.label, count: 0 }));
        for (const p of products) {
            const price = num(p.price);
            const idx = buckets.findIndex((b) => price >= b.min && price < b.max);
            if (idx >= 0)
                rows[idx].count++;
        }
        return {
            columns: [
                { field: "bucket", label: "Range", fieldtype: "text" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const newProductsReport = {
    id: "new-products", label: "New Products",
    description: "Products added in the last 60 days.",
    icon: "Sparkles", resource: "product-catalog.product", filters: [],
    async execute({ resources }) {
        const products = await fetchAll(resources, "product-catalog.product");
        const cutoff = Date.now() - 60 * 86_400_000;
        const rows = products
            .filter((p) => {
            const d = Date.parse(str(p.createdAt));
            return !Number.isNaN(d) && d >= cutoff;
        })
            .map((p) => ({
            sku: str(p.sku),
            name: str(p.name),
            category: str(p.category),
            price: num(p.price),
            createdAt: str(p.createdAt),
        }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return {
            columns: [
                { field: "sku", label: "SKU", fieldtype: "text" },
                { field: "name", label: "Name", fieldtype: "text" },
                { field: "category", label: "Category", fieldtype: "enum" },
                { field: "price", label: "Price", fieldtype: "currency", align: "right", options: "USD" },
                { field: "createdAt", label: "Created", fieldtype: "date" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "product-catalog.reports.view",
    detailViewId: "product-catalog.reports-detail.view",
    resource: "product-catalog.product",
    title: "Product Catalog Reports",
    description: "Catalog composition, pricing, new-product velocity.",
    basePath: "/catalog/reports",
    reports: [byCategoryReport, priceDistReport, newProductsReport],
});
export const productCatalogPlugin = buildDomainPlugin({
    id: "product-catalog",
    label: "Product Catalog",
    icon: "ShoppingBasket",
    section: SECTIONS.commerce,
    order: 1,
    resources: [
        {
            id: "product",
            singular: "Product",
            plural: "Products",
            icon: "Tag",
            path: "/catalog/products",
            fields: [
                { name: "sku", kind: "text", required: true, sortable: true, width: 110 },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "category", kind: "enum", options: [
                        { value: "apparel", label: "Apparel" },
                        { value: "electronics", label: "Electronics" },
                        { value: "home", label: "Home" },
                        { value: "books", label: "Books" },
                        { value: "toys", label: "Toys" },
                        { value: "grocery", label: "Grocery" },
                    ], sortable: true },
                { name: "brand", kind: "text", sortable: true },
                { name: "collection", kind: "text" },
                { name: "price", kind: "currency", align: "right", sortable: true },
                { name: "cost", kind: "currency", align: "right" },
                { name: "marginPct", kind: "number", align: "right" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE },
                { name: "createdAt", kind: "date", sortable: true },
                { name: "updatedAt", kind: "datetime", sortable: true },
                { name: "tags", kind: "multi-enum", options: [
                        { value: "new", label: "New" }, { value: "bestseller", label: "Bestseller" },
                        { value: "sale", label: "Sale" }, { value: "limited", label: "Limited" },
                    ] },
                { name: "description", kind: "textarea", formSection: "Details" },
            ],
            seedCount: 40,
            seed: (i) => {
                const price = money(i, 9, 500);
                const cost = Math.round(price * 0.6);
                return {
                    sku: code("P", i, 6),
                    name: pick(["Classic Tee", "Running Shoes", "Coffee Mug", "Wireless Mouse", "Notebook", "Phone Case"], i) + ` v${1 + (i % 5)}`,
                    category: pick(["apparel", "electronics", "home", "books", "toys", "grocery"], i),
                    brand: pick(["Brand A", "Brand B", "Brand C", "Brand D"], i),
                    collection: pick(["Spring 2026", "Summer 2026", "Fall 2025", "Core"], i),
                    price,
                    cost,
                    marginPct: Math.round(((price - cost) / price) * 100),
                    status: pick(["active", "active", "archived"], i),
                    createdAt: daysAgo((i * 7) % 120),
                    updatedAt: daysAgo(i),
                    tags: pick([["new"], ["bestseller"], ["sale"], [], ["limited"]], i),
                    description: "",
                };
            },
        },
        {
            id: "collection",
            singular: "Collection",
            plural: "Collections",
            icon: "FolderKanban",
            path: "/catalog/collections",
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "season", kind: "text" },
                { name: "productsCount", kind: "number", align: "right" },
                { name: "activeFrom", kind: "date" },
                { name: "activeTo", kind: "date" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE },
            ],
            seedCount: 6,
            seed: (i) => ({
                code: code("COL", i, 4),
                name: pick(["Spring 2026", "Summer 2026", "Fall 2025", "Winter 2025", "Core", "Limited Edition"], i),
                season: pick(["Spring 2026", "Summer 2026", "Fall 2025", "Winter 2025", "Year-round", "Special"], i),
                productsCount: 8 + (i * 3),
                activeFrom: daysAgo(30 + i * 30),
                activeTo: daysFromNow(60 - i * 10),
                status: i === 5 ? "archived" : "active",
            }),
        },
        {
            id: "brand",
            singular: "Brand",
            plural: "Brands",
            icon: "Award",
            path: "/catalog/brands",
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "vendor", kind: "text" },
                { name: "productsCount", kind: "number", align: "right" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE },
            ],
            seedCount: 8,
            seed: (i) => ({
                code: code("BR", i, 4),
                name: pick(["Brand A", "Brand B", "Brand C", "Brand D", "Brand E", "Brand F", "Brand G", "Brand H"], i),
                vendor: pick(["Acme Supply", "Globex Parts", "Initech"], i),
                productsCount: 5 + (i * 3),
                status: "active",
            }),
        },
        {
            id: "category",
            singular: "Category",
            plural: "Categories",
            icon: "FolderTree",
            path: "/catalog/categories",
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "parent", kind: "text" },
                { name: "productsCount", kind: "number", align: "right" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE },
            ],
            seedCount: 10,
            seed: (i) => ({
                code: code("CAT", i, 4),
                name: pick(["Apparel", "Electronics", "Home", "Books", "Toys", "Grocery", "Beauty", "Sports", "Outdoor", "Accessories"], i),
                parent: "",
                productsCount: 5 + (i * 4),
                status: "active",
            }),
        },
    ],
    extraNav: [
        { id: "product-catalog.control-room.nav", label: "Catalog Control Room", icon: "LayoutDashboard", path: "/catalog/control-room", view: "product-catalog.control-room.view", order: 0 },
        { id: "product-catalog.reports.nav", label: "Reports", icon: "BarChart3", path: "/catalog/reports", view: "product-catalog.reports.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail],
    commands: [
        { id: "catalog.go.control-room", label: "Catalog: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/catalog/control-room"; } },
        { id: "catalog.go.reports", label: "Catalog: Reports", icon: "BarChart3", run: () => { window.location.hash = "/catalog/reports"; } },
        { id: "catalog.new-product", label: "New product", icon: "Plus", run: () => { window.location.hash = "/catalog/products/new"; } },
        { id: "catalog.new-collection", label: "New collection", icon: "FolderKanban", run: () => { window.location.hash = "/catalog/collections/new"; } },
    ],
});
