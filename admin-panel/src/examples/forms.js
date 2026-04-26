import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
const controlRoomView = buildCompactControlRoom({
    viewId: "forms.control-room.view",
    resource: "forms.form",
    title: "Forms Control Room",
    description: "Forms, submissions, conversion.",
    kpis: [
        { label: "Active forms", resource: "forms.form",
            filter: { field: "status", op: "eq", value: "active" } },
        { label: "Submissions (30d)", resource: "forms.submission", range: "last-30" },
        { label: "Avg conversion %", resource: "forms.form", fn: "avg", field: "conversionPct" },
    ],
    charts: [
        { label: "Submissions by form", resource: "forms.submission", chart: "bar", groupBy: "formName" },
        { label: "Submissions (30d)", resource: "forms.submission", chart: "area", period: "day", lastDays: 30 },
    ],
    shortcuts: [
        { label: "New form", icon: "Plus", href: "/forms/new" },
        { label: "Submissions", icon: "Inbox", href: "/forms/submissions" },
    ],
});
export const formsPlugin = buildDomainPlugin({
    id: "forms",
    label: "Forms",
    icon: "ClipboardList",
    section: SECTIONS.workspace,
    order: 5,
    resources: [
        {
            id: "form",
            singular: "Form",
            plural: "Forms",
            icon: "ClipboardList",
            path: "/forms",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "slug", kind: "text" },
                { name: "fieldsCount", kind: "number", align: "right" },
                { name: "submissions", kind: "number", align: "right", sortable: true },
                { name: "views", kind: "number", align: "right" },
                { name: "conversionPct", label: "Conv %", kind: "number", align: "right" },
                { name: "status", kind: "enum", options: STATUS_ACTIVE },
                { name: "updatedAt", kind: "datetime", sortable: true },
            ],
            seedCount: 14,
            seed: (i) => {
                const submissions = (i * 37) % 500;
                const views = submissions * 5 + 100;
                return {
                    name: pick(["Contact us", "Support request", "NPS survey", "Demo request", "Waitlist"], i),
                    slug: pick(["contact", "support", "nps", "demo", "waitlist"], i),
                    fieldsCount: 3 + (i % 8),
                    submissions,
                    views,
                    conversionPct: views > 0 ? Math.round((submissions / views) * 100) : 0,
                    status: pick(["active", "active", "inactive"], i),
                    updatedAt: daysAgo(i),
                };
            },
        },
        {
            id: "submission",
            singular: "Submission",
            plural: "Submissions",
            icon: "Inbox",
            path: "/forms/submissions",
            readOnly: true,
            defaultSort: { field: "submittedAt", dir: "desc" },
            fields: [
                { name: "formName", kind: "text", sortable: true },
                { name: "email", kind: "email" },
                { name: "status", kind: "enum", options: [
                        { value: "new", label: "New", intent: "info" },
                        { value: "contacted", label: "Contacted", intent: "success" },
                        { value: "archived", label: "Archived", intent: "neutral" },
                    ] },
                { name: "submittedAt", kind: "datetime", sortable: true },
            ],
            seedCount: 30,
            seed: (i) => ({
                formName: pick(["Contact us", "Support request", "Demo request"], i),
                email: `contact+${i}@example.com`,
                status: pick(["new", "contacted", "archived"], i),
                submittedAt: daysAgo(i * 0.5),
            }),
        },
    ],
    extraNav: [
        { id: "forms.control-room.nav", label: "Forms Control Room", icon: "LayoutDashboard", path: "/forms/control-room", view: "forms.control-room.view", order: 0 },
    ],
    extraViews: [controlRoomView],
    commands: [
        { id: "forms.go.control-room", label: "Forms: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/forms/control-room"; } },
        { id: "forms.new", label: "New form", icon: "Plus", run: () => { window.location.hash = "/forms/new"; } },
    ],
});
