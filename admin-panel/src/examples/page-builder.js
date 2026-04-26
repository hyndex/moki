import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_LIFECYCLE } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
const controlRoomView = buildCompactControlRoom({
    viewId: "page-builder.control-room.view",
    resource: "page-builder.page",
    title: "Page Builder Control Room",
    description: "Pages, blocks, publishing.",
    kpis: [
        { label: "Published", resource: "page-builder.page",
            filter: { field: "status", op: "eq", value: "published" } },
        { label: "Drafts", resource: "page-builder.page",
            filter: { field: "status", op: "eq", value: "draft" } },
        { label: "Total views", resource: "page-builder.page", fn: "sum", field: "views" },
    ],
    charts: [
        { label: "Pages by status", resource: "page-builder.page", chart: "donut", groupBy: "status" },
        { label: "Top pages", resource: "page-builder.page", chart: "bar", groupBy: "title", fn: "sum", field: "views" },
    ],
    shortcuts: [
        { label: "New page", icon: "Plus", href: "/pages/new" },
        { label: "Blocks", icon: "Grid", href: "/pages/blocks" },
    ],
});
export const pageBuilderPlugin = buildDomainPlugin({
    id: "page-builder",
    label: "Page Builder",
    icon: "LayoutTemplate",
    section: SECTIONS.portals,
    order: 3,
    resources: [
        {
            id: "page",
            singular: "Page",
            plural: "Pages",
            icon: "LayoutTemplate",
            path: "/pages",
            displayField: "title",
            defaultSort: { field: "updatedAt", dir: "desc" },
            fields: [
                { name: "title", kind: "text", required: true, sortable: true },
                { name: "slug", kind: "text" },
                { name: "path", kind: "text" },
                { name: "theme", kind: "text" },
                { name: "views", kind: "number", align: "right", sortable: true },
                { name: "status", kind: "enum", options: STATUS_LIFECYCLE, sortable: true },
                { name: "publishedAt", kind: "datetime" },
                { name: "updatedAt", kind: "datetime", sortable: true },
            ],
            seedCount: 20,
            seed: (i) => ({
                title: pick(["Home", "Pricing", "About", "Careers", "Changelog", "Features", "Blog"], i),
                slug: pick(["", "pricing", "about", "careers", "changelog", "features", "blog"], i),
                path: "/" + pick(["", "pricing", "about", "careers", "changelog"], i),
                theme: pick(["default", "dark", "minimal"], i),
                views: 100 + (i * 317) % 10_000,
                status: pick(["draft", "published", "published", "archived"], i),
                publishedAt: daysAgo(i),
                updatedAt: daysAgo(i),
            }),
        },
        {
            id: "block",
            singular: "Block",
            plural: "Blocks",
            icon: "Grid",
            path: "/pages/blocks",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "kind", kind: "enum", options: [
                        { value: "hero", label: "Hero" }, { value: "features", label: "Features" },
                        { value: "cta", label: "CTA" }, { value: "testimonial", label: "Testimonial" },
                        { value: "faq", label: "FAQ" }, { value: "pricing", label: "Pricing" },
                    ] },
                { name: "usageCount", kind: "number", align: "right" },
            ],
            seedCount: 10,
            seed: (i) => ({
                name: pick(["Landing hero", "Feature grid", "CTA big", "Testimonial carousel", "FAQ accordion"], i),
                kind: pick(["hero", "features", "cta", "testimonial", "faq", "pricing"], i),
                usageCount: 3 + i * 2,
            }),
        },
    ],
    extraNav: [
        { id: "page-builder.control-room.nav", label: "Pages Control Room", icon: "LayoutDashboard", path: "/pages/control-room", view: "page-builder.control-room.view", order: 0 },
    ],
    extraViews: [controlRoomView],
    commands: [
        { id: "pb.go.control-room", label: "Pages: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/pages/control-room"; } },
        { id: "pb.new", label: "New page", icon: "Plus", run: () => { window.location.hash = "/pages/new"; } },
    ],
});
