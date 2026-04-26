import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";

const controlRoomView = buildCompactControlRoom({
  viewId: "search.control-room.view",
  resource: "search.index",
  title: "Search Control Room",
  description: "Indexes, synonyms, queries.",
  kpis: [
    { label: "Active indexes", resource: "search.index",
      filter: { field: "status", op: "eq", value: "active" } },
    { label: "Total docs", resource: "search.index", fn: "sum", field: "documents" },
    { label: "Queries (7d)", resource: "search.query", range: "last-7" },
  ],
  charts: [
    { label: "Indexes by resource", resource: "search.index", chart: "bar", groupBy: "resource" },
  ],
  shortcuts: [
    { label: "New index", icon: "Plus", href: "/platform/search-indexes/new" },
  ],
});

export const searchPlugin = buildDomainPlugin({
  id: "search",
  label: "Search",
  icon: "Search",
  section: SECTIONS.platform,
  order: 7,
  resources: [
    {
      id: "index",
      singular: "Index",
      plural: "Indexes",
      icon: "Search",
      path: "/platform/search-indexes",
      fields: [
        { name: "name", kind: "text", required: true, sortable: true },
        { name: "resource", kind: "text", sortable: true },
        { name: "documents", kind: "number", align: "right", sortable: true },
        { name: "sizeBytes", kind: "number", align: "right" },
        { name: "engine", kind: "enum", options: [
          { value: "postgres-fts", label: "Postgres FTS" },
          { value: "meilisearch", label: "Meilisearch" },
          { value: "typesense", label: "Typesense" },
          { value: "elasticsearch", label: "Elasticsearch" },
        ] },
        { name: "status", kind: "enum", options: STATUS_ACTIVE },
        { name: "updatedAt", kind: "datetime", sortable: true },
      ],
      seedCount: 12,
      seed: (i) => ({
        name: pick(["contacts", "products", "invoices", "tickets", "pages", "employees"], i),
        resource: pick(["crm.contact", "product-catalog.product", "accounting.invoice", "issues.issue", "page-builder.page", "hr-payroll.employee"], i),
        documents: 1000 + ((i * 7919) % 50000),
        sizeBytes: 1_000_000 + i * 500_000,
        engine: pick(["postgres-fts", "meilisearch", "typesense", "elasticsearch"], i),
        status: pick(["active", "active", "inactive"], i),
        updatedAt: daysAgo(i),
      }),
    },
    {
      id: "synonym",
      singular: "Synonym",
      plural: "Synonyms",
      icon: "Replace",
      path: "/platform/search-indexes/synonyms",
      fields: [
        { name: "term", kind: "text", required: true, sortable: true },
        { name: "synonyms", kind: "text" },
        { name: "index", kind: "text" },
      ],
      seedCount: 10,
      seed: (i) => ({
        term: pick(["laptop", "phone", "car", "invoice", "customer"], i),
        synonyms: pick(["notebook, computer", "mobile, cell", "automobile, vehicle", "bill, receipt", "client, buyer"], i),
        index: pick(["products", "contacts", "invoices"], i),
      }),
    },
    {
      id: "query",
      singular: "Query",
      plural: "Queries",
      icon: "History",
      path: "/platform/search-indexes/queries",
      readOnly: true,
      defaultSort: { field: "queriedAt", dir: "desc" },
      fields: [
        { name: "text", kind: "text", required: true, sortable: true },
        { name: "index", kind: "text" },
        { name: "user", kind: "text" },
        { name: "hits", kind: "number", align: "right" },
        { name: "latencyMs", kind: "number", align: "right" },
        { name: "queriedAt", kind: "datetime", sortable: true },
      ],
      seedCount: 30,
      seed: (i) => ({
        text: pick(["alice", "invoice 2024", "ticket SUP-1023", "widget A", "enterprise"], i),
        index: pick(["contacts", "invoices", "tickets"], i),
        user: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
        hits: 1 + (i * 3) % 20,
        latencyMs: 5 + (i * 3) % 100,
        queriedAt: daysAgo(i * 0.2),
      }),
    },
  ],
  extraNav: [
    { id: "search.control-room.nav", label: "Search Control Room", icon: "LayoutDashboard", path: "/platform/search-indexes/control-room", view: "search.control-room.view", order: 0 },
  ],
  extraViews: [controlRoomView],
  commands: [
    { id: "search.go.control-room", label: "Search: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/platform/search-indexes/control-room"; } },
  ],
});
