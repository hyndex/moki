import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "ai-rag.control-room.view",
    resource: "ai-rag.collection",
    title: "AI RAG Control Room",
    description: "Collections, documents, queries, retrieval quality.",
    kpis: [
        { label: "Collections", resource: "ai-rag.collection",
            filter: { field: "status", op: "eq", value: "active" } },
        { label: "Documents", resource: "ai-rag.document" },
        { label: "Queries (30d)", resource: "ai-rag.query", range: "last-30" },
        { label: "Chunks", resource: "ai-rag.collection", fn: "sum", field: "chunks" },
    ],
    charts: [
        { label: "Collections by embedder", resource: "ai-rag.collection", chart: "donut", groupBy: "embedder" },
        { label: "Queries (30d)", resource: "ai-rag.query", chart: "area", period: "day", lastDays: 30 },
    ],
    shortcuts: [
        { label: "New collection", icon: "Plus", href: "/ai/rag/collections/new" },
        { label: "Upload documents", icon: "Upload", href: "/ai/rag/documents/new" },
        { label: "Query console", icon: "Search", href: "/ai/rag/query" },
        { label: "Reports", icon: "BarChart3", href: "/ai/rag/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const retrievalQualityReport = {
    id: "retrieval-quality", label: "Retrieval Quality",
    description: "Average recall@k by collection.",
    icon: "Target", resource: "ai-rag.collection", filters: [],
    async execute({ resources }) {
        const collections = await fetchAll(resources, "ai-rag.collection");
        const rows = collections.map((c) => ({
            name: str(c.name),
            chunks: num(c.chunks),
            recall: num(c.recallAtK),
            avgLatency: num(c.avgLatencyMs),
            queries: num(c.queryCount),
        })).sort((a, b) => b.recall - a.recall);
        return {
            columns: [
                { field: "name", label: "Collection", fieldtype: "text" },
                { field: "chunks", label: "Chunks", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "queries", label: "Queries", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "recall", label: "Recall@10 %", fieldtype: "percent", align: "right" },
                { field: "avgLatency", label: "Avg latency (ms)", fieldtype: "number", align: "right" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "ai-rag.reports.view",
    detailViewId: "ai-rag.reports-detail.view",
    resource: "ai-rag.collection",
    title: "AI RAG Reports",
    description: "Retrieval quality.",
    basePath: "/ai/rag/reports",
    reports: [retrievalQualityReport],
});
export const aiRagPlugin = buildDomainPlugin({
    id: "ai-rag",
    label: "AI RAG",
    icon: "Database",
    section: SECTIONS.ai,
    order: 3,
    resources: [
        {
            id: "collection",
            singular: "Collection",
            plural: "Collections",
            icon: "FolderArchive",
            path: "/ai/rag/collections",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "description", kind: "text" },
                { name: "embedder", kind: "enum", options: [
                        { value: "text-embedding-3-large", label: "OpenAI 3-large" },
                        { value: "voyage-2", label: "Voyage 2" },
                        { value: "cohere-v3", label: "Cohere v3" },
                    ], sortable: true },
                { name: "vectorStore", kind: "enum", options: [
                        { value: "pgvector", label: "pgvector" },
                        { value: "pinecone", label: "Pinecone" },
                        { value: "weaviate", label: "Weaviate" },
                        { value: "qdrant", label: "Qdrant" },
                    ] },
                { name: "chunks", kind: "number", align: "right", sortable: true },
                { name: "chunkSize", kind: "number", align: "right" },
                { name: "queryCount", kind: "number", align: "right" },
                { name: "recallAtK", kind: "number", align: "right" },
                { name: "avgLatencyMs", kind: "number", align: "right" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE },
                { name: "updatedAt", kind: "datetime", sortable: true },
            ],
            seedCount: 12,
            seed: (i) => ({
                name: pick(["docs-v2", "support-kb", "sales-playbook", "onboarding", "policies", "api-reference", "changelog"], i),
                description: "",
                embedder: pick(["text-embedding-3-large", "voyage-2", "cohere-v3"], i),
                vectorStore: pick(["pgvector", "pinecone", "weaviate", "qdrant"], i),
                chunks: 500 + ((i * 97) % 5000),
                chunkSize: pick([256, 512, 1024], i),
                queryCount: (i * 137) % 2000,
                recallAtK: 80 + (i * 2) % 18,
                avgLatencyMs: 50 + (i * 13) % 200,
                status: pick(["active", "active", "inactive"], i),
                updatedAt: daysAgo(i),
            }),
        },
        {
            id: "document",
            singular: "Document",
            plural: "Documents",
            icon: "FileText",
            path: "/ai/rag/documents",
            fields: [
                { name: "title", kind: "text", required: true, sortable: true },
                { name: "collection", kind: "text", sortable: true },
                { name: "source", kind: "enum", options: [
                        { value: "upload", label: "Upload" }, { value: "url", label: "URL" },
                        { value: "google-drive", label: "Google Drive" }, { value: "confluence", label: "Confluence" },
                        { value: "notion", label: "Notion" },
                    ] },
                { name: "chunks", kind: "number", align: "right" },
                { name: "sizeBytes", kind: "number", align: "right" },
                { name: "indexedAt", kind: "datetime", sortable: true },
                { name: "status", kind: "enum", options: [
                        { value: "indexed", label: "Indexed", intent: "success" },
                        { value: "indexing", label: "Indexing", intent: "info" },
                        { value: "failed", label: "Failed", intent: "danger" },
                    ] },
            ],
            seedCount: 30,
            seed: (i) => ({
                title: pick(["Getting started", "API reference", "Pricing update", "Changelog v1.2", "Security policy"], i) + ` ${i + 1}`,
                collection: pick(["docs-v2", "support-kb", "sales-playbook"], i),
                source: pick(["upload", "url", "google-drive", "confluence", "notion"], i),
                chunks: 10 + (i * 3) % 50,
                sizeBytes: 5000 + (i * 737) % 50_000,
                indexedAt: daysAgo(i),
                status: pick(["indexed", "indexed", "indexing", "failed"], i),
            }),
        },
        {
            id: "query",
            singular: "Query",
            plural: "Queries",
            icon: "Search",
            path: "/ai/rag/queries",
            readOnly: true,
            defaultSort: { field: "queriedAt", dir: "desc" },
            fields: [
                { name: "text", kind: "text", required: true, sortable: true },
                { name: "collection", kind: "text", sortable: true },
                { name: "user", kind: "text" },
                { name: "k", kind: "number", align: "right" },
                { name: "hits", kind: "number", align: "right" },
                { name: "latencyMs", kind: "number", align: "right" },
                { name: "queriedAt", kind: "datetime", sortable: true },
            ],
            seedCount: 40,
            seed: (i) => ({
                text: pick(["How do I reset my password?", "Pricing for enterprise", "API rate limits", "Refund policy", "SSO setup"], i),
                collection: pick(["docs-v2", "support-kb", "sales-playbook"], i),
                user: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
                k: pick([5, 10, 20], i),
                hits: 3 + (i % 8),
                latencyMs: 50 + (i * 13) % 300,
                queriedAt: daysAgo(i * 0.2),
            }),
        },
    ],
    extraNav: [
        { id: "ai-rag.control-room.nav", label: "AI RAG Control Room", icon: "LayoutDashboard", path: "/ai/rag/control-room", view: "ai-rag.control-room.view", order: 0 },
        { id: "ai-rag.reports.nav", label: "Reports", icon: "BarChart3", path: "/ai/rag/reports", view: "ai-rag.reports.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail],
    commands: [
        { id: "rag.go.control-room", label: "RAG: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/ai/rag/control-room"; } },
        { id: "rag.new-collection", label: "New RAG collection", icon: "Plus", run: () => { window.location.hash = "/ai/rag/collections/new"; } },
    ],
});
