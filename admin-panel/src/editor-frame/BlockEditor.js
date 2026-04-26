import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Production-grade block editor — TipTap on ProseMirror with Yjs
 *  collab, syntax-highlighted code, tables, task lists, slash menu, and
 *  bubble-menu inline formatting. Replaces the previous AFFiNE/BlockSuite
 *  integration which required a complex iframe-only mount + extensive
 *  CJS/dev-mode shimming.
 *
 *  Why TipTap:
 *    - React-native (no Lit web components or shadow DOM)
 *    - Battle-tested ProseMirror schema underneath
 *    - Yjs binding via `y-prosemirror` is upstream-supported
 *    - StrictMode-safe (React 18 + 19)
 *    - Same data shape as our existing Y.Doc snapshot persistence
 *
 *  Persistence model:
 *    - Editor state lives in `Y.XmlFragment`(s) keyed on `page-tree` /
 *      `whiteboard-tree` inside the shared `Y.Doc` we own.
 *    - The host (`FrameEditor.tsx`) writes the Y.Doc state as a binary
 *      update to the REST snapshot endpoint. Reload re-applies the
 *      update — full round-trip including history undo/redo.
 *    - `exportSnapshot()` returns HTML for indexing / preview / export.
 *
 *  Yjs UndoManager owns history (NOT TipTap's StarterKit history). They
 *  conflict — TipTap's local-only history reverts collab updates;
 *  y-prosemirror's UndoManager only undoes user's own edits. */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { common, createLowlight } from "lowlight";
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Link as LinkIcon, Highlighter, AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Quote, Code2, Minus, Undo, Redo, Pilcrow, } from "lucide-react";
import { createSlashSuggestion } from "./slash-suggestion";
import styles from "./BlockEditor.module.css";
// `lowlight` is the bridge between ProseMirror's code-block schema and
// highlight.js. `common` registers the most-used languages out of the
// box (js/ts/python/json/css/html/etc.) — keeps bundle tight.
const lowlight = createLowlight(common);
const ToolbarButton = ({ onClick, active, disabled, title, children, }) => (_jsx("button", { type: "button", className: styles.toolbarButton, onMouseDown: (e) => e.preventDefault(), onClick: onClick, "data-active": active || undefined, disabled: disabled, title: title, "aria-label": title, children: children }));
const ICON = 16;
/* ------------------------------------------------------------------ */
/*  Bubble menu (formatting popup over a selection)                    */
/* ------------------------------------------------------------------ */
const FormatBubble = ({ editor }) => {
    if (!editor)
        return null;
    const setLink = () => {
        const prev = editor.getAttributes("link").href;
        const url = window.prompt("URL", prev ?? "https://");
        if (url === null)
            return;
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    };
    return (_jsxs(BubbleMenu, { editor: editor, tippyOptions: { duration: 100, placement: "top" }, shouldShow: ({ editor: ed, view, state, from, to }) => {
            if (!view.hasFocus())
                return false;
            if (from === to)
                return false;
            // Don't show inside code blocks (Cmd+B etc. don't apply there).
            if (ed.isActive("codeBlock"))
                return false;
            return state.doc.textBetween(from, to).trim().length > 0;
        }, className: styles.bubbleMenu, children: [_jsx("button", { type: "button", className: styles.bubbleMenuButton, "data-active": editor.isActive("bold") || undefined, onMouseDown: (e) => e.preventDefault(), onClick: () => editor.chain().focus().toggleBold().run(), title: "Bold \u2318B", children: _jsx(Bold, { size: ICON }) }), _jsx("button", { type: "button", className: styles.bubbleMenuButton, "data-active": editor.isActive("italic") || undefined, onMouseDown: (e) => e.preventDefault(), onClick: () => editor.chain().focus().toggleItalic().run(), title: "Italic \u2318I", children: _jsx(Italic, { size: ICON }) }), _jsx("button", { type: "button", className: styles.bubbleMenuButton, "data-active": editor.isActive("underline") || undefined, onMouseDown: (e) => e.preventDefault(), onClick: () => editor.chain().focus().toggleUnderline().run(), title: "Underline \u2318U", children: _jsx(UnderlineIcon, { size: ICON }) }), _jsx("button", { type: "button", className: styles.bubbleMenuButton, "data-active": editor.isActive("strike") || undefined, onMouseDown: (e) => e.preventDefault(), onClick: () => editor.chain().focus().toggleStrike().run(), title: "Strikethrough", children: _jsx(Strikethrough, { size: ICON }) }), _jsx("span", { className: styles.bubbleMenuDivider }), _jsx("button", { type: "button", className: styles.bubbleMenuButton, "data-active": editor.isActive("code") || undefined, onMouseDown: (e) => e.preventDefault(), onClick: () => editor.chain().focus().toggleCode().run(), title: "Inline code \u2318E", children: _jsx(Code, { size: ICON }) }), _jsx("button", { type: "button", className: styles.bubbleMenuButton, "data-active": editor.isActive("highlight") || undefined, onMouseDown: (e) => e.preventDefault(), onClick: () => editor.chain().focus().toggleHighlight().run(), title: "Highlight", children: _jsx(Highlighter, { size: ICON }) }), _jsx("button", { type: "button", className: styles.bubbleMenuButton, "data-active": editor.isActive("link") || undefined, onMouseDown: (e) => e.preventDefault(), onClick: setLink, title: "Link \u2318K", children: _jsx(LinkIcon, { size: ICON }) })] }));
};
/* ------------------------------------------------------------------ */
/*  BlockEditor (main component)                                       */
/* ------------------------------------------------------------------ */
export const BlockEditor = forwardRef(({ doc, fragment = "page-tree", status, errorMsg, placeholder, readOnly, provider }, ref) => {
    /* eslint-disable react-hooks/exhaustive-deps */
    // The editor is intentionally created once per doc/fragment combo.
    // Recreating it would lose cursor + collab state. The `extensions`
    // array is a constant — referencing `doc`/`fragment` outside the
    // factory is safe because TipTap already snapshots them on mount.
    // Build Yjs xml fragment lazily so we never depend on it across
    // recreations. y-prosemirror will share state through it.
    const xmlFragment = useMemo(() => doc.getXmlFragment(fragment), [doc, fragment]);
    const editor = useEditor({
        editable: !readOnly,
        extensions: [
            StarterKit.configure({
                // Yjs `y-prosemirror` plugs in its own undo redo via
                // `Collaboration` — TipTap's history would conflict.
                history: false,
                // We register lowlight code blocks below.
                codeBlock: false,
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                autolink: true,
                HTMLAttributes: {
                    rel: "noopener noreferrer",
                    target: "_blank",
                },
            }),
            Image.configure({
                inline: false,
                allowBase64: true,
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Table.configure({ resizable: true, lastColumnResizable: false }),
            TableRow,
            TableCell,
            TableHeader,
            CodeBlockLowlight.configure({ lowlight }),
            Typography,
            CharacterCount,
            Highlight.configure({ multicolor: false }),
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            Placeholder.configure({
                placeholder: placeholder ?? 'Type "/" for commands, or just start writing…',
                showOnlyWhenEditable: true,
                showOnlyCurrent: true,
            }),
            Collaboration.configure({ fragment: xmlFragment }),
            // CollaborationCursor only mounts when a y-websocket provider
            // is supplied — otherwise we'd be writing awareness updates
            // into a doc that isn't being shared, which is harmless but
            // wasteful. The cursor extension reads each peer's `user`
            // field from awareness state and paints a colored caret +
            // a labeled chip.
            ...(provider
                ? [
                    CollaborationCursor.configure({
                        provider,
                        user: provider.awareness.getLocalState()?.user ?? {
                            name: "User",
                            color: "#3b82f6",
                        },
                    }),
                ]
                : []),
            createSlashSuggestion(),
        ],
        editorProps: {
            attributes: {
                class: styles.editor,
                spellCheck: "true",
            },
        },
    }, [xmlFragment, readOnly, provider]);
    /* expose imperative API to the host iframe */
    useImperativeHandle(ref, () => ({
        async exportSnapshot() {
            const html = editor?.getHTML() ?? "";
            const wrapped = `<!doctype html><meta charset="utf-8"><body>${html}</body>`;
            return {
                bytes: new TextEncoder().encode(wrapped),
                contentType: "text/html",
            };
        },
        getText: () => editor?.getText() ?? "",
        focus: () => editor?.commands.focus(),
    }), [editor]);
    /* keyboard shortcut: Cmd+K opens link prompt on selection */
    useEffect(() => {
        if (!editor)
            return;
        const handler = (e) => {
            const meta = e.metaKey || e.ctrlKey;
            if (meta && e.key === "k") {
                e.preventDefault();
                const { from, to } = editor.state.selection;
                if (from === to)
                    return;
                const prev = editor.getAttributes("link").href;
                const url = window.prompt("URL", prev ?? "https://");
                if (url === null)
                    return;
                if (url === "") {
                    editor.chain().focus().extendMarkRange("link").unsetLink().run();
                }
                else {
                    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                }
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [editor]);
    const charCount = editor?.storage.characterCount?.characters() ?? 0;
    const wordCount = editor?.storage.characterCount?.words() ?? 0;
    return (_jsxs("div", { className: styles.shell, children: [!readOnly && editor && _jsx(Toolbar, { editor: editor }), editor && _jsx(FormatBubble, { editor: editor }), _jsx("div", { className: styles.canvas, children: _jsx(EditorContent, { editor: editor, className: styles.editor }) }), errorMsg && (_jsx("div", { className: styles.error, role: "alert", children: errorMsg })), _jsxs("div", { className: styles.statusBar, children: [_jsxs("span", { className: styles.statusItem, children: [_jsx("span", { className: styles.statusDot, "data-status": status }), STATUS_LABEL[status]] }), _jsxs("span", { className: styles.statusItem, children: [wordCount.toLocaleString(), " words \u00B7 ", charCount.toLocaleString(), " characters"] })] })] }));
    /* eslint-enable react-hooks/exhaustive-deps */
});
BlockEditor.displayName = "BlockEditor";
const STATUS_LABEL = {
    loading: "Loading…",
    ready: "Ready",
    saving: "Saving…",
    saved: "Saved",
    retrying: "Retrying…",
    error: "Save failed",
};
/* ------------------------------------------------------------------ */
/*  Toolbar (the static one at the top — bubble menu handles inline)   */
/* ------------------------------------------------------------------ */
const Toolbar = ({ editor }) => {
    const setHeading = useCallback((level) => editor.chain().focus().toggleHeading({ level }).run(), [editor]);
    return (_jsxs("div", { className: styles.toolbar, role: "toolbar", "aria-label": "Editor toolbar", children: [_jsxs("div", { className: styles.toolbarGroup, children: [_jsx(ToolbarButton, { onClick: () => editor.chain().focus().undo().run(), disabled: !editor.can().undo(), title: "Undo \u2318Z", children: _jsx(Undo, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().redo().run(), disabled: !editor.can().redo(), title: "Redo \u2318\u21E7Z", children: _jsx(Redo, { size: ICON }) })] }), _jsxs("div", { className: styles.toolbarGroup, children: [_jsx(ToolbarButton, { onClick: () => editor.chain().focus().setParagraph().run(), active: editor.isActive("paragraph") && !editor.isActive("heading"), title: "Paragraph", children: _jsx(Pilcrow, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => setHeading(1), active: editor.isActive("heading", { level: 1 }), title: "Heading 1", children: _jsx(Heading1, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => setHeading(2), active: editor.isActive("heading", { level: 2 }), title: "Heading 2", children: _jsx(Heading2, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => setHeading(3), active: editor.isActive("heading", { level: 3 }), title: "Heading 3", children: _jsx(Heading3, { size: ICON }) })] }), _jsxs("div", { className: styles.toolbarGroup, children: [_jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold"), title: "Bold \u2318B", children: _jsx(Bold, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic"), title: "Italic \u2318I", children: _jsx(Italic, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive("underline"), title: "Underline \u2318U", children: _jsx(UnderlineIcon, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive("strike"), title: "Strikethrough", children: _jsx(Strikethrough, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleCode().run(), active: editor.isActive("code"), title: "Inline code \u2318E", children: _jsx(Code, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleHighlight().run(), active: editor.isActive("highlight"), title: "Highlight", children: _jsx(Highlighter, { size: ICON }) })] }), _jsxs("div", { className: styles.toolbarGroup, children: [_jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList"), title: "Bullet list", children: _jsx(List, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList"), title: "Numbered list", children: _jsx(ListOrdered, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive("taskList"), title: "Task list", children: _jsx(ListChecks, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote"), title: "Quote", children: _jsx(Quote, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive("codeBlock"), title: "Code block", children: _jsx(Code2, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().setHorizontalRule().run(), title: "Divider", children: _jsx(Minus, { size: ICON }) })] }), _jsxs("div", { className: styles.toolbarGroup, children: [_jsx(ToolbarButton, { onClick: () => editor.chain().focus().setTextAlign("left").run(), active: editor.isActive({ textAlign: "left" }), title: "Align left", children: _jsx(AlignLeft, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().setTextAlign("center").run(), active: editor.isActive({ textAlign: "center" }), title: "Align center", children: _jsx(AlignCenter, { size: ICON }) }), _jsx(ToolbarButton, { onClick: () => editor.chain().focus().setTextAlign("right").run(), active: editor.isActive({ textAlign: "right" }), title: "Align right", children: _jsx(AlignRight, { size: ICON }) })] })] }));
};
