import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { daysAgo, pick } from "./_factory/seeds";
export const dashboardPlugin = buildDomainPlugin({
    id: "dashboards",
    label: "Dashboards",
    icon: "LayoutDashboard",
    section: SECTIONS.platform,
    order: 2,
    resources: [
        {
            id: "board",
            singular: "Dashboard",
            plural: "Dashboards",
            icon: "LayoutDashboard",
            path: "/platform/dashboards",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "owner", kind: "text", sortable: true },
                { name: "widgets", kind: "number", align: "right" },
                { name: "updatedAt", kind: "datetime", sortable: true },
            ],
            seedCount: 8,
            seed: (i) => ({
                name: pick(["Exec overview", "Sales pipeline", "Ops health", "Support SLA", "Finance"], i),
                owner: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
                widgets: 4 + (i % 10),
                updatedAt: daysAgo(i),
            }),
        },
    ],
});
