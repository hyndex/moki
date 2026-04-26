import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_LIFECYCLE } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "content.control-room.view",
    resource: "content.article",
    title: "Content Control Room",
    description: "Articles, categories, publishing pipeline.",
    kpis: [
        { label: "Published", resource: "content.article",
            filter: { field: "status", op: "eq", value: "published" } },
        { label: "Drafts", resource: "content.article",
            filter: { field: "status", op: "eq", value: "draft" } },
        { label: "Pending review", resource: "content.article",
            filter: { field: "status", op: "eq", value: "pending" }, warnAbove: 3 },
        { label: "Total views", resource: "content.article", fn: "sum", field: "views" },
    ],
    charts: [
        { label: "Articles by status", resource: "content.article", chart: "donut", groupBy: "status" },
        { label: "Articles by author", resource: "content.article", chart: "bar", groupBy: "author" },
    ],
    shortcuts: [
        { label: "New article", icon: "Plus", href: "/content/articles/new" },
        { label: "Categories", icon: "FolderTree", href: "/content/categories" },
        { label: "Authors", icon: "Users", href: "/content/authors" },
        { label: "Reports", icon: "BarChart3", href: "/content/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const topArticlesReport = {
    id: "top-articles", label: "Top Articles",
    description: "Articles by views.",
    icon: "TrendingUp", resource: "content.article", filters: [],
    async execute({ resources }) {
        const articles = await fetchAll(resources, "content.article");
        const rows = articles.map((a) => ({
            title: str(a.title),
            slug: str(a.slug),
            status: str(a.status),
            author: str(a.author),
            views: num(a.views),
            updatedAt: str(a.updatedAt),
        })).sort((a, b) => b.views - a.views);
        return {
            columns: [
                { field: "title", label: "Title", fieldtype: "text" },
                { field: "slug", label: "Slug", fieldtype: "text" },
                { field: "author", label: "Author", fieldtype: "text" },
                { field: "status", label: "Status", fieldtype: "enum" },
                { field: "views", label: "Views", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "updatedAt", label: "Updated", fieldtype: "datetime" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "content.reports.view",
    detailViewId: "content.reports-detail.view",
    resource: "content.article",
    title: "Content Reports",
    description: "Top articles.",
    basePath: "/content/reports",
    reports: [topArticlesReport],
});
export const contentPlugin = buildDomainPlugin({
    id: "content",
    label: "Content",
    icon: "FileText",
    section: SECTIONS.workspace,
    order: 1,
    resources: [
        {
            id: "article",
            singular: "Article",
            plural: "Articles",
            icon: "FileText",
            path: "/content/articles",
            displayField: "title",
            defaultSort: { field: "updatedAt", dir: "desc" },
            fields: [
                { name: "title", kind: "text", required: true, sortable: true },
                { name: "slug", kind: "text" },
                { name: "status", kind: "enum", options: STATUS_LIFECYCLE, sortable: true },
                { name: "author", kind: "text", sortable: true },
                { name: "category", kind: "text" },
                { name: "views", kind: "number", align: "right", sortable: true },
                { name: "likes", kind: "number", align: "right" },
                { name: "tags", kind: "multi-enum", options: [
                        { value: "tutorial", label: "Tutorial" }, { value: "guide", label: "Guide" },
                        { value: "changelog", label: "Changelog" }, { value: "announcement", label: "Announcement" },
                    ] },
                { name: "publishedAt", kind: "datetime", sortable: true },
                { name: "updatedAt", kind: "datetime", sortable: true },
                { name: "body", kind: "textarea", formSection: "Content", required: true },
            ],
            seedCount: 30,
            seed: (i) => ({
                title: pick(["Getting started", "API reference", "Pricing update", "Changelog v1.2", "Security policy", "Integration guide"], i),
                slug: pick(["getting-started", "api", "pricing", "changelog-1-2", "security", "integration"], i),
                status: pick(["draft", "approved", "published", "published"], i),
                author: pick(["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev"], i),
                category: pick(["Docs", "Blog", "News", "Changelog"], i),
                views: 100 + (i * 317) % 10_000,
                likes: 5 + (i * 13) % 200,
                tags: pick([["tutorial"], ["guide"], ["changelog"], ["announcement"]], i),
                publishedAt: daysAgo(i),
                updatedAt: daysAgo(i),
                body: "Lorem ipsum…",
            }),
        },
        {
            id: "category",
            singular: "Category",
            plural: "Categories",
            icon: "FolderTree",
            path: "/content/categories",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "slug", kind: "text" },
                { name: "articlesCount", kind: "number", align: "right" },
            ],
            seedCount: 6,
            seed: (i) => ({
                name: pick(["Docs", "Blog", "News", "Changelog", "Product", "Engineering"], i),
                slug: pick(["docs", "blog", "news", "changelog", "product", "engineering"], i),
                articlesCount: 5 + i * 3,
            }),
        },
        {
            id: "author",
            singular: "Author",
            plural: "Authors",
            icon: "Users",
            path: "/content/authors",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "email", kind: "email" },
                { name: "articles", kind: "number", align: "right" },
            ],
            seedCount: 5,
            seed: (i) => ({
                name: pick(["Sam Hopper", "Alex Knuth", "Taylor Turing", "Jordan Hamilton", "Casey Pappas"], i),
                email: pick(["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev", "jordan@gutu.dev", "casey@gutu.dev"], i),
                articles: 3 + i * 2,
            }),
        },
    ],
    extraNav: [
        { id: "content.control-room.nav", label: "Content Control Room", icon: "LayoutDashboard", path: "/content/control-room", view: "content.control-room.view", order: 0 },
        { id: "content.reports.nav", label: "Reports", icon: "BarChart3", path: "/content/reports", view: "content.reports.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail],
    commands: [
        { id: "content.go.control-room", label: "Content: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/content/control-room"; } },
        { id: "content.new", label: "New article", icon: "Plus", run: () => { window.location.hash = "/content/articles/new"; } },
    ],
});
