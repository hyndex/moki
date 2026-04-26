import { buildDomainPlugin } from "./_factory/buildDomainPlugin";
import { SECTIONS } from "./_factory/sections";
import { daysAgo, pick } from "./_factory/seeds";
import { buildCompactControlRoom } from "./_factory/compactDashboard";
const controlRoomView = buildCompactControlRoom({
    viewId: "document.control-room.view",
    resource: "document.doc",
    title: "Documents Control Room",
    description: "Documents, folders, shares.",
    kpis: [
        { label: "Documents", resource: "document.doc" },
        { label: "Folders", resource: "document.folder" },
        { label: "Updated (7d)", resource: "document.doc", range: "last-7" },
    ],
    charts: [
        { label: "Docs by type", resource: "document.doc", chart: "donut", groupBy: "type" },
        { label: "Docs by owner", resource: "document.doc", chart: "bar", groupBy: "owner" },
    ],
    shortcuts: [
        { label: "New document", icon: "Plus", href: "/documents/new" },
        { label: "Folders", icon: "Folder", href: "/documents/folders" },
    ],
});
export const documentPlugin = buildDomainPlugin({
    id: "document",
    label: "Documents",
    icon: "FileText",
    section: SECTIONS.workspace,
    order: 2,
    resources: [
        {
            id: "doc",
            singular: "Document",
            plural: "Documents",
            icon: "FileText",
            path: "/documents",
            displayField: "title",
            defaultSort: { field: "updatedAt", dir: "desc" },
            fields: [
                { name: "title", kind: "text", required: true, sortable: true },
                { name: "type", kind: "enum", options: [
                        { value: "md", label: "Markdown" }, { value: "rich", label: "Rich text" },
                        { value: "docx", label: "Word" }, { value: "pdf", label: "PDF" },
                        { value: "pptx", label: "PowerPoint" },
                    ] },
                { name: "folder", kind: "text" },
                { name: "owner", kind: "text", sortable: true },
                { name: "collaborators", kind: "number", align: "right" },
                { name: "sizeBytes", kind: "number", align: "right" },
                { name: "shared", kind: "boolean" },
                { name: "updatedAt", kind: "datetime", sortable: true },
            ],
            seedCount: 30,
            seed: (i) => ({
                title: pick(["Onboarding handbook", "2026 plan", "Q1 review", "Policy v3", "Release notes", "Product spec"], i),
                type: pick(["md", "rich", "docx", "pdf", "pptx"], i),
                folder: pick(["/HR", "/Product", "/Engineering", "/Sales"], i),
                owner: pick(["sam@gutu.dev", "alex@gutu.dev", "taylor@gutu.dev"], i),
                collaborators: 1 + (i % 5),
                sizeBytes: 1024 * (5 + (i * 37) % 5000),
                shared: i % 3 === 0,
                updatedAt: daysAgo(i),
            }),
        },
        {
            id: "folder",
            singular: "Folder",
            plural: "Folders",
            icon: "Folder",
            path: "/documents/folders",
            fields: [
                { name: "name", kind: "text", required: true, sortable: true },
                { name: "parent", kind: "text" },
                { name: "documents", kind: "number", align: "right" },
            ],
            seedCount: 8,
            seed: (i) => ({
                name: pick(["HR", "Product", "Engineering", "Sales", "Finance", "Legal", "Marketing", "Ops"], i),
                parent: "",
                documents: 3 + i * 2,
            }),
        },
    ],
    extraNav: [
        { id: "document.control-room.nav", label: "Document Control Room", icon: "LayoutDashboard", path: "/documents/control-room", view: "document.control-room.view", order: 0 },
    ],
    extraViews: [controlRoomView],
    commands: [
        { id: "docs.go.control-room", label: "Documents: Control Room", icon: "LayoutDashboard", run: () => { window.location.hash = "/documents/control-room"; } },
        { id: "docs.new", label: "New document", icon: "Plus", run: () => { window.location.hash = "/documents/new"; } },
    ],
});
