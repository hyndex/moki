import { jsx as _jsx } from "react/jsx-runtime";
import { definePlugin } from "@/contracts/plugin-v2";
import { SECTIONS } from "@/examples/_factory/sections";
import { SpreadsheetWorkspace, DocumentWorkspace, SlidesWorkspace, PagesWorkspace, WhiteboardWorkspace, } from "@/editor-host";
const SPREADSHEET_VIEW = {
    id: "office.spreadsheets.view",
    title: "Spreadsheets",
    resource: "spreadsheet.workbook",
    type: "custom",
    render: () => _jsx(SpreadsheetWorkspace, {}),
};
const DOCUMENT_VIEW = {
    id: "office.documents.view",
    title: "Documents",
    resource: "document.page",
    type: "custom",
    render: () => _jsx(DocumentWorkspace, {}),
};
const SLIDES_VIEW = {
    id: "office.slides.view",
    title: "Slides",
    resource: "slides.deck",
    type: "custom",
    render: () => _jsx(SlidesWorkspace, {}),
};
const PAGES_VIEW = {
    id: "office.pages.view",
    title: "Pages",
    resource: "collab.page",
    type: "custom",
    render: () => _jsx(PagesWorkspace, {}),
};
const WHITEBOARD_VIEW = {
    id: "office.whiteboards.view",
    title: "Whiteboards",
    resource: "whiteboard.canvas",
    type: "custom",
    render: () => _jsx(WhiteboardWorkspace, {}),
};
const SECTION_ID = SECTIONS.workspace.id;
const navItems = [
    { id: "office.spreadsheets.nav", label: "Spreadsheets", icon: "Table", path: "/spreadsheets", view: SPREADSHEET_VIEW.id, section: SECTION_ID, order: 100 },
    { id: "office.documents.nav", label: "Documents", icon: "FileText", path: "/documents", view: DOCUMENT_VIEW.id, section: SECTION_ID, order: 101 },
    { id: "office.slides.nav", label: "Slides", icon: "Presentation", path: "/slides", view: SLIDES_VIEW.id, section: SECTION_ID, order: 102 },
    { id: "office.pages.nav", label: "Pages", icon: "BookOpen", path: "/pages", view: PAGES_VIEW.id, section: SECTION_ID, order: 103 },
    { id: "office.whiteboards.nav", label: "Whiteboards", icon: "PenTool", path: "/whiteboards", view: WHITEBOARD_VIEW.id, section: SECTION_ID, order: 104 },
];
const commands = [
    { id: "office.spreadsheets.go", label: "Open Spreadsheets", icon: "Table", run: () => { window.location.hash = "/spreadsheets"; } },
    { id: "office.documents.go", label: "Open Documents", icon: "FileText", run: () => { window.location.hash = "/documents"; } },
    { id: "office.slides.go", label: "Open Slides", icon: "Presentation", run: () => { window.location.hash = "/slides"; } },
    { id: "office.pages.go", label: "Open Pages", icon: "BookOpen", run: () => { window.location.hash = "/pages"; } },
    { id: "office.whiteboards.go", label: "Open Whiteboards", icon: "PenTool", run: () => { window.location.hash = "/whiteboards"; } },
];
export const officePlugin = definePlugin({
    manifest: {
        id: "com.gutu.office",
        version: "0.1.0",
        label: "Office",
        description: "Spreadsheet, Document, Slides, collaborative Pages and Whiteboards — Univer + BlockSuite engines, end-to-end inside the Gutu shell.",
        icon: "Briefcase",
        requires: { shell: "^2.0.0", capabilities: ["nav", "commands"] },
        origin: { kind: "filesystem", location: "src/examples/office" },
    },
    async activate(ctx) {
        ctx.contribute.nav(navItems);
        ctx.contribute.views([
            SPREADSHEET_VIEW,
            DOCUMENT_VIEW,
            SLIDES_VIEW,
            PAGES_VIEW,
            WHITEBOARD_VIEW,
        ]);
        ctx.contribute.commands(commands);
    },
});
