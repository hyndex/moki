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
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { common, createLowlight } from "lowlight";
import * as Y from "yjs";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Link as LinkIcon, Highlighter,
  AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Code2, Minus,
  Undo, Redo, Pilcrow,
} from "lucide-react";
import { createSlashSuggestion } from "./slash-suggestion";
import styles from "./BlockEditor.module.css";

// `lowlight` is the bridge between ProseMirror's code-block schema and
// highlight.js. `common` registers the most-used languages out of the
// box (js/ts/python/json/css/html/etc.) — keeps bundle tight.
const lowlight = createLowlight(common);

export type SaveStatus =
  | "loading"
  | "ready"
  | "saving"
  | "saved"
  | "retrying"
  | "error";

export interface BlockEditorHandle {
  /** Snapshot the current document as HTML (for storage / export). */
  exportSnapshot: () => Promise<{ bytes: Uint8Array; contentType: string }>;
  /** Get plain text (for search indexing / character count). */
  getText: () => string;
  /** Force focus into the editor canvas. */
  focus: () => void;
}

interface Props {
  /** The shared Y.Doc that backs the editor state. */
  doc: Y.Doc;
  /** Y.Doc XmlFragment field name — defaults to "page-tree". */
  fragment?: string;
  /** Save status indicator from the host (drives the status pill). */
  status: SaveStatus;
  /** Server-reported error (drives the error banner). */
  errorMsg: string | null;
  /** Optional placeholder text. */
  placeholder?: string;
  /** Read-only mode (no toolbar, no edits). */
  readOnly?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Toolbar                                                            */
/* ------------------------------------------------------------------ */

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  active,
  disabled,
  title,
  children,
}) => (
  <button
    type="button"
    className={styles.toolbarButton}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    data-active={active || undefined}
    disabled={disabled}
    title={title}
    aria-label={title}
  >
    {children}
  </button>
);

const ICON = 16;

/* ------------------------------------------------------------------ */
/*  Bubble menu (formatting popup over a selection)                    */
/* ------------------------------------------------------------------ */

const FormatBubble: React.FC<{ editor: ReturnType<typeof useEditor> }> = ({ editor }) => {
  if (!editor) return null;
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100, placement: "top" }}
      shouldShow={({ editor: ed, view, state, from, to }) => {
        if (!view.hasFocus()) return false;
        if (from === to) return false;
        // Don't show inside code blocks (Cmd+B etc. don't apply there).
        if (ed.isActive("codeBlock")) return false;
        return state.doc.textBetween(from, to).trim().length > 0;
      }}
      className={styles.bubbleMenu}
    >
      <button
        type="button"
        className={styles.bubbleMenuButton}
        data-active={editor.isActive("bold") || undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold ⌘B"
      >
        <Bold size={ICON} />
      </button>
      <button
        type="button"
        className={styles.bubbleMenuButton}
        data-active={editor.isActive("italic") || undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic ⌘I"
      >
        <Italic size={ICON} />
      </button>
      <button
        type="button"
        className={styles.bubbleMenuButton}
        data-active={editor.isActive("underline") || undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline ⌘U"
      >
        <UnderlineIcon size={ICON} />
      </button>
      <button
        type="button"
        className={styles.bubbleMenuButton}
        data-active={editor.isActive("strike") || undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <Strikethrough size={ICON} />
      </button>
      <span className={styles.bubbleMenuDivider} />
      <button
        type="button"
        className={styles.bubbleMenuButton}
        data-active={editor.isActive("code") || undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code ⌘E"
      >
        <Code size={ICON} />
      </button>
      <button
        type="button"
        className={styles.bubbleMenuButton}
        data-active={editor.isActive("highlight") || undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="Highlight"
      >
        <Highlighter size={ICON} />
      </button>
      <button
        type="button"
        className={styles.bubbleMenuButton}
        data-active={editor.isActive("link") || undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={setLink}
        title="Link ⌘K"
      >
        <LinkIcon size={ICON} />
      </button>
    </BubbleMenu>
  );
};

/* ------------------------------------------------------------------ */
/*  BlockEditor (main component)                                       */
/* ------------------------------------------------------------------ */

export const BlockEditor = forwardRef<BlockEditorHandle, Props>(
  ({ doc, fragment = "page-tree", status, errorMsg, placeholder, readOnly }, ref) => {
    /* eslint-disable react-hooks/exhaustive-deps */
    // The editor is intentionally created once per doc/fragment combo.
    // Recreating it would lose cursor + collab state. The `extensions`
    // array is a constant — referencing `doc`/`fragment` outside the
    // factory is safe because TipTap already snapshots them on mount.

    // Build Yjs xml fragment lazily so we never depend on it across
    // recreations. y-prosemirror will share state through it.
    const xmlFragment = useMemo(() => doc.getXmlFragment(fragment), [doc, fragment]);

    const editor = useEditor(
      {
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
          createSlashSuggestion(),
        ],
        editorProps: {
          attributes: {
            class: styles.editor,
            spellCheck: "true",
          },
        },
      },
      [xmlFragment, readOnly],
    );

    /* expose imperative API to the host iframe */
    useImperativeHandle(
      ref,
      (): BlockEditorHandle => ({
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
      }),
      [editor],
    );

    /* keyboard shortcut: Cmd+K opens link prompt on selection */
    useEffect(() => {
      if (!editor) return;
      const handler = (e: KeyboardEvent) => {
        const meta = e.metaKey || e.ctrlKey;
        if (meta && e.key === "k") {
          e.preventDefault();
          const { from, to } = editor.state.selection;
          if (from === to) return;
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL", prev ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
          } else {
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [editor]);

    const charCount = editor?.storage.characterCount?.characters() ?? 0;
    const wordCount = editor?.storage.characterCount?.words() ?? 0;

    return (
      <div className={styles.shell}>
        {!readOnly && editor && <Toolbar editor={editor} />}
        {editor && <FormatBubble editor={editor} />}
        <div className={styles.canvas}>
          <EditorContent editor={editor} className={styles.editor} />
        </div>
        {errorMsg && (
          <div className={styles.error} role="alert">
            {errorMsg}
          </div>
        )}
        <div className={styles.statusBar}>
          <span className={styles.statusItem}>
            <span className={styles.statusDot} data-status={status} />
            {STATUS_LABEL[status]}
          </span>
          <span className={styles.statusItem}>
            {wordCount.toLocaleString()} words · {charCount.toLocaleString()} characters
          </span>
        </div>
      </div>
    );
    /* eslint-enable react-hooks/exhaustive-deps */
  },
);
BlockEditor.displayName = "BlockEditor";

const STATUS_LABEL: Record<SaveStatus, string> = {
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

const Toolbar: React.FC<{ editor: NonNullable<ReturnType<typeof useEditor>> }> = ({ editor }) => {
  const setHeading = useCallback(
    (level: 1 | 2 | 3) => editor.chain().focus().toggleHeading({ level }).run(),
    [editor],
  );

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Editor toolbar">
      <div className={styles.toolbarGroup}>
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo ⌘Z"
        >
          <Undo size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo ⌘⇧Z"
        >
          <Redo size={ICON} />
        </ToolbarButton>
      </div>
      <div className={styles.toolbarGroup}>
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive("paragraph") && !editor.isActive("heading")}
          title="Paragraph"
        >
          <Pilcrow size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(1)}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(2)}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => setHeading(3)}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={ICON} />
        </ToolbarButton>
      </div>
      <div className={styles.toolbarGroup}>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold ⌘B"
        >
          <Bold size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic ⌘I"
        >
          <Italic size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline ⌘U"
        >
          <UnderlineIcon size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline code ⌘E"
        >
          <Code size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive("highlight")}
          title="Highlight"
        >
          <Highlighter size={ICON} />
        </ToolbarButton>
      </div>
      <div className={styles.toolbarGroup}>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet list"
        >
          <List size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered list"
        >
          <ListOrdered size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive("taskList")}
          title="Task list"
        >
          <ListChecks size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code block"
        >
          <Code2 size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Divider"
        >
          <Minus size={ICON} />
        </ToolbarButton>
      </div>
      <div className={styles.toolbarGroup}>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Align left"
        >
          <AlignLeft size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Align center"
        >
          <AlignCenter size={ICON} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="Align right"
        >
          <AlignRight size={ICON} />
        </ToolbarButton>
      </div>
    </div>
  );
};
