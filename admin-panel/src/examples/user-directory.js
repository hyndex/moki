import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { CITIES, personEmail, personName, pick, daysAgo } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
import { buildReportLibrary } from "./_factory/reportLibraryHelper";
const controlRoomView = buildCompactControlRoom({
    viewId: "user-directory.control-room.view",
    resource: "user-directory.person",
    title: "Directory Control Room",
    description: "Organization chart, teams, hiring pulse.",
    kpis: [
        { label: "People", resource: "user-directory.person" },
        { label: "Departments", resource: "user-directory.department" },
        { label: "Teams", resource: "user-directory.team" },
        { label: "Open offices", resource: "user-directory.office",
            filter: { field: "status", op: "eq", value: "active" } },
    ],
    charts: [
        { label: "People by department", resource: "user-directory.person", chart: "donut", groupBy: "department" },
        { label: "People by city", resource: "user-directory.person", chart: "bar", groupBy: "city" },
    ],
    shortcuts: [
        { label: "New person", icon: "UserPlus", href: "/directory/new" },
        { label: "Departments", icon: "Building2", href: "/directory/departments" },
        { label: "Teams", icon: "Users", href: "/directory/teams" },
        { label: "Reports", icon: "BarChart3", href: "/directory/reports" },
    ],
});
async function fetchAll(r, resource) {
    return (await r.list(resource, { page: 1, pageSize: 10_000 })).rows;
}
const str = (v, d = "") => (typeof v === "string" ? v : d);
const byDeptReport = {
    id: "people-by-dept", label: "People by Department",
    description: "Department headcount.",
    icon: "Building2", resource: "user-directory.person", filters: [],
    async execute({ resources }) {
        const people = await fetchAll(resources, "user-directory.person");
        const by = new Map();
        for (const p of people) {
            const d = str(p.department);
            const r = by.get(d) ?? { department: d, count: 0 };
            r.count++;
            by.set(d, r);
        }
        const rows = [...by.values()].sort((a, b) => b.count - a.count);
        return {
            columns: [
                { field: "department", label: "Department", fieldtype: "text" },
                { field: "count", label: "Count", fieldtype: "number", align: "right", totaling: "sum" },
            ],
            rows,
        };
    },
};
const { indexView: reportsIndex, detailView: reportsDetail } = buildReportLibrary({
    indexViewId: "user-directory.reports.view",
    detailViewId: "user-directory.reports-detail.view",
    resource: "user-directory.person",
    title: "Directory Reports",
    description: "Headcount + department mix.",
    basePath: "/directory/reports",
    reports: [byDeptReport],
});
export const userDirectoryPlugin = buildDomainPlugin({
    id: "user-directory",
    label: "User Directory",
    icon: "Contact",
    section: SECTIONS.people,
    order: 4,
    resources: [
        {
            id: "person",
            singular: "Person",
            plural: "Directory",
            icon: "Contact",
            path: "/directory",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "email", kind: "email", required: true },
                { name: "phone", kind: "phone" },
                { name: "title", kind: "text" },
                { name: "department", kind: "text", sortable: true },
                { name: "manager", kind: "text" },
                { name: "city", kind: "enum", options: CITIES.map((c) => ({ value: c, label: c })), sortable: true },
                { name: "office", kind: "text" },
                { name: "timezone", kind: "text" },
                { name: "status", kind: "enum", options: [
                        { value: "active", label: "Active", intent: "success" },
                        { value: "on-leave", label: "On leave", intent: "info" },
                        { value: "inactive", label: "Inactive", intent: "neutral" },
                    ] },
                { name: "joinedAt", kind: "date", sortable: true },
            ],
            seedCount: 40,
            seed: (i) => ({
                name: personName(i),
                email: personEmail(i, "gutu.dev"),
                phone: `+1-555-${String(1000 + i).slice(-4)}`,
                title: pick(["Engineer", "Senior Engineer", "Designer", "Manager", "Ops Lead", "Director", "VP"], i),
                department: pick(["Engineering", "Operations", "Sales", "Marketing", "Support", "Finance", "HR"], i),
                manager: i > 5 ? personName(i - 5) : "",
                city: pick(CITIES, i),
                office: pick(["HQ", "NYC", "London", "Remote"], i),
                timezone: pick(["America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Tokyo"], i),
                status: pick(["active", "active", "active", "on-leave"], i),
                joinedAt: daysAgo(i * 20),
            }),
        },
        {
            id: "department",
            singular: "Department",
            plural: "Departments",
            icon: "Building2",
            path: "/directory/departments",
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "head", kind: "text" },
                { name: "parent", kind: "text" },
                { name: "headcount", kind: "number", align: "right" },
            ],
            seedCount: 7,
            seed: (i) => ({
                code: pick(["ENG", "OPS", "SAL", "MKT", "SUP", "FIN", "HR"], i),
                name: pick(["Engineering", "Operations", "Sales", "Marketing", "Support", "Finance", "HR"], i),
                head: personName(i),
                parent: "",
                headcount: 5 + (i * 4),
            }),
        },
        {
            id: "team",
            singular: "Team",
            plural: "Teams",
            icon: "Users",
            path: "/directory/teams",
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "department", kind: "text" },
                { name: "lead", kind: "text" },
                { name: "members", kind: "number", align: "right" },
            ],
            seedCount: 10,
            seed: (i) => ({
                code: `TEAM-${String(100 + i).slice(-3)}`,
                name: pick(["Platform", "Growth", "Infra", "Data", "Mobile", "Web", "Backend", "Frontend", "SRE", "Security"], i),
                department: pick(["Engineering", "Operations", "Sales"], i),
                lead: personName(i),
                members: 3 + (i % 8),
            }),
        },
        {
            id: "office",
            singular: "Office",
            plural: "Offices",
            icon: "MapPin",
            path: "/directory/offices",
            fields: [
                { name: "code", kind: "text", required: true, sortable: true },
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "city", kind: "enum", options: CITIES.map((c) => ({ value: c, label: c })) },
                { name: "country", kind: "text" },
                { name: "capacity", kind: "number", align: "right" },
                { name: "occupancy", kind: "number", align: "right" },
                { name: "status", kind: "enum", options: [
                        { value: "active", label: "Active", intent: "success" },
                        { value: "closed", label: "Closed", intent: "neutral" },
                    ] },
            ],
            seedCount: 5,
            seed: (i) => ({
                code: pick(["HQ", "NYC", "LDN", "BER", "TYO"], i),
                name: pick(["HQ San Francisco", "New York", "London", "Berlin", "Tokyo"], i),
                city: pick(["San Francisco", "New York", "London", "Berlin", "Tokyo"], i),
                country: pick(["USA", "USA", "UK", "Germany", "Japan"], i),
                capacity: 50 + i * 30,
                occupancy: 40 + i * 25,
                status: "active",
            }),
        },
    ],
    extraNav: [
        { id: "user-directory.control-room.nav", label: "User Directory Control Room", icon: "LayoutDashboard", path: "/directory/control-room", view: "user-directory.control-room.view", order: 0 },
        { id: "user-directory.reports.nav", label: "Reports", icon: "BarChart3", path: "/directory/reports", view: "user-directory.reports.view" },
    ],
    extraViews: [controlRoomView, reportsIndex, reportsDetail],
    commands: [
        { id: "dir.go.control-room", label: "Directory: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/directory/control-room"; } },
        { id: "dir.new-person", label: "New person", icon: "UserPlus", run: () => { window.location.hash = "/directory/new"; } },
    ],
});
