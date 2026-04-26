import { jsx as _jsx } from "react/jsx-runtime";
import { EditorList } from "./EditorList";
export function SpreadsheetWorkspace() {
    return _jsx(EditorList, { kind: "spreadsheet", title: "Spreadsheets", newButtonLabel: "New spreadsheet" });
}
export function DocumentWorkspace() {
    return _jsx(EditorList, { kind: "document", title: "Documents", newButtonLabel: "New document" });
}
export function SlidesWorkspace() {
    return _jsx(EditorList, { kind: "slides", title: "Slides", newButtonLabel: "New deck" });
}
export function PagesWorkspace() {
    return _jsx(EditorList, { kind: "page", title: "Pages", newButtonLabel: "New page" });
}
export function WhiteboardWorkspace() {
    return _jsx(EditorList, { kind: "whiteboard", title: "Whiteboards", newButtonLabel: "New whiteboard" });
}
