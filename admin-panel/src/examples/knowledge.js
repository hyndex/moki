import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_LIFECYCLE } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
const controlRoomView = buildCompactControlRoom({
    viewId: "knowledge.control-room.view",
    resource: "knowledge.article",
    title: "Knowledge Base Control Room",
    description: "KB articles, categories, helpful-rate.",
    kpis: [
        { label: "Published", resource: "knowledge.article",
            filter: { field: "status", op: "eq", value: "published" } },
        { label: "Drafts", resource: "knowledge.article",
            filter: { field: "status", op: "eq", value: "draft" } },
        { label: "Total views", resource: "knowledge.article", fn: "sum", field: "views" },
        { label: "Avg helpful %", resource: "knowledge.article", fn: "avg", field: "helpfulPct" },
    ],
    charts: [
        { label: "Articles by category", resource: "knowledge.article", chart: "donut", groupBy: "category" },
        { label: "Articles by status", resource: "knowledge.article", chart: "donut", groupBy: "status" },
    ],
    shortcuts: [
        { label: "New article", icon: "Plus", href: "/knowledge/articles/new" },
        { label: "Categories", icon: "FolderTree", href: "/knowledge/categories" },
    ],
});
export const knowledgePlugin = buildDomainPlugin({
    id: "knowledge",
    label: "Knowledge Base",
    icon: "BookOpenText",
    section: SECTIONS.workspace,
    order: 6,
    resources: [
        {
            id: "article",
            singular: "KB Article",
            plural: "KB Articles",
            icon: "BookOpenText",
            path: "/knowledge/articles",
            displayField: "title",
            defaultSort: { field: "views", dir: "desc" },
            fields: [
                { name: "title", kind: "text", required: true, sortable: true },
                { name: "slug", kind: "text" },
                { name: "category", kind: "enum", options: [
                        { value: "getting-started", label: "Getting started" },
                        { value: "troubleshooting", label: "Troubleshooting" },
                        { value: "api", label: "API" }, { value: "billing", label: "Billing" },
                        { value: "security", label: "Security" },
                    ], sortable: true },
                { name: "status", kind: "enum", options: STATUS_LIFECYCLE },
                { name: "author", kind: "text" },
                { name: "views", kind: "number", align: "right", sortable: true },
                { name: "helpful", kind: "number", align: "right" },
                { name: "notHelpful", kind: "number", align: "right" },
                { name: "helpfulPct", kind: "number", align: "right" },
                { name: "updatedAt", kind: "datetime", sortable: true },
                { name: "body", kind: "textarea", formSection: "Content" },
            ],
            seedCount: 30,
            seed: (i) => {
                const helpful = 20 + (i * 7) % 200;
                const notHelpful = 1 + (i % 10);
                return {
                    title: pick(["Resetting your password", "Setting up SSO", "Importing CSV", "Understanding invoices", "API limits"], i),
                    slug: pick(["reset-password", "sso", "import-csv", "invoices", "api-limits"], i),
                    category: pick(["getting-started", "troubleshooting", "api", "billing", "security"], i),
                    status: pick(["draft", "published", "published", "published"], i),
                    author: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
                    views: (i * 131) % 5000,
                    helpful,
                    notHelpful,
                    helpfulPct: Math.round((helpful / (helpful + notHelpful)) * 100),
                    updatedAt: daysAgo(i),
                    body: "Full article body…",
                };
            },
        },
        {
            id: "category",
            singular: "Category",
            plural: "Categories",
            icon: "FolderTree",
            path: "/knowledge/categories",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "articles", kind: "number", align: "right" },
            ],
            seedCount: 5,
            seed: (i) => ({
                name: pick(["Getting started", "Troubleshooting", "API", "Billing", "Security"], i),
                articles: 5 + i * 2,
            }),
        },
    ],
    extraNav: [
        { id: "knowledge.control-room.nav", label: "Knowledge Control Room", icon: "LayoutDashboard", path: "/knowledge/control-room", view: "knowledge.control-room.view", order: 0 },
    ],
    extraViews: [controlRoomView],
    commands: [
        { id: "kb.go.control-room", label: "KB: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/knowledge/control-room"; } },
        { id: "kb.new", label: "New article", icon: "Plus", run: () => { window.location.hash = "/knowledge/articles/new"; } },
    ],
});
