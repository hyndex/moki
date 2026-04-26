import { buildControlRoom } from "../_factory/controlRoomHelper";
import { buildReportLibrary } from "../_factory/reportLibraryHelper";
const workspace = {
    id: "party-relationships.control-room",
    label: "Relationships Control Room",
    widgets: [
        { id: "h1", type: "header", col: 12, label: "Graph pulse", level: 2 },
        { id: "k-entities", type: "number_card", col: 4, label: "Entities",
            aggregation: { resource: "party-relationships.entity", fn: "count" },
            drilldown: "/party-relationships" },
        { id: "k-edges", type: "number_card", col: 4, label: "Relationships",
            aggregation: { resource: "party-relationships.relationship", fn: "count" } },
        { id: "k-companies", type: "number_card", col: 4, label: "Companies",
            aggregation: { resource: "party-relationships.entity", fn: "count",
                filter: { field: "kind", op: "eq", value: "company" } } },
        { id: "h2", type: "header", col: 12, label: "Charts", level: 2 },
        { id: "c-kind", type: "chart", col: 6, label: "Entities by kind", chart: "donut",
            aggregation: { resource: "party-relationships.entity", fn: "count", groupBy: "kind" } },
        { id: "c-rel", type: "chart", col: 6, label: "Relationships by kind", chart: "donut",
            aggregation: { resource: "party-relationships.relationship", fn: "count", groupBy: "kind" } },
        { id: "h3", type: "header", col: 12, label: "Shortcuts", level: 2 },
        { id: "sc-graph", type: "shortcut", col: 4, label: "Graph", icon: "Network", href: "/party-relationships/graph" },
        { id: "sc-list", type: "shortcut", col: 4, label: "List", icon: "Share2", href: "/party-relationships" },
        { id: "sc-reports", type: "shortcut", col: 4, label: "Reports", icon: "BarChart3", href: "/party-relationships/reports" },
    ],
};
export const partyControlRoomView = buildControlRoom({
    viewId: "party-relationships.control-room.view",
    resource: "party-relationships.entity",
    title: "Relationships Control Room",
    description: "Graph snapshot — entities, edges, kinds.",
    workspace,
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const connectivityReport = {
    id: "connectivity", label: "Entity Connectivity",
    description: "Degree (connections in/out) for each entity.",
    icon: "Network", resource: "party-relationships.entity", filters: [],
    async execute({ resources }) {
        const entities = await fetchAll(resources, "party-relationships.entity");
        const edges = await fetchAll(resources, "party-relationships.relationship");
        const deg = new Map();
        for (const e of edges) {
            const f = str(e.from), t = str(e.to);
            const df = deg.get(f) ?? { in: 0, out: 0 };
            df.out++;
            deg.set(f, df);
            const dt = deg.get(t) ?? { in: 0, out: 0 };
            dt.in++;
            deg.set(t, dt);
        }
        const rows = entities.map((e) => ({
            id: str(e.id),
            label: str(e.label),
            kind: str(e.kind),
            inDegree: deg.get(str(e.id))?.in ?? 0,
            outDegree: deg.get(str(e.id))?.out ?? 0,
            total: (deg.get(str(e.id))?.in ?? 0) + (deg.get(str(e.id))?.out ?? 0),
        })).sort((a, b) => b.total - a.total);
        return {
            columns: [
                { field: "label", label: "Entity", fieldtype: "text" },
                { field: "kind", label: "Kind", fieldtype: "enum" },
                { field: "inDegree", label: "In", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "outDegree", label: "Out", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const relationshipStrengthReport = {
    id: "relationship-strength", label: "Relationship Strength",
    description: "All edges ordered by strength.",
    icon: "Heart", resource: "party-relationships.relationship", filters: [],
    async execute({ resources }) {
        const edges = await fetchAll(resources, "party-relationships.relationship");
        const rows = edges.map((e) => ({
            from: str(e.from),
            to: str(e.to),
            kind: str(e.kind),
            strength: num(e.strength),
        })).sort((a, b) => b.strength - a.strength);
        return {
            columns: [
                { field: "from", label: "From", fieldtype: "text" },
                { field: "to", label: "To", fieldtype: "text" },
                { field: "kind", label: "Kind", fieldtype: "enum" },
                { field: "strength", label: "Strength", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
export const PARTY_REPORTS = [connectivityReport, relationshipStrengthReport];
const { indexView, detailView } = buildReportLibrary({
    indexViewId: "party-relationships.reports.view",
    detailViewId: "party-relationships.reports-detail.view",
    resource: "party-relationships.entity",
    title: "Relationships Reports",
    description: "Connectivity + strength analysis.",
    basePath: "/party-relationships/reports",
    reports: PARTY_REPORTS,
});
export const partyReportsIndexView = indexView;
export const partyReportsDetailView = detailView;
