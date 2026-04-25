/** `office` plugin — surfaces the 5 editor workspaces (Spreadsheet,
 *  Document, Slides, Page, Whiteboard) into the admin shell.
 *
 *  Each workspace is a CustomView that renders the matching
 *  `<EditorList>` from `src/editor-host/`. Clicking a row opens
 *  `<EditorHost>` which lazy-loads the appropriate runtime adapter
 *  (Univer or BlockSuite) and binds a Y.Doc seeded from the backend's
 *  persisted Yjs snapshot. Auto-save flows back through `/api/editors/...`
 *  → `gutu-lib-storage`. */

import React from "react";
import { definePlugin } from "@/contracts/plugin-v2";
import {
  SpreadsheetWorkspace,
  DocumentWorkspace,
  SlidesWorkspace,
  PagesWorkspace,
  WhiteboardWorkspace,
} from "@/editor-host";

const officeNavSection = {
  id: "office",
  label: "Office",
  icon: "Briefcase" as const,
  order: 5,
};

const SPREADSHEET_VIEW = {
  id: "office.spreadsheets.view",
  resource: "spreadsheet.workbook" as const,
  type: "custom" as const,
  render: () => <SpreadsheetWorkspace />,
};
const DOCUMENT_VIEW = {
  id: "office.documents.view",
  resource: "document.page" as const,
  type: "custom" as const,
  render: () => <DocumentWorkspace />,
};
const SLIDES_VIEW = {
  id: "office.slides.view",
  resource: "slides.deck" as const,
  type: "custom" as const,
  render: () => <SlidesWorkspace />,
};
const PAGES_VIEW = {
  id: "office.pages.view",
  resource: "collab.page" as const,
  type: "custom" as const,
  render: () => <PagesWorkspace />,
};
const WHITEBOARD_VIEW = {
  id: "office.whiteboards.view",
  resource: "whiteboard.canvas" as const,
  type: "custom" as const,
  render: () => <WhiteboardWorkspace />,
};

const navItems = [
  { id: "office.spreadsheets.nav", label: "Spreadsheets", icon: "Table" as const, path: "/spreadsheets", view: SPREADSHEET_VIEW.id, section: "office", order: 0 },
  { id: "office.documents.nav", label: "Documents", icon: "FileText" as const, path: "/documents", view: DOCUMENT_VIEW.id, section: "office", order: 1 },
  { id: "office.slides.nav", label: "Slides", icon: "Presentation" as const, path: "/slides", view: SLIDES_VIEW.id, section: "office", order: 2 },
  { id: "office.pages.nav", label: "Pages", icon: "BookOpen" as const, path: "/pages", view: PAGES_VIEW.id, section: "office", order: 3 },
  { id: "office.whiteboards.nav", label: "Whiteboards", icon: "PenTool" as const, path: "/whiteboards", view: WHITEBOARD_VIEW.id, section: "office", order: 4 },
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
    description:
      "Spreadsheet, Document, Slides, collaborative Pages and Whiteboards — Univer + BlockSuite engines, end-to-end inside the Gutu shell.",
    icon: "Briefcase",
    requires: { shell: "^2.0.0", capabilities: ["nav", "commands"] },
    origin: { kind: "filesystem", location: "src/examples/office" },
  },

  async activate(ctx) {
    ctx.contribute.navSections([officeNavSection]);
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
