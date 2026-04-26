import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_ACTIVE } from "./_factory/options";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
const controlRoomView = buildCompactControlRoom({
    viewId: "template.control-room.view",
    resource: "template.template",
    title: "Templates Control Room",
    description: "Reusable templates catalog.",
    kpis: [
        { label: "Active", resource: "template.template",
            filter: { field: "status", op: "eq", value: "active" } },
        { label: "Email", resource: "template.template",
            filter: { field: "kind", op: "eq", value: "email" } },
        { label: "Documents", resource: "template.template",
            filter: { field: "kind", op: "eq", value: "document" } },
        { label: "Pages", resource: "template.template",
            filter: { field: "kind", op: "eq", value: "page" } },
    ],
    charts: [
        { label: "Templates by kind", resource: "template.template", chart: "donut", groupBy: "kind" },
        { label: "By usage count", resource: "template.template", chart: "bar", groupBy: "name", fn: "sum", field: "usageCount" },
    ],
    shortcuts: [
        { label: "New template", icon: "Plus", href: "/templates/new" },
    ],
});
export const templatePlugin = buildDomainPlugin({
    id: "template",
    label: "Templates",
    icon: "Copy",
    section: SECTIONS.workspace,
    order: 7,
    resources: [
        {
            id: "template",
            singular: "Template",
            plural: "Templates",
            icon: "Copy",
            path: "/templates",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "kind", kind: "enum", options: [
                        { value: "email", label: "Email" }, { value: "document", label: "Document" },
                        { value: "page", label: "Page" }, { value: "sms", label: "SMS" },
                        { value: "slack", label: "Slack" },
                    ] },
                { name: "variables", kind: "text" },
                { name: "usageCount", kind: "number", align: "right", sortable: true },
                { name: "status", kind: "enum", options: STATUS_ACTIVE },
                { name: "updatedAt", kind: "datetime", sortable: true },
                { name: "body", kind: "textarea", formSection: "Body" },
            ],
            seedCount: 16,
            seed: (i) => ({
                name: pick(["Welcome email", "Invoice document", "Landing page", "NDA template", "Offer letter", "Birthday wish", "Onboarding checklist"], i),
                kind: pick(["email", "document", "page", "sms", "slack"], i),
                variables: "{{name}}, {{link}}",
                usageCount: 50 + (i * 37) % 500,
                status: pick(["active", "active", "inactive"], i),
                updatedAt: daysAgo(i),
                body: "Template body with {{name}} placeholder…",
            }),
        },
    ],
    extraNav: [
        { id: "template.control-room.nav", label: "Template Control Room", icon: "LayoutDashboard", path: "/templates/control-room", view: "template.control-room.view", order: 0 },
    ],
    extraViews: [controlRoomView],
    commands: [
        { id: "templates.go.control-room", label: "Templates: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/templates/control-room"; } },
        { id: "templates.new", label: "New template", icon: "Plus", run: () => { window.location.hash = "/templates/new"; } },
    ],
});
