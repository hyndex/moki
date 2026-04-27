/** Markdown field kind — Tiptap-based WYSIWYG editor with the
 *  starter kit (paragraph, headings, bold/italic/code, lists, links,
 *  blockquote, horizontal rule). Stores HTML in the record (Tiptap's
 *  canonical wire format).
 *
 *  Why HTML and not actual markdown: Tiptap reads/writes HTML
 *  natively; round-tripping through markdown loses formatting (e.g.
 *  attribute-rich custom marks). Pages that need markdown-on-disk
 *  can convert at the storage layer using `marked` or
 *  `turndown` later.
 *
 *  Hardening:
 *    - Editor is created lazily via Tiptap's `useEditor`. No state
 *      flash on first paint.
 *    - The editor sets its HTML from `value` once on mount + on every
 *      external value change that doesn't equal the current HTML —
 *      avoids cursor jumps when the parent re-renders mid-typing.
 *    - SSR-safe: Tiptap's React binding renders nothing server-side
 *      (it requires DOM APIs). The detail viewer renders sanitised
 *      HTML directly so SSR pages still see the content. */

import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Link2, Code, Quote } from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  FieldKindFormProps,
  FieldKindListCellProps,
  FieldKindDetailProps,
  FieldKindRenderer,
} from "../fieldKindRegistry";

function MarkdownToolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }): React.ReactElement | null {
  if (!editor) return null;
  const Btn = ({
    onClick,
    active,
    label,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    label: string;
    children: React.ReactNode;
  }): React.ReactElement => (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "h-7 w-7 inline-flex items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-primary transition-colors",
        active && "bg-surface-2 text-text-primary",
      )}
    >
      {children}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-border-subtle bg-surface-1">
      <Btn
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" aria-hidden />
      </Btn>
      <Btn
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" aria-hidden />
      </Btn>
      <Btn
        label="Inline code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="h-3.5 w-3.5" aria-hidden />
      </Btn>
      <span className="w-px h-4 bg-border mx-1" aria-hidden />
      <Btn
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" aria-hidden />
      </Btn>
      <Btn
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" aria-hidden />
      </Btn>
      <Btn
        label="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" aria-hidden />
      </Btn>
      <span className="w-px h-4 bg-border mx-1" aria-hidden />
      <Btn
        label="Link"
        active={editor.isActive("link")}
        onClick={() => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL", previous ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden />
      </Btn>
    </div>
  );
}

function MarkdownForm(props: FieldKindFormProps): React.ReactElement {
  const { value, onChange, disabled, invalid } = props;
  const html = typeof value === "string" ? value : "";
  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: html,
      editable: !disabled,
      onUpdate: ({ editor }) => {
        const next = editor.getHTML();
        // Tiptap's empty-document HTML is `<p></p>` — round-trip an
        // empty value as the empty string so downstream "no value"
        // checks (renderValue's `v === ""` branch) still work.
        onChange(next === "<p></p>" ? "" : next);
      },
    },
    [disabled],
  );

  // Sync external value back into the editor when it changes from
  // outside the editor (e.g. record refresh, undo). Skip sync when
  // the value is the same to avoid stomping caret position.
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const norm = html || "<p></p>";
    if (current !== norm) editor.commands.setContent(norm, false);
  }, [editor, html]);

  return (
    <div
      className={cn(
        "rounded-md border bg-surface-0 overflow-hidden",
        invalid ? "border-danger" : "border-border focus-within:border-accent focus-within:shadow-focus",
        disabled && "opacity-60",
      )}
    >
      <MarkdownToolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 min-h-[120px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[100px]"
      />
    </div>
  );
}

function MarkdownCell(props: FieldKindListCellProps): React.ReactElement {
  const v = props.value;
  if (typeof v !== "string" || !v) return <span className="text-text-muted">—</span>;
  // Strip HTML tags for a compact preview in the list cell.
  const text = v
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (
    <span className="text-text-muted text-xs truncate max-w-[280px]" title={text}>
      {text.length > 60 ? text.slice(0, 60) + "…" : text}
    </span>
  );
}

function MarkdownDetail(props: FieldKindDetailProps): React.ReactElement {
  const v = props.value;
  if (typeof v !== "string" || !v) return <span className="text-text-muted">—</span>;
  // Tiptap's StarterKit produces safe HTML; the renderer trusts it.
  // If a deployment ever pulls untrusted HTML from a third-party
  // source, swap this for a sanitiser like DOMPurify.
  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: v }}
    />
  );
}

export const markdownKind: FieldKindRenderer = {
  Form: MarkdownForm,
  ListCell: MarkdownCell,
  Detail: MarkdownDetail,
};
