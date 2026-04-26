import { buildControlRoom } from "../_factory/controlRoomHelper";
import { buildReportLibrary } from "../_factory/reportLibraryHelper";
const workspace = {
    id: "community.control-room",
    label: "Community Control Room",
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Community pulse", level: 2 },
        { id: "k-posts", type: "number_card", col: 3, label: "Posts (7d)",
            aggregation: { resource: "community.post", fn: "count",
                range: { kind: "last", days: 7 } } },
        { id: "k-spaces", type: "number_card", col: 3, label: "Active spaces",
            aggregation: { resource: "community.space", fn: "count" } },
        { id: "k-reports", type: "number_card", col: 3, label: "Open reports",
            aggregation: { resource: "community.report", fn: "count",
                filter: { field: "status", op: "eq", value: "open" } },
            warnAbove: 5, dangerAbove: 15 },
        { id: "k-engagement", type: "number_card", col: 3, label: "Total likes",
            aggregation: { resource: "community.post", fn: "sum", field: "likes" } },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-visibility", type: "chart", col: 6, label: "Spaces by visibility", chart: "donut",
            aggregation: { resource: "community.space", fn: "count", groupBy: "visibility" } },
        { id: "c-report-sev", type: "chart", col: 6, label: "Reports by severity", chart: "donut",
            aggregation: { resource: "community.report", fn: "count", groupBy: "severity" } },
        { id: "c-vol", type: "chart", col: 12, label: "Posts (30d)", chart: "area",
            aggregation: { resource: "community.post", fn: "count", period: "day", range: { kind: "last", days: 30 } } },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-feed", type: "shortcut", col: 3, label: "Feed", icon: "MessageCircle", href: "/community/feed" },
        { id: "sc-spaces", type: "shortcut", col: 3, label: "Spaces", icon: "Hash", href: "/community/spaces" },
        { id: "sc-mod", type: "shortcut", col: 3, label: "Moderation", icon: "ShieldAlert", href: "/community/moderation" },
        { id: "sc-reports", type: "shortcut", col: 3, label: "Reports", icon: "BarChart3", href: "/community/reports" },
    ],
};
export const communityControlRoomView = buildControlRoom({
    viewId: "community.control-room.view",
    resource: "community.post",
    title: "Community Control Room",
    description: "Pulse of posts, spaces, moderation queue, engagement.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const topSpacesReport = {
    id: "top-spaces", label: "Top Spaces by Activity",
    description: "Spaces ranked by post volume + members.",
    icon: "Hash", resource: "community.space", filters: [],
    async execute({ resources }) {
        const spaces = await fetchAll(resources, "community.space");
        const rows = spaces.map((s) => ({
            name: str(s.name),
            handle: str(s.handle),
            members: num(s.members),
            posts: num(s.posts),
            visibility: str(s.visibility),
            lastActive: str(s.lastActive),
        })).sort((a, b) => b.posts - a.posts);
        return {
            columns: [
                { field: "name", label: "Space", fieldtype: "text" },
                { field: "handle", label: "Handle", fieldtype: "text" },
                { field: "members", label: "Members", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "posts", label: "Posts", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "visibility", label: "Visibility", fieldtype: "enum" },
                { field: "lastActive", label: "Last active", fieldtype: "datetime" },
            ],
            rows,
        };
    },
};
const topAuthorsReport = {
    id: "top-authors", label: "Top Authors",
    description: "Most prolific authors + engagement.",
    icon: "Users", resource: "community.post", filters: [],
    async execute({ resources }) {
        const posts = await fetchAll(resources, "community.post");
        const by = new Map();
        for (const p of posts) {
            const a = str(p.author);
            const r = by.get(a) ?? { author: a, posts: 0, likes: 0, replies: 0 };
            r.posts++;
            r.likes += num(p.likes);
            r.replies += num(p.replies);
            by.set(a, r);
        }
        const rows = [...by.values()].sort((a, b) => b.posts - a.posts);
        return {
            columns: [
                { field: "author", label: "Author", fieldtype: "text" },
                { field: "posts", label: "Posts", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "likes", label: "Likes", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "replies", label: "Replies", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const moderationReport = {
    id: "moderation-summary", label: "Moderation Summary",
    description: "Moderation reports by severity + outcome.",
    icon: "ShieldAlert", resource: "community.report", filters: [],
    async execute({ resources }) {
        const reports = await fetchAll(resources, "community.report");
        const by = new Map();
        for (const r of reports) {
            const s = str(r.severity);
            const row = by.get(s) ?? { severity: s, open: 0, actioned: 0, dismissed: 0 };
            if (r.status === "open")
                row.open++;
            else if (r.status === "actioned")
                row.actioned++;
            else
                row.dismissed++;
            by.set(s, row);
        }
        const rows = [...by.values()];
        return {
            columns: [
                { field: "severity", label: "Severity", fieldtype: "enum" },
                { field: "open", label: "Open", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "actioned", label: "Actioned", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "dismissed", label: "Dismissed", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
export const COMMUNITY_REPORTS = [
    topSpacesReport, topAuthorsReport, moderationReport,
];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "community.reports.view",
    detailViewId: "community.reports-detail.view",
    resource: "community.post",
    title: "Community Reports",
    description: "Top spaces, top authors, moderation summary.",
    basePath: "/community/reports",
    reports: COMMUNITY_REPORTS,
});
export const communityReportsIndexView = indexView;
export const communityReportsDetailView = detailView;
