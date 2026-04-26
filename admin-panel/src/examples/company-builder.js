import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { STATUS_LIFECYCLE } from "./_factory/options";
import { COMPANIES, daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
const controlRoomView = buildCompactControlRoom({
    viewId: "company-builder.control-room.view",
    resource: "company-builder.company",
    title: "Company Builder Control Room",
    description: "Tenant companies + branding.",
    kpis: [
        { label: "Published", resource: "company-builder.company",
            filter: { field: "status", op: "eq", value: "published" } },
        { label: "Drafts", resource: "company-builder.company",
            filter: { field: "status", op: "eq", value: "draft" } },
        { label: "Total", resource: "company-builder.company" },
    ],
    charts: [
        { label: "By industry", resource: "company-builder.company", chart: "donut", groupBy: "industry" },
        { label: "By status", resource: "company-builder.company", chart: "donut", groupBy: "status" },
    ],
    shortcuts: [
        { label: "New company", icon: "Plus", href: "/company-builder/companies/new" },
    ],
});
export const companyBuilderPlugin = buildDomainPlugin({
    id: "company-builder",
    label: "Company Builder",
    icon: "Building2",
    section: SECTIONS.portals,
    order: 4,
    resources: [
        {
            id: "company",
            singular: "Company",
            plural: "Companies",
            icon: "Building",
            path: "/company-builder/companies",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "domain", kind: "url" },
                { name: "industry", kind: "enum", options: [
                        { value: "saas", label: "SaaS" }, { value: "retail", label: "Retail" },
                        { value: "manufacturing", label: "Manufacturing" }, { value: "services", label: "Services" },
                        { value: "healthcare", label: "Healthcare" }, { value: "finance", label: "Finance" },
                    ] },
                { name: "logoUrl", kind: "url" },
                { name: "brandColor", kind: "text" },
                { name: "status", kind: "enum", options: STATUS_LIFECYCLE },
                { name: "createdAt", kind: "date", sortable: true },
            ],
            seedCount: 14,
            seed: (i) => ({
                name: pick(COMPANIES, i),
                domain: `https://${pick(COMPANIES, i).toLowerCase().replace(/\s+/g, "")}.com`,
                industry: pick(["saas", "retail", "manufacturing", "services", "healthcare"], i),
                logoUrl: "",
                brandColor: pick(["#0088cc", "#00c4a7", "#ff6b6b", "#9b59b6"], i),
                status: pick(["draft", "approved", "published"], i),
                createdAt: daysAgo(i * 4),
            }),
        },
    ],
    extraNav: [
        { id: "company-builder.control-room.nav", label: "Company Builder Control Room", icon: "LayoutDashboard", path: "/company-builder/control-room", view: "company-builder.control-room.view", order: 0 },
    ],
    extraViews: [controlRoomView],
    commands: [
        { id: "cb.go.control-room", label: "Company Builder: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/company-builder/control-room"; } },
    ],
});
