import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { daysAgo, hoursAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "ai-assist.control-room.view",
    resource: "ai-assist.thread",
    title: "AI Assist Control Room",
    description: "Threads, memories, agent activity.",
    kpis: [
        { label: "Active threads (7d)", resource: "ai-assist.thread", range: "last-7" },
        { label: "Memories", resource: "ai-assist.memory" },
        { label: "Agents", resource: "ai-assist.agent" },
        { label: "Tools", resource: "ai-assist.tool" },
    ],
    charts: [
        { label: "Threads by owner", resource: "ai-assist.thread", chart: "bar", groupBy: "owner" },
        { label: "Memories by type", resource: "ai-assist.memory", chart: "donut", groupBy: "type" },
    ],
    shortcuts: [
        { label: "New thread", icon: "Plus", href: "/ai/assist/threads/new" },
        { label: "New agent", icon: "Bot", href: "/ai/assist/agents/new" },
        { label: "Tools", icon: "Wrench", href: "/ai/assist/tools" },
        { label: "Reports", icon: "BarChart3", href: "/ai/assist/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const threadActivityReport = {
    id: "thread-activity", label: "Thread Activity",
    description: "Message count + last active per user.",
    icon: "MessagesSquare", resource: "ai-assist.thread", filters: [],
    async execute({ resources }) {
        const threads = await fetchAll(resources, "ai-assist.thread");
        const by = new Map();
        for (const t of threads) {
            const o = str(t.owner);
            const r = by.get(o) ?? { owner: o, threads: 0, messages: 0 };
            r.threads++;
            r.messages += num(t.messages);
            by.set(o, r);
        }
        const rows = [...by.values()].sort((a, b) => b.messages - a.messages);
        return {
            columns: [
                { field: "owner", label: "Owner", fieldtype: "text" },
                { field: "threads", label: "Threads", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "messages", label: "Messages", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "ai-assist.reports.view",
    detailViewId: "ai-assist.reports-detail.view",
    resource: "ai-assist.thread",
    title: "AI Assist Reports",
    description: "Thread activity.",
    basePath: "/ai/assist/reports",
    reports: [threadActivityReport],
});
export const aiAssistPlugin = buildDomainPlugin({
    id: "ai-assist",
    label: "AI Assist",
    icon: "Bot",
    section: SECTIONS.ai,
    order: 5,
    resources: [
        {
            id: "thread",
            singular: "Thread",
            plural: "Threads",
            icon: "MessagesSquare",
            path: "/ai/assist/threads",
            displayField: "title",
            defaultSort: { field: "lastActive", dir: "desc" },
            fields: [
                { name: "title", kind: "text", required: true, sortable: true },
                { name: "owner", kind: "text", sortable: true },
                { name: "agent", kind: "text" },
                { name: "messages", kind: "number", align: "right" },
                { name: "lastActive", kind: "datetime", sortable: true },
                { name: "starred", kind: "boolean" },
            ],
            seedCount: 30,
            seed: (i) => ({
                title: pick(["Draft Q3 OKRs", "Rewrite landing page", "Find duplicates in CRM", "Summarize interview", "Plan migration"], i),
                owner: pick(["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev"], i),
                agent: pick(["General", "Sales assistant", "Support triage", "Code review"], i),
                messages: 2 + ((i * 3) % 40),
                lastActive: hoursAgo(i * 2),
                starred: i % 5 === 0,
            }),
        },
        {
            id: "memory",
            singular: "Memory",
            plural: "Memories",
            icon: "Bookmark",
            path: "/ai/assist/memories",
            readOnly: true,
            fields: [
                { name: "summary", kind: "text", sortable: true },
                { name: "type", kind: "enum", options: [
                        { value: "user", label: "User" },
                        { value: "project", label: "Project" },
                        { value: "feedback", label: "Feedback" },
                    ] },
                { name: "confidence", kind: "number", align: "right" },
                { name: "createdAt", kind: "datetime", sortable: true },
            ],
            seedCount: 20,
            seed: (i) => ({
                summary: pick([
                    "User prefers terse responses", "Accounting invoices use Net 30",
                    "Company is Gutu framework workspace", "Booking confirmations go to ops@",
                ], i),
                type: pick(["user", "project", "feedback"], i),
                confidence: 70 + (i * 2) % 30,
                createdAt: daysAgo(i * 2),
            }),
        },
        {
            id: "agent",
            singular: "Agent",
            plural: "Agents",
            icon: "Bot",
            path: "/ai/assist/agents",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "description", kind: "text" },
                { name: "model", kind: "text" },
                { name: "systemPrompt", kind: "textarea", formSection: "System prompt" },
                { name: "tools", kind: "multi-enum", options: [
                        { value: "search", label: "Search" }, { value: "code", label: "Code exec" },
                        { value: "browser", label: "Browser" }, { value: "api", label: "API calls" },
                    ] },
                { name: "active", kind: "boolean" },
            ],
            seedCount: 8,
            seed: (i) => ({
                name: pick(["General", "Sales assistant", "Support triage", "Code review", "Data analyst", "HR helper", "Finance bot", "Security agent"], i),
                description: "",
                model: pick(["claude-opus-4-7", "claude-sonnet-4-6", "gpt-4o"], i),
                systemPrompt: "You are a helpful assistant specialized in…",
                tools: pick([["search"], ["search", "code"], ["api"], ["browser", "search"]], i),
                active: i !== 7,
            }),
        },
        {
            id: "tool",
            singular: "Tool",
            plural: "Tools",
            icon: "Wrench",
            path: "/ai/assist/tools",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "description", kind: "text" },
                { name: "kind", kind: "enum", options: [
                        { value: "builtin", label: "Built-in" },
                        { value: "custom", label: "Custom" },
                        { value: "mcp", label: "MCP" },
                    ] },
                { name: "usageCount", kind: "number", align: "right" },
                { name: "active", kind: "boolean" },
            ],
            seedCount: 12,
            seed: (i) => ({
                name: pick(["search", "code-exec", "browser", "read-file", "write-file", "api-call", "database-query", "slack-send", "email-send"], i),
                description: "",
                kind: pick(["builtin", "builtin", "custom", "mcp"], i),
                usageCount: 100 + (i * 137) % 3000,
                active: true,
            }),
        },
    ],
    extraNav: [
        { id: "ai-assist.control-room.nav", label: "AI Assist Control Room", icon: "LayoutDashboard", path: "/ai/assist/control-room", view: "ai-assist.control-room.view", order: 0 },
        { id: "ai-assist.reports.nav", label: "Reports", icon: "BarChart3", path: "/ai/assist/reports", view: "ai-assist.reports.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail],
    commands: [
        { id: "assist.go.control-room", label: "Assist: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/ai/assist/control-room"; } },
        { id: "assist.new-thread", label: "New thread", icon: "Plus", run: () => { window.location.hash = "/ai/assist/threads/new"; } },
        { id: "assist.new-agent", label: "New agent", icon: "Bot", run: () => { window.location.hash = "/ai/assist/agents/new"; } },
    ],
});
