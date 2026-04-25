/** Slash menu — typed `/` inside the editor opens a popup of insertable
 *  blocks (heading, list, code, quote, …). Built on TipTap's
 *  `Suggestion` extension which handles the trigger char + character
 *  capture. We render the floating popup ourselves with `tippy.js` and
 *  a small React component that maintains keyboard focus + arrow nav.
 *
 *  Why our own instead of TipTap Pro's: their pro one is paid, and the
 *  surface area we need (block insertion) is small enough that
 *  rolling our own keeps the dependency graph trim and matches our
 *  admin-shell visual language. */
import React, { forwardRef, useImperativeHandle, useEffect, useState } from "react";
import { Editor, Range } from "@tiptap/core";
import {
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks,
  Code, Code2, Quote, Minus, Image as ImageIcon, Table as TableIcon,
  Pilcrow,
  type LucideIcon,
} from "lucide-react";
import styles from "./BlockEditor.module.css";

export interface SlashMenuItem {
  id: string;
  title: string;
  description: string;
  group: string;
  /** Use Lucide's exported icon type so we accept any of their
   *  `ForwardRefExoticComponent<LucideProps>` icons without TS
   *  variance complaints around the `size` PropTypes signature. */
  icon: LucideIcon;
  searchTerms: string[];
  command: (props: { editor: Editor; range: Range }) => void;
}

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  {
    id: "paragraph",
    title: "Text",
    description: "Plain paragraph",
    group: "Basic",
    icon: Pilcrow,
    searchTerms: ["text", "paragraph", "p"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    id: "heading1",
    title: "Heading 1",
    description: "Top-level title",
    group: "Basic",
    icon: Heading1,
    searchTerms: ["h1", "heading", "title", "large"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    id: "heading2",
    title: "Heading 2",
    description: "Section heading",
    group: "Basic",
    icon: Heading2,
    searchTerms: ["h2", "heading", "section"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    id: "heading3",
    title: "Heading 3",
    description: "Subsection heading",
    group: "Basic",
    icon: Heading3,
    searchTerms: ["h3", "heading", "subsection"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    id: "bulletList",
    title: "Bullet list",
    description: "Unordered list",
    group: "Lists",
    icon: List,
    searchTerms: ["bullet", "list", "ul", "unordered"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "orderedList",
    title: "Numbered list",
    description: "Ordered list",
    group: "Lists",
    icon: ListOrdered,
    searchTerms: ["numbered", "list", "ol", "ordered", "1"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "taskList",
    title: "Task list",
    description: "Checklist with checkboxes",
    group: "Lists",
    icon: ListChecks,
    searchTerms: ["task", "todo", "checklist", "checkbox"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: "codeBlock",
    title: "Code block",
    description: "Multi-line code with syntax highlight",
    group: "Code",
    icon: Code2,
    searchTerms: ["code", "snippet", "block", "syntax"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: "inlineCode",
    title: "Inline code",
    description: "`monospace` text",
    group: "Code",
    icon: Code,
    searchTerms: ["code", "inline", "mono"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCode().run(),
  },
  {
    id: "blockquote",
    title: "Quote",
    description: "Blockquote",
    group: "Other",
    icon: Quote,
    searchTerms: ["quote", "blockquote", "citation"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setBlockquote().run(),
  },
  {
    id: "horizontalRule",
    title: "Divider",
    description: "Horizontal rule",
    group: "Other",
    icon: Minus,
    searchTerms: ["divider", "rule", "hr", "separator", "line"],
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    id: "table",
    title: "Table",
    description: "3×3 table you can resize",
    group: "Other",
    icon: TableIcon,
    searchTerms: ["table", "grid", "rows", "columns"],
    command: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    id: "image",
    title: "Image",
    description: "Insert an image by URL",
    group: "Media",
    icon: ImageIcon,
    searchTerms: ["image", "img", "picture", "photo"],
    command: ({ editor, range }) => {
      const url = window.prompt("Image URL");
      if (!url) {
        editor.chain().focus().deleteRange(range).run();
        return;
      }
      editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
    },
  },
];

export function filterSlashItems(query: string): SlashMenuItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_MENU_ITEMS;
  return SLASH_MENU_ITEMS.filter((item) => {
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.searchTerms.some((t) => t.includes(q))) return true;
    return false;
  });
}

export interface SlashMenuListProps {
  items: SlashMenuItem[];
  command: (item: SlashMenuItem) => void;
}

export interface SlashMenuListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashMenuList = forwardRef<SlashMenuListHandle, SlashMenuListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when item set changes (e.g., after typing).
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const select = (index: number) => {
      const item = items[index];
      if (item) command(item);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          select(selectedIndex);
          return true;
        }
        return false;
      },
    }), [items, selectedIndex]);

    if (items.length === 0) {
      return (
        <div className={styles.slashMenu}>
          <div className={styles.slashMenuEmpty}>No matching blocks</div>
        </div>
      );
    }

    // Group items by their `group` field, preserving original order.
    const groups = new Map<string, SlashMenuItem[]>();
    for (const item of items) {
      const list = groups.get(item.group) ?? [];
      list.push(item);
      groups.set(item.group, list);
    }

    let runningIndex = 0;
    return (
      <div className={styles.slashMenu}>
        {Array.from(groups.entries()).map(([group, groupItems]) => (
          <div key={group}>
            <div className={styles.slashMenuGroup}>{group}</div>
            {groupItems.map((item) => {
              const isSelected = runningIndex === selectedIndex;
              const myIndex = runningIndex++;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className={styles.slashMenuItem}
                  data-selected={isSelected || undefined}
                  onMouseEnter={() => setSelectedIndex(myIndex)}
                  onMouseDown={(e) => { e.preventDefault(); select(myIndex); }}
                >
                  <span className={styles.slashMenuItemIcon}>
                    <Icon size={16} />
                  </span>
                  <span className={styles.slashMenuItemText}>
                    <span className={styles.slashMenuItemTitle}>{item.title}</span>
                    <span className={styles.slashMenuItemDescription}>{item.description}</span>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
);
SlashMenuList.displayName = "SlashMenuList";
