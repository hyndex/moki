import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { pick, daysAgo } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "ai-skills.control-room.view",
    resource: "ai-skills.skill",
    title: "AI Skills Control Room",
    description: "Skills catalog, usage, invocations.",
    kpis: [
        { label: "Skills", resource: "ai-skills.skill",
            filter: { field: "status", op: "eq", value: "active" } },
        { label: "Invocations (30d)", resource: "ai-skills.invocation", range: "last-30" },
        { label: "Success rate", resource: "ai-skills.invocation", fn: "avg", field: "successNumeric" },
    ],
    charts: [
        { label: "Skills by trigger", resource: "ai-skills.skill", chart: "donut", groupBy: "trigger" },
        { label: "Invocations (30d)", resource: "ai-skills.invocation", chart: "area", period: "day", lastDays: 30 },
    ],
    shortcuts: [
        { label: "New skill", icon: "Plus", href: "/ai/skills/new" },
        { label: "Invocations", icon: "Activity", href: "/ai/skills/invocations" },
        { label: "Reports", icon: "BarChart3", href: "/ai/skills/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const num = (v) => (typeof v === "number" ? v : 0);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const skillUsageReport = {
    id: "skill-usage", label: "Skill Usage",
    description: "Invocation counts + success per skill.",
    icon: "Activity", resource: "ai-skills.invocation", filters: [],
    async execute({ resources }) {
        const invs = await fetchAll(resources, "ai-skills.invocation");
        const by = new Map();
        for (const i of invs) {
            const s = str(i.skill);
            const r = by.get(s) ?? { skill: s, total: 0, success: 0, rate: 0 };
            r.total++;
            if (i.success)
                r.success++;
            by.set(s, r);
        }
        const rows = [...by.values()]
            .map((r) => ({ ...r, rate: r.total > 0 ? Math.round((r.success / r.total) * 100) : 0 }))
            .sort((a, b) => b.total - a.total);
        return {
            columns: [
                { field: "skill", label: "Skill", fieldtype: "text" },
                { field: "total", label: "Total", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "success", label: "Success", fieldtype: "number", align: "right", totaling: "sum" },
                { field: "rate", label: "Rate %", fieldtype: "percent", align: "right" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "ai-skills.reports.view",
    detailViewId: "ai-skills.reports-detail.view",
    resource: "ai-skills.skill",
    title: "AI Skills Reports",
    description: "Skill usage.",
    basePath: "/ai/skills/reports",
    reports: [skillUsageReport],
});
export const aiSkillsPlugin = buildDomainPlugin({
    id: "ai-skills",
    label: "AI Skills",
    icon: "Puzzle",
    section: SECTIONS.ai,
    order: 4,
    resources: [
        {
            id: "skill",
            singular: "Skill",
            plural: "Skills",
            icon: "Zap",
            path: "/ai/skills",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "description", kind: "text" },
                { name: "trigger", kind: "enum", options: [
                        { value: "manual", label: "Manual" }, { value: "automatic", label: "Automatic" },
                        { value: "on-mention", label: "On mention" }, { value: "scheduled", label: "Scheduled" },
                    ] },
                { name: "kind", label: "Type", kind: "enum", options: [
                        { value: "document-generation", label: "Document generation" },
                        { value: "data-extraction", label: "Data extraction" },
                        { value: "analysis", label: "Analysis" },
                        { value: "automation", label: "Automation" },
                    ] },
                { name: "version", kind: "text", width: 90 },
                { name: "invocationCount", kind: "number", align: "right" },
                { name: "successRate", label: "Success %", kind: "number", align: "right" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE, sortable: true },
            ],
            seedCount: 20,
            seed: (i) => ({
                name: pick(["pptx", "docx", "xlsx", "pdf", "setup-cowork", "skill-creator", "design-critique", "code-review", "debug", "summarize"], i),
                description: "",
                trigger: pick(["manual", "automatic", "on-mention", "scheduled"], i),
                kind: pick(["document-generation", "data-extraction", "analysis", "automation"], i),
                version: `0.${i + 1}`,
                invocationCount: 100 + (i * 37) % 2000,
                successRate: 80 + (i * 2) % 18,
                status: pick(["active", "active", "inactive"], i),
            }),
        },
        {
            id: "invocation",
            singular: "Invocation",
            plural: "Invocations",
            icon: "Activity",
            path: "/ai/skills/invocations",
            readOnly: true,
            defaultSort: { field: "calledAt", dir: "desc" },
            fields: [
                { name: "id", kind: "text" },
                { name: "skill", kind: "text", sortable: true },
                { name: "user", kind: "text" },
                { name: "success", kind: "boolean" },
                { name: "successNumeric", kind: "number", align: "right" },
                { name: "latencyMs", kind: "number", align: "right" },
                { name: "calledAt", kind: "datetime", sortable: true },
            ],
            seedCount: 40,
            seed: (i) => {
                const success = i % 10 !== 7;
                return {
                    id: `sinv_${i + 1}`,
                    skill: pick(["pptx", "docx", "summarize", "code-review"], i),
                    user: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
                    success,
                    successNumeric: success ? 100 : 0,
                    latencyMs: 500 + (i * 113) % 3000,
                    calledAt: daysAgo(i * 0.3),
                };
            },
        },
    ],
    extraNav: [
        { id: "ai-skills.control-room.nav", label: "AI Skills Control Room", icon: "LayoutDashboard", path: "/ai/skills/control-room", view: "ai-skills.control-room.view", order: 0 },
        { id: "ai-skills.reports.nav", label: "Reports", icon: "BarChart3", path: "/ai/skills/reports", view: "ai-skills.reports.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail],
    commands: [
        { id: "skills.go.control-room", label: "Skills: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/ai/skills/control-room"; } },
        { id: "skills.new", label: "New skill", icon: "Plus", run: () => { window.location.hash = "/ai/skills/new"; } },
    ],
});
