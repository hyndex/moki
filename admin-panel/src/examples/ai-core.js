import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { aiPlaygroundView } from "./ai-core-pages";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "ai-core.control-room.view",
    resource: "ai-core.model",
    title: "AI Core Control Room",
    description: "Models, prompts, tokens, cost.",
    kpis: [
        { label: "Active models", resource: "ai-core.model",
            filter: { field: "status", op: "eq", value: "active" } },
        { label: "Prompts", resource: "ai-core.prompt" },
        { label: "Tokens (30d)", resource: "ai-core.invocation",
            fn: "sum", field: "tokens", range: "last-30" },
        { label: "Cost (30d)", resource: "ai-core.invocation",
            fn: "sum", field: "cost", range: "last-30", format: "currency" },
    ],
    charts: [
        { label: "Models by provider", resource: "ai-core.model", chart: "donut", groupBy: "provider" },
        { label: "Invocations (30d)", resource: "ai-core.invocation", chart: "area", period: "day", lastDays: 30 },
    ],
    shortcuts: [
        { label: "Playground", icon: "MessageCircle", href: "/ai/playground" },
        { label: "New model", icon: "Cpu", href: "/ai/models/new" },
        { label: "New prompt", icon: "MessageSquare", href: "/ai/prompts/new" },
        { label: "Reports", icon: "BarChart3", href: "/ai/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const modelUsageReport = {
    id: "model-usage", label: "Model Usage",
    description: "Token volume + cost per model.",
    icon: "Activity", resource: "ai-core.invocation", filters: [],
    async execute({ resources }) {
        const invs = await fetchAll(resources, "ai-core.invocation");
        const by = new Map();
        for (const i of invs) {
            const m = str(i.model);
            const r = by.get(m) ?? { model: m, invocations: 0, tokens: 0, cost: 0 };
            r.invocations++;
            r.tokens += num(i.tokens);
            r.cost += num(i.cost);
            by.set(m, r);
        }
        const rows = [...by.values()].sort((a, b) => b.tokens - a.tokens);
        return {
            columns: [
                { field: "model", label: "Model", fieldtype: "text" },
                { field: "invocations", label: "Calls", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "tokens", label: "Tokens", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "cost", label: "Cost", fieldtype: "currency", align: "right", options: "USD", totaling: "sum" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "ai-core.reports.view",
    detailViewId: "ai-core.reports-detail.view",
    resource: "ai-core.model",
    title: "AI Core Reports",
    description: "Model usage, tokens, cost.",
    basePath: "/ai/reports",
    reports: [modelUsageReport],
});
export const aiCorePlugin = buildDomainPlugin({
    id: "ai-core",
    label: "AI Core",
    icon: "Sparkles",
    section: SECTIONS.ai,
    order: 1,
    resources: [
        {
            id: "model",
            singular: "Model",
            plural: "Models",
            icon: "Cpu",
            path: "/ai/models",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "provider", kind: "enum", required: true, sortable: true, options: [
                        { value: "anthropic", label: "Anthropic" }, { value: "openai", label: "OpenAI" },
                        { value: "google", label: "Google" }, { value: "local", label: "Local" },
                    ] },
                { name: "version", kind: "text" },
                { name: "contextWindow", label: "Context", kind: "number", align: "right", sortable: true },
                { name: "costPer1kTokens", label: "$/1k", kind: "currency", align: "right" },
                { name: "status", kind: "enum", required: true, options: STATUS_ACTIVE },
            ],
            seedCount: 12,
            seed: (i) => ({
                name: pick(["claude-opus-4-7", "claude-sonnet-4-6", "gpt-4o", "gemini-2.5-pro", "llama-3.1-70b"], i),
                provider: pick(["anthropic", "anthropic", "openai", "google", "local"], i),
                version: pick(["4.7", "4.6", "4o", "2.5", "3.1-70b"], i),
                contextWindow: pick([1_000_000, 200_000, 128_000, 2_000_000, 8192], i),
                costPer1kTokens: pick([15, 3, 2.5, 1.25, 0], i),
                status: pick(["active", "inactive"], i),
            }),
        },
        {
            id: "prompt",
            singular: "Prompt",
            plural: "Prompts",
            icon: "MessageSquare",
            path: "/ai/prompts",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "version", kind: "text", width: 90 },
                { name: "category", kind: "enum", options: [
                        { value: "extraction", label: "Extraction" },
                        { value: "classification", label: "Classification" },
                        { value: "generation", label: "Generation" },
                        { value: "summarization", label: "Summarization" },
                        { value: "translation", label: "Translation" },
                    ] },
                { name: "invocations", kind: "number", align: "right" },
                { name: "updatedAt", label: "Updated", kind: "datetime", sortable: true, width: 180 },
                { name: "body", kind: "textarea", formSection: "Body", required: true },
            ],
            seedCount: 14,
            seed: (i) => ({
                name: pick(["summarize-invoice", "classify-intent", "extract-contact", "rewrite-support", "translate-copy", "code-review", "sentiment"], i),
                version: `v${1 + (i % 5)}`,
                category: pick(["extraction", "classification", "generation", "summarization", "translation"], i),
                invocations: 100 + (i * 73) % 5000,
                updatedAt: daysAgo(i),
                body: "You are a helpful assistant…",
            }),
        },
        {
            id: "invocation",
            singular: "Invocation",
            plural: "Invocations",
            icon: "PlaySquare",
            path: "/ai/invocations",
            readOnly: true,
            defaultSort: { field: "calledAt", dir: "desc" },
            fields: [
                { name: "id", kind: "text" },
                { name: "model", kind: "text", sortable: true },
                { name: "prompt", kind: "text" },
                { name: "user", kind: "text" },
                { name: "tokens", kind: "number", align: "right", sortable: true },
                { name: "cost", kind: "currency", align: "right" },
                { name: "latencyMs", kind: "number", align: "right" },
                { name: "status", kind: "enum", options: [
                        { value: "success", label: "Success", intent: "success" },
                        { value: "error", label: "Error", intent: "danger" },
                        { value: "timeout", label: "Timeout", intent: "warning" },
                    ] },
                { name: "calledAt", kind: "datetime", sortable: true },
            ],
            seedCount: 60,
            seed: (i) => ({
                id: `inv_${i + 1}`,
                model: pick(["claude-opus-4-7", "claude-sonnet-4-6", "gpt-4o"], i),
                prompt: pick(["summarize-invoice", "classify-intent", "extract-contact"], i),
                user: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
                tokens: 500 + (i * 317) % 5000,
                cost: Math.round((500 + (i * 317) % 5000) / 1000 * 15 * 100) / 100,
                latencyMs: 500 + (i * 137) % 4000,
                status: pick(["success", "success", "success", "error", "timeout"], i),
                calledAt: daysAgo(i * 0.2),
            }),
        },
        {
            id: "policy",
            singular: "AI Policy",
            plural: "AI Policies",
            icon: "Shield",
            path: "/ai/policies",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "kind", kind: "enum", options: [
                        { value: "safety", label: "Safety" }, { value: "cost", label: "Cost" },
                        { value: "rate-limit", label: "Rate limit" }, { value: "data-residency", label: "Data residency" },
                    ] },
                { name: "description", kind: "text" },
                { name: "active", kind: "boolean" },
            ],
            seedCount: 6,
            seed: (i) => ({
                name: pick(["PII redaction", "Cost cap — $1k/day", "Rate limit — 100/min", "EU data residency", "Refusal list"], i),
                kind: pick(["safety", "cost", "rate-limit", "data-residency", "safety"], i),
                description: "",
                active: true,
            }),
        },
    ],
    extraNav: [
        { id: "ai-core.control-room.nav", label: "AI Control Room", icon: "LayoutDashboard", path: "/ai/control-room", view: "ai-core.control-room.view", order: 0 },
        { id: "ai-core.reports.nav", label: "Reports", icon: "BarChart3", path: "/ai/reports", view: "ai-core.reports.view" },
        { id: "ai.playground.nav", label: "Playground", icon: "MessageCircle", path: "/ai/playground", view: "ai-core.playground.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail, aiPlaygroundView],
    commands: [
        { id: "ai.go.control-room", label: "AI: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/ai/control-room"; } },
        { id: "ai.go.playground", label: "AI: Playground", icon: "MessageCircle", run: () => { window.location.hash = "/ai/playground"; } },
        { id: "ai.new-prompt", label: "New prompt", icon: "MessageSquare", run: () => { window.location.hash = "/ai/prompts/new"; } },
    ],
});
