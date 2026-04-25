export { EditorHost } from "./EditorHost";
export { EditorList } from "./EditorList";
export type { EditorKind, EditorRecord, EditorPresence } from "./types";
export {
  listEditorRecords,
  createEditorRecord,
  deleteEditorRecord,
  fetchEditorRecord,
  fetchSnapshot,
  postSnapshot,
} from "./api";

// Per-kind page components — reuse `EditorList` with sane labels.
import React from "react";
import { EditorList } from "./EditorList";

export function SpreadsheetWorkspace(): React.JSX.Element {
  return <EditorList kind="spreadsheet" title="Spreadsheets" newButtonLabel="New spreadsheet" />;
}
export function DocumentWorkspace(): React.JSX.Element {
  return <EditorList kind="document" title="Documents" newButtonLabel="New document" />;
}
export function SlidesWorkspace(): React.JSX.Element {
  return <EditorList kind="slides" title="Slides" newButtonLabel="New deck" />;
}
export function PagesWorkspace(): React.JSX.Element {
  return <EditorList kind="page" title="Pages" newButtonLabel="New page" />;
}
export function WhiteboardWorkspace(): React.JSX.Element {
  return <EditorList kind="whiteboard" title="Whiteboards" newButtonLabel="New whiteboard" />;
}
