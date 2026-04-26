import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
const controlRoomView = buildCompactControlRoom({
    viewId: "execution-workspaces.control-room.view",
    resource: "execution-workspaces.workspace",
    title: "Execution Workspaces Control Room",
    description: "Active workspaces + tasks.",
    kpis: [
        { label: "Total workspaces", resource: "execution-workspaces.workspace" },
        { label: "Active (7d)", resource: "execution-workspaces.workspace", range: "last-7" },
    ],
    charts: [
        { label: "Workspaces by kind", resource: "execution-workspaces.workspace", chart: "donut", groupBy: "kind" },
        { label: "By owner", resource: "execution-workspaces.workspace", chart: "bar", groupBy: "owner" },
    ],
    shortcuts: [
        { label: "New workspace", icon: "Plus", href: "/platform/exec-workspaces/new" },
    ],
});
export const executionWorkspacesPlugin = buildDomainPlugin({
    id: "execution-workspaces",
    label: "Execution Workspaces",
    icon: "Briefcase",
    section: SECTIONS.platform,
    order: 6,
    resources: [
        {
            id: "workspace",
            singular: "Workspace",
            plural: "Workspaces",
            icon: "Briefcase",
            path: "/platform/exec-workspaces",
            defaultSort: { field: "lastActive", dir: "desc" },
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "owner", kind: "text", sortable: true },
                { name: "kind", kind: "enum", options: [
                        { value: "claude", label: "Claude Code" },
                        { value: "cli", label: "CLI" },
                        { value: "notebook", label: "Notebook" },
                    ] },
                { name: "branch", kind: "text" },
                { name: "tasksCount", kind: "number", align: "right" },
                { name: "lastActive", kind: "datetime", sortable: true },
            ],
            seedCount: 16,
            seed: (i) => ({
                name: pick(["quizzical-lamport", "witty-hopper", "noble-turing", "eager-ada", "happy-ritchie", "awesome-curie"], i),
                owner: pick(["sam@gutu.dev", "alex@gutu.dev"], i),
                kind: pick(["claude", "cli", "notebook"], i),
                branch: `feat/ws-${i}`,
                tasksCount: 1 + (i % 8),
                lastActive: daysAgo(i * 0.5),
            }),
        },
    ],
    extraNav: [
        { id: "execution-workspaces.control-room.nav", label: "Execution Control Room", icon: "LayoutDashboard", path: "/platform/exec-workspaces/control-room", view: "execution-workspaces.control-room.view", order: 0 },
    ],
    extraViews: [controlRoomView],
    commands: [
        { id: "ew.go.control-room", label: "Workspaces: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/platform/exec-workspaces/control-room"; } },
    ],
});
